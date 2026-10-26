# 002 — Data Source Registry

Every dataset below was **verified live against the Socrata API on 2026-10-24**.
IDs, field names, row counts and quirks are observed, not assumed. Re-run
`npm run verify:sources` to re-validate before trusting this document.

Base URLs:
- Metadata: `https://data.cityofnewyork.us/api/views/{id}.json`
- Rows (SoQL): `https://data.cityofnewyork.us/resource/{id}.json`
- GeoJSON: `https://data.cityofnewyork.us/resource/{id}.geojson`

---

## Primary datasets

### 1. Geography — 2020 Neighborhood Tabulation Areas
`9nt8-h7nd` · **262 features** · updated 2026-05-28

The analytical unit of the whole application.

Fields: `borocode`, `boroname`, `countyfips`, `nta2020`, `ntaname`, `ntaabbrev`,
`ntatype`, `cdta2020`, `cdtaname`, `shape_leng`, `shape_area`, `the_geom` (MultiPolygon)

**Critical: `ntatype` must be filtered.** Only `ntatype = '0'` are residential
neighborhoods. The rest have little or no residential population and would produce
meaningless or infinite per-capita rates:

| `ntatype` | Count | Meaning | Examples |
|---|---|---|---|
| `0` | **197** | Residential neighborhood — **use these** | Allerton, Bedford Park, Belmont |
| `9` | 40 | Park | Central Park, Alley Pond Park, Bronx Park |
| `7` | 14 | Cemetery | Green-Wood, Calvary & Mount Zion, Hart Island |
| `6` | 8 | Institutional, military or rail yard | Brooklyn Navy Yard, Fort Totten, Sunnyside Yards |
| `8` | 2 | Airport | JFK, LaGuardia |
| `5` | 1 | Correctional facility | Rikers Island |

These meanings are not documented upstream; they were established by inspecting
every feature name per type. `verify:sources` re-checks the counts.

Full GeoJSON for all 262 features is **4.38 MB** — too large to ship raw to the
browser. Must be simplified server-side (see [004-architecture.md](004-architecture.md)).

### 2. Crime — NYPD Complaint Data, Current (Year To Date)
`5uac-w243` · **279,513 rows** · 41 columns

Key fields: `cmplnt_num`, `cmplnt_fr_dt`, `cmplnt_fr_tm`, `ofns_desc`, `law_cat_cd`,
`ky_cd`, `pd_desc`, `boro_nm`, `addr_pct_cd`, `prem_typ_desc`, `loc_of_occur_desc`,
`latitude`, `longitude`, `geocoded_column` (point)

`law_cat_cd` distribution: MISDEMEANOR 145,780 · FELONY 88,009 · VIOLATION 45,724

**No NTA field.** Crime records carry lat/lon, precinct, and computed regions, but no
neighborhood code. Assigning crimes to NTAs requires a spatial join — this is the
central technical problem of the project.

Useful computed regions (server-side groupable, no join needed):
`:@computed_region_f5dn_yrer` (Community Districts), `:@computed_region_sbqj_enih`
(Police Precincts), `:@computed_region_efsh_h5xi` (Zip Codes)

### 3. Crime — NYPD Complaint Data Historic
`qgea-i56i` · 40 columns · 2006 → 2019

Same schema shape as above, for longitudinal work. Note the YTD and historic sets do
not form a continuous series without care — schema and geocoding practice changed.

### 4. Violence — Shootings (2006–Present)
`5ucz-vwe8` · **24,310 rows** · 2006-01-01 → 2026-06-30 · 13 columns

Fields: `incident_key`, `occur_date`, `occur_time`, `boro`, `precinct`,
`jurisdiction_code`, `loc_of_occur_desc`, `loc_classfctn_desc`, `location_desc`,
`latitude`, `longitude`, `x_coord_cd`, `y_coord_cd`

**This is the primary outcome measure.** Shootings are far less subject to reporting
bias than complaint data — a gunshot wound reaches a hospital and a precinct regardless
of whether the victim trusts the police. See [007-methodology.md](007-methodology.md).

