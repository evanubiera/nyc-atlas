import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { AtlasResolver } from './atlas.resolver.js';
import { MetricsResolver } from './metrics.resolver.js';

/**
 * Writes schema.gql from the resolver decorators, without starting the app.
 *
 * The running server also emits this file through `autoSchemaFile`, but only
 * when it boots — and booting reaches Socrata for the geography. That left
 * the schema unverifiable in CI: the pipeline could confirm the generated
 * client types matched the committed schema, but nothing confirmed the
 * committed schema matched the code defining it. A changed `@Field` stayed
 * invisible until somebody happened to run the server.
 *
 * `GraphQLSchemaFactory` reads decorator metadata alone, so this needs no
 * network, no cache files and no credentials.
 *
 * Usage: node dist/graphql/generate-schema.js [--check]
 */

const SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schema.gql');

/**
 * Reproduced exactly as `autoSchemaFile` writes it, banner and all, and with
 * no trailing newline. The running server rewrites this file on every boot;
 * if the two differed by so much as whitespace, each would keep reverting the
 * other and the staleness check would fire on noise instead of on drift.
 */
const NEST_BANNER =
  '# ------------------------------------------------------\n' +
  '# THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)\n' +
  '# ------------------------------------------------------\n\n';

async function buildSchemaText(): Promise<string> {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });
  await app.init();

  try {
    const factory = app.get(GraphQLSchemaFactory);
    // Sorted to match the server's `sortSchema: true`, so the two agree.
    const schema = await factory.create([AtlasResolver, MetricsResolver]);
    return NEST_BANNER + printSchema(lexicographicSortSchema(schema)).trimEnd();
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const generated = await buildSchemaText();

  if (!process.argv.includes('--check')) {
    writeFileSync(SCHEMA_PATH, generated, 'utf8');
    console.log(`Wrote ${SCHEMA_PATH}`);
    return;
  }

  let committed = '';
  try {
    committed = readFileSync(SCHEMA_PATH, 'utf8');
  } catch {
    console.error('No schema.gql found — run `npm run generate:schema`.');
    process.exit(1);
  }

  if (committed !== generated) {
    console.error(
      'schema.gql is stale: the resolvers define a different contract than the\n' +
        'committed schema. Run `npm run generate:schema` and commit the result.',
    );
    process.exit(1);
  }
  console.log('schema.gql matches the resolvers.');
}

void main();
