# 005 — GraphQL Contract

Code-first, generated from `shared/` types (004). This file documents the intended
shape; `schema.gql` is the generated artifact and is the authority at runtime.

```graphql
type Query {
  "Residential NTAs with geometry and demographics. Excluded NTAs included, flagged."
  neighborhoods(filter: NeighborhoodFilter): [Neighborhood!]!

  "Simplified geometry only — small payload for first paint."
  neighborhoodGeometry: GeoJsonFeatureCollection!

  "The join product driving the map."
  metrics(input: MetricsInput!): MetricsResult!

  institutions(filter: InstitutionFilter): [CulturalInstitution!]!

  "Raw points for hexbin at high zoom. Bounded by bbox; hard row cap."
  incidents(filter: IncidentFilter!, bbox: BBoxInput!, limit: Int = 10000): [Incident!]!

  "Quintile comparison with CIs."
  quintileAnalysis(input: AnalysisInput!): QuintileAnalysis!

  "Partial correlation adjusting for confounders. Association only."
  correlation(input: AnalysisInput!): CorrelationResult!

  provenance: Provenance!
  dataQualityReport: DataQualityReport!
}

input MetricsInput {
  outcome: OutcomeMeasureInput!
  exposure: ExposureMeasure!
  from: Date!
  to: Date!
  boroughs: [BoroughCode!]
  institutionScope: InstitutionScope! = STANDARD
  disciplines: [String!]
  "Aggregate to Community Districts instead of NTAs — the MAUP sensitivity check."
  geography: AnalysisGeography! = NTA
}

input OutcomeMeasureInput {
  kind: OutcomeKind!          # SHOOTINGS | COMPLAINTS
  category: CrimeCategory     # required when kind = COMPLAINTS
}

type MetricsResult {
  rows: [NeighborhoodMetrics!]!
  scale: ScaleHints!          # domain/breaks so client and server agree on color
  excluded: [ExcludedNeighborhood!]!
  provenance: Provenance!
  "Non-dismissible caveats for this specific query (e.g. enforcement-driven category)."
  caveats: [String!]!
}

type NeighborhoodMetrics {
  nta2020: String!
  name: String!
  outcome: OutcomeMetrics!
  exposure: ExposureMetrics!
  denominatorWarning: DenominatorWarning
  dataQuality: RowQuality!
}

type OutcomeMetrics {
  rawCount: Int!
  ratePer100k: Float
  smoothedRatePer100k: Float
  confidenceInterval: [Float!]
  isEnforcementDriven: Boolean!
}

type ExposureMetrics {
  institutionCount: Int!
  perSqKm: Float!
  per10kResidents: Float
  walkableAccessShare: Float
}

type CorrelationResult {
  "Unadjusted Pearson r between exposure and outcome."
  raw: Float!
  "Partial correlation after adjusting for the confounder set."
  adjusted: Float!
  confounders: [String!]!
  n: Int!
  "Always present. Association is not causation; residual confounding is certain."
  interpretation: String!
}

enum CrimeCategory {
  VIOLENT_PERSON VIOLENT_PROPERTY PROPERTY FRAUD WEAPONS
  DRUGS DISORDER TRAFFIC ADMINISTRATIVE SHOOTING UNKNOWN
}
enum ExposureMeasure { DENSITY PER_CAPITA ACCESS }
enum InstitutionScope { NARROW STANDARD BROAD }
enum AnalysisGeography { NTA CDTA }
enum DenominatorWarning { DAYTIME_POPULATION_DOMINANT }
```

## Contract decisions

**`caveats` and `interpretation` are non-nullable.** A client cannot retrieve a
correlation without also retrieving its interpretation. The methodology requirements in
007 are enforced by the type system, not by reviewer discipline.

**`ratePer100k` is nullable, `rawCount` is not.** Excluded neighborhoods still have a
count; they do not have a meaningful rate.

**`scale` is server-computed.** Color breaks must be identical across the map, the
legend and the scatter. Computing them client-side in three places guarantees drift.

**`incidents` requires a bbox and caps rows.** There are hundreds of thousands of
points; an unbounded query is a foot-gun. Aggregates come from `metrics`.

**No mutations in v1.** The app is read-only over public data.
