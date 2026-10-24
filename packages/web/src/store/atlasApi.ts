import { createApi } from '@reduxjs/toolkit/query/react';
import { gql } from 'graphql-request';
import { graphqlBaseQuery } from './graphqlBaseQuery.js';

export interface Capabilities {
  geographyLoaded: boolean;
  neighborhoodCount: number;
  residentialNeighborhoodCount: number;
  censusApiAvailable: boolean;
  socrataTokenConfigured: boolean;
  degradedFeatures: string[];
}

export interface NeighborhoodSummary {
  nta2020: string;
  name: string;
  boroughName: string;
  boroughCode: number;
  landAreaSqKm: number;
  isResidential: boolean;
  exclusion: { kind: string; explanation: string } | null;
}

export interface ProvenanceData {
  ingestVersion: string;
  attribution: string;
  warnings: string[];
  datasets: { id: string; name: string; purpose: string; notes: string | null }[];
}

export type OutcomeMode = 'RATE_PER_100K' | 'COUNT_PER_SQKM';

export interface MetricsInput {
  category: string;
  exposure: 'DENSITY' | 'PER_CAPITA' | 'ACCESS';
  scope: 'NARROW' | 'STANDARD' | 'BROAD';
  from: string;
  to: string;
  boroughCodes?: number[];
}

export interface NeighborhoodMetric {
  nta2020: string;
  name: string;
  boroughName: string;
  population: number | null;
  rawCount: number;
  ratePer100k: number | null;
  smoothedRatePer100k: number | null;
  confidenceInterval: number[] | null;
  institutionCount: number;
  institutionsPerSqKm: number;
  institutionsPer10k: number | null;
  exposureValue: number | null;
  residual: number | null;
  medianHouseholdIncome: number | null;
  povertyRate: number | null;
  isEnforcementDriven: boolean;
  excluded: { kind: string; explanation: string } | null;
}

export interface MetricsPayload {
  outcomeMode: OutcomeMode;
  rows: NeighborhoodMetric[];
  scaleBreaks: number[];
  residualExtent: number[] | null;
  caveats: string[];
  demographicsAvailable: boolean;
}

export interface QuintileBucket {
  quintile: number;
  exposureRange: number[];
  meanOutcomeRate: number;
  confidenceInterval: number[];
  neighborhoodCount: number;
  totalPopulation: number;
  totalCount: number;
}

export interface QuintilePayload {
  outcomeMode: OutcomeMode;
  buckets: QuintileBucket[];
  caveats: string[];
  demographicsAvailable: boolean;
}

export interface CorrelationPayload {
  raw: number;
  adjusted: number | null;
  confounders: string[];
  n: number;
  modelRSquared: number | null;
  interpretation: string;
}

export interface InstitutionPoint {
  id: string;
  name: string;
  source: string;
  lon: number;
  lat: number;
  scope: string;
  discipline: string | null;
  facilitySubgroup: string | null;
}

const METRIC_FIELDS = `
  nta2020 name boroughName population rawCount
  ratePer100k smoothedRatePer100k confidenceInterval
  institutionCount institutionsPerSqKm institutionsPer10k exposureValue
  residual medianHouseholdIncome povertyRate isEnforcementDriven
  excluded { kind explanation }
`;

export const atlasApi = createApi({
  reducerPath: 'atlasApi',
  baseQuery: graphqlBaseQuery(),
  endpoints: (build) => ({
    capabilities: build.query<Capabilities, void>({
      query: () => ({
        document: gql`
          query Capabilities {
            capabilities {
              geographyLoaded
              neighborhoodCount
              residentialNeighborhoodCount
              censusApiAvailable
              socrataTokenConfigured
              degradedFeatures
            }
          }
        `,
      }),
      transformResponse: (r: { capabilities: Capabilities }) => r.capabilities,
    }),

    neighborhoods: build.query<NeighborhoodSummary[], { residentialOnly: boolean }>({
      query: ({ residentialOnly }) => ({
        document: gql`
          query Neighborhoods($residentialOnly: Boolean!) {
            neighborhoods(residentialOnly: $residentialOnly) {
              nta2020
              name
              boroughName
              boroughCode
              landAreaSqKm
              isResidential
              exclusion {
                kind
                explanation
              }
            }
          }
        `,
        variables: { residentialOnly },
      }),
      transformResponse: (r: { neighborhoods: NeighborhoodSummary[] }) => r.neighborhoods,
    }),

    geometry: build.query<GeoJSON.FeatureCollection, void>({
      query: () => ({
        document: gql`
          query Geometry {
            neighborhoodGeometry
          }
        `,
      }),
      // The BFF serialises the FeatureCollection to keep the GraphQL schema
      // free of a bespoke GeoJSON type tree.
      transformResponse: (r: { neighborhoodGeometry: string }) =>
        JSON.parse(r.neighborhoodGeometry) as GeoJSON.FeatureCollection,
    }),

    metrics: build.query<MetricsPayload, MetricsInput>({
      query: (input) => ({
        document: gql`
          query Metrics($input: MetricsInput!) {
            metrics(input: $input) {
              outcomeMode
              scaleBreaks
              residualExtent
              caveats
              demographicsAvailable
              rows { ${METRIC_FIELDS} }
            }
          }
        `,
        variables: { input },
      }),
      transformResponse: (r: { metrics: MetricsPayload }) => r.metrics,
    }),

    quintiles: build.query<QuintilePayload, MetricsInput>({
      query: (input) => ({
        document: gql`
          query Quintiles($input: MetricsInput!) {
            quintiles(input: $input) {
              outcomeMode
              demographicsAvailable
              caveats
              buckets {
                quintile exposureRange meanOutcomeRate confidenceInterval
                neighborhoodCount totalPopulation totalCount
              }
            }
          }
        `,
        variables: { input },
      }),
      transformResponse: (r: { quintiles: QuintilePayload }) => r.quintiles,
    }),

    correlation: build.query<CorrelationPayload, MetricsInput>({
      query: (input) => ({
        document: gql`
          query Correlation($input: MetricsInput!) {
            correlation(input: $input) {
              raw adjusted confounders n modelRSquared interpretation
            }
          }
        `,
        variables: { input },
      }),
      transformResponse: (r: { correlation: CorrelationPayload }) => r.correlation,
    }),

    institutions: build.query<InstitutionPoint[], { scope: string }>({
      query: ({ scope }) => ({
        document: gql`
          query Institutions($scope: InstitutionScope!) {
            institutions(scope: $scope) {
              id name source lon lat scope discipline facilitySubgroup
            }
          }
        `,
        variables: { scope },
      }),
      transformResponse: (r: { institutions: InstitutionPoint[] }) => r.institutions,
    }),

    provenance: build.query<ProvenanceData, void>({
      query: () => ({
        document: gql`
          query Provenance {
            provenance {
              ingestVersion
              attribution
              warnings
              datasets {
                id
                name
                purpose
                notes
              }
            }
          }
        `,
      }),
      transformResponse: (r: { provenance: ProvenanceData }) => r.provenance,
    }),
  }),
});

export const {
  useCapabilitiesQuery,
  useNeighborhoodsQuery,
  useGeometryQuery,
  useProvenanceQuery,
  useMetricsQuery,
  useQuintilesQuery,
  useCorrelationQuery,
  useInstitutionsQuery,
} = atlasApi;
