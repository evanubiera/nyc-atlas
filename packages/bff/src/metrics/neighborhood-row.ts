import {
  MIN_POPULATION_FOR_RATE,
  poissonRateInterval,
  type ExposureMeasure,
} from '@nyc-atlas/shared';
import type { NtaRecord } from '../geography/geography.service.js';
import type { NtaDemographics } from '../census/census.service.js';
import type { NtaAmenities } from '../amenities/amenities.types.js';
import { perTenThousand } from './group-pooling.js';
import type { ExclusionNote, NeighborhoodRow } from './metrics.types.js';

export interface SmoothedRate {
  smoothed: number;
  raw: number;
}

export interface RowInputs {
  record: NtaRecord;
  demographics: NtaDemographics | undefined;
  amenities: NtaAmenities | undefined;
  incidentCount: number;
  institutionCount: number;
  smoothedRate: SmoothedRate | undefined;
  exposure: ExposureMeasure;
  demographicsAvailable: boolean;
  isEnforcementDriven: boolean;
}

/**
 * Why a neighborhood carries no rate.
 *
 * A globally missing Census key is a mode rather than a per-neighborhood
 * exclusion, so it is reported in caveats and leaves this null.
 */
export function determineExclusion(
  population: number | null,
  demographicsAvailable: boolean,
): ExclusionNote | null {
  if (population === null) {
    return demographicsAvailable
      ? { kind: 'NO_DEMOGRAPHICS', explanation: 'No ACS data for this neighborhood.' }
      : null;
  }

  if (population < MIN_POPULATION_FOR_RATE) {
    return {
      kind: 'LOW_POPULATION',
      explanation:
        `Population ${population.toLocaleString()} is below ${MIN_POPULATION_FOR_RATE}; ` +
        `a per-capita rate here would be dominated by noise.`,
    };
  }

  return null;
}

function institutionExposure(
  institutionCount: number,
  population: number | null,
  landAreaSqKm: number,
  isRateUsable: boolean,
): { per10k: number | null; perSqKm: number } {
  return {
    per10k:
      isRateUsable && population !== null && population > 0
        ? (institutionCount / population) * 10_000
        : null,
    perSqKm: landAreaSqKm > 0 ? institutionCount / landAreaSqKm : 0,
  };
}

type AmenityFields = Pick<
  NeighborhoodRow,
  | 'foodStoreCount'
  | 'supermarketCount'
  | 'supermarketsPer10k'
  | 'gradedStoreCount'
  | 'gradeAStoreCount'
  | 'storeGradeShare'
  | 'healthcareSiteCount'
  | 'healthcareSitesPer10k'
  | 'schoolCount'
  | 'schoolStudents'
  | 'schoolProficiency'
>;

/**
 * Counts default to zero while their rates stay null without a population, and
 * shares stay null rather than zero: no inspected store is not the same as
 * every store failing.
 *
 * Student counts are rounded here as well as at ingest. The GraphQL field is an
 * Int, and a cache written before that rounding would otherwise fail the whole
 * metrics query on a half-student.
 */
function amenityFields(
  amenities: NtaAmenities | undefined,
  population: number | null,
): AmenityFields {
  return {
    foodStoreCount: amenities?.foodStoreCount ?? 0,
    supermarketCount: amenities?.supermarketCount ?? 0,
    supermarketsPer10k: perTenThousand(amenities?.supermarketCount, population),
    gradedStoreCount: amenities?.gradedStoreCount ?? 0,
    gradeAStoreCount: amenities?.gradeAStoreCount ?? 0,
    storeGradeShare: amenities?.storeGradeShare ?? null,
    healthcareSiteCount: amenities?.healthcareSiteCount ?? 0,
    healthcareSitesPer10k: perTenThousand(amenities?.healthcareSiteCount, population),
    schoolCount: amenities?.schoolCount ?? 0,
    schoolStudents: Math.round(amenities?.schoolStudents ?? 0),
    schoolProficiency: amenities?.schoolProficiency ?? null,
  };
}

export function buildNeighborhoodRow(inputs: RowInputs): NeighborhoodRow {
  const { record, demographics, amenities, incidentCount, institutionCount } = inputs;
  const population = demographics?.population ?? null;
  const excluded = determineExclusion(population, inputs.demographicsAvailable);
  const isRateUsable = population !== null && excluded === null;

  const countPerSqKm = record.landAreaSqKm > 0 ? incidentCount / record.landAreaSqKm : 0;
  const exposure = institutionExposure(
    institutionCount,
    population,
    record.landAreaSqKm,
    isRateUsable,
  );

  const usePerCapitaExposure =
    inputs.exposure !== 'DENSITY' && inputs.demographicsAvailable;
  const fallbackRate = inputs.demographicsAvailable ? null : countPerSqKm;

  return {
    nta2020: record.nta2020,
    name: record.name,
    boroughName: record.boroughName,
    boroughCode: record.boroughCode,
    landAreaSqKm: record.landAreaSqKm,
    centroid: record.centroid,
    population,
    rawCount: incidentCount,
    ratePer100k: isRateUsable ? (inputs.smoothedRate?.raw ?? null) : fallbackRate,
    smoothedRatePer100k: isRateUsable
      ? (inputs.smoothedRate?.smoothed ?? null)
      : fallbackRate,
    confidenceInterval:
      isRateUsable && population !== null
        ? (poissonRateInterval(incidentCount, population) as [number, number] | null)
        : null,
    institutionCount,
    institutionsPerSqKm: exposure.perSqKm,
    institutionsPer10k: exposure.per10k,
    exposureValue: usePerCapitaExposure ? exposure.per10k : exposure.perSqKm,
    residual: null,
    medianHouseholdIncome: demographics?.medianHouseholdIncome ?? null,
    povertyRate: demographics?.povertyRate ?? null,
    shareBachelorsOrHigher: demographics?.shareBachelorsOrHigher ?? null,

    ...amenityFields(amenities, population),

    isEnforcementDriven: inputs.isEnforcementDriven,
    excluded,
  };
}
