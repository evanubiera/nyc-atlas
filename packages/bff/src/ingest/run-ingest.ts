import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { IngestService } from './ingest.service.js';

/**
 * Standalone ingest entry point. Builds the full DI context without starting
 * an HTTP server, runs the pipeline, writes data/cache/, and exits.
 */
async function main(): Promise<void> {
  const logger = new Logger('ingest');
  const includeHistoric = process.argv.includes('--historic');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    await app.get(IngestService).run({ includeHistoric });
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(String(err));
    await app.close();
    process.exit(1);
  }
}

void main();
