import { Types } from 'mongoose';
import { CartModel } from './cart.model';
import { ICart, ICartDoc, ICartItem } from './cart.types';

export class CartRepository {
  public async findByUserId(userId: string): Promise<ICartDoc | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return CartModel.findOne({ userId: new Types.ObjectId(userId) });
  }

  public async findByGuestId(guestId: string): Promise<ICartDoc | null> {
    if (!guestId) return null;
    return CartModel.findOne({ guestId });
  }

  public async create(data: Partial<ICart>): Promise<ICartDoc> {
    return CartModel.create(data);
  }

  public async updateItems(cartId: string, items: ICartItem[]): Promise<ICartDoc | null> {
    if (!Types.ObjectId.isValid(cartId)) return null;
    return CartModel.findByIdAndUpdate(
      cartId,
      { items },
      { returnDocument: 'after' },
    );
  }

  public async deleteById(cartId: string): Promise<void> {
    if (!Types.ObjectId.isValid(cartId)) return;
    await CartModel.findByIdAndDelete(cartId);
  }

  public async clearCart(cartId: string): Promise<ICartDoc | null> {
    if (!Types.ObjectId.isValid(cartId)) return null;
    return CartModel.findByIdAndUpdate(
      cartId,
      { items: [] },
      { returnDocument: 'after' },
    );
  }
}

export const cartRepository = new CartRepository();
