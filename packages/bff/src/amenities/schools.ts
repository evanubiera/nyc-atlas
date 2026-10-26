import type { Nta2020Code } from '@nyc-atlas/shared';
import { getOrCreate } from '../common/map-utils.js';
import { pointFromLatLonFields } from '../common/geo-point.js';
import type { NtaLocator } from '../common/nta-locator.js';
import type { RejectionLog } from '../common/rejection-log.js';
import type { SchoolLocationRow, SchoolQualityRow, SchoolTally } from './amenities.types.js';

export const PROFICIENCY_ROW_INCOMPLETE =
  'schools: proficiency row missing a value or a student count';
export const DBN_HAS_NO_PUBLISHED_LOCATION =
  'schools: DBN has outcomes but no location in the 2019-20 vintage';

/** The two subjects each school reports, pooled into one figure per school. */
const SUBJECTS_PER_SCHOOL = 2;

interface SchoolProficiency {
  proficiencyTimesStudents: number;
  studentSittings: number;
}

export function indexNeighborhoodsByDbn(
  locations: readonly SchoolLocationRow[],
  locator: NtaLocator,
): Map<string, Nta2020Code> {
  const ntaByDbn = new Map<string, Nta2020Code>();

  for (const location of locations) {
    const dbn = (location.system_code ?? '').trim();
    if (dbn === '') continue;

    const nta2020 = locator.fromPoint(
      pointFromLatLonFields(location.latitude, location.longitude),
    );
    if (nta2020 !== null) ntaByDbn.set(dbn, nta2020);
  }

  return ntaByDbn;
}

/**
 * Pools a school's subjects before any neighborhood roll-up, so a school that
 * reported only one subject is not under-weighted against one that reported
 * both.
 */
export function poolProficiencyPerSchool(
  qualityRows: readonly SchoolQualityRow[],
  rejections: RejectionLog,
): Map<string, SchoolProficiency> {
  const byDbn = new Map<string, SchoolProficiency>();

  for (const row of qualityRows) {
    const dbn = (row.dbn ?? '').trim();
    const proficiency = Number(row.metric_value);
    const students = Number(row.number_of_students);

    if (dbn === '' || !Number.isFinite(proficiency) || !Number.isFinite(students) || students <= 0) {
      rejections.record(PROFICIENCY_ROW_INCOMPLETE);
      continue;
    }

    const school = getOrCreate(byDbn, dbn, () => ({
      proficiencyTimesStudents: 0,
      studentSittings: 0,
    }));
    school.proficiencyTimesStudents += proficiency * students;
    school.studentSittings += students;
  }

  return byDbn;
}

/**
 * Student sittings are counted once per subject, so halving them yields a
 * school's tested enrolment rather than its number of test sittings.
 */
function testedEnrolmentOf(school: SchoolProficiency): number {
  return school.studentSittings / SUBJECTS_PER_SCHOOL;
}

/**
 * Schools are rolled up in DBN order rather than arrival order.
 *
 * Socrata does not guarantee row order without an explicit `$order`, so the
 * same query returns the same schools in a different sequence between runs.
 * Summing floats in that sequence makes a neighborhood's proficiency differ in
 * its last digits from one ingest to the next, which breaks the byte-identical
 * cache the build depends on (specs/001 NFR-11).
 */
function inDeterministicOrder(
  proficiencyByDbn: ReadonlyMap<string, SchoolProficiency>,
): [string, SchoolProficiency][] {
  return [...proficiencyByDbn.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function tallySchoolsByNeighborhood(
  proficiencyByDbn: ReadonlyMap<string, SchoolProficiency>,
  ntaByDbn: ReadonlyMap<string, Nta2020Code>,
  rejections: RejectionLog,
): Map<Nta2020Code, SchoolTally> {
  const byNta = new Map<Nta2020Code, SchoolTally>();

  for (const [dbn, school] of inDeterministicOrder(proficiencyByDbn)) {
    const nta2020 = ntaByDbn.get(dbn);
    if (nta2020 === undefined) {
      rejections.record(DBN_HAS_NO_PUBLISHED_LOCATION);
      continue;
    }

    const proficiency = school.proficiencyTimesStudents / school.studentSittings;
    const students = testedEnrolmentOf(school);

    const tally = getOrCreate(byNta, nta2020, () => ({
      schools: 0,
      students: 0,
      weightedProficiency: 0,
    }));
    tally.schools += 1;
    tally.students += students;
    tally.weightedProficiency += proficiency * students;
  }

  return byNta;
}
