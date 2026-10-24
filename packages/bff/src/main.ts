import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  const logger = new Logger('bootstrap');
  logger.log(`BFF listening on http://localhost:${port}/graphql`);
  if (!process.env.CENSUS_API_KEY) {
    logger.warn(
      'CENSUS_API_KEY is not set — ACS demographics will degrade to cache. ' +
        'Free key: https://api.census.gov/data/key_signup.html',
    );
  }
}

void bootstrap();