> **Note:** `833y-fsy8` is the dataset most tutorials reference. It is now
> **`ARCHIVED_NYPD Shooting Incident Data (Historic)`**. Use `5ucz-vwe8`, which
> consolidates 2006–present. The archived set has 26 columns including victim and
> perpetrator race/sex/age; the live set has 13 and drops them. If demographic
> breakdowns of victims are needed, the archived set is the only source.

### 5. Cultural institutions — DCLA Cultural Organizations
`u35m-9t32` · 16 columns · updated 2026-06

Fields: `organization_name`, `address`, `city`, `state`, `postcode`, `main_phone`,
`discipline`, `council_district`, `community_board`, `borough`, `latitude`,
`longitude`, `census_tract`, `bin`, `bbl`, **`nta`**

**Has an `nta` field** — no spatial join needed.

`discipline` distribution: Theater 429 · Music 403 · Multi-Discipl Perf & Non-Perf 315 ·
Multi-Discipline Performing 244 · Dance 235 · Visual Arts 168 · **(null) 121** ·
Multi-Discipline Non-Perform 120 · Film/Video/Audio 115 · Museum 99 · Literature 63 ·
Other 50 · Folk Arts 44 · Humanities 34 · Architecture/Design 33

**Coverage bias:** this is the directory of organizations in DCLA's orbit — largely
those that have applied for or received city cultural funding. It systematically
under-represents informal and unfunded cultural spaces: church basements, social clubs,
dance studios, community radio, bodega-front galleries. In exactly the marginalized
neighborhoods this project is about, that under-count is likely worst. This is a
first-order limitation, not a footnote.

### 6. Cultural institutions — Facilities Database (FacDB)
`ji82-xba5` · 38 columns · updated 2026-04

Fields of interest: `uid`, `facname`, `address`, `boro`, `latitude`, `longitude`,
**`nta2020`**, `nta2010`, `ct2020`, `facdomain`, `facgroup`, `facsubgrp`, `factype`,
`capacity`, `optype`, `opname`, `policeprct`

**Has `nta2020`** — joins directly to the geography table.

`facdomain` distribution:

| `facdomain` | Count |
|---|---|
| EDUCATION, CHILD WELFARE, AND YOUTH | 15,420 |
| HEALTH AND HUMAN SERVICES | 5,740 |
| CORE INFRASTRUCTURE AND TRANSPORTATION | 5,489 |
| PARKS, GARDENS, AND HISTORICAL SITES | 3,677 |
| **LIBRARIES AND CULTURAL PROGRAMS** | **2,647** |
| ADMINISTRATION OF GOVERNMENT | 996 |
| PUBLIC SAFETY, EMERGENCY SERVICES, AND ADMIN OF JUSTICE | 477 |

Within `LIBRARIES AND CULTURAL PROGRAMS`:

| `facsubgrp` | Count |
|---|---|
| OTHER CULTURAL INSTITUTIONS | 2,207 |
| PUBLIC LIBRARIES | 227 |
| MUSEUMS | 139 |
| HISTORICAL SOCIETIES | 47 |
| ACADEMIC AND SPECIAL LIBRARIES | 27 |

`facsubgrp` is heavily lumped — 83% falls into one bucket. Use `factype` for finer
granularity. Consider including `PARKS, GARDENS, AND HISTORICAL SITES` and youth
programs from the education domain as a broader "civic/third-place infrastructure"
definition; this should be a user-toggleable choice, not a hardcoded one.

### 7. Crosswalk — 2020 Census Tracts to 2020 NTAs
`hm78-6dwm` · updated 2024-07-05

Fields: `geoid`, `countyfips`, `borocode`, `boroname`, `boroct2020`, `ct2020`,
`ctlabel`, `ntacode`, `ntatype`, `ntaname`, `ntaabbrev`, `cdtacode`, `cdtaname`

The bridge from tract-level census data to NTA2020. `geoid` is the 11-digit census
tract GEOID (e.g. `36005001901`) and `ntacode` is the 2020 code (e.g. `BX0101`).

---

## Socioeconomic data — the hard part

There is **no current NTA-level socioeconomic table on NYC Open Data.** Verified:

