import { OrderStatus } from './order.types';
import { ConflictError } from '../../app/errors/app-error';

/**
 * Valid state transitions mapping for Order lifecycle.
 */
const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [], // Terminal state
  REFUNDED: [],  // Terminal state
};

export class OrderStateMachine {
  /**
   * Verifies if a proposed status transition is legal.
   */
  public static canTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
  }

  /**
   * Asserts that a transition is legal, throwing a ConflictError if illegal.
   */
  public static validateTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new ConflictError(
        `Illegal order status transition from '${currentStatus}' to '${nextStatus}'. Allowed transitions: [${
          VALID_TRANSITIONS[currentStatus]?.join(', ') || 'None (Terminal state)'
        }]`,
      );
    }
  }
}
