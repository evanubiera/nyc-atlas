#!/usr/bin/env node
/**
 * Enforces the payload budgets this project commits to.
 *
 *   1. Simplified NTA geometry — under 600 KB gzipped (specs/001 NFR-3)
 *   2. Web production bundle   — webpack's own hints are warnings only, and
 *      its config defers the real budget to here
 *
 * Exits non-zero on any breach so it can gate CI.
 *
 * The geometry number is measured, not asserted: the script runs the very
 * simplification the BFF serves, so loosening the tolerance shows up here as
 * bytes. That file is derived from Socrata at request time rather than
 * committed, so the check needs the network; when it is unreachable the check
 * reports SKIP rather than failing, for the same reason the `sources` CI job is
 * continue-on-error — somebody else's outage must not gate a merge.
 *
 * Usage: node scripts/check-bundle-budget.mjs [--skip-geometry]
 */

import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATASETS } from '../packages/shared/dist/index.js';
import {
  GEOMETRY_BUDGET_BYTES,
  simplifyNtaCollection,
} from '../packages/bff/dist/geography/simplify-geometry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST = path.join(ROOT, 'packages/web/dist');

/**
 * First paint pulls the entry chunk and nothing else; the async chunks follow
 * on interaction. They are budgeted separately so a regression in one is not
 * hidden by headroom in the other.
 */
const ENTRY_BUDGET_BYTES = 450 * 1024;
const TOTAL_BUDGET_BYTES = 700 * 1024;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let failures = 0;

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Reports one measurement against its budget and records a breach. */
function report(label, bytes, budget) {
  const share = ((bytes / budget) * 100).toFixed(0);
  const detail = `${kb(bytes)} of ${kb(budget)} ${dim(`(${share}%)`)}`;
  if (bytes > budget) {
    failures += 1;
    console.log(`  ${red('OVER')} ${label} — ${detail}`);
  } else {
    console.log(`  ${green('OK')}   ${label} — ${detail}`);
  }
}

function gzipped(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

function checkWebBundle() {
  console.log('\nWeb production bundle');

  let entries;
  try {
    entries = readdirSync(WEB_DIST);
  } catch {
    failures += 1;
    console.log(`  ${red('FAIL')} ${path.relative(ROOT, WEB_DIST)} is missing — run \`npm run build\` first`);
    return;
  }

  // Source maps and licence sidecars are never served to the browser.
  const served = entries.filter(
    (name) =>
      !name.endsWith('.map') &&
      !name.endsWith('.LICENSE.txt') &&
      statSync(path.join(WEB_DIST, name)).isFile(),
  );

  if (served.length === 0) {
    failures += 1;
    console.log(`  ${red('FAIL')} no built assets found — run \`npm run build\` first`);
    return;
  }

  let entryBytes = 0;
  let totalBytes = 0;

  for (const name of served.sort()) {
    const size = gzipped(readFileSync(path.join(WEB_DIST, name)));
    totalBytes += size;
    // Webpack names the entry chunk `main`; the numbered chunks load lazily.
    if (name.startsWith('main.') || name === 'index.html') entryBytes += size;
    console.log(`       ${dim(`${name.padEnd(28)} ${kb(size).padStart(10)}`)}`);
  }

  report('entry chunk, gzipped', entryBytes, ENTRY_BUDGET_BYTES);
  report('all served assets, gzipped', totalBytes, TOTAL_BUDGET_BYTES);
}

async function checkGeometry() {
  console.log('\nSimplified NTA geometry (NFR-3)');

  const dataset = DATASETS.ntaGeography;
  const domain = dataset.domain ?? 'data.cityofnewyork.us';
  const url = `https://${domain}/resource/${dataset.id}.geojson?$limit=500`;
  const token = process.env.SOCRATA_APP_TOKEN;

  let collection;
  try {
    const res = await fetch(url, { headers: token ? { 'X-App-Token': token } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    collection = await res.json();
  } catch (err) {
    console.log(`  ${yellow('SKIP')} NTA geography unreachable — ${err.message}`);
    console.log(`       ${dim('an upstream outage does not gate a merge; the scheduled source check catches drift')}`);
    return;
  }

  const features = (collection.features ?? []).filter((f) => f?.geometry && f.properties?.nta2020);
  if (features.length === 0) {
    failures += 1;
    console.log(`  ${red('FAIL')} no NTA features returned — the geometry source may have changed`);
    return;
  }

  const rawBytes = gzipped(Buffer.from(JSON.stringify(collection)));
  const simplified = simplifyNtaCollection(features);
  const bytes = gzipped(Buffer.from(JSON.stringify(simplified)));

  console.log(
    `       ${dim(`${features.length} features, ${kb(rawBytes)} gzipped raw → ${kb(bytes)} simplified`)}`,
  );
  report('transport geometry, gzipped', bytes, GEOMETRY_BUDGET_BYTES);
}

const skipGeometry = process.argv.includes('--skip-geometry');

checkWebBundle();
if (skipGeometry) {
  console.log(`\nSimplified NTA geometry (NFR-3)\n  ${yellow('SKIP')} --skip-geometry was passed`);
} else {
  await checkGeometry();
}

if (failures > 0) {
  console.log(`\n${red(`${failures} budget check(s) failed`)}\n`);
  process.exit(1);
}
console.log(`\n${green('All payload budgets are within limits')}\n`);
