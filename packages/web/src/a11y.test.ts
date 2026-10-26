import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

import { store } from './store/index.ts';
import { resolveTheme } from './theme/index.ts';
import { LimitationsPanel } from './features/transparency/LimitationsPanel.tsx';
import { DataQualityPanel } from './features/transparency/DataQualityPanel.tsx';
import { CategoryCaveat } from './features/transparency/CategoryCaveat.tsx';
import { AtlasControls } from './app/AtlasControls.tsx';
import { NeighborhoodTable } from './features/analysis/neighborhood-table/NeighborhoodTable.tsx';
import { ScatterPanel } from './features/analysis/ScatterPanel.tsx';
import type { MetricsInput } from './store/atlasApi.ts';

/**
 * specs/008 §8.6 — the accessibility pass, run as a test rather than a
 * one-off audit so a regression fails the build.
 *
 * Components are rendered to static markup with their styled-components CSS
 * attached and audited in a DOM. What this covers is structure and
 * semantics: form labels, accessible names on controls, ARIA validity,
 * heading order and table markup, in both themes.
 *
 * What it does not cover is colour contrast. axe computes contrast by
 * rasterising to a canvas, which jsdom does not implement, so the rule
 * reports neither a pass nor a failure — it is simply skipped. Rather than
 * let a silently absent rule look like a satisfied one, it is disabled here
 * with its reason. Contrast is instead validated against the palette
 * validator, with the measured ratios for both modes recorded in
 * shared/src/theme.ts and specs/006.
 *
 * The map canvas is out of scope: WebGL has no DOM to audit, and its
 * keyboard affordance is covered by keyboardTraversal.test.ts.
 */

const INPUT: MetricsInput = {
  category: 'SHOOTING',
  exposure: 'PER_CAPITA',
  scope: 'STANDARD',
  from: '2006-01',
  to: '2026-12',
};

/** Rules a static jsdom render cannot evaluate honestly. */
const UNEVALUABLE_HERE = [
  // Landmark structure belongs to the app shell, not to a fragment of it.
  'region',
  // Needs real layout boxes, which static markup does not have.
  'target-size',
  // Needs canvas rasterisation; validated separately against the palette.
  'color-contrast',
];

function renderWithStyles(node: ReactElement, mode: 'light' | 'dark'): string {
  const sheet = new ServerStyleSheet();
  try {
    const body = renderToStaticMarkup(
      sheet.collectStyles(
        createElement(
          Provider,
          { store } as never,
          createElement(ThemeProvider, { theme: resolveTheme(mode) } as never, node),
        ),
      ),
    );
    return `<!doctype html><html lang="en"><head>${sheet.getStyleTags()}</head><body>${body}</body></html>`;
  } finally {
    sheet.seal();
  }
}

async function auditViolations(node: ReactElement, mode: 'light' | 'dark'): Promise<string[]> {
  const dom = new JSDOM(renderWithStyles(node, mode), { pretendToBeVisual: true });
  const rules: axe.RuleObject = Object.fromEntries(
    UNEVALUABLE_HERE.map((id) => [id, { enabled: false }]),
  );
  const results = await axe.run(dom.window.document.body as unknown as Element, { rules });

  dom.window.close();
  return results.violations.map(
    (v: axe.Result) => `${v.id} (${v.impact ?? 'n/a'}): ${v.help} [${v.nodes.length} node(s)]`,
  );
}

const SUBJECTS: [string, () => ReactElement][] = [
  ['limitations panel', () => createElement(LimitationsPanel)],
  ['data quality panel', () => createElement(DataQualityPanel)],
  ['enforcement caveat', () => createElement(CategoryCaveat, { category: 'DRUGS' })],
  ['controls', () => createElement(AtlasControls, { input: INPUT })],
  ['neighborhood table', () => createElement(NeighborhoodTable, { input: INPUT })],
  ['scatter', () => createElement(ScatterPanel, { input: INPUT })],
];

for (const [name, build] of SUBJECTS) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${name} has no axe violations in ${mode} mode`, async () => {
      const violations = await auditViolations(build(), mode);
      assert.deepEqual(violations, [], `\n  ${violations.join('\n  ')}\n`);
    });
  }
}
