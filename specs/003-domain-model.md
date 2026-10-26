# 003 — Domain Model

Types live in `packages/shared/src/` and are the single source of truth for both the
BFF GraphQL schema and the web client. Nothing in this file is allowed to use `any`.

## Identifiers

```ts
type Nta2020Code = string;   // 'BX0101'  — 2020 NTA, 6 chars
type CensusTractGeoid = string; // '36005001901' — 11 digits
type BoroughCode = 1 | 2 | 3 | 4 | 5; // MN, BX, BK, QN, SI
```

NTA2010 codes (`BX01`) are deliberately **not** modelled. They are incompatible with
2020 geometry and must never enter the domain.

## Core entities

### Neighborhood
The analytical unit. One per residential NTA (197).

```ts
interface Neighborhood {
  nta2020: Nta2020Code;
  name: string;
  abbrev: string;
  borough: Borough;
  cdta2020: string;
  landAreaSqKm: number;        // derived from shape_area
  geometry: MultiPolygon;       // simplified for transport
  centroid: [number, number];
  demographics: Demographics | null;  // null when ACS unavailable
  exclusion: ExclusionReason | null;  // non-null => omit from rate displays
}

type ExclusionReason =
  | { kind: 'NON_RESIDENTIAL'; ntatype: string }
  | { kind: 'LOW_POPULATION'; population: number }
  | { kind: 'NO_DEMOGRAPHICS' };
```

`exclusion` is explicit rather than implied by absence — FR-4.4 requires excluded
neighborhoods to be visible with their reason.

### Demographics
Aggregated from census tracts via the `hm78-6dwm` crosswalk.

```ts
interface Demographics {
  population: number;
  populationDensityPerSqKm: number;
  povertyRate: number | null;          // 0..1
  medianHouseholdIncome: number | null;
  medianIncomeIsApproximated: true;    // always true; medians don't aggregate
  shareAged15to24: number | null;
  ownerOccupancyRate: number | null;
  shareBachelorsOrHigher: number | null;
  raceEthnicity: RaceEthnicityBreakdown | null;
  acsVintage: string;                  // '2023 ACS 5-year'
  contributingTracts: number;
}
```

`medianIncomeIsApproximated` is a literal `true`, not a boolean — the type system
enforces that every consumer acknowledges the approximation. See 002 §Socioeconomic.

### CulturalInstitution
Unified across DCLA and FacDB.

```ts
interface CulturalInstitution {
  id: string;                  // stable: `${source}:${sourceId}`
  name: string;
  source: 'DCLA' | 'FACDB';
  sourceId: string;
  location: [number, number];
  address: string | null;
  borough: Borough;
  nta2020: Nta2020Code | null;  // DCLA.nta / FacDB.nta2020; null if unresolvable
  scope: InstitutionScope;      // NARROW | STANDARD | BROAD
  discipline: string | null;    // DCLA discipline, null-safe
  facilityGroup: string | null; // FacDB facsubgrp
  facilityType: string | null;  // FacDB factype
  dedupeKey: string;            // bbl+normalized name, for cross-source dedupe
}

type InstitutionScope = 'NARROW' | 'STANDARD' | 'BROAD';
```

Scopes are **nested**: NARROW ⊂ STANDARD ⊂ BROAD. A record carries its narrowest
scope; filtering for BROAD includes everything.

### Incident
A crime or shooting, pre-aggregation.

```ts
interface Incident {
  id: string;
  kind: 'COMPLAINT' | 'SHOOTING';
  occurredAt: string;          // ISO date
  location: [number, number];
  nta2020: Nta2020Code | null; // assigned by spatial join, null if outside all NTAs
  category: CrimeCategory;
  lawCategory: 'FELONY' | 'MISDEMEANOR' | 'VIOLATION' | null;
  offenseDescription: string | null;  // raw ofns_desc, truncated as the source has it
  premiseType: string | null;
  precinct: number | null;
}

type CrimeCategory =
  | 'VIOLENT_PERSON' | 'VIOLENT_PROPERTY' | 'PROPERTY' | 'FRAUD'
  | 'WEAPONS' | 'DRUGS' | 'DISORDER' | 'TRAFFIC' | 'ADMINISTRATIVE'
  | 'SHOOTING' | 'UNKNOWN';
```

`SHOOTING` is its own category, not folded into `VIOLENT_PERSON` — it is the primary
outcome and comes from a separate dataset with different properties (007 §3).

### NeighborhoodMetrics
The join product the map actually consumes.

