import { Module } from '@nestjs/common';
import { GeographyModule } from '../geography/geography.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { SocrataModule } from '../socrata/socrata.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [GeographyModule, MetricsModule, SocrataModule],
  controllers: [HealthController],
})
export class HealthModule {}
