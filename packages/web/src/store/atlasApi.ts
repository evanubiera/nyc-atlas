import { createApi } from '@reduxjs/toolkit/query/react';
import { gql } from 'graphql-request';
import { graphqlBaseQuery } from './graphqlBaseQuery.js';

/**
 * Every shape below is derived from `schema.generated.ts` rather than written
 * out again (specs/001 NFR-7, 008 §4.4).
 *
 * `Pick` keeps the selection honest: these types describe what the queries
 * actually ask for, not the whole schema, so nothing can read a field the
 * document never requested. And when the contract drops or renames a field,
 * the Pick stops compiling instead of failing at runtime on undefined.
 */
import type * as Schema from './schema.generated.js';

export type Capabilities = Schema.Capabilities;

export type NeighborhoodSummary = Pick<
  Schema.Neighborhood,
  'nta2020' | 'name' | 'boroughName' | 'boroughCode' | 'landAreaSqKm' | 'isResidential'
> & { exclusion: Pick<Schema.Exclusion, 'kind' | 'explanation'> | null };

export type ProvenanceData = Pick<
  Schema.Provenance,
  'ingestVersion' | 'attribution' | 'warnings'
> & {
  datasets: Pick<
    Schema.DatasetProvenance,
    'id' | 'name' | 'purpose' | 'notes' | 'rowsUpdatedAt' | 'rowCount'
  >[];
};

export type QualityRejection = Schema.QualityRejection;
export type QualityReport = Schema.QualityReportPayload;

export type OutcomeMode = Schema.OutcomeMode;

export type MetricsInput = Schema.MetricsInput;

export type NeighborhoodMetric = Pick<
  Schema.NeighborhoodMetric,
  | 'nta2020'
  | 'name'
  | 'boroughName'
  | 'population'
  | 'rawCount'
  | 'ratePer100k'
  | 'smoothedRatePer100k'
  | 'confidenceInterval'
  | 'institutionCount'
  | 'institutionsPerSqKm'
  | 'institutionsPer10k'
  | 'exposureValue'
  | 'residual'
  | 'medianHouseholdIncome'
  | 'povertyRate'
  | 'shareBachelorsOrHigher'
  | 'foodStoreCount'
  | 'supermarketCount'
  | 'supermarketsPer10k'
  | 'gradedStoreCount'
  | 'gradeAStoreCount'
  | 'storeGradeShare'
  | 'healthcareSiteCount'
  | 'healthcareSitesPer10k'
  | 'schoolCount'
  | 'schoolStudents'
  | 'schoolProficiency'
  | 'isEnforcementDriven'
  | 'excluded'
>;

export type MetricsPayload = Pick<
  Schema.MetricsPayload,
  'outcomeMode' | 'scaleBreaks' | 'residualExtent' | 'caveats' | 'demographicsAvailable'
> & { rows: NeighborhoodMetric[] };

export type QuintileBucket = Schema.QuintileBucket;

export type QuintilePayload = Pick<
  Schema.QuintilePayload,
  'outcomeMode' | 'caveats' | 'demographicsAvailable'
> & { buckets: QuintileBucket[] };

export type CorrelationPayload = Pick<
  Schema.CorrelationPayload,
  'raw' | 'adjusted' | 'confounders' | 'n' | 'modelRSquared' | 'interpretation'
>;

export type InstitutionPoint = Schema.InstitutionPoint;

export type GapUnit = Schema.GapUnit;
export type AccessGapMeasure = Schema.AccessGapMeasure;
export type AccessGapGroup = Schema.AccessGapGroup;
export type AccessGapsPayload = Schema.AccessGapsPayload;

const METRIC_FIELDS = `
  nta2020 name boroughName population rawCount
  ratePer100k smoothedRatePer100k confidenceInterval
  institutionCount institutionsPerSqKm institutionsPer10k exposureValue
  residual medianHouseholdIncome povertyRate shareBachelorsOrHigher
  foodStoreCount supermarketCount supermarketsPer10k
  gradedStoreCount gradeAStoreCount storeGradeShare
  healthcareSiteCount healthcareSitesPer10k
  schoolCount schoolStudents schoolProficiency
  isEnforcementDriven
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

    accessGaps: build.query<AccessGapsPayload, MetricsInput>({
      query: (input) => ({
        document: gql`
          query AccessGaps($input: MetricsInput!) {
            accessGaps(input: $input) {
              exposureLabel
              amenitiesAvailable
              demographicsAvailable
              caveats
              measures {
                key label unit lowest highest ratio higherIsBetter note
              }
              least { neighborhoodCount population institutionsPer10k examples }
              most { neighborhoodCount population institutionsPer10k examples }
            }
          }
        `,
        variables: { input },
      }),
      transformResponse: (r: { accessGaps: AccessGapsPayload }) => r.accessGaps,
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
              id name source lon lat nta2020 scope
              discipline facilitySubgroup facilityType
            }
          }
        `,
        variables: { scope },
      }),
      transformResponse: (r: { institutions: InstitutionPoint[] }) => r.institutions,
    }),

    dataQualityReport: build.query<QualityReport | null, void>({
      query: () => ({
        document: gql`
          query DataQualityReport {
            dataQualityReport {
              generatedAt
              totalRowsProcessed
              recoveredViaFallback
              unmappedOffenses
              notes
              rejections {
                dataset
                reason
                count
              }
            }
          }
        `,
      }),
      transformResponse: (r: { dataQualityReport: QualityReport | null }) => r.dataQualityReport,
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
                rowsUpdatedAt
                rowCount
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
  useDataQualityReportQuery,
  useMetricsQuery,
  useQuintilesQuery,
  useCorrelationQuery,
  useAccessGapsQuery,
  useInstitutionsQuery,
} = atlasApi;
