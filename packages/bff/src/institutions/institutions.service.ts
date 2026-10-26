import { Injectable, Logger } from '@nestjs/common';
import {
  DATASETS,
  FACDB_CULTURAL_DOMAIN,
  hasValue,
  type InstitutionScope,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import { GeographyService } from '../geography/geography.service.js';
import { NtaLocator } from '../common/nta-locator.js';
import { pointFromLatLonFields } from '../common/geo-point.js';
import { RejectionLog } from '../common/rejection-log.js';

export interface UnifiedInstitution {
  id: string;
  name: string;
  source: 'DCLA' | 'FACDB';
  sourceId: string;
  lon: number;
  lat: number;
  nta2020: Nta2020Code | null;
  scope: InstitutionScope;
  discipline: string | null;
  facilitySubgroup: string | null;
  facilityType: string | null;
  dedupeKey: string;
}

interface DclaRow {
  organization_name?: string;
  address?: string;
  borough?: string;
  discipline?: string;
  latitude?: string;
  longitude?: string;
  nta?: string;
  bbl?: string;
}

interface FacDbRow {
  uid?: string;
  facname?: string;
  address?: string;
  boro?: string;
  latitude?: string;
  longitude?: string;
  nta2020?: string;
  facdomain?: string;
  facsubgrp?: string;
  factype?: string;
  bbl?: string;
}

/** Domains counted as "third places" under the BROAD scope. */
const BROAD_EXTRA_DOMAIN = 'PARKS, GARDENS, AND HISTORICAL SITES';

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name);

  constructor(
    private readonly socrata: SocrataService,
    private readonly geography: GeographyService,
  ) {}

  /**
   * Fetches both sources and unifies them.
   *
   * DCLA carries `nta` and FacDB carries `nta2020`, so neither needs a spatial
   * join — but both are trusted only after a bounds check, and any row whose
   * NTA code is missing or unknown falls back to point-in-polygon.
   */
  async fetchAll(): Promise<{ institutions: UnifiedInstitution[]; rejected: Map<string, number> }> {
    const rejections = new RejectionLog();
    const bump = (reason: string): void => rejections.record(reason);
    const locator = new NtaLocator(this.geography);

    const [dcla, facdb] = await this.fetchSources();
    this.logger.log(`Fetched ${dcla.length} DCLA rows, ${facdb.length} FacDB rows`);

    const unified = [
      ...mapRows(dcla, (row) => toDclaInstitution(row, locator, bump)),
      ...mapRows(facdb, (row) => toFacDbInstitution(row, locator, bump)),
    ];

    const deduped = this.dedupe(unified, bump);
    this.logScopeCounts(deduped);

    return { institutions: deduped, rejected: rejections.toMap() };
  }

  private fetchSources(): Promise<[DclaRow[], FacDbRow[]]> {
    return Promise.all([
      this.socrata.query<DclaRow>(DATASETS.culturalOrgsDcla.id, { limit: 50_000 }),
      this.socrata.query<FacDbRow>(DATASETS.facilities.id, {
        where: `facdomain in('${FACDB_CULTURAL_DOMAIN}','${BROAD_EXTRA_DOMAIN}')`,
        limit: 50_000,
      }),
    ]);
  }

  private logScopeCounts(institutions: readonly UnifiedInstitution[]): void {
    const countIn = (scope: InstitutionScope): number =>
      institutions.filter((institution) => institution.scope === scope).length;

    this.logger.log(
      `Unified ${institutions.length} institutions ` +
        `(${countIn('NARROW')} narrow, ${countIn('STANDARD')} standard, ` +
        `${countIn('BROAD')} broad)`,
    );
  }

  /**
   * Removes cross-source duplicates. A venue listed in both DCLA and FacDB is
   * one institution, not two; counting it twice would inflate exactly the
   * neighborhoods with the best-documented cultural infrastructure.
   *
   * The surviving record keeps the NARROWEST scope, so scope filtering stays
   * monotonic (specs/003 invariant 2).
   */
  private dedupe(
    rows: UnifiedInstitution[],
    bump: (reason: string) => void,
  ): UnifiedInstitution[] {
    const byKey = new Map<string, UnifiedInstitution>();
    for (const row of rows) {
      const existing = byKey.get(row.dedupeKey);
      if (existing === undefined) {
        byKey.set(row.dedupeKey, row);
        continue;
      }
      bump('duplicate across DCLA and FacDB');
      if (scopeRank(row.scope) < scopeRank(existing.scope)) {
        byKey.set(row.dedupeKey, { ...row, scope: row.scope });
      }
    }
    return [...byKey.values()];
  }
}

