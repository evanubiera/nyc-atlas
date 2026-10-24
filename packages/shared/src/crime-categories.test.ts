import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyOffense,
  isNullish,
  hasValue,
  OFFENSE_TO_CATEGORY,
  CRIME_CATEGORY_META,
  DEFAULT_VISIBLE_CATEGORIES,
  CRIME_CATEGORIES,
} from './crime-categories.js';

test('exact ofns_desc match resolves to its category', () => {
  assert.equal(classifyOffense('FELONY ASSAULT').category, 'VIOLENT_PERSON');
  assert.equal(classifyOffense('PETIT LARCENY').category, 'PROPERTY');
  assert.equal(classifyOffense('DANGEROUS DRUGS').category, 'DRUGS');
  assert.equal(classifyOffense('ROBBERY').category, 'VIOLENT_PROPERTY');
});

test('both truncation variants map to the same category', () => {
  // The historic and current datasets truncate differently; loose matching
  // would split these into separate categories.
  assert.equal(
    classifyOffense('OTHER OFFENSES RELATED TO THEF').category,
    classifyOffense('OTHER OFFENSES RELATED TO THEFT').category,
  );
  assert.equal(
    classifyOffense('OTHER STATE LAWS (NON PENAL LA').category,
    classifyOffense('OTHER STATE LAWS (NON PENAL LAW)').category,
  );
  assert.equal(
    classifyOffense('ADMINISTRATIVE CODE').category,
    classifyOffense('ADMINISTRATIVE CODES').category,
  );
  for (const variant of [
    'KIDNAPPING',
    'KIDNAPPING & RELATED OFFENSES',
    'KIDNAPPING AND RELATED OFFENSES',
  ]) {
    assert.equal(classifyOffense(variant).category, 'VIOLENT_PERSON', variant);
  }
});

test("the literal '(null)' sentinel is treated as missing, not as a category", () => {
  // ofns_desc IS NULL matches zero rows upstream; '(null)' matches ~18,910.
  assert.ok(isNullish('(null)'));
  assert.ok(isNullish(null));
  assert.ok(isNullish(undefined));
  assert.ok(isNullish('  '));
  assert.ok(!isNullish('ROBBERY'));

  const r = classifyOffense('(null)');
  assert.equal(r.category, 'UNKNOWN');
  assert.equal(r.unmapped, false, "sentinel is absence, not an unrecognised label");
});

test('hasValue narrows the type', () => {
  const v: string | null | undefined = 'ROBBERY';
  assert.ok(hasValue(v));
  assert.ok(!hasValue('(null)'));
});

test("pd_desc recovers a category when ofns_desc is the sentinel", () => {
  // Real rows observed upstream on 2026-10-24.
  assert.equal(classifyOffense('(null)', 'CRIM POS WEAP 4').category, 'WEAPONS');
  assert.equal(classifyOffense('(null)', 'OBSCENITY 1').category, 'DISORDER');
  assert.equal(
    classifyOffense('(null)', 'SALE OF UNAUTHORIZED RECORDING').category,
    'PROPERTY',
  );
  assert.equal(classifyOffense('(null)', 'FALSE REPORT UNCLASSIFIED').category, 'ADMINISTRATIVE');

  for (const r of [
    classifyOffense('(null)', 'CRIM POS WEAP 4'),
    classifyOffense('(null)', 'OBSCENITY 1'),
  ]) {
    assert.equal(r.viaFallback, true);
    assert.equal(r.unmapped, false);
  }
});

test('pd_desc fallback is not consulted when ofns_desc is usable', () => {
  const r = classifyOffense('PETIT LARCENY', 'CRIM POS WEAP 4');
  assert.equal(r.category, 'PROPERTY');
  assert.equal(r.viaFallback, false);
});

test('an unrecognised label is flagged as unmapped, distinct from absence', () => {
  const r = classifyOffense('SOME BRAND NEW OFFENSE 2027');
  assert.equal(r.category, 'UNKNOWN');
  assert.equal(r.unmapped, true, 'must be reportable so new labels surface');
  assert.equal(classifyOffense(null).unmapped, false);
});

test('every mapped category is a declared CrimeCategory', () => {
  for (const [offense, category] of Object.entries(OFFENSE_TO_CATEGORY)) {
    assert.ok(CRIME_CATEGORIES.includes(category), `${offense} -> ${category}`);
  }
});

test('every category has metadata', () => {
  for (const c of CRIME_CATEGORIES) {
    assert.ok(CRIME_CATEGORY_META[c], `missing meta for ${c}`);
    assert.ok(CRIME_CATEGORY_META[c].label.length > 0);
    assert.ok(CRIME_CATEGORY_META[c].description.length > 0);
  }
});

test('enforcement-driven categories are excluded from the default view', () => {
  // specs/007 §3: these reflect police deployment as much as behaviour.
  for (const c of ['DRUGS', 'DISORDER', 'TRAFFIC', 'ADMINISTRATIVE', 'WEAPONS'] as const) {
    assert.equal(CRIME_CATEGORY_META[c].isEnforcementDriven, true, c);
    assert.ok(!DEFAULT_VISIBLE_CATEGORIES.includes(c), `${c} must not be visible by default`);
  }
  assert.ok(DEFAULT_VISIBLE_CATEGORIES.includes('SHOOTING'));
  assert.ok(DEFAULT_VISIBLE_CATEGORIES.includes('VIOLENT_PERSON'));
  assert.ok(!DEFAULT_VISIBLE_CATEGORIES.includes('UNKNOWN'));
});

test('shootings are their own category, not folded into violent-person', () => {
  // Separate dataset, different reporting properties — specs/007 §3.
  assert.notEqual(CRIME_CATEGORY_META.SHOOTING.label, CRIME_CATEGORY_META.VIOLENT_PERSON.label);
  assert.equal(CRIME_CATEGORY_META.SHOOTING.isEnforcementDriven, false);
});
