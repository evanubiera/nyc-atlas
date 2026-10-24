import { Module } from '@nestjs/common';
import { SocrataModule } from '../socrata/socrata.module.js';
import { GeographyModule } from '../geography/geography.module.js';
import { CacheService } from '../cache/cache.service.js';
import { MetricsService } from './metrics.service.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import { InstitutionsService } from '../institutions/institutions.service.js';
import { CensusService } from '../census/census.service.js';
import { IngestService } from '../ingest/ingest.service.js';

@Module({
  imports: [SocrataModule, GeographyModule],
  providers: [
    CacheService,
    MetricsService,
    IncidentsService,
    InstitutionsService,
    CensusService,
    IngestService,
  ],
  exports: [MetricsService, IngestService, CacheService],
})
export class MetricsModule {}