/** Drops rows the mapper could not use, keeping the ones it could. */
function mapRows<T>(
  rows: readonly T[],
  toInstitution: (row: T) => UnifiedInstitution | null,
): UnifiedInstitution[] {
  const mapped: UnifiedInstitution[] = [];
  for (const row of rows) {
    const institution = toInstitution(row);
    if (institution !== null) mapped.push(institution);
  }
  return mapped;
}

/** The DCLA directory is the narrowest definition: funded arts organizations. */
function toDclaInstitution(
  row: DclaRow,
  locator: NtaLocator,
  bump: (reason: string) => void,
): UnifiedInstitution | null {
  const point = pointFromLatLonFields(row.latitude, row.longitude);
  if (point === null) {
    bump('DCLA: missing or out-of-bounds coordinates');
    return null;
  }

  const name = (row.organization_name ?? '').trim();
  if (name === '') {
    bump('DCLA: missing organization name');
    return null;
  }

  const nta2020 = locator.fromUpstreamCodeOrPoint(row.nta, point);
  if (nta2020 === null) bump('DCLA: could not resolve to an NTA');

  return {
    id: `DCLA:${slug(name)}:${point.lon.toFixed(5)},${point.lat.toFixed(5)}`,
    name,
    source: 'DCLA',
    sourceId: slug(name),
    lon: point.lon,
    lat: point.lat,
    nta2020,
    scope: 'NARROW',
    discipline: hasValue(row.discipline) ? row.discipline.trim() : null,
    facilitySubgroup: null,
    facilityType: null,
    dedupeKey: dedupeKey(row.bbl, name),
  };
}

/** Cultural facilities are STANDARD; parks and historical sites only count under BROAD. */
function toFacDbInstitution(
  row: FacDbRow,
  locator: NtaLocator,
  bump: (reason: string) => void,
): UnifiedInstitution | null {
  const point = pointFromLatLonFields(row.latitude, row.longitude);
  if (point === null) {
    bump('FacDB: missing or out-of-bounds coordinates');
    return null;
  }

  const name = (row.facname ?? '').trim();
  if (name === '') {
    bump('FacDB: missing facility name');
    return null;
  }

  const nta2020 = locator.fromUpstreamCodeOrPoint(row.nta2020, point);
  if (nta2020 === null) bump('FacDB: could not resolve to an NTA');

  return {
    id: `FACDB:${row.uid ?? slug(name)}`,
    name,
    source: 'FACDB',
    sourceId: row.uid ?? slug(name),
    lon: point.lon,
    lat: point.lat,
    nta2020,
    scope: row.facdomain === FACDB_CULTURAL_DOMAIN ? 'STANDARD' : 'BROAD',
    discipline: null,
    facilitySubgroup: hasValue(row.facsubgrp) ? row.facsubgrp.trim() : null,
    facilityType: hasValue(row.factype) ? row.factype.trim() : null,
    dedupeKey: dedupeKey(row.bbl, name),
  };
}

function scopeRank(s: InstitutionScope): number {
  return s === 'NARROW' ? 0 : s === 'STANDARD' ? 1 : 2;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/**
 * BBL (borough-block-lot) identifies a tax lot and is the strongest join key
 * available. Where it is absent, fall back to a normalized name, which is
 * weaker but still catches the common "same venue, two directories" case.
 */
function dedupeKey(bbl: string | undefined, name: string): string {
  if (hasValue(bbl) && bbl.trim() !== '0') return `bbl:${bbl.trim()}`;
  return `name:${slug(name)}`;
}
