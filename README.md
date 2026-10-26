# NYC Income and Cultural Institution gaps

An interactive atlas of how cultural institutions are distributed across New
York City's neighborhoods, set against the things that track with them —
household income, grocery access, school outcomes, healthcare access — and
against reported crime and shootings.

The page answers one question directly: the fifth of neighborhoods with the
fewest cultural institutions per resident, and the fifth with the most, differ
by **31× in institutions** but only **1.7× in income**, **1.5× in supermarkets**,
**11 points in school proficiency** and **1.2× in clinics**. Which of those gaps
is cause and which is consequence is exactly what this app refuses to assert.

> **This application shows statistical association, not causation.** Cultural
> institutions are disproportionately sited in wealthier, already-safer
> neighborhoods, so a raw negative correlation between institutions and crime is
> close to guaranteed and tells us very little. The analytical value is in what
> remains after confounders are accounted for, and in making the confounding
> visible rather than hiding it. See [specs/007-methodology.md](specs/007-methodology.md).

## Quick start

```bash
npm install
npm run build:shared        # the BFF and web both consume this
npm run verify:sources      # validates every dataset against the live API
npm run dev                 # BFF on :4000, web on :3000
```

Open <http://localhost:3000>. No API keys are required to run the app.

### Optional credentials

Both are free and optional — copy `.env.example` to `.env` to use them.