```ts
interface NeighborhoodMetrics {
  nta2020: Nta2020Code;
  period: { from: string; to: string };

  outcome: {
    measure: OutcomeMeasure;
    rawCount: number;
    ratePer100k: number | null;        // null when excluded
    smoothedRatePer100k: number | null; // empirical-Bayes shrunk; drives color
    confidenceInterval: [number, number] | null;
    isEnforcementDriven: boolean;       // true for DRUGS/DISORDER/TRAFFIC/ADMIN
  };

  exposure: {
    measure: ExposureMeasure;
    institutionCount: number;
    perSqKm: number;
    per10kResidents: number | null;
    walkableAccessShare: number | null; // 0..1, pop within 800 m
  };

  /** What a resident can reach. Independent of the Census key. */
  amenities: {
    foodStoreCount: number;
    supermarketCount: number;            // >= 10,000 sq ft
    supermarketsPer10k: number | null;
    gradedStoreCount: number;          // stores with a current inspection
    gradeAStoreCount: number;
    storeGradeShare: number | null;    // 0..1, sanitation — not food quality
    healthcareSiteCount: number;         // FacDB hospitals and clinics
    healthcareSitesPer10k: number | null;
    schoolCount: number;
    schoolStudents: number;              // integer: students, not test sittings
    schoolProficiency: number | null;    // 0..1, ELA+Math, student-weighted
  };

  denominatorWarning: 'DAYTIME_POPULATION_DOMINANT' | null;
  dataQuality: { rejectedRows: number; notes: string[] };
}

type OutcomeMeasure = { kind: 'SHOOTINGS' } | { kind: 'COMPLAINTS'; category: CrimeCategory };
type ExposureMeasure = 'DENSITY' | 'PER_CAPITA' | 'ACCESS';
```

`smoothedRatePer100k` is separate from `ratePer100k` deliberately: the raw rate is shown
in tooltips for honesty, the smoothed rate drives the color scale, because a single
shooting in a 4,000-person NTA otherwise dominates the palette (007 §7).

`amenities` carries raw counts *and* their per-10k forms. The counts are what the
table shows on hover and what group figures are pooled from; the rates are what a
single neighborhood is read by. Deriving one from the other at the point of use
would scatter the `population === null` check across every consumer.

`schoolProficiency` is `null`, never `0`, where no school reported — three
residential NTAs. Zero would read as "every student failed" and would drag any
average it touched. `storeGradeShare` is `null` on the same principle: no
inspected store is not the same as every store failing.

**Access and rating are separate fields on purpose.** `supermarketsPer10k` says
how many stores a resident can reach; `storeGradeShare` says what condition they
are in. A neighborhood can score well on one and badly on the other, and
collapsing them into a single "grocery score" would hide exactly that case.
Healthcare deliberately has no rating counterpart — see 007 §6.

### AccessGaps

The least- and best-served fifths of neighborhoods by cultural access, described
side by side. One measure per row, each carrying how it was pooled.

```ts
interface AccessGapMeasure {
  key: string;
  label: string;
  unit: 'USD' | 'PER_10K' | 'SHARE';
  lowest: number | null;    // pooled across the least-served fifth
  highest: number | null;   // pooled across the best-served fifth
  ratio: number | null;     // highest / lowest; null if either side is absent
  higherIsBetter: boolean;  // poverty and income move in opposite directions
  note: string;             // how it was pooled, and what it does not say
}
```

`higherIsBetter` exists because a ratio alone is directionless: 0.72 is an
improvement for poverty and a deficit for income. The UI phrases the gap from
this field rather than inferring it from the sign.

## Provenance

Every response carries provenance, per FR-4.2.

```ts
interface Provenance {
  datasets: Array<{
    id: string;            // 'qgea-i56i'
    name: string;
    fetchedAt: string;
    rowsUpdatedAt: string | null;
    rowCount: number | null;
  }>;
  ingestVersion: string;
  warnings: string[];
}
```

## Invariants

1. A `Neighborhood` with non-null `exclusion` must have null `ratePer100k`
2. `InstitutionScope` filtering is monotonic: BROAD ⊇ STANDARD ⊇ NARROW
3. Every `Incident.category` is the output of the explicit mapping table; `UNKNOWN`
   is reachable only for null/unmapped source values, and surfaces a warning
4. `Demographics.population` is the sum of contributing tracts; medians are weighted
   means and flagged as approximations
5. No 2010 NTA code ever appears in a domain object
