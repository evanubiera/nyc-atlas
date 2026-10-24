import { Injectable, Logger } from '@nestjs/common';
import {
  BOROUGHS,
  CENSUS_ACS_BASE,
  CENSUS_ACS_VINTAGE,
  CENSUS_KEY_SIGNUP_URL,
  DATASETS,
  NYS_STATE_FIPS,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { AppConfig } from '../config/configuration.js';
import { SocrataService } from '../socrata/socrata.service.js';

export interface NtaDemographics {
  nta2020: Nta2020Code;
  population: number;
  povertyRate: number | null;
  medianHouseholdIncome: number | null;
  medianIncomeIsApproximated: true;
  shareAged15to24: number | null;
  ownerOccupancyRate: number | null;
  shareBachelorsOrHigher: number | null;
  acsVintage: string;
  contributingTracts: number;
}

/**
 * ACS variables. Counts sum across tracts; medians do NOT — median household
 * income is approximated as a population-weighted mean of tract medians and
 * flagged as such. See specs/002 §Socioeconomic.
 */
const VARS = {
  population: 'B01003_001E',
  povertyUniverse: 'B17001_001E',
  povertyBelow: 'B17001_002E',
  medianIncome: 'B19013_001E',
  tenureTotal: 'B25003_001E',
  tenureOwner: 'B25003_002E',
  eduTotal: 'B15003_001E',
  eduBachelor: 'B15003_022E',
  eduMaster: 'B15003_023E',
  eduProfessional: 'B15003_024E',
  eduDoctorate: 'B15003_025E',
  // Age 15–24, both sexes. B01001 splits by sex then band.
  m15to17: 'B01001_006E',
  m18to19: 'B01001_007E',
  m20: 'B01001_008E',
  m21: 'B01001_009E',
  m22to24: 'B01001_010E',
  f15to17: 'B01001_030E',
  f18to19: 'B01001_031E',
  f20: 'B01001_032E',
  f21: 'B01001_033E',
  f22to24: 'B01001_034E',
} as const;

type VarKey = keyof typeof VARS;

interface TractRow {
  geoid: string;
  values: Partial<Record<VarKey, number | null>>;
}

@Injectable()
export class CensusService {
  private readonly logger = new Logger(CensusService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly socrata: SocrataService,
  ) {}

  get isAvailable(): boolean {
    return this.config.hasCensusKey;
  }

  /**
   * Pulls ACS 5-year estimates at tract level for the five NYC counties and
   * aggregates them to 2020 NTAs using the official DCP crosswalk.
   *
   * Returns an empty map (not an error) when no key is configured, so the app
   * degrades visibly rather than failing to start — specs/001 NFR-5.
   */
  async fetchNtaDemographics(): Promise<Map<Nta2020Code, NtaDemographics>> {
    if (!this.isAvailable) {
      this.logger.warn(
        `CENSUS_API_KEY not set — skipping ACS. Confounder adjustment will be unavailable. ` +
          `Free key: ${CENSUS_KEY_SIGNUP_URL}`,
      );
      return new Map();
    }

    const [tracts, crosswalk] = await Promise.all([
      this.fetchTracts(),
      this.fetchCrosswalk(),
    ]);

    this.logger.log(
      `Fetched ${tracts.length} tracts; crosswalk covers ${crosswalk.size} tract GEOIDs`,
    );

    const byNta = new Map<Nta2020Code, TractRow[]>();
    let unmatched = 0;
    for (const tract of tracts) {
      const nta = crosswalk.get(tract.geoid);
      if (nta === undefined) {
        unmatched += 1;
        continue;
      }
      const list = byNta.get(nta) ?? [];
      list.push(tract);
      byNta.set(nta, list);
    }
    if (unmatched > 0) {
      this.logger.warn(`${unmatched} tracts had no NTA in the crosswalk and were dropped`);
    }

    const out = new Map<Nta2020Code, NtaDemographics>();
    for (const [nta, rows] of byNta) {
      out.set(nta, aggregateTracts(nta, rows));
    }

    this.logger.log(`Aggregated ACS to ${out.size} NTAs`);
    return out;
  }

  private async fetchTracts(): Promise<TractRow[]> {
    const key = this.config.censusApiKey;
    const varList = Object.values(VARS);
    const keys = Object.keys(VARS) as VarKey[];
    const rows: TractRow[] = [];

    for (const boro of BOROUGHS) {
      const url =
        `${CENSUS_ACS_BASE}?get=${varList.join(',')}` +
        `&for=tract:*&in=state:${NYS_STATE_FIPS}%20county:${boro.countyFips}` +
        `&key=${key ?? ''}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Census API ${res.status} for ${boro.name}: ${body.slice(0, 200)}. ` +
            `A 302 or 403 usually means the key is missing or invalid (${CENSUS_KEY_SIGNUP_URL}).`,
        );
      }

      const table = (await res.json()) as string[][];
      const header = table[0];
      if (header === undefined) continue;
      const idx = (name: string): number => header.indexOf(name);

      const stateIdx = idx('state');
      const countyIdx = idx('county');
      const tractIdx = idx('tract');

      for (const row of table.slice(1)) {
        const geoid = `${row[stateIdx]}${row[countyIdx]}${row[tractIdx]}`;
        const values: Partial<Record<VarKey, number | null>> = {};
        for (const k of keys) {
          const raw = row[idx(VARS[k])];
          values[k] = parseAcs(raw);
        }
        rows.push({ geoid, values });
      }
    }

    return rows;
  }

  /** tract GEOID -> NTA2020 code, from the DCP equivalency table. */
  private async fetchCrosswalk(): Promise<Map<string, Nta2020Code>> {
    const rows = await this.socrata.query<{ geoid?: string; ntacode?: string }>(
      DATASETS.tractToNta.id,
      { select: 'geoid, ntacode', limit: 5000 },
    );
    const map = new Map<string, Nta2020Code>();
    for (const r of rows) {
      if (r.geoid && r.ntacode) map.set(r.geoid, r.ntacode);
    }
    return map;
  }
}

