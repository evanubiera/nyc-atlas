// Generated from packages/bff/schema.gql by scripts/generate-graphql-types.mjs.
// Do not edit by hand — run `npm run generate:types`.

export interface AccessGapGroup {
  examples: string[];
  institutionsPer10k: number | null;
  neighborhoodCount: number;
  population: number;
}

export interface AccessGapMeasure {
  higherIsBetter: boolean;
  highest: number | null;
  key: string;
  label: string;
  lowest: number | null;
  note: string;
  ratio: number | null;
  unit: GapUnit;
}

export interface AccessGapsPayload {
  amenitiesAvailable: boolean;
  caveats: string[];
  demographicsAvailable: boolean;
  exposureLabel: string;
  least: AccessGapGroup;
  measures: AccessGapMeasure[];
  most: AccessGapGroup;
}

export interface Capabilities {
  censusApiAvailable: boolean;
  degradedFeatures: string[];
  geographyLoaded: boolean;
  neighborhoodCount: number;
  residentialNeighborhoodCount: number;
  socrataTokenConfigured: boolean;
}

export interface CorrelationPayload {
  adjusted: number | null;
  confounders: string[];
  interpretation: string;
  modelRSquared: number | null;
  n: number;
  raw: number;
}

export type CrimeCategory = 'ADMINISTRATIVE' | 'DISORDER' | 'DRUGS' | 'FRAUD' | 'PROPERTY' | 'SHOOTING' | 'TRAFFIC' | 'UNKNOWN' | 'VIOLENT_PERSON' | 'VIOLENT_PROPERTY' | 'WEAPONS';

export interface DatasetProvenance {
  id: string;
  name: string;
  notes: string | null;
  purpose: string;
  rowCount: number | null;
  rowsUpdatedAt: string | null;
}

export interface Demographics {
  acsVintage: string;
  contributingTracts: number;
  medianHouseholdIncome: number | null;
  medianIncomeIsApproximated: boolean;
  ownerOccupancyRate: number | null;
  population: number;
  populationDensityPerSqKm: number;
  povertyRate: number | null;
  shareAged15to24: number | null;
}

export interface Exclusion {
  explanation: string;
  kind: ExclusionKind;
  ntatype: string | null;
  population: number | null;
}

export type ExclusionKind = 'LOW_POPULATION' | 'NON_RESIDENTIAL' | 'NO_DEMOGRAPHICS';

export interface ExclusionNote {
  explanation: string;
  kind: string;
}

export type ExposureMeasure = 'ACCESS' | 'DENSITY' | 'PER_CAPITA';

export type GapUnit = 'PER_10K' | 'SHARE' | 'USD';

export interface IncidentPointModel {
  lat: number;
  lon: number;
  occurredOn: string;
}

export interface IncidentsInput {
  category: CrimeCategory;
  east: number;
  from: string;
  limit?: number | null;
  north: number;
  south: number;
  to: string;
  west: number;
}

export interface IncidentsPayload {
  capped: boolean;
  points: IncidentPointModel[];
  serviceable: boolean;
}

export interface InstitutionPoint {
  discipline: string | null;
  facilitySubgroup: string | null;
  facilityType: string | null;
  id: string;
  lat: number;
  lon: number;
  name: string;
  nta2020: string | null;
  scope: string;
  source: string;
}

export type InstitutionScope = 'BROAD' | 'NARROW' | 'STANDARD';

export interface MaupPayload {
  agrees: boolean;
  coarseCorrelation: number | null;
  coarseCount: number;
  fineCorrelation: number | null;
  fineCount: number;
  interpretation: string;
  shift: number | null;
}

export interface MetricsInput {
  boroughCodes?: number[] | null;
  category: CrimeCategory;
  exposure: ExposureMeasure;
  from: string;
  scope: InstitutionScope;
  to: string;
}

export interface MetricsPayload {
  caveats: string[];
  demographicsAvailable: boolean;
  outcomeMode: OutcomeMode;
  residualExtent: number[] | null;
  rows: NeighborhoodMetric[];
  scaleBreaks: number[];
}

export interface Neighborhood {
  boroughCode: number;
  boroughName: string;
  cdta2020: string;
  centroid: number[];
  demographics: Demographics | null;
  exclusion: Exclusion | null;
  isResidential: boolean;
  landAreaSqKm: number;
  name: string;
  nta2020: string;
}

export interface NeighborhoodMetric {
  boroughCode: number;
  boroughName: string;
  centroid: number[];
  confidenceInterval: number[] | null;
  excluded: ExclusionNote | null;
  exposureValue: number | null;
  foodStoreCount: number;
  gradeAStoreCount: number;
  gradedStoreCount: number;
  healthcareSiteCount: number;
  healthcareSitesPer10k: number | null;
  institutionCount: number;
  institutionsPer10k: number | null;
  institutionsPerSqKm: number;
  isEnforcementDriven: boolean;
  landAreaSqKm: number;
  medianHouseholdIncome: number | null;
  name: string;
  nta2020: string;
  population: number | null;
  povertyRate: number | null;
  ratePer100k: number | null;
  rawCount: number;
  residual: number | null;
  schoolCount: number;
  schoolProficiency: number | null;
  schoolStudents: number;
  shareBachelorsOrHigher: number | null;
  smoothedRatePer100k: number | null;
  storeGradeShare: number | null;
  supermarketCount: number;
  supermarketsPer10k: number | null;
}

export type OutcomeMode = 'COUNT_PER_SQKM' | 'RATE_PER_100K';

export interface Provenance {
  attribution: string;
  datasets: DatasetProvenance[];
  ingestVersion: string;
  warnings: string[];
}

export interface QualityRejection {
  count: number;
  dataset: string;
  reason: string;
}

export interface QualityReportPayload {
  generatedAt: string;
  notes: string[];
  recoveredViaFallback: number;
  rejections: QualityRejection[];
  totalRowsProcessed: number;
  unmappedOffenses: string[];
}

export interface QuintileBucket {
  confidenceInterval: number[];
  exposureRange: number[];
  meanOutcomeRate: number;
  neighborhoodCount: number;
  quintile: number;
  totalCount: number;
  totalPopulation: number;
}

export interface QuintilePayload {
  buckets: QuintileBucket[];
  caveats: string[];
  demographicsAvailable: boolean;
  outcomeMode: OutcomeMode;
}