| Dataset | Problem |
|---|---|
| `swpk-hqdp` NYC Population by NTA | Last updated **2020-02-08**. Years 2000 & 2010 only. Uses **2010** NTA codes (`BX01`, 4-char). |
| `rnsn-acs2` Census Demographics at NTA level | Last updated **2020-02-08**. 2000/2010 population only. **2010** NTA codes. |
| `4mhf-duep` Heat Vulnerability Index | Keyed to `zcta20` (zip), and contains only a 1–5 `hvi` rank — no underlying variables. |

The 2010 codes (`BX01`) are **not compatible** with the 2020 NTA geometry (`BX0101`).
Boundaries were redrawn, not just renamed. Joining them is wrong.

### Chosen approach: Census API, tract → NTA2020

1. Pull ACS 5-year estimates at **census tract** level for the five NYC counties
   (state `36`; counties `005` Bronx, `047` Kings, `061` New York, `081` Queens,
   `085` Richmond).
2. Aggregate tracts to NTA2020 using the `hm78-6dwm` crosswalk.
3. Cache the result to `data/cache/` so the app runs offline afterwards.

**The Census API now requires a key.** Verified: an unkeyed request returns
HTTP 302 → `https://api.census.gov/data/missing_key.html`. This changed from the
long-standing behaviour of allowing low-volume anonymous use. Get a free key at
<https://api.census.gov/data/key_signup.html> and set `CENSUS_API_KEY` in `.env`.

Planned ACS variables (2024 ACS 5-year, `/data/2024/acs/acs5`):

| Variable | Meaning |
|---|---|
| `B01003_001E` | Total population — rate denominator |
| `B17001_002E` / `B17001_001E` | Poverty rate |
| `B19013_001E` | Median household income |
| `B02001_*` | Race/ethnicity composition |
| `B25003_002E` / `B25003_001E` | Owner-occupancy rate |
| `B15003_022E`+ | Share with bachelor's degree or higher |
| `B01001_*` | Age structure — share aged 15–24 (crime-relevant cohort) |

Aggregation rules: counts sum across tracts; **medians do not**. Median household income
must be approximated as a population-weighted mean of tract medians, and that
approximation must be labelled in the UI.

---

## Amenity access — groceries, schools, healthcare

Income alone describes a neighborhood thinly. These three measure what a
resident can actually reach. None needs a Census key, so they degrade
independently of the ACS stage.

Each is a **count of places**, or a share of a countable population. There is
deliberately no composite "opportunity index": collapsing the three into one
number hides which is missing, and the weights would be ours rather than the
data's.

### 8. Groceries — Retail Food Stores (NYS Ag & Markets)
`9a8c-vfzj` · **host `data.ny.gov`, not `data.cityofnewyork.us`**

Fields used: `license_number`, `county`, `entity_name`, `dba_name`,
`square_footage`, `georeference`

Food retail is licensed by the **State**, so there is no City dataset covering
it. This is the one entry in the registry that carries its own `domain`;
`SocrataService` takes a host override and the API is otherwise identical.

| Measured | Value |
|---|---|
| NYC rows (5 counties) | 11,159 |
| At or above 10,000 sq ft | 763 (6.8%) |
| Missing `georeference` | 227 — cannot be placed, reported as a rejection |

**Operational definition.** A store of **10,000 sq ft or more** counts as a
full-service supermarket. That is the conventional line in NYC food-access work
and in USDA food-desert analysis. It is a proxy: floor area predicts produce,
dairy and meat depth; it does not measure them.

**The known weakness.** `square_footage` is self-reported at licensing and never
audited — a donut shop in the file claims 20,000 sq ft. This is the noisiest
input in the application. It is used anyway because it is the only citywide
signal separating a supermarket from a bodega, and because the error is not
obviously correlated with income, which is what would actually bias the
comparison the app draws. A plain store count would mostly measure bodegas and
would run *opposite* to grocery access.

No NTA field: coordinates go through the same point-in-polygon join as crime.

### 8a. Grocery rating — Food Safety Inspections
`d6dy-3h7r` · **host `data.ny.gov`**

Fields used: `county`, `trade_name`, `owner_name`, `street`, `inspection_grade`,
`inspection_date`, `georeference`

