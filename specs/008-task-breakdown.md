# 008 — Task Breakdown

Dependency-ordered. `[x]` complete, `[~]` scaffolded (compiles, stub logic), `[ ]` not started.

## Phase 0 — Foundation
- [x] 0.1 Verify every dataset ID, schema and field name against the live API
- [x] 0.2 Write the spec set (000–008)
- [x] 0.3 Validate the color palette with the validator, both modes
- [x] 0.4 npm workspaces monorepo, strict TS, shared tsconfig base
- [x] 0.5 `shared/` domain types and the 55-value crime-category map
- [x] 0.6 Webpack 5 + babel-loader + styled-components, dev server with HMR
- [x] 0.7 NestJS + GraphQL bootstrap, code-first schema
- [x] 0.8 `verify:sources` script wired to `npm run`

## Phase 1 — Data layer
- [x] 1.1 Typed Socrata client: SoQL builder, pagination, retry with backoff, optional app token
- [x] 1.2 Census ACS client, key optional, graceful degradation when absent
- [x] 1.3 Tract→NTA2020 aggregation via `hm78-6dwm`; sum counts, weight medians
- [x] 1.4 NTA geometry load + Turf simplification — **122 KB gzipped**, 88% reduction from 4.38 MB
- [x] 1.5 R-tree over NTA bboxes; exact PIP against **unsimplified** geometry — 12/12 landmark fixtures pass
- [x] 1.6 Incident ingest with date validation (reject the 58 pre-2000 rows) and bbox guard
- [x] 1.7 Institution unification: DCLA ∪ FacDB, dedupe on BBL + normalized name, scope resolution
- [x] 1.8 Month-granularity aggregate cache, deterministic output (NFR-11)
- [x] 1.9 Ingest quality report — rejected rows with reasons
- [x] 1.11 Amenity ingest — grocery, healthcare and school-outcome join to NTA2020
- [x] 1.12 Socrata host override, so the State-licensed food-store file can be read
- [x] 1.13 Food-store inspection grades: collapse deficiency rows, keep the current inspection
- [x] 1.14 Deterministic school roll-up (DBN order), so repeated ingests stay byte-identical
- [ ] 1.10 Resumability from last completed page

## Phase 2 — Metrics
- [x] 2.1 Rate computation with population denominators
- [x] 2.2 Exclusion rules: `ntatype != '0'`, population < 1,000, missing demographics
- [x] 2.3 Empirical-Bayes shrinkage toward borough mean
- [x] 2.4 Poisson confidence intervals
- [ ] 2.5 Walkable-access exposure from tract centroids, 800 m
- [ ] 2.6 Daytime-population flagging for distorted denominators
- [x] 2.7 Partial correlation adjusting for the confounder set
- [x] 2.8 Quintile analysis with CIs
- [x] 2.9 Server-computed scale breaks (`ScaleHints`)
- [x] 2.11 Pooled group figures (`pooledRate`, `weightedMean`) — tested in shared
- [x] 2.12 Access-gap contrast: least- vs best-served fifth across five measures
- [ ] 2.10 CDTA re-aggregation for the MAUP sensitivity check

## Phase 3 — GraphQL
- [x] 3.1 Resolvers per 005 — neighborhoods, geometry, capabilities, provenance, resolvePoint
- [x] 3.2 Non-nullable `caveats` / `interpretation` enforcement
- [x] 3.3 Request memoization, 15 min LRU
- [x] 3.4 Provenance and quality-report resolvers, with an upstream-freshness sidecar
- [x] 3.5 bbox-bounded, row-capped `incidents` resolver
- [x] 3.6 `accessGaps` resolver; amenity fields on `NeighborhoodMetric`

## Phase 4 — Client foundation
- [x] 4.1 Redux store, RTK Query GraphQL baseQuery via `graphql-request`
- [x] 4.2 Theme tokens, light/dark under both scopes, validated palette
- [x] 4.3 Filter slice + bidirectional URL serialization
- [x] 4.4 Generated types from the GraphQL schema, with a CI staleness check

