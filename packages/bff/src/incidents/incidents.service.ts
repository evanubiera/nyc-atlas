import { Injectable, Logger } from '@nestjs/common';
import {
  DATASETS,
  EARLIEST_VALID_INCIDENT_DATE,
  classifyOffense,
  resolveCoordinatePair,
  type CrimeCategory,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import { GeographyService } from '../geography/geography.service.js';

/** nta2020 -> category -> 'YYYY-MM' -> count */
export type IncidentAggregate = Record<string, Record<string, Record<string, number>>>;

export interface IngestOutcome {
  aggregate: IncidentAggregate;
  totalRows: number;
  accepted: number;
  rejected: Map<string, number>;
  unmappedOffenses: Set<string>;
  /** Rows that resolved a category only via the pd_desc fallback. */
  recoveredViaFallback: number;
  /** Rows whose latitude/longitude columns arrived transposed. */
  coordinatesSwapped: number;
}

interface ShootingRow {
  occur_date?: string;
  latitude?: string;
  longitude?: string;
}

interface ComplaintRow {
  cmplnt_fr_dt?: string;
  ofns_desc?: string;
  pd_desc?: string;
  law_cat_cd?: string;
  latitude?: string;
  longitude?: string;
}

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly socrata: SocrataService,
    private readonly geography: GeographyService,
  ) {}

  /**
   * Shootings — the primary outcome.
   *
   * Least affected by reporting bias: a gunshot wound reaches a hospital and a
   * police response regardless of the victim's trust in the NYPD. For a project
   * about marginalized neighborhoods, where under-reporting is worst, this is
   * the measure that holds up. See specs/007 §3.
   */
  async ingestShootings(): Promise<IngestOutcome> {
    const outcome = emptyOutcome();
    this.logger.log('Ingesting shootings (2006–present)…');

    for await (const page of this.socrata.paginate<ShootingRow>(DATASETS.shootings.id, {
      select: 'occur_date, latitude, longitude',
      order: 'occur_date',
    })) {
      for (const row of page) {
        outcome.totalRows += 1;
        const placed = this.place(row.longitude, row.latitude, row.occur_date, outcome);
        if (placed === null) continue;
        bumpAggregate(outcome.aggregate, placed.nta, 'SHOOTING', placed.month);
        outcome.accepted += 1;
      }
    }

    this.logSummary('shootings', outcome);
    return outcome;
  }

  /**
   * Complaints — the secondary outcome, carrying reporting bias that is itself
   * correlated with the exposure of interest.
   */
  async ingestComplaints(datasetId: string, label: string): Promise<IngestOutcome> {
    const outcome = emptyOutcome();
    this.logger.log(`Ingesting complaints (${label})…`);

    for await (const page of this.socrata.paginate<ComplaintRow>(datasetId, {
      select: 'cmplnt_fr_dt, ofns_desc, pd_desc, law_cat_cd, latitude, longitude',
      order: 'cmplnt_fr_dt',
    })) {
      for (const row of page) {
        outcome.totalRows += 1;
        const placed = this.place(row.longitude, row.latitude, row.cmplnt_fr_dt, outcome);
        if (placed === null) continue;

        // ofns_desc is frequently the literal '(null)'; pd_desc recovers it.
        const cls = classifyOffense(row.ofns_desc, row.pd_desc);
        if (cls.unmapped && row.ofns_desc !== undefined) {
          outcome.unmappedOffenses.add(row.ofns_desc);
        }
        if (cls.viaFallback) outcome.recoveredViaFallback += 1;

        bumpAggregate(outcome.aggregate, placed.nta, cls.category, placed.month);
        outcome.accepted += 1;
      }
    }

    this.logSummary(`complaints (${label})`, outcome);
    return outcome;
  }

  /**
   * Validates a row and resolves it to an NTA and a month bucket.
   * Returns null for any row that cannot be trusted, recording why.
   */
  private place(
    lonRaw: string | undefined,
    latRaw: string | undefined,
    dateRaw: string | undefined,
    outcome: IngestOutcome,
  ): { nta: Nta2020Code; month: string } | null {
    const bump = (reason: string): null => {
      outcome.rejected.set(reason, (outcome.rejected.get(reason) ?? 0) + 1);
      return null;
    };

    // Column order cannot be trusted: 98.7% of Shootings rows ship transposed.
    // resolveCoordinatePair recovers them by range, which is unambiguous
    // because NYC's lat and lon bands do not overlap.
    const resolved = resolveCoordinatePair(Number(latRaw), Number(lonRaw));
    if (resolved === null) return bump('coordinates missing, (0,0), or outside the NYC bounding box');
    const { lon, lat } = resolved;
    if (resolved.wasSwapped) outcome.coordinatesSwapped += 1;

    if (dateRaw === undefined || dateRaw === '') return bump('missing date');
    const iso = dateRaw.slice(0, 10);
    // 58 complaint rows carry impossible dates; the minimum observed is 1016-04-30.
    if (iso < EARLIEST_VALID_INCIDENT_DATE) return bump('date before 2006 (data-entry error)');
    if (iso > new Date().toISOString().slice(0, 10)) return bump('date in the future');

    const nta = this.geography.resolvePoint(lon, lat);
    if (nta === null) return bump('point fell outside every NTA polygon');

    return { nta, month: iso.slice(0, 7) };
  }

  private logSummary(label: string, o: IngestOutcome): void {
    const pct = o.totalRows === 0 ? 0 : (100 * o.accepted) / o.totalRows;
    this.logger.log(
      `${label}: ${o.accepted.toLocaleString()} / ${o.totalRows.toLocaleString()} accepted (${pct.toFixed(1)}%)`,
    );
    for (const [reason, n] of [...o.rejected].sort((a, b) => b[1] - a[1])) {
      this.logger.warn(`   rejected ${n.toLocaleString()} — ${reason}`);
    }
    if (o.coordinatesSwapped > 0) {
      this.logger.warn(
        `   repaired ${o.coordinatesSwapped.toLocaleString()} rows with transposed ` +
          `latitude/longitude columns`,
      );
    }
    if (o.recoveredViaFallback > 0) {
      this.logger.log(
        `   recovered ${o.recoveredViaFallback.toLocaleString()} rows via pd_desc fallback`,
      );
    }
    if (o.unmappedOffenses.size > 0) {
      this.logger.error(`   UNMAPPED offense labels: ${[...o.unmappedOffenses].join(', ')}`);
    }
  }
}

function emptyOutcome(): IngestOutcome {
  return {
    aggregate: {},
    totalRows: 0,
    accepted: 0,
    rejected: new Map(),
    unmappedOffenses: new Set(),
    recoveredViaFallback: 0,
    coordinatesSwapped: 0,
  };
}

function bumpAggregate(
  agg: IncidentAggregate,
  nta: string,
  category: CrimeCategory,
  month: string,
): void {
  const byCategory = (agg[nta] ??= {});
  const byMonth = (byCategory[category] ??= {});
  byMonth[month] = (byMonth[month] ?? 0) + 1;
}

export function mergeAggregates(a: IncidentAggregate, b: IncidentAggregate): IncidentAggregate {
  const out: IncidentAggregate = structuredClone(a);
  for (const [nta, cats] of Object.entries(b)) {
    for (const [cat, months] of Object.entries(cats)) {
      for (const [month, n] of Object.entries(months)) {
        const byCat = (out[nta] ??= {});
        const byMonth = (byCat[cat] ??= {});
        byMonth[month] = (byMonth[month] ?? 0) + n;
      }
    }
  }
  return out;
}
