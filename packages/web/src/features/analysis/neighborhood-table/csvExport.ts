import type {
  MetricsInput,
  NeighborhoodMetric,
  ProvenanceData,
} from '../../../store/atlasApi.js';

/**
 * CSV export for the neighborhood table.
 *
 * The file carries raw numbers rather than the table's formatted strings: a
 * spreadsheet can format "$74.2k" itself, but it cannot recover the value from
 * it. Missing stays empty rather than zero, the same distinction the table
 * draws with an em dash.
 *
 * Every export is prefixed with its attribution (specs/001 FR-4, 008 §7.4).
 * The sources and the association-not-causation line travel with the data,
 * because a CSV outlives the page that produced it.
 */

/** Stated even when provenance is unavailable; the claim is about the method. */
const CAUSATION_DISCLAIMER =
  'These are statistical associations between neighborhood measures. ' +
  'They do not establish that any measure causes any other.';

const SMOOTHING_NOTE =
  'ratePer100k is the raw rate; smoothedRatePer100k is empirical-Bayes shrunk ' +
  'toward the borough mean. Small-population neighborhoods move the most.';

interface CsvColumn {
  header: string;
  value: (row: NeighborhoodMetric) => string | number | null;
}

/**
 * Shares travel with the counts behind them. A grade share without its
 * denominator cannot be pooled or re-weighted by whoever opens the file.
 */
const CSV_COLUMNS: CsvColumn[] = [
  { header: 'nta2020', value: (r) => r.nta2020 },
  { header: 'neighborhood', value: (r) => r.name },
  { header: 'borough', value: (r) => r.boroughName },
  { header: 'population', value: (r) => r.population },
  { header: 'medianHouseholdIncome', value: (r) => r.medianHouseholdIncome },
  { header: 'povertyRate', value: (r) => r.povertyRate },
  { header: 'supermarketsPer10k', value: (r) => r.supermarketsPer10k },
  { header: 'supermarketCount', value: (r) => r.supermarketCount },
  { header: 'foodStoreCount', value: (r) => r.foodStoreCount },
  { header: 'storeGradeShare', value: (r) => r.storeGradeShare },
  { header: 'gradeAStoreCount', value: (r) => r.gradeAStoreCount },
  { header: 'gradedStoreCount', value: (r) => r.gradedStoreCount },
  { header: 'schoolProficiency', value: (r) => r.schoolProficiency },
  { header: 'schoolCount', value: (r) => r.schoolCount },
  { header: 'schoolStudentsTested', value: (r) => r.schoolStudents },
  { header: 'healthcareSitesPer10k', value: (r) => r.healthcareSitesPer10k },
  { header: 'healthcareSiteCount', value: (r) => r.healthcareSiteCount },
  { header: 'institutionCount', value: (r) => r.institutionCount },
  { header: 'institutionsPer10k', value: (r) => r.institutionsPer10k },
  { header: 'incidentCount', value: (r) => r.rawCount },
  { header: 'ratePer100k', value: (r) => r.ratePer100k },
  { header: 'smoothedRatePer100k', value: (r) => r.smoothedRatePer100k },
  { header: 'residual', value: (r) => r.residual },
];

/** RFC 4180: quote only when needed, and double any quote inside. */
export function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Floats carry binary noise well past any precision these measures have. */
function renderValue(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(Number(value.toFixed(6)));
  }
  return escapeCsvField(value);
}

export interface AttributionContext {
  input: MetricsInput;
  provenance: ProvenanceData | undefined;
  generatedAt: Date;
  rowCount: number;
}

/**
 * The comment block every export opens with. `#` rather than a quoted row so
 * a reader that skips comments lands on a clean header line.
 */
export function buildAttributionHeader(context: AttributionContext): string[] {
  const { input, provenance, generatedAt, rowCount } = context;
  const lines = [
    '# NYC Income and Cultural Institution gaps — neighborhood table',
    `# Generated: ${generatedAt.toISOString()}`,
    `# Rows: ${rowCount}`,
    `# Selection: category=${input.category}, exposure=${input.exposure}, ` +
      `scope=${input.scope}, period=${input.from}..${input.to}`,
    `# ${CAUSATION_DISCLAIMER}`,
    `# ${SMOOTHING_NOTE}`,
  ];

  if (provenance) {
    if (provenance.attribution) lines.push(`# ${provenance.attribution}`);
    lines.push(`# Ingest version: ${provenance.ingestVersion}`);
    lines.push('# Sources:');
    for (const dataset of provenance.datasets) {
      lines.push(`#   ${dataset.name} (${dataset.id})`);
    }
  } else {
    lines.push('# Source detail unavailable at export time — see specs/002-data-sources.md');
  }

  return lines;
}

export function toCsv(rows: NeighborhoodMetric[], context: AttributionContext): string {
  const header = CSV_COLUMNS.map((column) => escapeCsvField(column.header)).join(',');
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => renderValue(column.value(row))).join(','),
  );
  return [...buildAttributionHeader(context), header, ...body].join('\n') + '\n';
}

/** `nyc-atlas-SHOOTINGS-2026-10-26.csv` — selection and date, so files stay distinguishable. */
export function csvFilename(input: MetricsInput, generatedAt: Date): string {
  const day = generatedAt.toISOString().slice(0, 10);
  return `nyc-atlas-${input.category.toLowerCase()}-${day}.csv`;
}
