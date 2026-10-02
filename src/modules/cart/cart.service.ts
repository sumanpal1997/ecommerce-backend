import { Types } from 'mongoose';
import { cartRepository, CartRepository } from './cart.repository';
import { productRepository, ProductRepository } from '../catalog/product.repository';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import {
  AddItemInput,
  UpdateQuantityInput,
} from './cart.schema';
import {
  CartSummary,
  EnrichedCartItem,
  ICartDoc,
  ICartItem,
} from './cart.types';
import { BadRequestError, ConflictError, NotFoundError } from '../../app/errors/app-error';

export class CartService {
  constructor(
    private readonly cartRepo: CartRepository = cartRepository,
    private readonly productRepo: ProductRepository = productRepository,
    private readonly inventory: InventoryService = inventoryService,
  ) {}

  /**
   * Retrieves or creates a cart associated with either a logged-in user or a guest.
   */
  public async getOrCreateCart(userId?: string, guestId?: string): Promise<ICartDoc> {
    if (!userId && !guestId) {
      throw new BadRequestError('Either userId or guestId must be provided');
    }

    if (userId) {
      const userCart = await this.cartRepo.findByUserId(userId);
      if (userCart) return userCart;
      return this.cartRepo.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }

    const guestCart = await this.cartRepo.findByGuestId(guestId!);
    if (guestCart) return guestCart;
    return this.cartRepo.create({
      guestId,
      items: [],
    });
  }

  /**
   * Adds an item to the cart. Validates product existence, current price, and available inventory.
   */
  public async addItem(
    input: AddItemInput,
    userId?: string,
    guestId?: string,
  ): Promise<CartSummary> {
    // 1. Validate Product & Price
    const product = await this.productRepo.findById(input.productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundError('Product not found or inactive');
    }

    const currentPrice = product.salePrice ?? product.basePrice;

    // 2. Validate Inventory
    const inventory = await this.inventory.getStockStatus(input.sku);
    if (inventory.availableStock < 1) {
      throw new ConflictError(`Item with SKU '${input.sku}' is currently out of stock`);
    }

    // 3. Retrieve or Create Cart
    const cart = await this.getOrCreateCart(userId, guestId);

    // 4. Update or Insert Item
    const existingItemIndex = cart.items.findIndex(
      (item) => item.sku.toUpperCase() === input.sku.toUpperCase(),
    );

    if (existingItemIndex > -1) {
      const existingItem = cart.items[existingItemIndex];
      if (existingItem) {
        const newQuantity = existingItem.quantity + input.quantity;
        if (newQuantity > inventory.availableStock) {
          throw new ConflictError(
            `Cannot add ${input.quantity} more units. Only ${inventory.availableStock} available in stock.`,
          );
        }
        existingItem.quantity = newQuantity;
        existingItem.priceSnapshot = currentPrice;
      }
    } else {
      if (input.quantity > inventory.availableStock) {
        throw new ConflictError(
          `Requested quantity (${input.quantity}) exceeds available stock (${inventory.availableStock})`,
        );
      }
      cart.items.push({
        productId: product._id,
        sku: input.sku.toUpperCase(),
        quantity: input.quantity,
        priceSnapshot: currentPrice,
      });
    }

    const updated = await this.cartRepo.updateItems(cart._id.toString(), cart.items);
    return this.enrichCart(updated || cart);
  }

