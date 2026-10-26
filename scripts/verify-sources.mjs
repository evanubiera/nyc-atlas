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
  FACDB_HEALTHCARE_SUBGROUP,
  FOOD_GRADES,
  FOOD_GRADE_PASS,
  NYC_COUNTY_NAMES,
  OFFENSE_TO_CATEGORY,
  RESIDENTIAL_NTA_TYPE,
  SCHOOL_PROFICIENCY_METRICS,
  SCHOOL_QUALITY_REPORT_TYPE,
  SCHOOL_QUALITY_YEAR,
  SUPERMARKET_MIN_SQFT,
  isNullish,
} from '../packages/shared/dist/index.js';

const DOMAIN = 'https://data.cityofnewyork.us';
const token = process.env.SOCRATA_APP_TOKEN;

/** A dataset may name its own Socrata host; food retail is State-licensed. */
const hostOf = (ds) => (ds.domain === undefined ? DOMAIN : `https://${ds.domain}`);

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

async function soql(id, params, host = DOMAIN) {
  const qs = new URLSearchParams(params).toString();
  return getJson(`${host}/resource/${id}.json?${qs}`);
}

// --- 1 & 2: dataset ids and required fields --------------------------------

console.log('\nDataset identity and schema\n');

for (const [key, ds] of Object.entries(DATASETS)) {
  try {
    const meta = await getJson(`${hostOf(ds)}/api/views/${ds.id}.json`);
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
      const where = ds.domain === undefined ? '' : ` ${dim(`@ ${ds.domain}`)}`;
      pass(`${key} ${dim(`(${ds.id})`)}${where} — ${ds.requiredFields.length} fields present`);
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

// --- 5: amenity assumptions -------------------------------------------------

console.log('\nAmenity access assumptions\n');

// Grocery access depends on a floor-area threshold against a self-reported
// field. If either the field or the licence population shifts, the supermarket
// count moves without any code changing.
try {
  const counties = NYC_COUNTY_NAMES.map((c) => `'${c}'`).join(',');
  const host = `https://${DATASETS.retailFoodStores.domain}`;
  const [{ n: all }] = await soql(
    DATASETS.retailFoodStores.id,
    { $select: 'count(1) as n', $where: `county in(${counties})` },
    host,
  );
  const [{ n: big }] = await soql(
    DATASETS.retailFoodStores.id,
    {
      $select: 'count(1) as n',
      $where: `county in(${counties}) AND square_footage >= ${SUPERMARKET_MIN_SQFT}`,
    },
    host,
  );

  if (Number(all) === 0) {
    fail(`no NYC retail food stores returned — check the county spellings`);
  } else if (Number(big) === 0) {
    fail(`no store clears ${SUPERMARKET_MIN_SQFT} sq ft — square_footage may have changed type`);
  } else {
    const share = (Number(big) / Number(all)) * 100;
    pass(
      `${Number(all).toLocaleString()} NYC food stores, ${Number(big).toLocaleString()} ` +
        `at or above ${SUPERMARKET_MIN_SQFT.toLocaleString()} sq ft (${share.toFixed(1)}%)`,
    );
    if (share > 15 || share < 2) {
      warn(`supermarket share of ${share.toFixed(1)}% is outside the observed 5-8% band`);
    }
  }
} catch (err) {
  fail(`retail food store checks failed — ${err.message}`);
}

// The store-grade measure assumes a fixed grade vocabulary and that the file is
// one row per deficiency. A move to one row per establishment would not error —
// it would silently change what the share means.
try {
  const counties = NYC_COUNTY_NAMES.map((c) => `'${c}'`).join(',');
  const host = `https://${DATASETS.foodSafetyInspections.domain}`;
  const where = `upper(county) in(${counties})`;

  const grades = await soql(
    DATASETS.foodSafetyInspections.id,
    { $select: 'inspection_grade, count(1) as n', $group: 'inspection_grade' },
    host,
  );
  const seen = grades.map((g) => (g.inspection_grade ?? '').trim().toUpperCase()).filter(Boolean);
  const unknown = seen.filter((g) => !FOOD_GRADES.includes(g));

  if (unknown.length > 0) {
    fail(
      `unexpected inspection grade(s) ${unknown.map((g) => JSON.stringify(g)).join(', ')} — ` +
        `FOOD_GRADES in packages/shared/src/datasets.ts assumes ${FOOD_GRADES.join('/')}`,
    );
  } else if (!seen.includes(FOOD_GRADE_PASS)) {
    fail(`the passing grade '${FOOD_GRADE_PASS}' no longer appears upstream`);
  } else {
    pass(`inspection grades are still ${seen.sort().join('/')}`);
  }

  const [{ n: rows }] = await soql(
    DATASETS.foodSafetyInspections.id,
    { $select: 'count(1) as n', $where: where },
    host,
  );
  const [{ n: establishments }] = await soql(
    DATASETS.foodSafetyInspections.id,
    { $select: 'count(distinct trade_name) as n', $where: where },
    host,
  );

  if (Number(rows) === 0) {
    fail(`no NYC food inspections returned — this file spells counties in Title Case`);
  } else {
    const perEstablishment = Number(rows) / Number(establishments);
    pass(
      `${Number(rows).toLocaleString()} NYC inspection rows over ` +
        `~${Number(establishments).toLocaleString()} establishments ` +
        `(${perEstablishment.toFixed(1)} rows each)`,
    );
    if (perEstablishment < 2) {
      warn(
        `only ${perEstablishment.toFixed(1)} rows per establishment — this file may have moved ` +
          `to one row per establishment, which would change what the dedupe in ` +
          `AmenitiesService.fetchStoreGrades is collapsing`,
      );
    }
  }
} catch (err) {
  fail(`food inspection checks failed — ${err.message}`);
}

// School outcomes are pinned to a vintage and a report type. A new year
// publishing does not break anything, but the pinned year disappearing does.
try {
  const metrics = [SCHOOL_PROFICIENCY_METRICS.ela, SCHOOL_PROFICIENCY_METRICS.math]
    .map((m) => `'${m}'`)
    .join(',');
  const rows = await soql(DATASETS.schoolQuality.id, {
    $select: 'count(distinct dbn) as n',
    $where:
      `school_year=${SCHOOL_QUALITY_YEAR} AND report_type='${SCHOOL_QUALITY_REPORT_TYPE}' ` +
      `AND metric_variable_name in(${metrics})`,
  });
  const schools = Number(rows[0]?.n ?? 0);

  if (schools === 0) {
    fail(
      `no ${SCHOOL_QUALITY_YEAR} ${SCHOOL_QUALITY_REPORT_TYPE} proficiency rows — ` +
        `the pinned year or metric names in datasets.ts are stale`,
    );
  } else {
    pass(`${schools} schools report ${SCHOOL_QUALITY_YEAR} ELA/Math proficiency`);
  }

  const [{ n: newest }] = await soql(DATASETS.schoolQuality.id, {
    $select: 'max(school_year) as n',
  });
  if (Number(newest) > SCHOOL_QUALITY_YEAR) {
    warn(
      `school year ${newest} is now published; SCHOOL_QUALITY_YEAR is pinned to ` +
        `${SCHOOL_QUALITY_YEAR} — consider bumping it in packages/shared/src/datasets.ts`,
    );
  }
} catch (err) {
  fail(`school quality checks failed — ${err.message}`);
}

// Healthcare access is one FacDB subgroup. A rename would silently zero it.
try {
  const [{ n }] = await soql(DATASETS.facilities.id, {
    $select: 'count(1) as n',
    $where: `facsubgrp='${FACDB_HEALTHCARE_SUBGROUP}'`,
  });
  if (Number(n) === 0) {
    fail(`FacDB subgroup '${FACDB_HEALTHCARE_SUBGROUP}' returned no rows — it may be renamed`);
  } else {
    pass(`${Number(n).toLocaleString()} FacDB '${FACDB_HEALTHCARE_SUBGROUP}' facilities`);
  }
} catch (err) {
  fail(`healthcare facility checks failed — ${err.message}`);
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
