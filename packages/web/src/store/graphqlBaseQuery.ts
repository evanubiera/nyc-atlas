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

/** Written into index.html by the container entrypoint before the bundle runs. */
declare global {
  interface Window {
    __ATLAS_CONFIG__?: { graphqlEndpoint?: string };
  }
}

/** The placeholder as it appears in the template when nothing replaced it. */
const UNSUBSTITUTED = '__GRAPHQL_ENDPOINT__';

/**
 * Resolution order: runtime config, then the build-time value, then the same
 * origin.
 *
 * Runtime wins so that one built image can be promoted across clusters.
 * Compiling the endpoint in would mean a separate build per environment, and
 * therefore shipping an artifact nobody tested. The build-time value is kept
 * for `npm run dev`, where there is no entrypoint to substitute anything.
 */
export function resolveEndpoint(): string {
  const runtime =
    typeof window !== 'undefined' ? window.__ATLAS_CONFIG__?.graphqlEndpoint : undefined;
  const configured =
    runtime && runtime !== UNSUBSTITUTED ? runtime : process.env.GRAPHQL_ENDPOINT;

  if (configured && /^https?:\/\//.test(configured)) return configured;

  const path = configured && configured !== UNSUBSTITUTED ? configured : '/graphql';
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
