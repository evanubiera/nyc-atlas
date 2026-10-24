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
} = atlasApi;
