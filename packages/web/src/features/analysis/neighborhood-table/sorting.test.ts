import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSortState, sortNeighborhoods, withUsableRate } from './sorting.ts';
import {
  describeInstitutionKind,
  groupInstitutionsByNeighborhood,
} from './institutions.ts';
import type { InstitutionPoint, NeighborhoodMetric } from '../../../store/atlasApi.js';

function metric(overrides: Partial<NeighborhoodMetric> = {}): NeighborhoodMetric {
  return {
    nta2020: 'MN0101',
    name: 'Somewhere',
    boroughName: 'Manhattan',
    population: 10_000,
    rawCount: 0,
    ratePer100k: 0,
    smoothedRatePer100k: 0,
    confidenceInterval: null,
    institutionCount: 0,
    institutionsPerSqKm: 0,
    institutionsPer10k: 0,
    exposureValue: 0,
    residual: null,
    medianHouseholdIncome: 50_000,
    povertyRate: 0.2,
    shareBachelorsOrHigher: 0.3,
    foodStoreCount: 0,
    supermarketCount: 0,
    supermarketsPer10k: 0,
    gradedStoreCount: 0,
    gradeAStoreCount: 0,
    storeGradeShare: null,
    healthcareSiteCount: 0,
    healthcareSitesPer10k: 0,
    schoolCount: 0,
    schoolStudents: 0,
    schoolProficiency: null,
    isEnforcementDriven: false,
    excluded: null,
    ...overrides,
  };
}

function institution(overrides: Partial<InstitutionPoint> = {}): InstitutionPoint {
  return {
    id: 'x',
    name: 'A PLACE',
    source: 'DCLA',
    lon: -73.98,
    lat: 40.73,
    nta2020: 'MN0101',
    scope: 'NARROW',
    discipline: null,
    facilitySubgroup: null,
    facilityType: null,
    ...overrides,
  };
}

test('clicking a new column sorts numbers high-first and names A-first', () => {
  const fromName = nextSortState({ key: 'name', descending: false }, 'institutionCount');
  assert.deepEqual(fromName, { key: 'institutionCount', descending: true });

  const toName = nextSortState({ key: 'institutionCount', descending: true }, 'name');
  assert.deepEqual(toName, { key: 'name', descending: false });
});

test('clicking the active column flips its direction', () => {
  const once = nextSortState({ key: 'institutionCount', descending: true }, 'institutionCount');
  assert.deepEqual(once, { key: 'institutionCount', descending: false });

  const twice = nextSortState(once, 'institutionCount');
  assert.deepEqual(twice, { key: 'institutionCount', descending: true });
});

test('rows with no value sort last in both directions, never as zero', () => {
  const rows = [
    metric({ nta2020: 'HAS', schoolProficiency: 0.4 }),
    metric({ nta2020: 'NONE', schoolProficiency: null }),
    metric({ nta2020: 'HIGH', schoolProficiency: 0.9 }),
  ];

  const descending = sortNeighborhoods(rows, { key: 'schoolProficiency', descending: true });
  assert.deepEqual(descending.map((r) => r.nta2020), ['HIGH', 'HAS', 'NONE']);

  const ascending = sortNeighborhoods(rows, { key: 'schoolProficiency', descending: false });
  assert.deepEqual(ascending.map((r) => r.nta2020), ['HAS', 'HIGH', 'NONE']);
});

test('sorting leaves the caller’s array untouched', () => {
  const rows = [metric({ nta2020: 'B' }), metric({ nta2020: 'A' })];
  sortNeighborhoods(rows, { key: 'name', descending: false });
  assert.deepEqual(rows.map((r) => r.nta2020), ['B', 'A']);
});

test('excluded neighborhoods are kept out of the table', () => {
  const rows = [
    metric({ nta2020: 'OK' }),
    metric({ nta2020: 'LOW', excluded: { kind: 'LOW_POPULATION', explanation: 'too few' } }),
  ];
  assert.deepEqual(withUsableRate(rows).map((r) => r.nta2020), ['OK']);
});

test('institutions group by neighborhood and skip the unplaceable', () => {
  const grouped = groupInstitutionsByNeighborhood([
    institution({ id: '1', nta2020: 'MN0101' }),
    institution({ id: '2', nta2020: 'MN0101' }),
    institution({ id: '3', nta2020: 'BK0101' }),
    institution({ id: '4', nta2020: null }),
  ]);

  assert.equal(grouped.get('MN0101')?.length, 2);
  assert.equal(grouped.get('BK0101')?.length, 1);
  assert.equal(grouped.size, 2);
});

test('the kind label prefers discipline, then facility type, then subgroup', () => {
  assert.equal(
    describeInstitutionKind(institution({ discipline: 'DANCE', facilityType: 'LIBRARY' })),
    'Dance',
  );
  assert.equal(
    describeInstitutionKind(
      institution({ facilityType: 'BRANCH LIBRARY', facilitySubgroup: 'OTHER' }),
    ),
    'Branch Library',
  );
  assert.equal(
    describeInstitutionKind(institution({ facilitySubgroup: 'OTHER CULTURAL INSTITUTIONS' })),
    'Other Cultural Institutions',
  );
  assert.equal(describeInstitutionKind(institution()), '—');
});
