import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { GraphQLClient, type RequestDocument } from 'graphql-request';

/**
 * Injected at build time by webpack's DefinePlugin as a bare identifier.
 *
 * It must be referenced as a plain `process.env.GRAPHQL_ENDPOINT` expression —
 * DefinePlugin matches that exact text and will NOT substitute through optional
 * chaining, which leaves a runtime lookup of `process`, a global that does not
 * exist in the browser under Webpack 5.
 */
declare const process: { env: { GRAPHQL_ENDPOINT?: string } };

function resolveEndpoint(): string {
  const configured = process.env.GRAPHQL_ENDPOINT;
  if (configured && /^https?:\/\//.test(configured)) return configured;

  // graphql-request requires an absolute URL; a bare '/graphql' throws before
  // any request is issued. Resolve against the current origin so the webpack
  // dev-server proxy still handles it.
  const path = configured ?? '/graphql';
  return typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;
}

export const client = new GraphQLClient(resolveEndpoint());

export interface GraphqlArgs {
  document: RequestDocument;
  variables?: Record<string, unknown>;
}

export interface GraphqlError {
  message: string;
}

/**
 * RTK Query baseQuery over graphql-request.
 *
 * Deliberately not Apollo Client: the requirement is Redux, and Apollo's
 * normalized cache beside a Redux store means two sources of truth. This keeps
 * one store, so filter state and server cache live together — which matters
 * because filter state is serialized to the URL (specs/001 FR-2.8).
 */
export const graphqlBaseQuery =
  (): BaseQueryFn<GraphqlArgs, unknown, GraphqlError> =>
  async ({ document, variables }) => {
    try {
      const data = await client.request(document, variables);
      return { data };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : String(err) } };
    }
  };
