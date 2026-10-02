# ADR-004: Cart Domain, Server-Side Pricing & Cart Merge Algorithm

## Status
Accepted

## Context
Online shoppers routinely browse and add items to a shopping cart anonymously before registering or logging in. When a guest customer logs into an account that already contains items, their guest session cart ($M$ items) must merge seamlessly into their persistent account cart ($N$ items) without losing items, duplicating SKUs, or crashing.

Furthermore, naive cart implementations frequently trust client-submitted item prices or store stale prices in sessions, creating financial security vulnerabilities (client price tampering attacks).

## Decisions

### 1. Dual Cart Ownership Identity
- The `Cart` collection uses sparse indexing on both `userId` and `guestId`:
  - `userId`: MongoDB ObjectId for registered, logged-in customers.
  - `guestId`: UUID stored in a client-side cookie or forwarded via `X-Guest-Id` request header for anonymous shoppers.
- A single unified Cart service handles operations for both identities seamlessly through the `optionalAuthenticate` middleware.

### 2. Zero-Trust Server-Side Pricing & Stock Availability
- The client passes only `{ productId, sku, quantity }`.
- Item prices are never accepted from client requests. The Cart service evaluates current pricing (`salePrice ?? basePrice`) from the Catalog domain on every update.
- When retrieving a cart, the service cross-references live warehouse inventory via `inventoryService.getStockStatus(sku)`. If an item's requested quantity exceeds available stock, it is flagged with `isAvailable: false`, preventing checkout progression until resolved.

### 3. Practical DSA: $O(M + N)$ Hash Map Cart Merge
- When a customer logs in, `POST /api/v1/cart/merge` is dispatched with their `guestId`:
  - **Step 1**: Construct an in-memory Hash Map of the user's existing items keyed by `SKU` in $O(N)$ time.
  - **Step 2**: Iterate through the guest cart's items in $O(M)$ time:
    - If `map.has(sku)`: Increment existing quantity (`existing.quantity += guestItem.quantity`).
    - Else: Insert new item into map.
  - **Step 3**: Reassemble the merged item array in $O(M + N)$ time.
  - **Step 4**: Save the updated user cart and delete the obsolete guest cart document in a single database roundtrip.
- Replaces nested loops ($O(M \cdot N)$) with a linear-time algorithm that scales smoothly even for large industrial B2B carts.

## Consequences
- Frictionless shopping experience transitioning from anonymous browsing to checkout.
- Eliminates client-side price tampering.
- Clean bridge to Milestone 5 (Orders & Checkout).
