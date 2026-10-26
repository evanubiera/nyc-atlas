# 001 — Requirements

## Functional

### FR-1 Map view
- FR-1.1 Render all 197 residential NTAs as a choropleth on a MapLibre basemap
- FR-1.2 Extrude NTA polygons in 3D, height bound to the selected outcome measure
- FR-1.3 Render cultural institutions as a selectable point/column layer
- FR-1.4 Hexbin aggregation layer for raw incident points at high zoom
- FR-1.5 Hover tooltip: NTA name, population, outcome rate + CI, institution count
- FR-1.6 Click an NTA to open a detail panel
- FR-1.7 Toggle layers independently; persist choices across reloads

### FR-2 Filtering
- FR-2.1 Crime category (multi-select, from the mapping in 007)
- FR-2.2 Date range (shootings 2006→present; complaints YTD and historic)
- FR-2.3 Institution scope: Narrow / Standard / Broad
- FR-2.4 Institution discipline / facility subgroup (multi-select)
- FR-2.5 Borough (multi-select)
- FR-2.6 Outcome: shootings, or any complaint category, as rate or raw count
- FR-2.7 Exposure: density, per-capita, or access
- FR-2.8 All filter state serialized to the URL so a view is shareable

### FR-3 Analysis
- FR-3.1 Bivariate choropleth of exposure × outcome
- FR-3.2 Scatter plot, NTA-level, exposure vs outcome, with confounder-adjusted overlay
- FR-3.3 Quintile comparison chart with 95% CIs
- FR-3.4 Partial correlation adjusting for the confounder set, with coefficients shown
- FR-3.5 Sensitivity toggle: re-aggregate to Community Districts (MAUP check)
- FR-3.6 Rank table, sortable, exportable to CSV
- FR-3.7 Per-neighborhood table carrying income, grocery, school and healthcare access
  beside the cultural-institution count, for every residential NTA
- FR-3.7a Where a quality rating exists for an amenity, show it as its own sortable
  column distinct from the access count — stores by inspection grade, schools by
  proficiency. Never fold a rating and a count into one score
- FR-3.8 The institution count expands in place to list the institutions behind it,
  each with its discipline or facility type
- FR-3.9 Access-gap panel contrasting the least- and best-served fifth of
  neighborhoods on each socioeconomic measure, pooled across each group

### FR-4 Transparency
- FR-4.1 Persistent Limitations panel sourced from 007
- FR-4.2 Per-NTA data provenance: which datasets contributed, when fetched
- FR-4.3 Ingest data-quality report visible in the UI (rejected rows and why)
- FR-4.4 Excluded NTAs visibly marked with the reason
- FR-4.5 Attribution line on every export

### FR-5 Data pipeline
- FR-5.1 `npm run verify:sources` validates every dataset ID, schema and field name
- FR-5.2 `npm run ingest` builds the NTA aggregate cache from source APIs
- FR-5.3 Ingest is idempotent and resumable
- FR-5.4 Ingest emits a machine-readable quality report
- FR-5.5 App runs fully offline from cache once ingest has completed
- FR-5.6 Unmapped offense codes fail the build

## Non-functional

| ID | Requirement |
|---|---|
| NFR-1 | Initial map interactive in < 3 s on a cold load over a typical broadband connection |
| NFR-2 | Sustained 60 fps while panning/zooming with the choropleth and up to 50k institution points |
| NFR-3 | Simplified NTA geometry payload < 600 KB gzipped (raw is 4.38 MB) |
| NFR-4 | No Mapbox token or any paid API key required to run the app |
| NFR-5 | Census API key optional — the app falls back to the committed cache |
| NFR-6 | Strict TypeScript, no `any` in `shared/`, no implicit `any` anywhere |
| NFR-7 | GraphQL contract generated from a single source of truth in `shared/` |
| NFR-8 | Keyboard navigable; map state reachable without a pointer; WCAG AA contrast |
| NFR-9 | Color scales colorblind-safe; never red/green as the sole encoding |
| NFR-10 | All source API calls cached server-side with documented TTLs |
| NFR-11 | Deterministic ingest: same inputs produce byte-identical cache output |

## Constraints

- Node 24, npm workspaces (no pnpm/yarn — neither is installed)
- No Docker requirement for local development
- Disk is tight (~8 GB free at scaffold time); keep `node_modules` lean and avoid
  committing raw data dumps
- Socrata applies rate limits to unauthenticated requests; an app token is optional but
  supported via `SOCRATA_APP_TOKEN`

## Acceptance

v1 is done when a user can: load the map, see 197 NTAs extruded by shooting rate with
cultural institutions overlaid, filter to a borough and a crime category, open a
neighborhood and read its rate with a confidence interval alongside its institution
count and median income, switch the exposure measure to walkable access, view the
quintile comparison, re-run it at Community District level to check MAUP, read the
limitations panel, and share the exact view by URL — with every number traceable to a
verified dataset and a documented transformation.