  /**
   * Updates quantity of a specific item in the cart.
   */
  public async updateItemQuantity(
    input: UpdateQuantityInput,
    userId?: string,
    guestId?: string,
  ): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId, guestId);

    if (input.quantity === 0) {
      return this.removeItem(input.sku, userId, guestId);
    }

    const item = cart.items.find(
      (i) => i.sku.toUpperCase() === input.sku.toUpperCase(),
    );
    if (!item) {
      throw new NotFoundError(`Item with SKU '${input.sku}' not found in cart`);
    }

    const inventory = await this.inventory.getStockStatus(input.sku);
    if (input.quantity > inventory.availableStock) {
      throw new ConflictError(
        `Requested quantity (${input.quantity}) exceeds available stock (${inventory.availableStock})`,
      );
    }

    item.quantity = input.quantity;
    const updated = await this.cartRepo.updateItems(cart._id.toString(), cart.items);
    return this.enrichCart(updated || cart);
  }

  /**
   * Removes an item from the cart.
   */
  public async removeItem(
    sku: string,
    userId?: string,
    guestId?: string,
  ): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId, guestId);

    const filteredItems = cart.items.filter(
      (i) => i.sku.toUpperCase() !== sku.toUpperCase(),
    );

    const updated = await this.cartRepo.updateItems(cart._id.toString(), filteredItems);
    return this.enrichCart(updated || cart);
  }

  /**
   * Empties the cart.
   */
  public async clearCart(userId?: string, guestId?: string): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId, guestId);
    const updated = await this.cartRepo.clearCart(cart._id.toString());
    return this.enrichCart(updated || cart);
  }

  /**
   * Retrieves enriched cart details with live pricing, stock availability, and calculated totals.
   */
  public async getCart(userId?: string, guestId?: string): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId, guestId);
    return this.enrichCart(cart);
  }

  /**
   * DSA ALGORITHM: O(M + N) Hash Map Cart Merge.
   * Merges a guest cart (M items) into an authenticated user's cart (N items)
   * in linear time upon login or registration.
   */
  public async mergeGuestCartToUser(guestId: string, userId: string): Promise<CartSummary> {
    const guestCart = await this.cartRepo.findByGuestId(guestId);
    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId);
    }

    const userCart = await this.cartRepo.findByUserId(userId);

    // If user has no existing cart, reassign guest cart directly in O(1)
    if (!userCart) {
      guestCart.userId = new Types.ObjectId(userId);
      guestCart.guestId = null;
      await guestCart.save();
      return this.enrichCart(guestCart);
    }

    // Step 1: Build Hash Map of existing user items by SKU in O(N)
    const itemMap = new Map<string, ICartItem>();
    for (const item of userCart.items) {
      itemMap.set(item.sku.toUpperCase(), {
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        priceSnapshot: item.priceSnapshot,
      });
    }

    // Step 2: Merge guest items in O(M)
    for (const guestItem of guestCart.items) {
      const sku = guestItem.sku.toUpperCase();
      if (itemMap.has(sku)) {
        const existing = itemMap.get(sku)!;
        existing.quantity += guestItem.quantity;
      } else {
        itemMap.set(sku, {
          productId: guestItem.productId,
          sku: guestItem.sku,
          quantity: guestItem.quantity,
          priceSnapshot: guestItem.priceSnapshot,
        });
      }
    }

    // Step 3: Reconstruct merged items array in O(M + N)
    const mergedItems = Array.from(itemMap.values());

    // Update user cart and delete obsolete guest cart
    const updated = await this.cartRepo.updateItems(userCart._id.toString(), mergedItems);
    await this.cartRepo.deleteById(guestCart._id.toString());

    return this.enrichCart(updated || userCart);
  }

  /**
   * Computes live pricing snapshots, stock availability flags, and financial totals.
   */
  private async enrichCart(cart: ICartDoc): Promise<CartSummary> {
    const enrichedItems: EnrichedCartItem[] = [];
    let subtotal = 0;
    let hasUnavailableItems = false;

    for (const item of cart.items) {
      const product = await this.productRepo.findById(item.productId.toString());
      let availableStock = 0;

      try {
        const inv = await this.inventory.getStockStatus(item.sku);
        availableStock = inv.availableStock;
      } catch {
        availableStock = 0;
      }

      const isAvailable = availableStock >= item.quantity;
      if (!isAvailable) {
        hasUnavailableItems = true;
      }

      const unitPrice = product ? (product.salePrice ?? product.basePrice) : item.priceSnapshot;
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      const primaryImage = product?.images.find((img) => img.isPrimary)?.url || product?.images[0]?.url || '';

      enrichedItems.push({
        productId: item.productId.toString(),
        sku: item.sku,
        title: product?.title || 'Unknown Product',
        slug: product?.slug || '',
        image: primaryImage,
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        isAvailable,
        availableStock,
      });
    }

    // Shipping logic: Free shipping on orders of $100 or more, otherwise $10 flat rate
    const estimatedShipping = subtotal >= 100 || subtotal === 0 ? 0 : 10;
    const total = subtotal + estimatedShipping;

    return {
      items: enrichedItems,
      itemCount: enrichedItems.reduce((acc, curr) => acc + curr.quantity, 0),
      subtotal,
      estimatedShipping,
      total,
      hasUnavailableItems,
    };
  }
}

export const cartService = new CartService();
