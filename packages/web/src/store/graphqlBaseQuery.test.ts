import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEndpoint } from './graphqlBaseQuery.ts';

/**
 * Which cluster the browser talks to is decided here, so the precedence is
 * worth pinning. The placeholder case matters most: an image whose entrypoint
 * failed to substitute must fall back to the same origin, not try to reach a
 * host literally named __GRAPHQL_ENDPOINT__.
 */

const originalEnv = process.env.GRAPHQL_ENDPOINT;

function withWindow(config: { graphqlEndpoint?: string } | undefined): void {
  (globalThis as { window?: unknown }).window = {
    __ATLAS_CONFIG__: config,
    location: { origin: 'https://atlas.example.org' },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  if (originalEnv === undefined) delete process.env.GRAPHQL_ENDPOINT;
  else process.env.GRAPHQL_ENDPOINT = originalEnv;
});

test('runtime config wins, so one image serves every cluster', () => {
  process.env.GRAPHQL_ENDPOINT = 'https://built-in.example.com/graphql';
  withWindow({ graphqlEndpoint: 'https://cluster-a.example.org/graphql' });

  assert.equal(resolveEndpoint(), 'https://cluster-a.example.org/graphql');
});

test('an unsubstituted placeholder falls back instead of being used as a host', () => {
  delete process.env.GRAPHQL_ENDPOINT;
  withWindow({ graphqlEndpoint: '__GRAPHQL_ENDPOINT__' });

  assert.equal(resolveEndpoint(), 'https://atlas.example.org/graphql');
});

test('the build-time value is still honoured where nothing substitutes at runtime', () => {
  process.env.GRAPHQL_ENDPOINT = 'https://built-in.example.com/graphql';
  withWindow(undefined);

  assert.equal(resolveEndpoint(), 'https://built-in.example.com/graphql');
});

test('a relative path resolves against the page, which is the same-origin default', () => {
  process.env.GRAPHQL_ENDPOINT = '/api/graphql';
  withWindow(undefined);

  assert.equal(resolveEndpoint(), 'https://atlas.example.org/api/graphql');
});

test('with nothing configured at all it talks to its own origin', () => {
  delete process.env.GRAPHQL_ENDPOINT;
  withWindow({});

  assert.equal(resolveEndpoint(), 'https://atlas.example.org/graphql');
});
