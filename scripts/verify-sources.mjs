#!/usr/bin/env node
/**
 * Validates every assumption this project makes about its upstream data.
 *
 * Checks, per specs/002-data-sources.md:
 *   1. Every dataset id resolves and is not archived
 *   2. Every required field is present in the live schema
 *   3. Every observed `ofns_desc` value is covered by the offense mapping
 *   4. The residential-NTA count still matches what the specs assume
 *
 * Exits non-zero on any failure so it can gate CI.
 */

import {
  DATASETS,
  OFFENSE_TO_CATEGORY,
  RESIDENTIAL_NTA_TYPE,
  isNullish,
} from '../packages/shared/dist/index.js';

const DOMAIN = 'https://data.cityofnewyork.us';
const token = process.env.SOCRATA_APP_TOKEN;

const headers = token ? { 'X-App-Token': token } : {};
let failures = 0;
let warnings = 0;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function fail(msg) {
  console.log(`  ${red('FAIL')} ${msg}`);
  failures += 1;
}
function warn(msg) {
  console.log(`  ${yellow('WARN')} ${msg}`);
  warnings += 1;
}
function pass(msg) {
  console.log(`  ${green('PASS')} ${msg}`);
}

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function soql(id, params) {
  const qs = new URLSearchParams(params).toString();
  return getJson(`${DOMAIN}/resource/${id}.json?${qs}`);
}

// --- 1 & 2: dataset ids and required fields --------------------------------

console.log('\nDataset identity and schema\n');

for (const [key, ds] of Object.entries(DATASETS)) {
  try {
    const meta = await getJson(`${DOMAIN}/api/views/${ds.id}.json`);
    const liveName = meta.name ?? '(unnamed)';

    if (/^ARCHIVED/i.test(liveName)) {
      fail(`${key} (${ds.id}) is ARCHIVED upstream: "${liveName}"`);
      continue;
    }

    const fields = new Set((meta.columns ?? []).map((c) => c.fieldName));
    const missing = ds.requiredFields.filter((f) => !fields.has(f));

    if (missing.length > 0) {
      fail(`${key} (${ds.id}) missing required field(s): ${missing.join(', ')}`);
    } else {
      pass(`${key} ${dim(`(${ds.id})`)} — ${ds.requiredFields.length} fields present`);
      console.log(`       ${dim(liveName)}`);
    }
  } catch (err) {
    fail(`${key} (${ds.id}) unreachable — ${err.message}`);
  }
}

// --- 3: offense mapping coverage -------------------------------------------

console.log('\nOffense mapping coverage\n');

const observed = new Map();
let sentinelRows = 0;
for (const id of [DATASETS.complaintsCurrent.id, DATASETS.complaintsHistoric.id]) {
  try {
    const rows = await soql(id, {
      $select: 'ofns_desc, count(1) as n',
      $group: 'ofns_desc',
      $limit: '500',
    });
    for (const row of rows) {
      // Not a SQL-null check: missing values arrive as the literal '(null)'.
      if (isNullish(row.ofns_desc)) {
        sentinelRows += Number(row.n);
        continue;
      }
      observed.set(row.ofns_desc, (observed.get(row.ofns_desc) ?? 0) + Number(row.n));
    }
  } catch (err) {
    fail(`could not enumerate offenses from ${id} — ${err.message}`);
  }
}

const unmapped = [...observed.keys()].filter((d) => OFFENSE_TO_CATEGORY[d] === undefined);
const mappedKeys = Object.keys(OFFENSE_TO_CATEGORY);
const stale = mappedKeys.filter((k) => !observed.has(k));

if (unmapped.length > 0) {
  fail(
    `${unmapped.length} observed offense value(s) are NOT in OFFENSE_TO_CATEGORY — ` +
      `they would silently become UNKNOWN:`,
  );
  for (const u of unmapped.sort()) {
    console.log(`         ${red('+')} ${JSON.stringify(u)}  (${observed.get(u)} rows)`);
  }
  console.log(`\n       Add them to packages/shared/src/crime-categories.ts`);
} else {
  pass(`all ${observed.size} observed offense values are mapped`);
}

if (sentinelRows > 0) {
  pass(
    `${sentinelRows.toLocaleString()} rows carry the '(null)' sentinel — ` +
      `routed to the pd_desc fallback, not UNKNOWN`,
  );
}

if (stale.length > 0) {
  warn(`${stale.length} mapped value(s) no longer appear upstream (harmless, but stale):`);
  for (const s of stale.sort()) console.log(`         ${dim('-')} ${dim(JSON.stringify(s))}`);
}

// --- 4: residential NTA count ----------------------------------------------

console.log('\nGeography assumptions\n');

try {
  const [{ n: total }] = await soql(DATASETS.ntaGeography.id, { $select: 'count(1) as n' });
  const byType = await soql(DATASETS.ntaGeography.id, {
    $select: 'ntatype, count(1) as n',
    $group: 'ntatype',
  });
  const residential = byType.find((r) => r.ntatype === RESIDENTIAL_NTA_TYPE);
  const resCount = Number(residential?.n ?? 0);

  if (Number(total) !== 262) {
    warn(`NTA feature count is ${total}, specs assume 262 — review specs/002`);
  } else {
    pass(`NTA feature count is 262 as documented`);
  }

  if (resCount !== 197) {
    warn(`residential NTA count is ${resCount}, specs assume 197 — review specs/002 and 007`);
  } else {
    pass(`residential NTAs (ntatype='0') is 197 as documented`);
  }
} catch (err) {
  fail(`NTA geography checks failed — ${err.message}`);
}

// --- summary ----------------------------------------------------------------

console.log('');
if (!token) {
  console.log(dim('  note: no SOCRATA_APP_TOKEN set — using anonymous rate limits.'));
}
console.log(
  failures === 0
    ? green(`  All source checks passed${warnings ? ` (${warnings} warning(s))` : ''}.\n`)
    : red(`  ${failures} check(s) FAILED${warnings ? `, ${warnings} warning(s)` : ''}.\n`),
);

process.exit(failures === 0 ? 0 : 1);
