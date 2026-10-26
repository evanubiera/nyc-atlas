import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NtaLocator } from '../common/nta-locator.js';
import { RejectionLog } from '../common/rejection-log.js';
import {
  DBN_HAS_NO_PUBLISHED_LOCATION,
  indexNeighborhoodsByDbn,
  poolProficiencyPerSchool,
  PROFICIENCY_ROW_INCOMPLETE,
  tallySchoolsByNeighborhood,
} from './schools.js';
import type { SchoolQualityRow } from './amenities.types.js';

function subjectRow(
  dbn: string,
  proficiency: number,
  students: number,
): SchoolQualityRow {
  return {
    dbn,
    metric_value: String(proficiency),
    number_of_students: String(students),
  };
}

test('a school pools its two subjects before any neighborhood roll-up', () => {
  const pooled = poolProficiencyPerSchool(
    [subjectRow('01M015', 0.6, 100), subjectRow('01M015', 0.4, 100)],
    new RejectionLog(),
  );

  const school = pooled.get('01M015');
  assert.ok(school !== undefined);
  assert.equal(school.studentSittings, 200);
  assert.equal(school.proficiencyTimesStudents / school.studentSittings, 0.5);
});

test('a school reporting one subject is not under-weighted against one reporting both', () => {
  const rejections = new RejectionLog();
  const pooled = poolProficiencyPerSchool(
    [
      subjectRow('ONE', 0.8, 100),
      subjectRow('BOTH', 0.8, 100),
      subjectRow('BOTH', 0.8, 100),
    ],
    rejections,
  );

  const tallied = tallySchoolsByNeighborhood(
    pooled,
    new Map([
      ['ONE', 'MN0101'],
      ['BOTH', 'MN0101'],
    ]),
    rejections,
  ).get('MN0101');

  assert.ok(tallied !== undefined);
  assert.equal(tallied.weightedProficiency / tallied.students, 0.8);
});

test('student sittings halve into tested enrolment, not test sittings', () => {
  const pooled = poolProficiencyPerSchool(
    [subjectRow('01M015', 0.5, 300), subjectRow('01M015', 0.5, 300)],
    new RejectionLog(),
  );
  const tallied = tallySchoolsByNeighborhood(
    pooled,
    new Map([['01M015', 'MN0101']]),
    new RejectionLog(),
  ).get('MN0101');

  assert.equal(tallied?.students, 300);
  assert.equal(tallied?.schools, 1);
});

test('proficiency across schools is weighted by students, not by school', () => {
  const pooled = poolProficiencyPerSchool(
    [subjectRow('BIG', 0.9, 2000), subjectRow('SMALL', 0.1, 20)],
    new RejectionLog(),
  );
  const tallied = tallySchoolsByNeighborhood(
    pooled,
    new Map([
      ['BIG', 'MN0101'],
      ['SMALL', 'MN0101'],
    ]),
    new RejectionLog(),
  ).get('MN0101');

  assert.ok(tallied !== undefined);
  const weighted = tallied.weightedProficiency / tallied.students;
  assert.ok(weighted > 0.88, `expected the large school to dominate, got ${weighted}`);
  assert.notEqual(weighted, 0.5);
});

test('the roll-up is order independent, so repeated ingests agree bit for bit', () => {
  const rows = [
    subjectRow('03M999', 0.31, 137),
    subjectRow('01M015', 0.67, 69),
    subjectRow('02M111', 0.52, 431),
    subjectRow('04M222', 0.78, 93),
  ];
  const ntaByDbn = new Map(rows.map((r) => [r.dbn as string, 'MN0101']));

  const forwards = tallySchoolsByNeighborhood(
    poolProficiencyPerSchool(rows, new RejectionLog()),
    ntaByDbn,
    new RejectionLog(),
  ).get('MN0101');

  const backwards = tallySchoolsByNeighborhood(
    poolProficiencyPerSchool([...rows].reverse(), new RejectionLog()),
    ntaByDbn,
    new RejectionLog(),
  ).get('MN0101');

  assert.equal(forwards?.weightedProficiency, backwards?.weightedProficiency);
  assert.equal(forwards?.students, backwards?.students);
});

test('rows missing a value or a student count are recorded, not treated as zero', () => {
  const rejections = new RejectionLog();
  const pooled = poolProficiencyPerSchool(
    [
      { dbn: '01M015', metric_value: 's.', number_of_students: '10' },
      { dbn: '01M015', metric_value: '0.5', number_of_students: '0' },
      { dbn: '', metric_value: '0.5', number_of_students: '10' },
      subjectRow('01M015', 0.5, 10),
    ],
    rejections,
  );

  assert.equal(rejections.countOf(PROFICIENCY_ROW_INCOMPLETE), 3);
  assert.equal(pooled.get('01M015')?.studentSittings, 10);
});

test('a school with outcomes but no published location is reported', () => {
  const rejections = new RejectionLog();
  const pooled = poolProficiencyPerSchool([subjectRow('84X632', 0.5, 100)], rejections);
  const byNta = tallySchoolsByNeighborhood(pooled, new Map(), rejections);

  assert.equal(byNta.size, 0);
  assert.equal(rejections.countOf(DBN_HAS_NO_PUBLISHED_LOCATION), 1);
});

test('school locations index by DBN and skip those that place nowhere', () => {
  const index = indexNeighborhoodsByDbn(
    [
      { system_code: '15K001', latitude: '40.64', longitude: '-74.01' },
      { system_code: '', latitude: '40.64', longitude: '-74.01' },
      { system_code: 'NOWHERE', latitude: '', longitude: '' },
    ],
    new NtaLocator({ resolvePoint: () => 'BK0101', getRecord: () => undefined }),
  );

  assert.equal(index.get('15K001'), 'BK0101');
  assert.equal(index.has('NOWHERE'), false);
  assert.equal(index.size, 1);
});
