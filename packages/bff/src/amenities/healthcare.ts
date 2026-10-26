import { FACDB_HEALTHCARE_EXCLUDED_TYPES, type Nta2020Code } from '@nyc-atlas/shared';
import { getOrCreate } from '../common/map-utils.js';
import { pointFromLatLonFields } from '../common/geo-point.js';
import type { NtaLocator } from '../common/nta-locator.js';
import type { RejectionLog } from '../common/rejection-log.js';
import type { FacDbHealthRow, HealthcareTally } from './amenities.types.js';

export const RESIDENTIAL_PROGRAM_NOT_CARE_SITE =
  'healthcare: residential program, not a care access point';
export const HEALTHCARE_OUTSIDE_NEIGHBORHOODS = 'healthcare: could not resolve to an NTA';

/** 'HOSPITAL EXTENSION CLINIC' is a clinic a hospital runs, not a hospital. */
const HOSPITAL_TYPES = new Set(['HOSPITAL', 'ACUTE CARE HOSPITAL']);

export function readFacilityType(row: FacDbHealthRow): string {
  return (row.factype ?? '').trim().toUpperCase();
}

export function isResidentialProgram(facilityType: string): boolean {
  return FACDB_HEALTHCARE_EXCLUDED_TYPES.includes(facilityType);
}

export function isHospital(facilityType: string): boolean {
  return HOSPITAL_TYPES.has(facilityType);
}

export function tallyHealthcareByNeighborhood(
  rows: readonly FacDbHealthRow[],
  locator: NtaLocator,
  rejections: RejectionLog,
): Map<Nta2020Code, HealthcareTally> {
  const byNta = new Map<Nta2020Code, HealthcareTally>();

  for (const facility of rows) {
    const facilityType = readFacilityType(facility);
    if (isResidentialProgram(facilityType)) {
      rejections.record(RESIDENTIAL_PROGRAM_NOT_CARE_SITE);
      continue;
    }

    const point = pointFromLatLonFields(facility.latitude, facility.longitude);
    const nta2020 = locator.fromUpstreamCodeOrPoint(facility.nta2020, point);
    if (nta2020 === null) {
      rejections.record(HEALTHCARE_OUTSIDE_NEIGHBORHOODS);
      continue;
    }

    const tally = getOrCreate(byNta, nta2020, () => ({ sites: 0, hospitals: 0 }));
    tally.sites += 1;
    if (isHospital(facilityType)) tally.hospitals += 1;
  }

  return byNta;
}