## Phase 5 — Map
- [x] 5.1 MapLibre basemap + DeckGL overlay, no token
- [x] 5.2 Extruded `GeoJsonLayer` choropleth — renders; fill is a **placeholder** until metrics land
- [x] 5.3 Institution layer, Scatterplot→Column at z12
- [x] 5.4 Hexbin incident layer, z13+, bbox-bounded
- [x] 5.5 Hover tooltips showing raw **and** smoothed rates
- [x] 5.6 Excluded NTAs at zero elevation, hatched rather than flat grey
- [x] 5.7 Neighborhood labels with surface halo, above z11.5
- [x] 5.8 Keyboard traversal of NTAs, spatial rather than alphabetical

## Phase 6 — Analysis
- [x] 6.1 Scatter: exposure vs outcome, extremes labeled
- [x] 6.2 Quintile bar chart with CI whiskers
- [x] 6.3 Bivariate choropleth + 2D legend
- [x] 6.4 Residual (diverging) map after confounder adjustment
- [x] 6.5 Rank table, sortable, with CSV export
- [x] 6.6 Table view — `NeighborhoodTable` is standing rather than behind a toggle
- [x] 6.7 Access-gap dumbbell panel, one scale per measure, validated shade pair
- [x] 6.8 Institution disclosure: count expands in place to the venues behind it

## Phase 7 — Transparency
- [x] 7.1 Persistent, non-dismissible limitations panel from 007
- [x] 7.2 Per-NTA provenance display — per measure, including the empty ones
- [x] 7.3 Quality report surfaced in the UI — rows dropped, by dataset and reason
- [x] 7.4 Attribution on every export — sources and the causation caveat ride in the file
- [x] 7.5 Enforcement-driven category caveats inline, on the map and the table

## Phase 8 — Hardening
- [x] 8.1 Unit tests — category mapping (74 values), PIP landmarks, rate math, EB shrinkage, and pooled group figures (36 tests)
- [x] 8.2 Ingest fails on an unmapped offense code, rather than writing UNKNOWN
- [ ] 8.3 Determinism test: ingest twice, diff byte-for-byte
- [ ] 8.4 Performance: 60 fps with choropleth + 50k points
- [x] 8.5 Geometry payload budget check in CI — `check-bundle-budget.mjs`, geometry and bundle
- [ ] 8.6 Axe accessibility pass
- [x] 8.7 README with setup, ingest and methodology summary

## Critical path

`1.4 → 1.5 → 1.6 → 1.8 → 2.1 → 2.3 → 5.2`

The spatial join (1.5) is the highest-risk item: it gates every metric, and a
boundary-assignment bug would be invisible in the UI while silently corrupting every
number. It needs tests against known-location fixtures before anything depends on it.

## Risks

| Risk | Mitigation |
|---|---|
| PIP misassigns boundary points | Test fixtures at known coordinates; join against unsimplified geometry only |
| Socrata rate-limits or changes schema | `verify:sources` in CI; optional app token; cache-first serving |
| Census API key unavailable | Committed fallback cache; features degrade with a visible message |
| Disk pressure (~8 GB free) | Aggregate at month granularity; never commit raw dumps; `data/raw/` gitignored |
| Causal over-reading by users | Non-nullable caveats in the contract; limitations panel; associative copy only |
| Self-reported store floor area is wrong | Threshold documented as a proxy; `verify:sources` warns if the supermarket share leaves the 2-15% band; error is not obviously income-correlated |
| Pinned school-quality vintage goes stale | `verify:sources` fails if the pinned year vanishes and warns when a newer year publishes |
| School outcomes read as "the children who live here" | Stated in the column tooltip, the measure note and 002 §9 — it is where the schools are, not where the pupils come from |
