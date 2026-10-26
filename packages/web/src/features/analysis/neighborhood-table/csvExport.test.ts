import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  MetricsInput,
  NeighborhoodMetric,
  ProvenanceData,
} from '../../../store/atlasApi.js';
import { buildAttributionHeader, csvFilename, escapeCsvField, toCsv } from './csvExport.ts';

const INPUT: MetricsInput = {
  category: 'SHOOTING',
  exposure: 'PER_CAPITA',
  scope: 'STANDARD',
  from: '2020-01',
  to: '2025-12',
};

const PROVENANCE: ProvenanceData = {
  ingestVersion: '2026-10-25',
  attribution: 'Source: NYC Open Data. Associations only.',
  warnings: [],
  datasets: [
    {
      id: '5ucz-vwe8',
      name: 'NYPD Shooting Incidents',
      purpose: 'outcome',
      notes: null,
      rowsUpdatedAt: '2026-07-27T15:45:36.000Z',
      rowCount: 24310,
    },
  ],
};

function row(overrides: Partial<NeighborhoodMetric> = {}): NeighborhoodMetric {
  return {
    nta2020: 'BK0101',
    name: 'Greenpoint',
    boroughName: 'Brooklyn',
    centroid: [-73.95, 40.73],
    population: 38000,
    rawCount: 12,
    ratePer100k: 31.578947,
    smoothedRatePer100k: 29.4,
    confidenceInterval: [16, 55],
    institutionCount: 7,
    institutionsPerSqKm: 2.1,
    institutionsPer10k: 1.84,
    exposureValue: 1.84,
    residual: -3.2,
    medianHouseholdIncome: 102000,
    povertyRate: 0.11,
    shareBachelorsOrHigher: 0.62,
    foodStoreCount: 40,
    supermarketCount: 3,
    supermarketsPer10k: 0.79,
    gradedStoreCount: 31,
    gradeAStoreCount: 27,
    storeGradeShare: 0.871,
    healthcareSiteCount: 4,
    healthcareSitesPer10k: 1.05,
    schoolCount: 5,
    schoolStudents: 1400,
    schoolProficiency: 0.58,
    isEnforcementDriven: false, daytimePopulationSuspected: false,
    excluded: null,
    ...overrides,
  };
}

const context = { input: INPUT, provenance: PROVENANCE, generatedAt: new Date('2026-10-26T12:00:00Z'), rowCount: 1 };

test('a field is quoted only when a comma, quote or newline forces it', () => {
  assert.equal(escapeCsvField('Greenpoint'), 'Greenpoint');
  assert.equal(escapeCsvField('Bedford-Stuyvesant, West'), '"Bedford-Stuyvesant, West"');
  assert.equal(escapeCsvField('He said "go"'), '"He said ""go"""');
});

test('a neighborhood name containing a comma cannot break the row', () => {
  const csv = toCsv([row({ name: 'Flatlands, East' })], context);
  const dataLine = csv.trim().split('\n').at(-1) as string;

  assert.ok(dataLine.includes('"Flatlands, East"'));
  // 23 columns means 22 separating commas; the quoted one must not count.
  assert.equal(dataLine.split('","').length - 1 + dataLine.replace(/"[^"]*"/g, '').split(',').length - 1, 22);
});

test('a missing value exports as empty, never as zero', () => {
  const csv = toCsv([row({ medianHouseholdIncome: null, storeGradeShare: null })], context);
  const [headerLine, dataLine] = csv.trim().split('\n').slice(-2);
  const headers = (headerLine as string).split(',');
  const cells = (dataLine as string).split(',');

  assert.equal(cells[headers.indexOf('medianHouseholdIncome')], '');
  assert.equal(cells[headers.indexOf('storeGradeShare')], '');
});

test('a real zero still exports as zero', () => {
  const csv = toCsv([row({ institutionCount: 0 })], context);
  const [headerLine, dataLine] = csv.trim().split('\n').slice(-2);
  const headers = (headerLine as string).split(',');
  const cells = (dataLine as string).split(',');

  assert.equal(cells[headers.indexOf('institutionCount')], '0');
});

test('float noise is trimmed rather than exported at full binary precision', () => {
  const csv = toCsv([row({ ratePer100k: 31.578947368421055 })], context);
  assert.ok(csv.includes('31.578947'));
  assert.ok(!csv.includes('31.578947368421055'));
});

test('every export states the sources and that this is not causation', () => {
  const header = buildAttributionHeader(context).join('\n');

  assert.ok(header.includes('do not establish that any measure causes any other'));
  assert.ok(header.includes('NYPD Shooting Incidents (5ucz-vwe8)'));
  assert.ok(header.includes('Ingest version: 2026-10-25'));
  assert.ok(header.includes('category=SHOOTING'));
});

test('the causation line survives even when provenance never loaded', () => {
  const header = buildAttributionHeader({ ...context, provenance: undefined }).join('\n');

  assert.ok(header.includes('do not establish that any measure causes any other'));
  assert.ok(header.includes('Source detail unavailable'));
});

test('every attribution line is commented so the header row stays machine-readable', () => {
  const csv = toCsv([row()], context);
  const lines = csv.trim().split('\n');
  const firstUncommented = lines.findIndex((line) => !line.startsWith('#'));

  assert.ok(firstUncommented > 0);
  assert.equal(lines[firstUncommented], lines[firstUncommented]?.replace(/^#/, ''));
  assert.ok((lines[firstUncommented] as string).startsWith('nta2020,neighborhood,borough'));
});

test('the filename carries the selection and the day', () => {
  assert.equal(
    csvFilename(INPUT, new Date('2026-10-26T12:00:00Z')),
    'nyc-atlas-shooting-2026-10-26.csv',
  );
});
