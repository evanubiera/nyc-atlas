import type {
  CrimeCategory,
  ExposureMeasure,
  InstitutionScope,
  Nta2020Code,
} from '@nyc-atlas/shared';

export interface MetricsQuery {
  category: CrimeCategory;
  exposure: ExposureMeasure;
  scope: InstitutionScope;
  from: string;
  to: string;
  boroughCodes?: number[];
}

export interface ExclusionNote {
  kind: string;
  explanation: string;
}

export interface NeighborhoodRow {
  nta2020: Nta2020Code;
  name: string;
  boroughName: string;
  boroughCode: number;
  landAreaSqKm: number;
  centroid: [number, number];
  population: number | null;
  rawCount: number;
  ratePer100k: number | null;
  smoothedRatePer100k: number | null;
  confidenceInterval: [number, number] | null;
  institutionCount: number;
  institutionsPerSqKm: number;
  institutionsPer10k: number | null;
  exposureValue: number | null;
  /** Observed minus model-predicted rate. Null without demographics. */
  residual: number | null;
  medianHouseholdIncome: number | null;
  povertyRate: number | null;
  shareBachelorsOrHigher: number | null;

  foodStoreCount: number;
  supermarketCount: number;
  supermarketsPer10k: number | null;
  gradedStoreCount: number;
  gradeAStoreCount: number;
  /** Sanitation, not food quality. */
  storeGradeShare: number | null;
  healthcareSiteCount: number;
  healthcareSitesPer10k: number | null;
  schoolCount: number;
  schoolStudents: number;
  schoolProficiency: number | null;

  isEnforcementDriven: boolean;
  excluded: ExclusionNote | null;
}

/**
 * Which denominator the outcome is expressed against.
 *
 * Per-resident rates need ACS population. Without a Census key the analysis
 * still runs on area density, which is a real measure and keeps every view
 * usable — it is simply not the same quantity, so it is labelled everywhere
 * rather than silently substituted.
 */
export type OutcomeMode = 'RATE_PER_100K' | 'COUNT_PER_SQKM';

export interface MetricsResult {
  outcomeMode: OutcomeMode;
  rows: NeighborhoodRow[];
  scaleBreaks: number[];
  residualExtent: [number, number] | null;
  caveats: string[];
  demographicsAvailable: boolean;
  period: { from: string; to: string };
}

export interface CorrelationSummary {
  raw: number;
  adjusted: number | null;
  confounders: string[];
  n: number;
  modelRSquared: number | null;
  interpretation: string;
}

export type GapUnit = 'USD' | 'PER_10K' | 'SHARE';

export interface AccessGapMeasure {
  key: string;
  label: string;
  unit: GapUnit;
  lowest: number | null;
  highest: number | null;
  ratio: number | null;
  higherIsBetter: boolean;
  note: string;
}

export interface AccessGapGroup {
  neighborhoodCount: number;
  population: number;
  institutionsPer10k: number | null;
  examples: string[];
}

export interface AccessGapsResult {
  measures: AccessGapMeasure[];
  least: AccessGapGroup;
  most: AccessGapGroup;
  exposureLabel: string;
  amenitiesAvailable: boolean;
  demographicsAvailable: boolean;
  caveats: string[];
}

export const CONFOUNDER_LABELS = [
  'median household income',
  'poverty rate',
  'population density',
  'share aged 15-24',
  'owner-occupancy rate',
];
