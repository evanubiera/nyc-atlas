import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatByUnit,
  formatCompactCurrency,
  formatCompactPeople,
  formatCount,
  formatFullCurrency,
  formatPercent,
  formatRate,
  MISSING,
  pluralize,
  titleCaseFromShout,
} from './values.ts';

test('every formatter renders a missing value as one em dash, never as zero', () => {
  assert.equal(formatCompactCurrency(null), MISSING);
  assert.equal(formatFullCurrency(null), MISSING);
  assert.equal(formatPercent(null), MISSING);
  assert.equal(formatRate(null), MISSING);
  assert.equal(formatCount(null), MISSING);
});

test('a real zero is shown, because it is not the same as missing', () => {
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatRate(0), '0.00');
  assert.equal(formatCount(0), '0');
});

test('currency is compact in table cells and exact in the gap panel', () => {
  assert.equal(formatCompactCurrency(160_432), '$160k');
  assert.equal(formatFullCurrency(129_915.0971), '$129,915');
});

test('shares render as whole percents unless more precision is asked for', () => {
  assert.equal(formatPercent(0.7742), '77%');
  assert.equal(formatPercent(0.7742, 1), '77.4%');
});

test('unit dispatch matches the server-declared gap unit', () => {
  assert.equal(formatByUnit(129_915, 'USD'), '$129,915');
  assert.equal(formatByUnit(0.655, 'SHARE'), '66%');
  assert.equal(formatByUnit(1.0094, 'PER_10K'), '1.01');
});

test('population compacts at thousands and millions', () => {
  assert.equal(formatCompactPeople(1_733_580), '1.7M residents');
  assert.equal(formatCompactPeople(62_960), '63k residents');
  assert.equal(formatCompactPeople(640), '640 residents');
});

test('pluralize keeps the singular for exactly one', () => {
  assert.equal(pluralize(1, 'school'), '1 school');
  assert.equal(pluralize(0, 'school'), '0 schools');
  assert.equal(pluralize(23, 'school'), '23 schools');
  assert.equal(pluralize(2, 'institution'), '2 institutions');
  assert.equal(pluralize(1_200, 'store'), '1,200 stores');
});

test('shouted source names are title cased, including after punctuation', () => {
  assert.equal(titleCaseFromShout('MILLENNIUM HIGH SCHOOL'), 'Millennium High School');
  assert.equal(titleCaseFromShout("HELL'S KITCHEN"), "Hell's Kitchen");
  assert.equal(titleCaseFromShout('SOHO-LITTLE ITALY'), 'Soho-Little Italy');
});

test('the initials that fill NYC school names survive title casing', () => {
  assert.equal(titleCaseFromShout('P.S./I.S. 218 RAFAEL'), 'P.S./I.S. 218 Rafael');
  assert.equal(titleCaseFromShout('J.H.S. 022 JORDAN L. MOTT'), 'J.H.S. 022 Jordan L. Mott');
});

test('names that already carry lower case are left exactly as written', () => {
  assert.equal(titleCaseFromShout('deCordova Museum'), 'deCordova Museum');
  assert.equal(titleCaseFromShout('122 Community Center Inc.'), '122 Community Center Inc.');
});
