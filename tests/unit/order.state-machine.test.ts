import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from '../../src/modules/orders/order.state-machine';
import { ConflictError } from '../../src/app/errors/app-error';

describe('OrderStateMachine (Lifecycle Guard)', () => {
  it('should allow valid lifecycle transitions', () => {
    expect(OrderStateMachine.canTransition('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(OrderStateMachine.canTransition('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
    expect(OrderStateMachine.canTransition('PAID', 'PROCESSING')).toBe(true);
    expect(OrderStateMachine.canTransition('PROCESSING', 'SHIPPED')).toBe(true);
    expect(OrderStateMachine.canTransition('SHIPPED', 'DELIVERED')).toBe(true);
    expect(OrderStateMachine.canTransition('DELIVERED', 'REFUNDED')).toBe(true);
  });

  it('should reject invalid lifecycle transitions with ConflictError', () => {
    // Cannot skip payment to shipped
    expect(() =>
      OrderStateMachine.validateTransition('PENDING_PAYMENT', 'SHIPPED'),
    ).toThrow(ConflictError);

    // Cannot revert delivered order back to pending payment
    expect(() =>
      OrderStateMachine.validateTransition('DELIVERED', 'PENDING_PAYMENT'),
    ).toThrow(ConflictError);

    // Terminal states cannot transition
    expect(() =>
      OrderStateMachine.validateTransition('CANCELLED', 'PAID'),
    ).toThrow(ConflictError);

    expect(() =>
      OrderStateMachine.validateTransition('REFUNDED', 'DELIVERED'),
    ).toThrow(ConflictError);
  });
});
