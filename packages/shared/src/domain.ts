import type { Borough, Nta2020Code } from './geography.js';
import type { CrimeCategory } from './crime-categories.js';

export type Coordinate = readonly [lon: number, lat: number];

export interface BBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

export type ExclusionReason =
  | { readonly kind: 'NON_RESIDENTIAL'; readonly ntatype: string }
  | { readonly kind: 'LOW_POPULATION'; readonly population: number }
  | { readonly kind: 'NO_DEMOGRAPHICS' };

export interface Neighborhood {
  readonly nta2020: Nta2020Code;
  readonly name: string;
  readonly abbrev: string;
  readonly borough: Borough;
  readonly cdta2020: string;
  readonly landAreaSqKm: number;
  readonly centroid: Coordinate;
  readonly demographics: Demographics | null;
  /** Non-null means omit from rate displays, but still render — see specs/001 FR-4.4. */
  readonly exclusion: ExclusionReason | null;
}

export interface RaceEthnicityBreakdown {
  readonly whiteNonHispanic: number;
  readonly blackNonHispanic: number;
  readonly hispanic: number;
  readonly asianNonHispanic: number;
  readonly otherOrMultiple: number;
}

export interface Demographics {
  readonly population: number;
  readonly populationDensityPerSqKm: number;
  readonly povertyRate: number | null;
  readonly medianHouseholdIncome: number | null;
  /**
   * Always `true`. Medians cannot be aggregated across tracts, so this is a
   * population-weighted mean of tract medians. Typed as a literal so every
   * consumer must acknowledge the approximation.
   */
  readonly medianIncomeIsApproximated: true;
  readonly shareAged15to24: number | null;
  readonly ownerOccupancyRate: number | null;
  readonly shareBachelorsOrHigher: number | null;
  readonly raceEthnicity: RaceEthnicityBreakdown | null;
  readonly acsVintage: string;
  readonly contributingTracts: number;
}

export type InstitutionScope = 'NARROW' | 'STANDARD' | 'BROAD';

/** Scopes are nested: NARROW ⊂ STANDARD ⊂ BROAD. */
export const SCOPE_RANK: Readonly<Record<InstitutionScope, number>> = {
  NARROW: 0,
  STANDARD: 1,
  BROAD: 2,
};

export function isInScope(record: InstitutionScope, requested: InstitutionScope): boolean {
  return SCOPE_RANK[record] <= SCOPE_RANK[requested];
}

export interface CulturalInstitution {
  readonly id: string;
  readonly name: string;
  readonly source: 'DCLA' | 'FACDB';
  readonly sourceId: string;
  readonly location: Coordinate;
  readonly address: string | null;
  readonly borough: Borough;
  readonly nta2020: Nta2020Code | null;
  readonly scope: InstitutionScope;
  readonly discipline: string | null;
  readonly facilityGroup: string | null;
  readonly facilityType: string | null;
  readonly dedupeKey: string;
}

export type LawCategory = 'FELONY' | 'MISDEMEANOR' | 'VIOLATION';

export interface Incident {
  readonly id: string;
  readonly kind: 'COMPLAINT' | 'SHOOTING';
  readonly occurredAt: string;
  readonly location: Coordinate;
  readonly nta2020: Nta2020Code | null;
  readonly category: CrimeCategory;
  readonly lawCategory: LawCategory | null;
  readonly offenseDescription: string | null;
  readonly premiseType: string | null;
  readonly precinct: number | null;
}

export type OutcomeMeasure =
  | { readonly kind: 'SHOOTINGS' }
  | { readonly kind: 'COMPLAINTS'; readonly category: CrimeCategory };

export type ExposureMeasure = 'DENSITY' | 'PER_CAPITA' | 'ACCESS';

export type AnalysisGeography = 'NTA' | 'CDTA';

export type DenominatorWarning = 'DAYTIME_POPULATION_DOMINANT';

export interface OutcomeMetrics {
  readonly rawCount: number;
  readonly ratePer100k: number | null;
  /** Empirical-Bayes shrunk toward the borough mean. Drives the color scale. */
  readonly smoothedRatePer100k: number | null;
  readonly confidenceInterval: readonly [number, number] | null;
  readonly isEnforcementDriven: boolean;
}

export interface ExposureMetrics {
  readonly institutionCount: number;
  readonly perSqKm: number;
  readonly per10kResidents: number | null;
  readonly walkableAccessShare: number | null;
}

export interface RowQuality {
  readonly rejectedRows: number;
  readonly notes: readonly string[];
}

export interface NeighborhoodMetrics {
  readonly nta2020: Nta2020Code;
  readonly name: string;
  readonly period: { readonly from: string; readonly to: string };
  readonly outcome: OutcomeMetrics;
  readonly exposure: ExposureMetrics;
  readonly denominatorWarning: DenominatorWarning | null;
  readonly dataQuality: RowQuality;
}

export interface ScaleHints {
  readonly domain: readonly [number, number];
  readonly breaks: readonly number[];
  readonly method: 'QUANTILE' | 'EQUAL_INTERVAL';
}

export interface ExcludedNeighborhood {
  readonly nta2020: Nta2020Code;
  readonly name: string;
  readonly reason: ExclusionReason;
}

export interface MetricsResult {
  readonly rows: readonly NeighborhoodMetrics[];
  readonly scale: ScaleHints;
  readonly excluded: readonly ExcludedNeighborhood[];
  readonly provenance: Provenance;
  /** Non-empty whenever the query needs qualification. Never nullable. */
  readonly caveats: readonly string[];
}

export interface CorrelationResult {
  readonly raw: number;
  readonly adjusted: number;
  readonly confounders: readonly string[];
  readonly n: number;
  /** Required. Association is not causation; residual confounding is certain. */
  readonly interpretation: string;
}

export interface QuintileBucket {
  readonly quintile: 1 | 2 | 3 | 4 | 5;
  readonly exposureRange: readonly [number, number];
  readonly meanOutcomeRate: number;
  readonly confidenceInterval: readonly [number, number];
  readonly neighborhoodCount: number;
  readonly totalPopulation: number;
}

export interface QuintileAnalysis {
  readonly buckets: readonly QuintileBucket[];
  readonly outcome: OutcomeMeasure;
  readonly exposure: ExposureMeasure;
  readonly caveats: readonly string[];
}

export interface DatasetProvenance {
  readonly id: string;
  readonly name: string;
  readonly fetchedAt: string;
  readonly rowsUpdatedAt: string | null;
  readonly rowCount: number | null;
}

export interface Provenance {
  readonly datasets: readonly DatasetProvenance[];
  readonly ingestVersion: string;
  readonly warnings: readonly string[];
}

export interface DataQualityReport {
  readonly generatedAt: string;
  readonly rejections: readonly {
    readonly dataset: string;
    readonly reason: string;
    readonly count: number;
  }[];
  readonly unmappedOffenses: readonly string[];
  readonly totalRowsProcessed: number;
}
