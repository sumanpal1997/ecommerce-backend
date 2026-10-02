import { inventoryRepository, InventoryRepository } from './inventory.repository';
import {
  AdjustStockInput,
  ReserveStockInput,
} from './inventory.schema';
import {
  IInventoryDoc,
  StockReservationResult,
} from './inventory.types';
import { ConflictError, NotFoundError } from '../../app/errors/app-error';

export class InventoryService {
  constructor(private readonly inventoryRepo: InventoryRepository = inventoryRepository) {}

  /**
   * Initializes inventory when a new product/SKU is added to catalog.
   */
  public async initializeStock(
    productId: string,
    sku: string,
    initialStock = 0,
    lowStockThreshold = 5,
  ): Promise<IInventoryDoc> {
    const existing = await this.inventoryRepo.findBySku(sku);
    if (existing) {
      throw new ConflictError(`Inventory for SKU '${sku}' already exists`);
    }

    return this.inventoryRepo.initializeStock(productId, sku, initialStock, lowStockThreshold);
  }

  /**
   * Adjusts available stock for warehouse operations (restocking or count adjustments).
   */
  public async adjustStock(input: AdjustStockInput): Promise<IInventoryDoc> {
    const existing = await this.inventoryRepo.findBySku(input.sku);
    if (!existing) {
      throw new NotFoundError(`Inventory record for SKU '${input.sku}' not found`);
    }

    const updated = await this.inventoryRepo.adjustStock(input.sku, input.quantityDelta);
    if (!updated) {
      throw new ConflictError(
        `Insufficient available stock for SKU '${input.sku}' to deduct ${Math.abs(input.quantityDelta)} units`,
      );
    }

    return updated;
  }

  /**
   * CONCURRENCY & RACE-CONDITION DEFENSE:
   * Reserves items atomically using storage-engine level conditional updates.
   * If any item in a multi-item checkout fails, a compensating transaction
   * releases all previously reserved items in the batch (All-or-Nothing guarantee).
   */
  public async reserveStock(input: ReserveStockInput): Promise<StockReservationResult> {
    // 1. Idempotency check: prevent duplicate reservation requests
    const existingReservation = await this.inventoryRepo.findReservationById(input.reservationId);
    if (existingReservation) {
      if (existingReservation.status === 'PENDING') {
        const inventoryRecords = await this.inventoryRepo.findBySkus(
          existingReservation.items.map((i) => i.sku),
        );
        return {
          success: true,
          reservationId: existingReservation.reservationId,
          expiresAt: existingReservation.expiresAt,
          items: existingReservation.items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            availableStockRemaining:
              inventoryRecords.find((r) => r.sku === i.sku)?.availableStock ?? 0,
          })),
        };
      }
      throw new ConflictError(
        `Reservation '${input.reservationId}' has already been ${existingReservation.status.toLowerCase()}`,
      );
    }

    // 2. Atomic Reservation Loop with Compensating Rollback
    const successfullyReserved: { sku: string; quantity: number }[] = [];
    const resultItems: { sku: string; quantity: number; availableStockRemaining: number }[] = [];

    try {
      for (const item of input.items) {
        const updated = await this.inventoryRepo.reserveSingleItemAtomic(
          item.sku,
          item.quantity,
        );

        if (!updated) {
          // Race condition caught: item has insufficient stock!
          throw new ConflictError(
            `Insufficient stock available for SKU '${item.sku}' (requested: ${item.quantity})`,
          );
        }

        successfullyReserved.push({ sku: item.sku, quantity: item.quantity });
        resultItems.push({
          sku: item.sku,
          quantity: item.quantity,
          availableStockRemaining: updated.availableStock,
        });
      }
    } catch (error) {
      // Compensating Transaction (Rollback): Release all items reserved before the failure
      for (const rollbackItem of successfullyReserved) {
        await this.inventoryRepo.releaseSingleItemAtomic(
          rollbackItem.sku,
          rollbackItem.quantity,
        );
      }
      throw error;
    }

    // 3. Persist Reservation Record with TTL
    const ttlMinutes = input.ttlMinutes || 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.inventoryRepo.createReservation({
      reservationId: input.reservationId,
      orderId: input.orderId,
      items: input.items,
      expiresAt,
    });

    return {
      success: true,
      reservationId: input.reservationId,
      expiresAt,
      items: resultItems,
    };
  }

  /**
   * Releases stock held by a pending reservation back into the available pool.
   * Triggered when a checkout is cancelled, payment fails, or reservation expires.
   */
  public async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await this.inventoryRepo.findReservationById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation '${reservationId}' not found`);
    }

    if (reservation.status === 'RELEASED') {
      return; // Idempotent
    }

    if (reservation.status !== 'PENDING') {
      throw new ConflictError(
        `Cannot release reservation with status '${reservation.status}'`,
      );
    }

    // Release each reserved item back to available stock atomically
    for (const item of reservation.items) {
      await this.inventoryRepo.releaseSingleItemAtomic(item.sku, item.quantity);
    }

    await this.inventoryRepo.updateReservationStatus(reservationId, 'RELEASED');
  }

  /**
   * Commits reserved stock upon verified payment success (removes from reserved pool).
   */
  public async commitReservation(reservationId: string): Promise<void> {
    const reservation = await this.inventoryRepo.findReservationById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation '${reservationId}' not found`);
    }

    if (reservation.status === 'COMMITTED') {
      return; // Idempotent
    }

    if (reservation.status !== 'PENDING') {
      throw new ConflictError(
        `Cannot commit reservation with status '${reservation.status}'`,
      );
    }

    // Deduct stock from reserved pool atomically
    for (const item of reservation.items) {
      await this.inventoryRepo.commitSingleItemAtomic(item.sku, item.quantity);
    }

    await this.inventoryRepo.updateReservationStatus(reservationId, 'COMMITTED');
  }

  /**
   * Sweeps and releases expired pending reservations.
   */
  public async sweepExpiredReservations(): Promise<number> {
    const expired = await this.inventoryRepo.findExpiredPendingReservations();
    let count = 0;

    for (const res of expired) {
      try {
        await this.releaseReservation(res.reservationId);
        count++;
      } catch (err) {
        console.error(`Failed to sweep expired reservation '${res.reservationId}':`, err);
      }
    }

    return count;
  }

  /**
   * Queries stock availability for a SKU.
   */
  public async getStockStatus(sku: string): Promise<IInventoryDoc> {
    const inventory = await this.inventoryRepo.findBySku(sku);
    if (!inventory) {
      throw new NotFoundError(`Inventory for SKU '${sku}' not found`);
    }
    return inventory;
  }

  /**
   * Queries low-stock items for warehouse replenishment reports.
   */
  public async getLowStockAlerts(): Promise<IInventoryDoc[]> {
    return this.inventoryRepo.findLowStockItems();
  }
}

export const inventoryService = new InventoryService();
