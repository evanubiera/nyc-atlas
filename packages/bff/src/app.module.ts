import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'node:path';
import { SocrataModule } from './socrata/socrata.module.js';
import { GeographyModule } from './geography/geography.module.js';
import { AtlasResolver } from './graphql/atlas.resolver.js';
import { MetricsResolver } from './graphql/metrics.resolver.js';
import { MetricsModule } from './metrics/metrics.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: false,
      introspection: true,
    }),
    SocrataModule,
    GeographyModule,
    MetricsModule,
  ],
  providers: [AtlasResolver, MetricsResolver],
})
export class AppModule {}
