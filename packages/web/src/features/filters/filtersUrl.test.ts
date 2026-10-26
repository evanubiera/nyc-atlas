import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FiltersState } from './filtersSlice.ts';
import { decodeFilters, encodeFilters } from './filtersUrl.ts';

const DEFAULTS: FiltersState = {
  category: 'SHOOTING',
  exposure: 'PER_CAPITA',
  institutionScope: 'STANDARD',
  boroughCodes: [],
  from: '2006-01',
  to: '2026-12',
  mapMode: 'OUTCOME',
  showInstitutions: true,
  extrude: true,
};

test('the default view produces an empty query string', () => {
  assert.equal(encodeFilters(DEFAULTS, DEFAULTS), '');
});

test('only what changed is written, so a link shows what was actually set', () => {
  const query = encodeFilters({ ...DEFAULTS, category: 'DRUGS', mapMode: 'RESIDUAL' }, DEFAULTS);

  assert.equal(query, 'category=DRUGS&mode=RESIDUAL');
});

test('a round trip returns the state it started from', () => {
  const state: FiltersState = {
    category: 'VIOLENT_PERSON',
    exposure: 'ACCESS',
    institutionScope: 'BROAD',
    boroughCodes: [3, 1],
    from: '2015-06',
    to: '2024-03',
    mapMode: 'BIVARIATE',
    showInstitutions: false,
    extrude: false,
  };

  const decoded = decodeFilters(encodeFilters(state, DEFAULTS), DEFAULTS);

  assert.deepEqual(decoded, { ...state, boroughCodes: [1, 3] });
});

test('an unrecognised value costs that filter, not the page', () => {
  const decoded = decodeFilters('category=NOT_A_CATEGORY&mode=SPIRAL', DEFAULTS);

  assert.equal(decoded.category, DEFAULTS.category);
  assert.equal(decoded.mapMode, DEFAULTS.mapMode);
});

test('a malformed month is refused rather than passed to the server', () => {
  assert.equal(decodeFilters('from=2015-13', DEFAULTS).from, '2006-01');
  assert.equal(decodeFilters('from=yesterday', DEFAULTS).from, '2006-01');
  assert.equal(decodeFilters('from=2015-6', DEFAULTS).from, '2006-01');
  assert.equal(decodeFilters('from=2015-06', DEFAULTS).from, '2015-06');
});

test('borough codes outside 1-5 are dropped and the rest survive', () => {
  assert.deepEqual(decodeFilters('boroughs=2,9,abc,4', DEFAULTS).boroughCodes, [2, 4]);
});

test('duplicate borough codes collapse, so the filter cannot double-count', () => {
  assert.deepEqual(decodeFilters('boroughs=3,3,1', DEFAULTS).boroughCodes, [1, 3]);
});

test('an explicitly empty borough list means all boroughs, not the default', () => {
  const decoded = decodeFilters('boroughs=', { ...DEFAULTS, boroughCodes: [2] });
  assert.deepEqual(decoded.boroughCodes, []);
});

test('flags accept both 1/0 and true/false, and ignore anything else', () => {
  assert.equal(decodeFilters('extrude=0', DEFAULTS).extrude, false);
  assert.equal(decodeFilters('extrude=false', DEFAULTS).extrude, false);
  assert.equal(decodeFilters('extrude=maybe', DEFAULTS).extrude, true);
});

test('borough order in the URL does not change the state it decodes to', () => {
  assert.deepEqual(
    decodeFilters('boroughs=4,1,2', DEFAULTS).boroughCodes,
    decodeFilters('boroughs=2,4,1', DEFAULTS).boroughCodes,
  );
});
