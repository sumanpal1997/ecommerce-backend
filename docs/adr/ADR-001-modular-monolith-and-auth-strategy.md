# ADR-001: Modular Monolith Foundation & Authentication Strategy

## Status
Accepted

## Context
We are engineering a production-grade, highly scalable e-commerce platform. The system begins as a single-process deployment but must be architected such that major business domains (Auth, Catalog, Cart, Inventory, Orders, Payments) can later be carved out into independent microservices if organizational or throughput scale demands it.

Furthermore, we require a secure authentication system that provides strong resistance against password cracking, XSS token theft, and refresh token replay attacks, while ensuring that 99% of authenticated requests do not hit the database for session lookups.

## Decisions

### 1. Modular Monolith Architecture
- **Structure**: High-level separation between application bootstrapping (`src/app/`), shared infrastructure (`src/infrastructure/`), and isolated business domains (`src/modules/`).
- **Encapsulation**: Domains do not touch foreign Mongoose models directly. They communicate exclusively through exported public service interfaces or internal domain events.
- **Fail-Fast Configuration**: Environment variables are strictly validated at boot time using Zod schemas (`env.config.ts`).

### 2. Dual-Token Authentication & Cookie Security
- **Access Tokens**: Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`. Contain essential claims (`sub`, `email`, `role`). Verified completely in-memory by Express middleware with zero database overhead.
- **Refresh Tokens**: Longer-lived (7 days), signed with `JWT_REFRESH_SECRET`. Stored in an `HttpOnly`, `Secure`, `SameSite=Strict/Lax` cookie (`jid`) scoped to `/api/v1/auth`. JavaScript running in the browser cannot read this cookie, eliminating XSS token harvesting.
- **Password Hashing**: Implemented with **Argon2id** (memory cost 64MB, 3 iterations) rather than standard bcrypt. Argon2id provides superior resistance against GPU and ASIC parallel cracking.
- **Token Reuse Detection & Family Invalidation**: The User model maintains a `refreshTokenVersion`. The refresh token payload embeds this version. If an attacker replays an old token after rotation, the server detects the mismatch and immediately revokes all active sessions for that user account by incrementing `refreshTokenVersion`.

### 3. API Contract & Error Handling
- All API responses are wrapped in a predictable envelope:
  - Success: `{ success: true, data: T, message?: string, meta?: PaginationMeta }`
  - Error: `{ success: false, error: { code: string, message: string, details?: unknown }, requestId: string }`
- Centralized `errorHandler` catches custom `AppError` subclasses, Zod validation errors, MongoDB duplicate key constraints (E11000), and JWT errors. Stack traces are suppressed in production.

## Alternatives Considered
1. **Microservices from Day One**:
   - *Rejected*: Adds distributed transaction complexity, network latency, and deployment friction prematurely without traffic justification.
2. **Stateful Session Store in Redis**:
   - *Rejected for initial phase*: Introduces an external infrastructure dependency prematurely. Dual-token JWT with token versioning achieves in-memory verification speed while still retaining instant revocation capability.
3. **Storing Tokens in Browser LocalStorage**:
   - *Rejected*: LocalStorage is vulnerable to XSS. HttpOnly cookies ensure sensitive refresh tokens remain safe even if a 3rd-party script is compromised.

## Consequences
- Fast developer velocity and straightforward local development.
- In-memory database integration tests run in seconds without external dependencies.
- Clear module boundaries make microservice extraction possible in the future with zero domain logic rewrites.
