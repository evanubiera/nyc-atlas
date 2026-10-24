import { Injectable, Logger } from '@nestjs/common';
import { DATASETS } from '@nyc-atlas/shared';
import { GeographyService } from '../geography/geography.service.js';
import { IncidentsService, mergeAggregates } from '../incidents/incidents.service.js';
import { InstitutionsService } from '../institutions/institutions.service.js';
import { CensusService } from '../census/census.service.js';
import { CacheService } from '../cache/cache.service.js';
import {
  CACHE_FILES,
  type DemographicsCache,
  type IncidentCache,
  type InstitutionCache,
  type QualityReport,
} from './ingest.types.js';

export interface IngestOptions {
  /** Include the 2006-2019 historic complaint set (millions of rows). */
  includeHistoric?: boolean;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly geography: GeographyService,
    private readonly incidents: IncidentsService,
    private readonly institutions: InstitutionsService,
    private readonly census: CensusService,
    private readonly cache: CacheService,
  ) {}

  async run(options: IngestOptions = {}): Promise<void> {
    const started = Date.now();
    await this.geography.load();

    const rejections: QualityReport['rejections'] = [];
    const unmapped = new Set<string>();
    let totalRows = 0;
    let recovered = 0;
    let swapped = 0;
    const notes: string[] = [];

    // --- incidents ---------------------------------------------------------
    const shootings = await this.incidents.ingestShootings();
    totalRows += shootings.totalRows;
    recovered += shootings.recoveredViaFallback;
    swapped += shootings.coordinatesSwapped;
    for (const [reason, count] of shootings.rejected) {
      rejections.push({ dataset: DATASETS.shootings.id, reason, count });
    }

    const complaints = await this.incidents.ingestComplaints(
      DATASETS.complaintsCurrent.id,
      'current year-to-date',
    );
    totalRows += complaints.totalRows;
    recovered += complaints.recoveredViaFallback;
    swapped += complaints.coordinatesSwapped;
    for (const [reason, count] of complaints.rejected) {
      rejections.push({ dataset: DATASETS.complaintsCurrent.id, reason, count });
    }
    for (const o of complaints.unmappedOffenses) unmapped.add(o);

    let aggregate = mergeAggregates(shootings.aggregate, complaints.aggregate);

    if (options.includeHistoric === true) {
      const historic = await this.incidents.ingestComplaints(
        DATASETS.complaintsHistoric.id,
        'historic 2006-2019',
      );
      totalRows += historic.totalRows;
      recovered += historic.recoveredViaFallback;
      swapped += historic.coordinatesSwapped;
      for (const [reason, count] of historic.rejected) {
        rejections.push({ dataset: DATASETS.complaintsHistoric.id, reason, count });
      }
      for (const o of historic.unmappedOffenses) unmapped.add(o);
      aggregate = mergeAggregates(aggregate, historic.aggregate);
    } else {
      notes.push(
        'Historic complaints (2006-2019, qgea-i56i) were not ingested. ' +
          'Run with --historic to include them; shootings already span 2006-present.',
      );
    }

    const months = collectMonths(aggregate);
    const incidentCache: IncidentCache = {
      aggregate,
      earliestMonth: months.length > 0 ? (months[0] as string) : null,
      latestMonth: months.length > 0 ? (months[months.length - 1] as string) : null,
    };
    await this.cache.write(CACHE_FILES.incidents, incidentCache);

    // --- institutions ------------------------------------------------------
    const { institutions, rejected: instRejected } = await this.institutions.fetchAll();
    for (const [reason, count] of instRejected) {
      rejections.push({ dataset: 'institutions', reason, count });
    }
    const institutionCache: InstitutionCache = { institutions };
    await this.cache.write(CACHE_FILES.institutions, institutionCache);

    // --- demographics ------------------------------------------------------
    let demographicsCache: DemographicsCache;
    if (this.census.isAvailable) {
      try {
        const byNta = await this.census.fetchNtaDemographics();
        demographicsCache = {
          byNta: Object.fromEntries(byNta),
          available: byNta.size > 0,
          unavailableReason: byNta.size > 0 ? null : 'ACS returned no rows',
        };
      } catch (err) {
        this.logger.error(`ACS fetch failed: ${String(err)}`);
        demographicsCache = {
          byNta: {},
          available: false,
          unavailableReason: `ACS fetch failed: ${String(err)}`,
        };
      }
    } else {
      demographicsCache = {
        byNta: {},
        available: false,
        unavailableReason:
          'CENSUS_API_KEY is not set. Rates and confounder adjustment require ' +
          'population denominators from the ACS.',
      };
      notes.push(
        'No Census key: per-capita rates and confounder-adjusted views are unavailable.',
      );
    }
    await this.cache.write(CACHE_FILES.demographics, demographicsCache);

    // --- quality report ----------------------------------------------------
    if (swapped > 0) {
      notes.push(
        `Repaired ${swapped.toLocaleString()} incident rows whose latitude and longitude ` +
          `columns were transposed upstream. The Shootings dataset (5ucz-vwe8) ships every ` +
          `record from 2006-01-01 to 2025-12-31 reversed; only 2026 additions are correct. ` +
          `Without this repair 98.7% of shootings would be silently discarded.`,
      );
    }

    const quality: QualityReport = {
      generatedAt: new Date().toISOString(),
      totalRowsProcessed: totalRows,
      rejections: rejections.sort((a, b) => b.count - a.count),
      unmappedOffenses: [...unmapped].sort(),
      recoveredViaFallback: recovered,
      coordinatesRepaired: swapped,
      notes,
    };
    await this.cache.write(CACHE_FILES.quality, quality);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    this.logger.log(`Ingest complete in ${elapsed}s`);
    if (unmapped.size > 0) {
      throw new Error(
        `Ingest found ${unmapped.size} unmapped offense label(s): ${[...unmapped].join(', ')}. ` +
          `Add them to packages/shared/src/crime-categories.ts.`,
      );
    }
  }
}

function collectMonths(agg: Record<string, Record<string, Record<string, number>>>): string[] {
  const set = new Set<string>();
  for (const cats of Object.values(agg)) {
    for (const months of Object.values(cats)) {
      for (const m of Object.keys(months)) set.add(m);
    }
  }
  return [...set].sort();
}
