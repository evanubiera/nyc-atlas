import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed access to configuration. Every key is optional by design — the app must
 * run with no credentials at all (specs/001 NFR-4, NFR-5).
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return Number(this.config.get('PORT') ?? 4000);
  }

  /** Raises Socrata rate limits. Optional. */
  get socrataAppToken(): string | null {
    return this.config.get<string>('SOCRATA_APP_TOKEN')?.trim() || null;
  }

  /**
   * Required for live ACS demographics. The Census API rejects unkeyed requests
   * (302 -> missing_key.html, verified 2026-10-24). Absent, demographic features
   * degrade to the committed cache rather than failing startup.
   */
  get censusApiKey(): string | null {
    return this.config.get<string>('CENSUS_API_KEY')?.trim() || null;
  }

  get hasCensusKey(): boolean {
    return this.censusApiKey !== null;
  }

  get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }
}
