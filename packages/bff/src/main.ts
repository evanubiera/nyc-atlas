import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/configuration.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(AppConfig);
  const logger = new Logger('bootstrap');

  /**
   * Reflecting the caller's origin is fine on a laptop and wrong on a public
   * deployment, so production demands an explicit allowlist. Failing to start
   * is the right response: a service that silently accepts every origin is
   * harder to notice than one that refuses to boot.
   */
  const origins = config.corsOrigins;
  if (config.isProduction && origins.length === 0) {
    logger.error('CORS_ORIGINS must be set in production. Refusing to start permissively.');
    process.exit(1);
  }
  app.enableCors({ origin: origins.length > 0 ? origins : true });

  /**
   * Without this, SIGTERM kills the process mid-request. Orchestrators send
   * SIGTERM on every rollout, so this is the difference between a deploy that
   * is invisible to users and one that drops whatever was in flight.
   */
  app.enableShutdownHooks();

  await app.listen(config.port);

  logger.log(`BFF listening on port ${config.port} (revision ${config.revision})`);
  logger.log(`CORS: ${origins.length > 0 ? origins.join(', ') : 'reflecting caller origin'}`);
  if (!config.hasCensusKey) {
    logger.warn(
      'CENSUS_API_KEY is not set — ACS demographics will degrade to cache. ' +
        'Free key: https://api.census.gov/data/key_signup.html',
    );
  }
}

void bootstrap();
