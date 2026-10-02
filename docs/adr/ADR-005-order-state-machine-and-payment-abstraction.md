# ADR-005: Order State Machine, Historical Snapshots & Payment Abstraction

## Status
Accepted

## Context
Order fulfillment and payment processing are the most critical workflows in an e-commerce platform. Naive implementations face significant financial and operational risks:
1. **Changing Historical Data**: Referencing live product documents causes historical orders to reflect updated prices or modified titles if products change later.
2. **Vendor Lock-in**: Hardcoding payment gateways (like Stripe or PayPal) directly into checkout business logic makes migrating or supporting multiple regions extremely difficult.
3. **Invalid State Transitions**: Allowing arbitrary status mutations (e.g. shipping an unpaid order or refunding a cancelled order) corrupts fulfillment workflows.
4. **Duplicate Charge / Double-Transition on Webhooks**: Payment gateways guarantee at-least-once webhook delivery. If the server does not enforce idempotency, network retries can trigger duplicate state mutations.

## Decisions

### 1. Finite Order State Machine (`OrderStateMachine`)
- Explicitly models valid order state transitions:
  - `PENDING_PAYMENT` $\rightarrow$ `PAID` or `CANCELLED`
  - `PAID` $\rightarrow$ `PROCESSING`, `CANCELLED`, or `REFUNDED`
  - `PROCESSING` $\rightarrow$ `SHIPPED`, `CANCELLED`, or `REFUNDED`
  - `SHIPPED` $\rightarrow$ `DELIVERED` or `REFUNDED`
  - `DELIVERED` $\rightarrow$ `REFUNDED`
  - `CANCELLED` & `REFUNDED` $\rightarrow$ Terminal states (no further transitions permitted)
- Attempts to execute illegal transitions throw a `ConflictError`.

### 2. Historical Snapshot Modeling
- Orders embed immutable copies of product data at purchase time:
  - `productId`, `sku`, `title`, `unitPrice`, `quantity`, `subtotal`, and `image`.
  - Snapshot of shipping address and tax/shipping financial calculations.
- If a product price increases next week or a product is deleted, existing orders remain unchanged.

### 3. Pluggable Payment Provider Interface (`IPaymentProvider`)
- Checkout business logic depends on an abstraction:
  - `createPaymentIntent(params)`
  - `verifyWebhook(payload, signature)`
  - `refund(transactionId, amount)`
- Implementations include `MockPaymentProvider` (for local development and offline CI/CD) and `StripePaymentProvider` (for live credit card processing). Swapping payment providers requires zero modifications to `OrderService`.

### 4. Idempotency & Webhook Double-Transition Protection
- Clients may pass an `Idempotency-Key` during checkout to prevent duplicate order drafting from accidental double-clicks.
- Webhook events are verified against payment records: if an order is already `PAID`, duplicate webhooks return 200 OK without re-deducting warehouse stock.

### 5. Object-Level Authorization
- `getOrderById` verifies that the authenticated user matches `order.userId`. Non-admin customers attempting to inspect foreign orders are rejected with `403 Forbidden`.

## Consequences
- Orders represent legal, immutable audit records of financial transactions.
- Zero risk of invalid fulfillment state transitions.
- Testing is fast, deterministic, and network-independent via `MockPaymentProvider`.
