import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartService } from '../../src/modules/cart/cart.service';
import { CartRepository } from '../../src/modules/cart/cart.repository';
import { ProductRepository } from '../../src/modules/catalog/product.repository';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { Types } from 'mongoose';
import { ICartDoc } from '../../src/modules/cart/cart.types';

describe('CartService (Unit & Merge Algorithm DSA)', () => {
  let cartService: CartService;
  let mockCartRepo: CartRepository;
  let mockProductRepo: ProductRepository;
  let mockInventory: InventoryService;

  const userCartId = new Types.ObjectId().toString();
  const guestCartId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const guestId = 'guest-session-uuid-123';

  const prodIdA = new Types.ObjectId();
  const prodIdB = new Types.ObjectId();
  const prodIdC = new Types.ObjectId();

  beforeEach(() => {
    mockCartRepo = {
      findByUserId: vi.fn(),
      findByGuestId: vi.fn(),
      create: vi.fn(),
      updateItems: vi.fn(),
      deleteById: vi.fn(),
      clearCart: vi.fn(),
    } as unknown as CartRepository;

    mockProductRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => ({
        _id: new Types.ObjectId(id),
        title: `Product ${id}`,
        slug: `product-${id}`,
        basePrice: 50,
        images: [{ url: 'https://example.com/p.jpg', isPrimary: true }],
        status: 'ACTIVE',
      })),
    } as unknown as ProductRepository;

    mockInventory = {
      getStockStatus: vi.fn().mockResolvedValue({ availableStock: 100 }),
    } as unknown as InventoryService;

    cartService = new CartService(mockCartRepo, mockProductRepo, mockInventory);
  });

  describe('mergeGuestCartToUser (O(M + N) Hash Map DSA)', () => {
    it('should aggregate matching items and append new items in linear time', async () => {
      // User cart has: SKU-A (qty: 2), SKU-B (qty: 1)
      const mockUserCart = {
        _id: new Types.ObjectId(userCartId),
        userId: new Types.ObjectId(userId),
        items: [
          { productId: prodIdA, sku: 'SKU-A', quantity: 2, priceSnapshot: 50 },
          { productId: prodIdB, sku: 'SKU-B', quantity: 1, priceSnapshot: 50 },
        ],
      } as unknown as ICartDoc;

      // Guest cart has: SKU-B (qty: 3), SKU-C (qty: 4)
      const mockGuestCart = {
        _id: new Types.ObjectId(guestCartId),
        guestId,
        items: [
          { productId: prodIdB, sku: 'SKU-B', quantity: 3, priceSnapshot: 50 },
          { productId: prodIdC, sku: 'SKU-C', quantity: 4, priceSnapshot: 50 },
        ],
      } as unknown as ICartDoc;

      vi.spyOn(mockCartRepo, 'findByGuestId').mockResolvedValue(mockGuestCart);
      vi.spyOn(mockCartRepo, 'findByUserId').mockResolvedValue(mockUserCart);

      const updateItemsSpy = vi
        .spyOn(mockCartRepo, 'updateItems')
        .mockImplementation(async (_id, items) => ({
          ...mockUserCart,
          items,
        } as unknown as ICartDoc));

      const deleteByIdSpy = vi.spyOn(mockCartRepo, 'deleteById');

      const result = await cartService.mergeGuestCartToUser(guestId, userId);

      // Verify updateItems was called with merged items:
      // SKU-A: 2
      // SKU-B: 1 + 3 = 4
      // SKU-C: 4
      expect(updateItemsSpy).toHaveBeenCalled();
      const updatedItems = updateItemsSpy.mock.calls[0][1];
      expect(updatedItems).toHaveLength(3);

      const itemA = updatedItems.find((i) => i.sku === 'SKU-A');
      const itemB = updatedItems.find((i) => i.sku === 'SKU-B');
      const itemC = updatedItems.find((i) => i.sku === 'SKU-C');

      expect(itemA?.quantity).toBe(2);
      expect(itemB?.quantity).toBe(4); // Aggregated!
      expect(itemC?.quantity).toBe(4); // Incorporated!

      // Verify guest cart was cleaned up
      expect(deleteByIdSpy).toHaveBeenCalledWith(guestCartId);

      // Verify calculations: 10 items total * $50 = $500 subtotal, free shipping
      expect(result.itemCount).toBe(10);
      expect(result.subtotal).toBe(500);
      expect(result.estimatedShipping).toBe(0);
      expect(result.total).toBe(500);
    });
  });
});
