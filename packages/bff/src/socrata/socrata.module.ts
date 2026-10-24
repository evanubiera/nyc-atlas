import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from '../config/configuration.js';
import { SocrataService } from './socrata.service.js';

@Module({
  imports: [ConfigModule],
  providers: [AppConfig, SocrataService],
  exports: [SocrataService, AppConfig],
})
export class SocrataModule {}
