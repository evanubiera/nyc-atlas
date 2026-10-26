import type { AccessGapMeasure } from '../../../store/atlasApi.js';

const NEGLIGIBLE_POINTS = 0.5;
const NEGLIGIBLE_RATIO_LOW = 0.98;
const NEGLIGIBLE_RATIO_HIGH = 1.02;

export const NO_REAL_DIFFERENCE = 'no real difference';

function describeShareGap(lowest: number, highest: number): string {
  const points = (highest - lowest) * 100;
  if (Math.abs(points) < NEGLIGIBLE_POINTS) return NO_REAL_DIFFERENCE;
  return `${Math.abs(points).toFixed(0)} points ${points > 0 ? 'higher' : 'lower'}`;
}

function describeRatioGap(ratio: number): string {
  if (ratio >= NEGLIGIBLE_RATIO_LOW && ratio <= NEGLIGIBLE_RATIO_HIGH) return NO_REAL_DIFFERENCE;
  const factor = ratio >= 1 ? ratio : 1 / ratio;
  return `${factor.toFixed(1)}× ${ratio >= 1 ? 'more' : 'less'}`;
}

/**
 * The headline for one measure, phrased so direction is explicit.
 *
 * A ratio on its own is directionless: 0.72 is an improvement for poverty and a
 * deficit for income, which is why shares are stated in points rather than as a
 * multiple.
 */
export function describeGap(measure: AccessGapMeasure): string | null {
  const { lowest, highest } = measure;
  if (lowest === null || highest === null) return null;

  if (measure.unit === 'SHARE') return describeShareGap(lowest, highest);
  if (measure.ratio === null) return null;
  return describeRatioGap(measure.ratio);
}
