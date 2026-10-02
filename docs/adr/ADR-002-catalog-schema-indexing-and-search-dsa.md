# ADR-002: Catalog Domain, Compound Indexing & Search DSA

## Status
Accepted

## Context
E-commerce catalogs face demanding read traffic. Customers browse deeply nested category hierarchies, filter by multiple facets (category, price range, brand), and expect instant search suggestions as they type. Naive implementations suffer from three critical bottlenecks:
1. **$N+1$ Query Cascades**: Recursive database lookups to assemble nested category trees and breadcrumbs.
2. **$O(N)$ Skip Degradation**: Using `skip(offset).limit(n)` on large collections causes MongoDB to scan and discard thousands of documents in memory.
3. **Regex Search Storms**: Firing `title: { $regex: '^prefix' }` against the database on every search input keystroke consumes CPU and locks connection threads.

## Decisions

### 1. Hybrid Category Representation (Adjacency List + Materialized Path)
- Each category stores `parentId` (for direct parent/child references) and a `path` string (e.g., `/electronics/audio/headphones`).
- **Tree Construction**: All active categories are loaded in a single database query. An in-memory **$O(N)$ Hash Map Tree Construction** links children to parents in $O(1)$ time, eliminating all recursive database queries.
- **Breadcrumbs**: Computed in $O(H)$ (tree height) by splitting the materialized path without ancestor database queries.

### 2. Compound Indexing & The ESR (Equality, Sort, Range) Rule
To ensure index-covered queries without in-memory sorting:
- `{ categoryId: 1, status: 1, basePrice: 1 }`: Covers category filtering (`categoryId` = Equality, `status` = Equality) and price sorting (`basePrice` = Sort).
- `{ brand: 1, status: 1 }`: Covers brand filtering.
- `{ status: 1, createdAt: -1 }`: Covers "New Arrivals" feed.
- `{ title: 'text', description: 'text', brand: 'text' }`: Text search index.

### 3. Dual Pagination Architecture
- **Offset Pagination**: Maintained for admin data tables and pages requiring explicit page-jump navigators (`page`, `limit`).
- **Cursor Pagination**: Implemented for customer-facing infinite scrolling feeds. Queries `{ _id: { $lt: cursor } }` sorted by `{ _id: -1 }`. Operates in $O(\log N)$ time by leveraging the B-Tree index directly, maintaining constant latency whether fetching the 1st page or the 10,000th page.

### 4. Search Autocomplete: In-Memory Prefix Tree (Trie)
- Implemented an **`AutocompleteTrie`** in `src/modules/catalog/dsa/trie.ts`.
- Pre-warmed on server boot from active product titles and brands.
- Prefix search executes in $O(K + M)$ time (where $K$ is prefix length and $M$ is matching terms), completely decoupled from total catalog size $N$. Database load for typeahead suggestions is reduced to zero.

## Consequences
- Category tree queries execute in a single roundtrip with sub-10ms response times.
- Search suggestions respond in under 1ms.
- Product browsing queries are fully covered by indexes.
