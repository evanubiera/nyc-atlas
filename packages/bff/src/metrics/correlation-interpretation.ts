const MOSTLY_EXPLAINED_FRACTION = 0.5;
const MEANINGFUL_REVERSAL = 0.05;

const CLOSING =
  ' This is an association, not a causal effect; institutions are sited ' +
  'in already-safer areas, so causality plausibly runs in both directions.';

export const UNADJUSTED_ONLY =
  'Unadjusted association only. Without Census data the dominant confounder — ' +
  'income — cannot be accounted for, and institutions are known to locate in ' +
  'wealthier areas. This number should not be read as an effect.';

export const TOO_FEW_FOR_ADJUSTMENT =
  'Too few neighborhoods with complete demographics to adjust.';

function reversesAfterAdjustment(raw: number, adjusted: number): boolean {
  return Math.sign(adjusted) !== Math.sign(raw) && Math.abs(adjusted) > MEANINGFUL_REVERSAL;
}

function mostlyExplainedByConfounders(raw: number, adjusted: number): boolean {
  return Math.abs(adjusted) < Math.abs(raw) * MOSTLY_EXPLAINED_FRACTION;
}

function describeAdjustmentEffect(raw: number, adjusted: number): string {
  if (reversesAfterAdjustment(raw, adjusted)) {
    return (
      ' The association reverses once socioeconomics are accounted for, which strongly ' +
      'suggests the raw pattern was driven by where institutions are sited rather than by ' +
      'any effect of them.'
    );
  }

  if (mostlyExplainedByConfounders(raw, adjusted)) {
    return (
      ' Most of the raw association is explained by socioeconomic differences between ' +
      'neighborhoods rather than by cultural infrastructure itself.'
    );
  }

  return (
    ' A substantial part of the association persists after adjustment, though residual ' +
    'confounding from redlining and historical disinvestment is certain and unmeasured.'
  );
}

export function buildInterpretation(raw: number, adjusted: number): string {
  const direction = raw < 0 ? 'fewer' : 'more';
  const head =
    `Unadjusted, neighborhoods with more cultural institutions show ${direction} incidents ` +
    `(r = ${raw.toFixed(2)}). After adjusting for income, poverty, density, age structure ` +
    `and tenure, the partial correlation is ${adjusted.toFixed(2)}.`;

  return `${head}${describeAdjustmentEffect(raw, adjusted)}${CLOSING}`;
}
