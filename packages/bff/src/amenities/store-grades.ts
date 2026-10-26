import { FOOD_GRADE_PASS, type Nta2020Code } from '@nyc-atlas/shared';
import { getOrCreate } from '../common/map-utils.js';
import type { NtaLocator } from '../common/nta-locator.js';
import type { RejectionLog } from '../common/rejection-log.js';
import { pointFromGeoreference } from '../common/geo-point.js';
import type { InspectionRow, StoreGradeTally } from './amenities.types.js';

export const INSPECTION_WITHOUT_GRADE = 'store grades: inspection carries no grade';
export const INSPECTION_WITHOUT_LOCATION = 'store grades: inspection has no georeference';
export const INSPECTION_OUTSIDE_NEIGHBORHOODS = 'store grades: could not resolve to an NTA';

function establishmentIdentity(row: InspectionRow): string {
  return `${row.owner_name ?? ''}|${row.trade_name ?? ''}|${row.street ?? ''}`;
}

/**
 * Reduces the inspection file to one current inspection per establishment.
 *
 * Two collapses happen at once, and skipping either inverts the measure. The
 * file carries one row per deficiency, so a filthy store contributes a dozen
 * rows and a clean one contributes a single row — counting rows would rank the
 * worst neighborhoods best. Establishments are also inspected repeatedly, and
 * an old failure that has since been corrected is not the store's grade today.
 */
export function collapseToCurrentInspections(
  rows: readonly InspectionRow[],
): InspectionRow[] {
  const latestByEstablishment = new Map<string, InspectionRow>();

  for (const row of rows) {
    const identity = establishmentIdentity(row);
    const held = latestByEstablishment.get(identity);
    const isNewer = held === undefined || (row.inspection_date ?? '') > (held.inspection_date ?? '');
    if (isNewer) latestByEstablishment.set(identity, row);
  }

  return [...latestByEstablishment.values()];
}

export function readGrade(row: InspectionRow): string {
  return (row.inspection_grade ?? '').trim().toUpperCase();
}

export function tallyGradesByNeighborhood(
  currentInspections: readonly InspectionRow[],
  locator: NtaLocator,
  rejections: RejectionLog,
): Map<Nta2020Code, StoreGradeTally> {
  const byNta = new Map<Nta2020Code, StoreGradeTally>();

  for (const inspection of currentInspections) {
    const grade = readGrade(inspection);
    if (grade === '') {
      rejections.record(INSPECTION_WITHOUT_GRADE);
      continue;
    }

    const point = pointFromGeoreference(inspection.georeference);
    if (point === null) {
      rejections.record(INSPECTION_WITHOUT_LOCATION);
      continue;
    }

    const nta2020 = locator.fromPoint(point);
    if (nta2020 === null) {
      rejections.record(INSPECTION_OUTSIDE_NEIGHBORHOODS);
      continue;
    }

    const tally = getOrCreate(byNta, nta2020, () => ({ graded: 0, passing: 0 }));
    tally.graded += 1;
    if (grade === FOOD_GRADE_PASS) tally.passing += 1;
  }

  return byNta;
}

export function unplacedInspectionCount(rejections: RejectionLog): number {
  return (
    rejections.countOf(INSPECTION_WITHOUT_LOCATION) +
    rejections.countOf(INSPECTION_OUTSIDE_NEIGHBORHOODS)
  );
}
