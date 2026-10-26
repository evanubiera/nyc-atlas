import { empiricalBayesSmooth, type Nta2020Code } from '@nyc-atlas/shared';
import { getOrCreate } from '../common/map-utils.js';
import type { NtaRecord } from '../geography/geography.service.js';
import type { NtaDemographics } from '../census/census.service.js';
import type { UnifiedInstitution } from '../institutions/institutions.service.js';
import type { SmoothedRate } from './neighborhood-row.js';

export function countInstitutionsByNeighborhood(
  institutions: readonly UnifiedInstitution[],
): Map<string, number> {
  const byNta = new Map<string, number>();
  for (const institution of institutions) {
    if (institution.nta2020 === null) continue;
    byNta.set(institution.nta2020, (byNta.get(institution.nta2020) ?? 0) + 1);
  }
  return byNta;
}

function groupByBorough(records: readonly NtaRecord[]): Map<number, NtaRecord[]> {
  const byBorough = new Map<number, NtaRecord[]>();
  for (const record of records) {
    getOrCreate(byBorough, record.boroughCode, () => []).push(record);
  }
  return byBorough;
}

/**
 * Shrinks each neighborhood's rate toward its borough's mean rather than the
 * city's: boroughs differ enough that a citywide prior would distort every
 * estimate.
 */
export function smoothRatesWithinBoroughs(
  records: readonly NtaRecord[],
  incidentCounts: ReadonlyMap<string, number>,
  demographics: Record<string, NtaDemographics>,
): Map<Nta2020Code, SmoothedRate> {
  const smoothed = new Map<Nta2020Code, SmoothedRate>();

  for (const group of groupByBorough(records).values()) {
    const observations = group.map((record) => ({
      key: record.nta2020,
      count: incidentCounts.get(record.nta2020) ?? 0,
      population: demographics[record.nta2020]?.population ?? 0,
    }));

    for (const result of empiricalBayesSmooth(observations)) {
      smoothed.set(result.key, {
        smoothed: result.smoothedRatePer100k,
        raw: result.rawRatePer100k,
      });
    }
  }

  return smoothed;
}
