import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { IngestService } from './ingest.service.js';

/**
 * Standalone ingest entry point. Builds the full DI context without starting
 * an HTTP server, runs the pipeline, writes data/cache/, and exits.
 *
 * `--provenance-only` refreshes just the freshness sidecar. Upstream
 * timestamps move far more often than the figures do, and re-reading every
 * dataset to learn when it was last updated is a poor trade.
 */
async function main(): Promise<void> {
  const logger = new Logger('ingest');
  const includeHistoric = process.argv.includes('--historic');
  const provenanceOnly = process.argv.includes('--provenance-only');
  const walkabilityOnly = process.argv.includes('--walkability-only');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const ingest = app.get(IngestService);
    if (provenanceOnly) {
      await ingest.refreshProvenance();
    } else if (walkabilityOnly) {
      await ingest.refreshWalkability();
    } else {
      await ingest.run({ includeHistoric });
    }
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(String(err));
    await app.close();
    process.exit(1);
  }
}

void main();
