import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { InventoryRepository } from '../../src/modules/inventory/inventory.repository';
import { ConflictError, NotFoundError } from '../../src/app/errors/app-error';
import { IInventoryDoc, IInventoryReservationDoc } from '../../src/modules/inventory/inventory.types';
import { Types } from 'mongoose';

describe('InventoryService (Unit & Concurrency Logic)', () => {
  let inventoryService: InventoryService;
  let mockInventoryRepo: InventoryRepository;

  const mockInventory = {
    _id: new Types.ObjectId(),
    productId: new Types.ObjectId(),
    sku: 'TEST-SKU',
    availableStock: 10,
    reservedStock: 0,
    lowStockThreshold: 5,
  } as unknown as IInventoryDoc;

  beforeEach(() => {
    mockInventoryRepo = {
      findBySku: vi.fn(),
      findByProductId: vi.fn(),
      findBySkus: vi.fn(),
      initializeStock: vi.fn(),
      adjustStock: vi.fn(),
      reserveSingleItemAtomic: vi.fn(),
      releaseSingleItemAtomic: vi.fn(),
      commitSingleItemAtomic: vi.fn(),
      createReservation: vi.fn(),
      findReservationById: vi.fn(),
      updateReservationStatus: vi.fn(),
      findExpiredPendingReservations: vi.fn(),
      findLowStockItems: vi.fn(),
    } as unknown as InventoryRepository;

    inventoryService = new InventoryService(mockInventoryRepo);
  });

  describe('adjustStock', () => {
    it('should successfully increase stock on restock', async () => {
      vi.spyOn(mockInventoryRepo, 'findBySku').mockResolvedValue(mockInventory);
      vi.spyOn(mockInventoryRepo, 'adjustStock').mockResolvedValue({
        ...mockInventory,
        availableStock: 25,
      } as IInventoryDoc);

      const result = await inventoryService.adjustStock({ sku: 'TEST-SKU', quantityDelta: 15 });
      expect(result.availableStock).toBe(25);
    });

    it('should throw NotFoundError if SKU does not exist', async () => {
      vi.spyOn(mockInventoryRepo, 'findBySku').mockResolvedValue(null);

      await expect(
        inventoryService.adjustStock({ sku: 'NONEXISTENT', quantityDelta: 5 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('reserveStock with Compensating Rollback', () => {
    it('should execute compensating rollback when any item in a batch fails', async () => {
      vi.spyOn(mockInventoryRepo, 'findReservationById').mockResolvedValue(null);

      // Item 1 succeeds
      vi.spyOn(mockInventoryRepo, 'reserveSingleItemAtomic')
        .mockResolvedValueOnce({
          ...mockInventory,
          sku: 'SKU-ITEM-1',
          availableStock: 5,
        } as IInventoryDoc)
        // Item 2 fails (out of stock)
        .mockResolvedValueOnce(null);

      const releaseSpy = vi.spyOn(mockInventoryRepo, 'releaseSingleItemAtomic');

      await expect(
        inventoryService.reserveStock({
          reservationId: 'res-batch-1',
          items: [
            { sku: 'SKU-ITEM-1', quantity: 2 },
            { sku: 'SKU-ITEM-2', quantity: 1 },
          ],
        }),
      ).rejects.toThrow(ConflictError);

      // Verify that Item 1 was rolled back (released) so stock is never leaked!
      expect(releaseSpy).toHaveBeenCalledWith('SKU-ITEM-1', 2);
    });
  });

  describe('releaseReservation and commitReservation', () => {
    const pendingReservation = {
      reservationId: 'res-123',
      status: 'PENDING',
      items: [{ sku: 'TEST-SKU', quantity: 3 }],
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    } as unknown as IInventoryReservationDoc;

    it('should atomically release items back to available pool', async () => {
      vi.spyOn(mockInventoryRepo, 'findReservationById').mockResolvedValue(pendingReservation);
      const releaseSpy = vi.spyOn(mockInventoryRepo, 'releaseSingleItemAtomic');
      const updateStatusSpy = vi.spyOn(mockInventoryRepo, 'updateReservationStatus');

      await inventoryService.releaseReservation('res-123');

      expect(releaseSpy).toHaveBeenCalledWith('TEST-SKU', 3);
      expect(updateStatusSpy).toHaveBeenCalledWith('res-123', 'RELEASED');
    });

    it('should atomically commit items upon payment success', async () => {
      vi.spyOn(mockInventoryRepo, 'findReservationById').mockResolvedValue(pendingReservation);
      const commitSpy = vi.spyOn(mockInventoryRepo, 'commitSingleItemAtomic');
      const updateStatusSpy = vi.spyOn(mockInventoryRepo, 'updateReservationStatus');

      await inventoryService.commitReservation('res-123');

      expect(commitSpy).toHaveBeenCalledWith('TEST-SKU', 3);
      expect(updateStatusSpy).toHaveBeenCalledWith('res-123', 'COMMITTED');
    });
  });
});
