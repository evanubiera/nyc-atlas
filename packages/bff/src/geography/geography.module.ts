import { Module } from '@nestjs/common';
import { SocrataModule } from '../socrata/socrata.module.js';
import { GeographyService } from './geography.service.js';

@Module({
  imports: [SocrataModule],
  providers: [GeographyService],
  exports: [GeographyService],
})
export class GeographyModule {}
