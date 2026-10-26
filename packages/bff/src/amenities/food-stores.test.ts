import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NtaLocator } from '../common/nta-locator.js';
import { RejectionLog } from '../common/rejection-log.js';
import {
  isSupermarket,
  STORE_OUTSIDE_NEIGHBORHOODS,
  STORE_WITHOUT_LOCATION,
  tallyFoodStoresByNeighborhood,
} from './food-stores.js';
import {
  isHospital,
  isResidentialProgram,
  readFacilityType,
  RESIDENTIAL_PROGRAM_NOT_CARE_SITE,
  tallyHealthcareByNeighborhood,
} from './healthcare.js';
import type { FoodStoreRow } from './amenities.types.js';

const HERE = { type: 'Point', coordinates: [-73.98, 40.73] as [number, number] };

function store(squareFootage?: string, located = true): FoodStoreRow {
  return {
    dba_name: 'A STORE',
    ...(squareFootage === undefined ? {} : { square_footage: squareFootage }),
    georeference: located ? HERE : null,
  };
}

function locatorReturning(nta: string | null): NtaLocator {
  return new NtaLocator({ resolvePoint: () => nta, getRecord: () => undefined });
}

test('the supermarket threshold is inclusive and rejects unusable areas', () => {
  assert.equal(isSupermarket('10000'), true);
  assert.equal(isSupermarket('9999'), false);
  assert.equal(isSupermarket('25000'), true);
  assert.equal(isSupermarket(''), false);
  assert.equal(isSupermarket(undefined), false);
  assert.equal(isSupermarket('not a number'), false);
});

test('food stores split into a total and a supermarket subset', () => {
  const byNta = tallyFoodStoresByNeighborhood(
    [store('12000'), store('800'), store('2500'), store('40000')],
    locatorReturning('MN0101'),
    new RejectionLog(),
  );

  assert.deepEqual(byNta.get('MN0101'), { total: 4, supermarkets: 2 });
});

test('a store with no area still counts as a store', () => {
  const byNta = tallyFoodStoresByNeighborhood(
    [store()],
    locatorReturning('MN0101'),
    new RejectionLog(),
  );

  assert.deepEqual(byNta.get('MN0101'), { total: 1, supermarkets: 0 });
});

test('unplaceable stores are recorded by reason', () => {
  const rejections = new RejectionLog();
  tallyFoodStoresByNeighborhood(
    [store('12000', false)],
    locatorReturning('MN0101'),
    rejections,
  );
  assert.equal(rejections.countOf(STORE_WITHOUT_LOCATION), 1);

  const outside = new RejectionLog();
  tallyFoodStoresByNeighborhood([store('12000')], locatorReturning(null), outside);
  assert.equal(outside.countOf(STORE_OUTSIDE_NEIGHBORHOODS), 1);
});

test('hospital classification excludes clinics a hospital happens to run', () => {
  assert.equal(isHospital('HOSPITAL'), true);
  assert.equal(isHospital('ACUTE CARE HOSPITAL'), true);
  assert.equal(isHospital('HOSPITAL EXTENSION CLINIC'), false);
  assert.equal(isHospital('DIAGNOSTIC AND TREATMENT CENTER'), false);
});

test('facility type reading normalises case and padding', () => {
  assert.equal(readFacilityType({ factype: '  hospital ' }), 'HOSPITAL');
  assert.equal(readFacilityType({}), '');
});

test('residential programs are excluded from the healthcare count', () => {
  assert.equal(isResidentialProgram('ENRICHED HOUSING PROGRAM'), true);
  assert.equal(isResidentialProgram('HOSPITAL RESIDENTIAL STRUCTURE'), true);
  assert.equal(isResidentialProgram('HOSPITAL'), false);

  const rejections = new RejectionLog();
  const byNta = tallyHealthcareByNeighborhood(
    [
      { factype: 'ENRICHED HOUSING PROGRAM', nta2020: 'MN0101' },
      { factype: 'HOSPITAL', nta2020: 'MN0101' },
      { factype: 'DIAGNOSTIC AND TREATMENT CENTER', nta2020: 'MN0101' },
    ],
    new NtaLocator({ resolvePoint: () => null, getRecord: () => ({}) }),
    rejections,
  );

  assert.deepEqual(byNta.get('MN0101'), { sites: 2, hospitals: 1 });
  assert.equal(rejections.countOf(RESIDENTIAL_PROGRAM_NOT_CARE_SITE), 1);
});
