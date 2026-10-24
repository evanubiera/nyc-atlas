import { Injectable, Logger } from '@nestjs/common';
import {
  DATASETS,
  FACDB_CULTURAL_DOMAIN,
  isWithinNycBounds,
  hasValue,
  type InstitutionScope,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import { GeographyService } from '../geography/geography.service.js';

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
    const rejected = new Map<string, number>();
    const bump = (reason: string): void => {
      rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
    };

    const [dcla, facdb] = await Promise.all([
      this.socrata.query<DclaRow>(DATASETS.culturalOrgsDcla.id, { limit: 50_000 }),
      this.socrata.query<FacDbRow>(DATASETS.facilities.id, {
        where: `facdomain in('${FACDB_CULTURAL_DOMAIN}','${BROAD_EXTRA_DOMAIN}')`,
        limit: 50_000,
      }),
    ]);

    this.logger.log(`Fetched ${dcla.length} DCLA rows, ${facdb.length} FacDB rows`);

    const out: UnifiedInstitution[] = [];

    for (const r of dcla) {
      const lon = Number(r.longitude);
      const lat = Number(r.latitude);
      if (!isWithinNycBounds(lon, lat)) {
        bump('DCLA: missing or out-of-bounds coordinates');
        continue;
      }
      const name = (r.organization_name ?? '').trim();
      if (name === '') {
        bump('DCLA: missing organization name');
        continue;
      }
      const nta = this.resolveNta(r.nta, lon, lat);
      if (nta === null) bump('DCLA: could not resolve to an NTA');

      out.push({
        id: `DCLA:${slug(name)}:${lon.toFixed(5)},${lat.toFixed(5)}`,
        name,
        source: 'DCLA',
        sourceId: slug(name),
        lon,
        lat,
        nta2020: nta,
        // The DCLA directory is the narrowest definition: funded arts orgs.
        scope: 'NARROW',
        discipline: hasValue(r.discipline) ? r.discipline.trim() : null,
        facilitySubgroup: null,
        facilityType: null,
        dedupeKey: dedupeKey(r.bbl, name),
      });
    }

    for (const r of facdb) {
      const lon = Number(r.longitude);
      const lat = Number(r.latitude);
      if (!isWithinNycBounds(lon, lat)) {
        bump('FacDB: missing or out-of-bounds coordinates');
        continue;
      }
      const name = (r.facname ?? '').trim();
      if (name === '') {
        bump('FacDB: missing facility name');
        continue;
      }
      const nta = this.resolveNta(r.nta2020, lon, lat);
      if (nta === null) bump('FacDB: could not resolve to an NTA');

      // Cultural facilities are STANDARD; parks and historical sites only
      // count under BROAD.
      const scope: InstitutionScope =
        r.facdomain === FACDB_CULTURAL_DOMAIN ? 'STANDARD' : 'BROAD';

      out.push({
        id: `FACDB:${r.uid ?? slug(name)}`,
        name,
        source: 'FACDB',
        sourceId: r.uid ?? slug(name),
        lon,
        lat,
        nta2020: nta,
        scope,
        discipline: null,
        facilitySubgroup: hasValue(r.facsubgrp) ? r.facsubgrp.trim() : null,
        facilityType: hasValue(r.factype) ? r.factype.trim() : null,
        dedupeKey: dedupeKey(r.bbl, name),
      });
    }

    const deduped = this.dedupe(out, bump);
    this.logger.log(
      `Unified ${deduped.length} institutions ` +
        `(${deduped.filter((i) => i.scope === 'NARROW').length} narrow, ` +
        `${deduped.filter((i) => i.scope === 'STANDARD').length} standard, ` +
        `${deduped.filter((i) => i.scope === 'BROAD').length} broad)`,
    );

    return { institutions: deduped, rejected };
  }

  /**
   * Prefers the upstream NTA code, falling back to point-in-polygon.
   * An upstream code is only accepted if it names a known NTA — stale 2010
   * codes and blanks must not silently become a neighborhood.
   */
  private resolveNta(upstream: string | undefined, lon: number, lat: number): Nta2020Code | null {
    if (hasValue(upstream)) {
      const code = upstream.trim();
      if (this.geography.getRecord(code) !== undefined) return code;
    }
    return this.geography.resolvePoint(lon, lat);
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
