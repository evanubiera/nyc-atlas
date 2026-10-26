import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SocrataModule } from './socrata/socrata.module.js';
import { GeographyModule } from './geography/geography.module.js';
import { AtlasResolver } from './graphql/atlas.resolver.js';
import { ProvenanceService } from './graphql/provenance.service.js';
import { MetricsResolver } from './graphql/metrics.resolver.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { HealthModule } from './health/health.module.js';

/**
 * Anchored to this file rather than to `process.cwd()`.
 *
 * The working directory is whatever launched the process — the repo root for
 * one invocation, the package for another, and in a container whatever the
 * image declares. A cwd-relative path quietly writes a second schema wherever
 * it happens to be run from, which is exactly how a stale copy reached the
 * repo root.
 */
const SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'schema.gql');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: SCHEMA_PATH,
      sortSchema: true,
      playground: false,
      introspection: true,
    }),
    SocrataModule,
    GeographyModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [AtlasResolver, MetricsResolver, ProvenanceService],
})
export class AppModule {}
