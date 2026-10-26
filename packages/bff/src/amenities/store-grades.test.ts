import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NtaLocator } from '../common/nta-locator.js';
import { RejectionLog } from '../common/rejection-log.js';
import {
  collapseToCurrentInspections,
  INSPECTION_WITHOUT_GRADE,
  INSPECTION_WITHOUT_LOCATION,
  tallyGradesByNeighborhood,
  unplacedInspectionCount,
} from './store-grades.js';
import type { InspectionRow } from './amenities.types.js';

const MANHATTAN = { lon: -73.98, lat: 40.73 };

function inspection(overrides: Partial<InspectionRow> = {}): InspectionRow {
  return {
    owner_name: 'OWNER INC',
    trade_name: 'CORNER MARKET',
    street: '1 MAIN ST',
    inspection_grade: 'A',
    inspection_date: '2026-01-01T00:00:00.000',
    georeference: { type: 'Point', coordinates: [MANHATTAN.lon, MANHATTAN.lat] },
    ...overrides,
  };
}

function locatorReturning(nta: string | null): NtaLocator {
  return new NtaLocator({ resolvePoint: () => nta, getRecord: () => undefined });
}

test('one row per deficiency collapses to one establishment', () => {
  const dirtyStoreWithManyDeficiencies = [
    inspection({ inspection_grade: 'C' }),
    inspection({ inspection_grade: 'C' }),
    inspection({ inspection_grade: 'C' }),
  ];
  const cleanStoreWithOneRow = [
    inspection({ trade_name: 'TIDY GROCER', street: '2 MAIN ST', inspection_grade: 'A' }),
  ];

  const collapsed = collapseToCurrentInspections([
    ...dirtyStoreWithManyDeficiencies,
    ...cleanStoreWithOneRow,
  ]);

  assert.equal(collapsed.length, 2);
});

test('without the collapse, deficiency rows would invert the measure', () => {
  const rows = [
    inspection({ inspection_grade: 'C' }),
    inspection({ inspection_grade: 'C' }),
    inspection({ inspection_grade: 'C' }),
    inspection({ trade_name: 'TIDY GROCER', street: '2 MAIN ST', inspection_grade: 'A' }),
  ];

  const naiveShare = rows.filter((r) => r.inspection_grade === 'A').length / rows.length;
  const tallied = tallyGradesByNeighborhood(
    collapseToCurrentInspections(rows),
    locatorReturning('MN0101'),
    new RejectionLog(),
  ).get('MN0101');

  assert.ok(tallied !== undefined);
  assert.equal(tallied.passing / tallied.graded, 0.5);
  assert.equal(naiveShare, 0.25);
  assert.ok(naiveShare < tallied.passing / tallied.graded, 'row counting understates the share');
});

test('the most recent inspection wins, whatever order it arrives in', () => {
  const stale = inspection({ inspection_grade: 'C', inspection_date: '2024-01-01T00:00:00.000' });
  const current = inspection({ inspection_grade: 'A', inspection_date: '2026-05-01T00:00:00.000' });

  for (const rows of [[stale, current], [current, stale]]) {
    const collapsed = collapseToCurrentInspections(rows);
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0]?.inspection_grade, 'A');
  }
});

test('establishments are distinguished by owner, trade name and street together', () => {
  const sameNameDifferentStreet = [
    inspection({ street: '1 MAIN ST' }),
    inspection({ street: '500 OTHER AVE' }),
  ];
  assert.equal(collapseToCurrentInspections(sameNameDifferentStreet).length, 2);

  const sameStreetDifferentOwner = [
    inspection({ owner_name: 'FIRST INC' }),
    inspection({ owner_name: 'SECOND INC' }),
  ];
  assert.equal(collapseToCurrentInspections(sameStreetDifferentOwner).length, 2);
});

test('grades are counted per neighborhood, case-insensitively', () => {
  const byNta = tallyGradesByNeighborhood(
    [
      inspection({ inspection_grade: 'a' }),
      inspection({ inspection_grade: 'A' }),
      inspection({ inspection_grade: 'C' }),
    ],
    locatorReturning('MN0101'),
    new RejectionLog(),
  );

  assert.deepEqual(byNta.get('MN0101'), { graded: 3, passing: 2 });
});

test('inspections without a grade or a location are recorded, not counted', () => {
  const rejections = new RejectionLog();
  const byNta = tallyGradesByNeighborhood(
    [
      inspection({ inspection_grade: '' }),
      inspection({ georeference: null }),
      inspection(),
    ],
    locatorReturning('MN0101'),
    rejections,
  );

  assert.deepEqual(byNta.get('MN0101'), { graded: 1, passing: 1 });
  assert.equal(rejections.countOf(INSPECTION_WITHOUT_GRADE), 1);
  assert.equal(rejections.countOf(INSPECTION_WITHOUT_LOCATION), 1);
  assert.equal(unplacedInspectionCount(rejections), 1);
});

test('an inspection outside every neighborhood is not silently dropped', () => {
  const rejections = new RejectionLog();
  const byNta = tallyGradesByNeighborhood(
    [inspection()],
    locatorReturning(null),
    rejections,
  );

  assert.equal(byNta.size, 0);
  assert.equal(unplacedInspectionCount(rejections), 1);
});
