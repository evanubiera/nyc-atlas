# 004 — Architecture

## Monorepo layout

```
nyc-census-app/
├── packages/
│   ├── shared/     TypeScript domain types, crime-category map, constants
│   ├── bff/        NestJS + GraphQL. Owns all upstream I/O and all aggregation
│   └── web/        React + Redux + Webpack + deck.gl
├── data/cache/     Ingest output (committed; small, deterministic)
├── scripts/        verify-sources, ingest
└── specs/
```

Dependency direction is strictly `web → shared ← bff`. The web client never calls
Socrata or the Census API directly: upstream rate limits, API tokens, 4.38 MB geometry
payloads and CORS all need to be handled server-side, and the BFF is where the
association-vs-causation framing is enforced in the contract.

## The central problem: assigning crimes to neighborhoods

Crime records have lat/lon but no NTA code (002 §2). 197 polygons × hundreds of
thousands of points is the core computation. Four options were evaluated against the
live API:

| Approach | Verdict |
|---|---|
| `within_polygon()` per NTA, server-side | **Works** (verified) but one NTA ring held 324 coordinate pairs ≈ 13 KB of WKT; 197 such queries risk URL-length limits and are slow |
| Group by `:@computed_region_f5dn_yrer` (Community District) | Fast and free, but 59 CDs is too coarse — it averages away the variation of interest |
| Download all points, local point-in-polygon | Correct and exact, but naive PIP is 197 × N polygon tests |
| **`within_box()` pre-filter + local exact PIP, run once at ingest** | **Chosen** |

### Chosen strategy

**Ingest-time spatial join, cached.**

1. Fetch simplified NTA geometry once; build an R-tree over NTA bounding boxes.
2. Page through incidents via `$limit`/`$offset`, selecting only needed fields.
3. For each point: R-tree lookup for candidate NTAs (usually 1–2), then exact
   `booleanPointInPolygon` from Turf against candidates only.
4. Write per-NTA, per-category, per-month aggregates to `data/cache/`.
5. Serve queries from the cache. Live Socrata calls are only for recent deltas.

This turns an O(197 × N) problem into roughly O(N log 197) and happens once rather than
per request. `within_box` is retained as a server-side pre-filter when a user pans to a
small area and wants fresh data outside the cached window.

Aggregating at **month** granularity keeps the cache small while supporting arbitrary
date-range queries by summation. Day granularity would multiply cache size ~30× for
precision the UI does not expose.

### Why not PostGIS

A spatial database is the textbook answer and would be right at larger scale. Here the
join runs once over a fixed 197-polygon geography, the output is a few megabytes of
aggregates, and adding Postgres + PostGIS would mean Docker, a migration story, and a
service to run — against an explicit constraint that local development needs no
container (001 §Constraints). If the project later needs per-address queries or
user-drawn catchments, PostGIS becomes the right call; the ingest layer is isolated
behind an interface so that swap stays cheap.

## Geometry simplification

Raw NTA GeoJSON is 4.38 MB; NFR-3 budgets < 600 KB gzipped.

- Simplify with Turf (Douglas–Peucker), tolerance tuned to preserve visible shape at
  z10–z14; target ~85% vertex reduction
- Quantize coordinates to 5 decimal places (~1 m — well beyond what the view needs)
- Keep only the properties the client uses: `nta2020`, `ntaname`, `boroname`, `ntatype`
- Serve pre-simplified from cache; never simplify per request
- **Exact (unsimplified) geometry is used for the point-in-polygon join.** Simplifying
  before the spatial join would misassign points near boundaries; simplification is a
  presentation concern only

## BFF design (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── config/              env schema + validation
├── socrata/             typed Socrata client, SoQL builder, retry, rate limiting
├── census/              ACS client (key optional), tract→NTA aggregation
├── geography/           NTA loading, simplification, R-tree, PIP
├── institutions/        DCLA + FacDB unification, dedupe, scope resolution
├── incidents/           fetch, category mapping, date validation
├── metrics/             rate computation, EB smoothing, CIs, confounder adjustment
├── ingest/              orchestration, resumability, quality report
├── cache/               disk + in-memory, documented TTLs
└── graphql/             resolvers, code-first schema
```

Code-first GraphQL (decorators on classes derived from `shared/` types) rather than
schema-first, so the TypeScript domain model stays the single source of truth (NFR-7)
and drift between schema and types is impossible.

### Caching tiers

| Tier | Contents | TTL |
|---|---|---|
| Build-time | Simplified geometry, tract crosswalk | Permanent, committed |
| Ingest cache | NTA × category × month aggregates, ACS demographics | Until re-ingest |
| Request memo | Resolved metric queries | 15 min, in-memory LRU |
| Live delta | Current-month incidents from Socrata | 1 h |

Determinism (NFR-11) means ingest must sort inputs before aggregating and must not
embed timestamps in the aggregate payload — provenance timestamps live in a sidecar
file so the data output is byte-stable.

## Web design

```
src/
├── index.tsx
├── store/              configureStore, RTK Query GraphQL api slice
├── features/
│   ├── filters/        filter slice + URL serialization
│   ├── map/            deck.gl layers, MapLibre basemap, view state
│   ├── neighborhood/   detail panel
│   ├── analysis/       scatter, quintile, bivariate legend
│   └── transparency/   limitations, provenance, quality report
├── components/         presentational, styled-components
├── theme/              tokens, light/dark, colorblind-safe scales
└── hooks/
```

**Redux Toolkit + RTK Query over Apollo Client.** The requirement is Redux, and running
Apollo's normalized cache next to a Redux store means two sources of truth. RTK Query
with a `graphql-request` baseQuery keeps one store, gives Redux DevTools over every
server interaction, and keeps filter state and server cache in the same place — which
matters because filter state is serialized to the URL (FR-2.8).

View state (camera position) is deliberately **not** in Redux — it updates at 60 fps
and would flood the store. It lives in component state, with only the debounced
committed view persisted.

## Data flow

```
Socrata ─┐
Census  ─┼─> ingest (spatial join, aggregate) ─> data/cache/
         │                                            │
         └─> live delta ────────────┐                 │
                                    v                 v
                              NestJS metrics service
                                    │
                              GraphQL (code-first)
                                    │
                              RTK Query ─> Redux store
                                    │
                         deck.gl layers <─ selectors
```

## Error handling

- Upstream failure degrades to cache with a visible staleness banner; never a blank map
- Missing `CENSUS_API_KEY` disables demographic features with an explanatory message,
  rather than failing startup (NFR-5)
- An unmapped offense code fails the **build**, not the request (FR-5.6)
- Partial ingest is resumable from the last completed page
