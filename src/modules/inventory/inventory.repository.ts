import { ClientSession, Types } from 'mongoose';
import { InventoryModel, InventoryReservationModel } from './inventory.model';
import {
  IInventoryDoc,
  IInventoryReservationDoc,
  ReservationStatus,
  StockReservationRequest,
} from './inventory.types';

export class InventoryRepository {
  public async findBySku(sku: string, session?: ClientSession): Promise<IInventoryDoc | null> {
    return InventoryModel.findOne({ sku: sku.toUpperCase() }).session(session || null);
  }

  public async findByProductId(productId: string): Promise<IInventoryDoc | null> {
    if (!Types.ObjectId.isValid(productId)) return null;
    return InventoryModel.findOne({ productId: new Types.ObjectId(productId) });
  }

  public async findBySkus(skus: string[]): Promise<IInventoryDoc[]> {
    const uppercaseSkus = skus.map((s) => s.toUpperCase());
    return InventoryModel.find({ sku: { $in: uppercaseSkus } });
  }

  public async initializeStock(
    productId: string,
    sku: string,
    availableStock: number,
    lowStockThreshold = 5,
  ): Promise<IInventoryDoc> {
    return InventoryModel.create({
      productId: new Types.ObjectId(productId),
      sku: sku.toUpperCase(),
      availableStock,
      reservedStock: 0,
      lowStockThreshold,
    });
  }

  /**
   * Adjusts stock quantity (e.g. warehouse restock or physical count adjustment).
   */
  public async adjustStock(
    sku: string,
    quantityDelta: number,
    session?: ClientSession,
  ): Promise<IInventoryDoc | null> {
    return InventoryModel.findOneAndUpdate(
      {
        sku: sku.toUpperCase(),
        // If reducing stock, ensure availableStock doesn't drop below 0
        ...(quantityDelta < 0 ? { availableStock: { $gte: Math.abs(quantityDelta) } } : {}),
      },
      { $inc: { availableStock: quantityDelta } },
      { returnDocument: 'after', session: session || null },
    );
  }

  /**
   * ATOMIC CONCURRENCY ENGINE:
   * Uses atomic conditional mutation to reserve stock at the storage engine level.
   * If availableStock < quantity, the query fails atomically without overselling.
   */
  public async reserveSingleItemAtomic(
    sku: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<IInventoryDoc | null> {
    return InventoryModel.findOneAndUpdate(
      {
        sku: sku.toUpperCase(),
        availableStock: { $gte: quantity }, // Guard condition prevents race conditions
      },
      {
        $inc: {
          availableStock: -quantity,
          reservedStock: quantity,
        },
      },
      { returnDocument: 'after', session: session || null },
    );
  }

  /**
   * Atomically releases a reservation back to the available pool.
   */
  public async releaseSingleItemAtomic(
    sku: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<IInventoryDoc | null> {
    return InventoryModel.findOneAndUpdate(
      {
        sku: sku.toUpperCase(),
        reservedStock: { $gte: quantity },
      },
      {
        $inc: {
          availableStock: quantity,
          reservedStock: -quantity,
        },
      },
      { returnDocument: 'after', session: session || null },
    );
  }

  /**
   * Atomically commits a reservation upon payment completion (deducts from reserved pool).
   */
  public async commitSingleItemAtomic(
    sku: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<IInventoryDoc | null> {
    return InventoryModel.findOneAndUpdate(
      {
        sku: sku.toUpperCase(),
        reservedStock: { $gte: quantity },
      },
      {
        $inc: {
          reservedStock: -quantity,
        },
      },
      { returnDocument: 'after', session: session || null },
    );
  }

  public async createReservation(
    data: StockReservationRequest & { expiresAt: Date },
    session?: ClientSession,
  ): Promise<IInventoryReservationDoc> {
    const [reservation] = await InventoryReservationModel.create(
      [
        {
          reservationId: data.reservationId,
          orderId: data.orderId,
          items: data.items.map((i) => ({
            sku: i.sku.toUpperCase(),
            quantity: i.quantity,
          })),
          status: 'PENDING',
          expiresAt: data.expiresAt,
        },
      ],
      { session },
    );
    return reservation;
  }

  public async findReservationById(
    reservationId: string,
    session?: ClientSession,
  ): Promise<IInventoryReservationDoc | null> {
    return InventoryReservationModel.findOne({ reservationId }).session(session || null);
  }

  public async updateReservationStatus(
    reservationId: string,
    status: ReservationStatus,
    session?: ClientSession,
  ): Promise<IInventoryReservationDoc | null> {
    return InventoryReservationModel.findOneAndUpdate(
      { reservationId },
      { status },
      { returnDocument: 'after', session: session || null },
    );
  }

  public async findExpiredPendingReservations(): Promise<IInventoryReservationDoc[]> {
    const now = new Date();
    return InventoryReservationModel.find({
      status: 'PENDING',
      expiresAt: { $lte: now },
    });
  }

  public async findLowStockItems(limit = 50): Promise<IInventoryDoc[]> {
    return InventoryModel.find({
      $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
    })
      .limit(limit)
      .populate('productId', 'title slug');
  }
}

export const inventoryRepository = new InventoryRepository();
