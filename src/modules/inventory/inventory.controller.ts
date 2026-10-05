import { Request, Response, NextFunction } from 'express';
import { inventoryService, InventoryService } from './inventory.service';
import { sendSuccess } from '../../app/utils/api-response';

export class InventoryController {
  constructor(private readonly inventory: InventoryService = inventoryService) {}

  public adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const inventory = await this.inventory.adjustStock(req.body);
      sendSuccess(res, { inventory }, 'Stock adjusted successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sku = (req.params.sku as string).toUpperCase();
      const inventory = await this.inventory.getStockStatus(sku);
      sendSuccess(res, { inventory }, 'Stock status retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getLowStockAlerts = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const items = await this.inventory.getLowStockAlerts();
      sendSuccess(res, { items }, 'Low stock alerts retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getAllInventory = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const items = await this.inventory.getAllInventory();
      sendSuccess(res, { items }, 'All inventory items retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.inventory.reserveStock(req.body);
      sendSuccess(res, result, 'Stock reserved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public release = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.inventory.releaseReservation(req.body.reservationId);
      sendSuccess(res, null, 'Reservation released successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public commit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.inventory.commitReservation(req.body.reservationId);
      sendSuccess(res, null, 'Reservation committed successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public sweep = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sweptCount = await this.inventory.sweepExpiredReservations();
      sendSuccess(res, { sweptCount }, `Swept ${sweptCount} expired reservations`, 200);
    } catch (error) {
      next(error);
    }
  };
}

export const inventoryController = new InventoryController();