/**
 * ACS uses large negative sentinels (-666666666 and friends) for suppressed or
 * unavailable estimates. Treating them as numbers would silently produce
 * enormous negative incomes.
 */
function parseAcs(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n <= -666666666) return null;
  return n;
}

function sum(rows: TractRow[], key: VarKey): number {
  let total = 0;
  for (const r of rows) {
    const v = r.values[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function aggregateTracts(nta: Nta2020Code, rows: TractRow[]): NtaDemographics {
  const population = sum(rows, 'population');

  const povertyUniverse = sum(rows, 'povertyUniverse');
  const povertyBelow = sum(rows, 'povertyBelow');

  const tenureTotal = sum(rows, 'tenureTotal');
  const tenureOwner = sum(rows, 'tenureOwner');

  const eduTotal = sum(rows, 'eduTotal');
  const eduHigh =
    sum(rows, 'eduBachelor') +
    sum(rows, 'eduMaster') +
    sum(rows, 'eduProfessional') +
    sum(rows, 'eduDoctorate');

  const aged15to24 =
    sum(rows, 'm15to17') + sum(rows, 'm18to19') + sum(rows, 'm20') + sum(rows, 'm21') +
    sum(rows, 'm22to24') + sum(rows, 'f15to17') + sum(rows, 'f18to19') + sum(rows, 'f20') +
    sum(rows, 'f21') + sum(rows, 'f22to24');

  // Medians cannot be summed. Weight each tract's median by its population —
  // an approximation, flagged in the type so no consumer can forget.
  let incomeWeighted = 0;
  let incomeWeight = 0;
  for (const r of rows) {
    const med = r.values.medianIncome;
    const pop = r.values.population;
    if (typeof med === 'number' && typeof pop === 'number' && pop > 0) {
      incomeWeighted += med * pop;
      incomeWeight += pop;
    }
  }

  return {
    nta2020: nta,
    population,
    povertyRate: ratio(povertyBelow, povertyUniverse),
    medianHouseholdIncome: incomeWeight > 0 ? incomeWeighted / incomeWeight : null,
    medianIncomeIsApproximated: true,
    shareAged15to24: ratio(aged15to24, population),
    ownerOccupancyRate: ratio(tenureOwner, tenureTotal),
    shareBachelorsOrHigher: ratio(eduHigh, eduTotal),
    acsVintage: CENSUS_ACS_VINTAGE,
    contributingTracts: rows.length,
  };
}