| Measured | Value |
|---|---|
| NYC rows | 94,910 |
| Distinct establishments after collapsing | 11,766 |
| Current grade distribution | A 85.7%, B 4.0%, C 10.4% |
| With `georeference` | 99.3% |
| Inspection dates | 2024-08 to 2026-08 |
| Residential NTAs with a figure | 197 of 197 (min denominator 5, median 51) |

**Two collapses are mandatory, and skipping either inverts the measure.**

1. The file carries **one row per deficiency**, not per establishment. A filthy
   store contributes a dozen rows and a clean one contributes a single row, so
   counting rows ranks the worst neighborhoods best. A unit test asserts this
   directly: on the same fixture, row counting reads 25% passing where the
   collapsed figure reads 50%.
2. Establishments are inspected repeatedly. Only the **most recent** inspection
   counts; an old failure since corrected is not the store's grade today.

Establishment identity is `owner_name + trade_name + street` — trade name alone
merges chains, and street alone merges a mall.

**The counties are spelled in Title Case** here and in SHOUT CASE in the licence
file, so the filter runs through `upper()` and one constant serves both.

**What it is not.** This is a **sanitation** grade: whether a store is clean and
storing food safely. It says nothing about whether the produce is fresh, the
prices are fair, or the shelves carry anything green — which is what "a good
grocery store" usually means. It is the only store-level rating published
citywide, and it is labelled for what it measures everywhere it appears.

### 9. School outcomes — School Quality Reports + School Locations
`dnpx-dfnc` (outcomes) joined to `wg9x-4ke6` (coordinates)

This takes **two** datasets. The quality file is keyed by DBN and carries no
geography; the location file carries coordinates and no outcomes.

| Measured | Value |
|---|---|
| Schools with 2024 EMS proficiency | 1,360 |
| Distinct DBNs in the location file | 2,131 (all with coordinates) |
| Matched | 1,331 (97.4%) |
| Placed in an NTA after the spatial join | 1,325 schools, 366,214 students |
| NTAs with a figure | 196 of 197 residential |

**Metric.** `prof_pct_ela_all` and `prof_pct_mth_all` — the share of students at
**NY State Level 3–4** — for `school_year = 2024`, `report_type = 'EMS'`
(elementary and middle). Long format: one row per school per metric, so the two
subjects are pooled per school *first*, weighted by `number_of_students`, before
rolling up. A school reporting only one subject is then not under-weighted
against one reporting both.

Averaging a school's two subject enrolments leaves halves, so the stored student
count is rounded — students are whole people, and `schoolStudents` is a GraphQL
`Int`.

**Pinned vintage.** `wg9x-4ke6` is 2019–20, the newest published location file.
The 2.6% that do not match are mostly charters opened after 2020; they are
counted as a rejection rather than dropped silently. `verify:sources` warns when
a school year newer than the pinned one appears.

**What it is not.** This is where a neighborhood's schools *are*, not where its
children *go*. Choice and screening move students across neighborhood lines in
both directions, and the figure should never be read as the outcomes of the
children who live there.

### 10. Healthcare — Facilities Database
`ji82-xba5`, `facsubgrp = 'HOSPITALS AND CLINICS'` — 1,297 records

Deliberately narrow. This subgroup is where care is actually delivered:
hospitals, diagnostic and treatment centers, hospital and D&T extension clinics,
school-based clinics, child health centers. The sibling `OTHER HEALTH CARE`
subgroup (250 records) is mostly adult homes, home-care agencies and City Council
demonstration grants — real services, but not doors a resident walks into for
care, so counting them would overstate access.

Two residential `factype`s inside the subgroup are excluded as housing rather
than care: `ENRICHED HOUSING PROGRAM` and `HOSPITAL RESIDENTIAL STRUCTURE`
(38 rows rejected).

**What it is not.** A site is a site. This counts doors, not capacity, opening
hours, or whether a given clinic accepts your insurance.

### Aggregation rule for all three

Group figures are **pooled**, never averaged across neighborhoods. A mean of
per-neighborhood rates lets a 3,000-person NTA with one supermarket outweigh a
90,000-person NTA with eight, which describes neighborhoods rather than people.
`pooledRate` and `weightedMean` in `packages/shared/src/statistics.ts` are the
tested implementations.

---

## Observed data-quality issues