| Variable | Effect when absent |
|---|---|
| `CENSUS_API_KEY` | Demographic features degrade to the committed cache. The Census API now rejects unkeyed requests (302 → `missing_key.html`). [Get a key](https://api.census.gov/data/key_signup.html) |
| `SOCRATA_APP_TOKEN` | Anonymous NYC Open Data rate limits apply. [Get a token](https://data.cityofnewyork.us/profile/edit/developer_settings) |

## Layout

```
packages/shared   Domain types, offense taxonomy, statistics, design tokens.
packages/bff      NestJS + GraphQL. Owns all upstream I/O and aggregation.
  common/           RejectionLog, NtaLocator, geo-point — shared by every stage
  amenities/        groceries, store grades, healthcare, schools (one file each)
  metrics/          row building, pooling, confounder model, access gaps
packages/web      React + Redux + Webpack + deck.gl.
  format/           value formatters, shared by the table and the gap panel
  app/              shell, toolbar controls, status line, layout
  features/         map, analysis (neighborhood-table, access-gaps), transparency
specs/            The specification set — read 000 first.
scripts/          verify-sources, spatial-join landmark test
data/cache/       Deterministic ingest output (committed; raw dumps are not)
```

Each collector and each pure helper is unit tested: 113 tests across the three
packages, run by `npm test`. The BFF compiles its tests to `dist` like the shared
package; the web package runs its `.ts` tests directly on Node's type stripping,
so neither needs a bundler or a DOM to test the logic.

## Specs

This project is spec-driven. The specs are the contract; the code implements them.

| Doc | Contents |
|---|---|
| [000-overview](specs/000-overview.md) | Purpose, scope, the research question stated precisely |
| [001-requirements](specs/001-requirements.md) | Functional and non-functional requirements |
| [002-data-sources](specs/002-data-sources.md) | **Verified** dataset registry, schemas, data-quality findings |
| [003-domain-model](specs/003-domain-model.md) | Entities and TypeScript contracts |
| [004-architecture](specs/004-architecture.md) | System design and the spatial-join strategy |
| [005-graphql-schema](specs/005-graphql-schema.md) | BFF GraphQL contract |
| [006-visualization](specs/006-visualization.md) | deck.gl layers, validated color, interaction |
| [007-methodology](specs/007-methodology.md) | Confounders, threats to validity, what causality would require |
| [008-task-breakdown](specs/008-task-breakdown.md) | Implementation tasks in dependency order |

## Data sources

All verified live on 2026-10-24 by `npm run verify:sources`, which fails CI if any
dataset id, required field, or offense value drifts.

| Dataset | ID | Role |
|---|---|---|
| 2020 Neighborhood Tabulation Areas | `9nt8-h7nd` | Analytical geography (262 features, 197 residential) |
| Shootings (2006–Present) | `5ucz-vwe8` | **Primary outcome** (24,310 records) |
| NYPD Complaint Data Current (YTD) | `5uac-w243` | Secondary outcome |
| NYPD Complaint Data Historic | `qgea-i56i` | Longitudinal, 2006–2019 |
| DCLA Cultural Organizations | `u35m-9t32` | Funded arts organizations |
| Facilities Database (FacDB) | `ji82-xba5` | Libraries and cultural programs |
| Tract → 2020 NTA equivalency | `hm78-6dwm` | Bridge for ACS data |
| U.S. Census ACS 5-year | Census API | Income, poverty, education, tenure, age |
| Retail Food Stores (NYS) | `9a8c-vfzj` | Grocery access — **on `data.ny.gov`** |
| Food Safety Inspections | `d6dy-3h7r` | Grocery **rating** — **on `data.ny.gov`** |
| School Quality Reports | `dnpx-dfnc` | School outcomes (ELA/Math proficiency) |
| 2019–20 School Locations | `wg9x-4ke6` | DBN → coordinates for those outcomes |
| Facilities Database (FacDB) | `ji82-xba5` | Also hospitals and clinics |

## Things that will bite you

Each of these was found by probing the live API, and each is handled in code.
Full detail in [specs/002](specs/002-data-sources.md).

- **Missing offenses are not SQL nulls.** `ofns_desc IS NULL` matches **zero**
  rows. The absent value is the literal string `'(null)'` — 18,910 rows. A naive
  null check finds nothing and the sentinel passes through as a real category.
  Those rows are recoverable from `pd_desc`.
- **Offense labels are truncated inconsistently between datasets**, producing
  near-duplicates that silently split categories: `OTHER OFFENSES RELATED TO THEF`
  vs `…THEFT`, three spellings of kidnapping. All 74 values are mapped explicitly.
- **65 of 262 NTAs are not residential** — parks, cemeteries, airports, Rikers.
  Per-capita rates there are meaningless or infinite. Filter `ntatype = '0'`.
- **Rikers Island is coded `QN0151` but belongs to the Bronx.** It is the only
  such mismatch. Never derive a borough from the NTA code prefix.
- **Crime data has no NTA field.** Assignment requires a point-in-polygon join;
  see [specs/004](specs/004-architecture.md).
- **Impossible dates.** 58 complaint rows predate 2000; the minimum is `1016-04-30`.
- **`833y-fsy8` is archived.** Most tutorials still reference it.
- **Food retail is licensed by the State, not the City.** The only citywide
  store inventory lives on `data.ny.gov`, so one dataset in the registry carries
  its own `domain`. Its `square_footage` is self-reported at licensing and never
  audited — one donut shop claims 20,000 sq ft. It is still the only signal that
  separates a supermarket from a bodega; 6.8% of NYC stores clear 10,000 sq ft.
- **School quality and school location are two datasets.** The quality file is
  keyed by DBN with no coordinates; the newest published location vintage is
  2019–20. 97.4% of schools with 2024 outcomes match; the rest are mostly
  charters that opened after 2020, and they are reported as a rejection rather
  than dropped quietly.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | BFF + web with hot reload |
| `npm run build` | Build all three packages |
| `npm run typecheck` | Strict typecheck across the monorepo |
| `npm test` | Run workspace tests |
| `npm run verify:sources` | Validate every upstream assumption |
| `python3 scripts/test-spatial-join.py` | Landmark test for the point-in-polygon join (BFF must be running) |

## Status

The analysis pipeline is implemented and running on live data.

```bash
npm install && npm run build
npm run ingest       # ~17s: spatial join, institution unification, ACS
npm run dev          # BFF :4000, web :3000
```

**Working:** ingest of 24,308 shootings and 279,384 complaints through the
point-in-polygon join; 6,425 institutions unified across DCLA and FacDB with
cross-source dedupe; empirical-Bayes smoothed rates with Poisson intervals;
confounder-adjusted residuals; quintile comparison; partial correlation; and
four map encodings (outcome, residual, bivariate, 3D extrusion).

**Amenity access** is joined per neighborhood with no Census key required:
10,928 licensed food stores (697 of them supermarkets), a current State
inspection grade for 11,675 of them, 1,256 hospitals and clinics, and 2024
ELA/Math proficiency for 1,325 schools covering 366,214 students across 196 of
the 197 residential NTAs.

**Access and rating are separate columns.** Groceries are counted *and* graded;
schools carry proficiency. Healthcare deliberately has no rating column — the
only published one covers hospitals, which are 6% of care sites and absent from
77% of neighborhoods, so the column would be blank almost everywhere. The `accessGaps` query contrasts
the least- and best-served fifths; the on-page table lists every neighborhood
with its income, groceries, schools, healthcare and institution count, each count
expanding to the institutions behind it.

**Needs a Census key to be meaningful.** Without `CENSUS_API_KEY` the pipeline
degrades to *area density* rather than per-resident rates. In that mode the
association runs backwards — institutions and incidents both concentrate in
dense neighborhoods — which is exactly the confounding the adjusted views exist
to remove. Add the key and re-run `npm run ingest`.

**Not yet built:** walkable-access exposure (currently falls back to per-capita),
CDTA re-aggregation for the MAUP check, the scatter view, and CSV export. See
[specs/008](specs/008-task-breakdown.md).

## Attribution

Data: NYC Open Data (NYPD, DCLA, DCP, DOE), NYS Department of Agriculture and
Markets, and U.S. Census Bureau ACS.
This application shows statistical associations and does not establish causation.