These are real, measured on live data — not hypothetical.

| Issue | Measurement | Handling |
|---|---|---|
| Impossible dates | 58 rows in `5uac-w243` have `cmplnt_fr_dt` before 2000; the minimum is **`1016-04-30`** (a mistyped 2016) | Reject rows outside `[2006-01-01, today]`; log counts in the ingest report |
| **Null sentinel, not SQL NULL** | `ofns_desc IS NULL` matches **0** rows; the literal string `'(null)'` matches **18,907** (historic) + **3** (current). A naive null check finds nothing and the sentinel passes through as a real category | Treat `'(null)'` as missing via `NULL_SENTINEL_VALUES`; recover the category from `pd_desc`, which **is** populated on those rows (e.g. `SALE OF UNAUTHORIZED RECORDING`, `CRIM POS WEAP 4`) |
| Truncated offense labels | `ofns_desc` is capped ~30 chars, and **the truncation differs between the current and historic datasets**, producing near-duplicate labels that would split a category if matched loosely: `OTHER OFFENSES RELATED TO THEF` vs `…THEFT`; `OTHER STATE LAWS (NON PENAL LA` vs `…LAW)`; `ADMINISTRATIVE CODE` vs `CODES`; three spellings of kidnapping | Map via explicit lookup table keyed on the truncated string; never parse or prettify |
| Offense cardinality | **74** distinct non-sentinel `ofns_desc` values across current + historic (55 in current alone) | Map all 74 explicitly; `verify:sources` fails CI on an unmapped value |
| Null `discipline` | 121 DCLA rows | Bucket as `UNKNOWN`, show in counts, never silently drop |
| Geocoding | 0 null `latitude` in current YTD — better than documented | Still guard: reject `(0,0)` and anything outside the NYC bounding box |
| Non-residential NTAs | 65 of 262 | Filter `ntatype = '0'` |
| **Transposed coordinates** | **23,988 of 24,310 shooting rows (98.7%) have `latitude` and `longitude` swapped.** The swap is time-correlated: every record from 2006-01-01 to 2025-12-31 is reversed; only the 321 rows added in 2026 are correct. Complaint datasets are unaffected (0 of 10.3M) | Resolve per row by range via `resolveCoordinatePair`. NYC's latitude band [40.4, 41.0] and longitude band [-74.3, -73.7] do not overlap, so orientation is unambiguous. Without this, a bounds check silently discards 98.7% of the city's shooting data |
| **Borough prefix mismatch** | Exactly 1 of 262 NTAs: Rikers Island is `QN0151` (Queens prefix) but `boroname` Bronx, `borocode` 2 — legally Bronx, reached via Queens | Never derive borough from `nta2020.slice(0,2)`; always read `borocode`/`boroname` |
| Daytime population | Midtown/FiDi have huge daytime populations and small residential ones, inflating per-resident rates | Flag affected NTAs in the UI; offer raw counts as an alternative denominator |

## Verified API capabilities

- **`within_polygon(geocoded_column, 'MULTIPOLYGON(...)')` works server-side.** Tested
  against `5uac-w243`; returned 7,135 for a Mott Haven test box.
- **`within_box(geocoded_column, nwLat, nwLon, seLat, seLon)` works** and returned the
  identical count for the same box — cheaper, and the preferred pre-filter.
- `$select` / `$group` / `$where` / `$order` / `$limit` / `$offset` all behave.
- `count(distinct col)` is supported.
- `.geojson` export works with `$where` filtering and returns proper MultiPolygon
  features with all properties attached.

**Caveat on `within_polygon`:** NTA polygons are detailed — a single NTA ring contained
324 coordinate pairs in testing, which is roughly 13 KB of WKT. Embedding that in a
query string risks URL length limits, and 197 such queries would be slow. The
architecture therefore uses `within_box` as a server-side pre-filter plus exact local
point-in-polygon. See [004-architecture.md](004-architecture.md).

## Licensing and attribution

NYC Open Data carries no restriction on reuse but attribution is expected. Census data
is public domain. The UI must display: *"Data: NYC Open Data (NYPD, DCLA, DCP) and U.S.
Census Bureau ACS. This application shows statistical associations and does not
establish causation."*
