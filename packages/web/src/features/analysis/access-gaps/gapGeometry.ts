export interface DumbbellGeometry {
  leastPercent: number;
  mostPercent: number;
  connectorLeft: number;
  connectorWidth: number;
}

/**
 * Positions both ends of one measure's dumbbell as percentages of that row's
 * own maximum.
 *
 * Each row is scaled to itself because the measures share no unit — dollars,
 * stores per 10,000 residents, a share of students. A shared axis would invent
 * a comparison the data does not contain, so bar length is only ever comparable
 * within a row, and both ends carry direct value labels.
 */
export function dumbbellGeometry(
  least: number | null,
  most: number | null,
): DumbbellGeometry | null {
  if (least === null || most === null) return null;

  const max = Math.max(least, most);
  if (max <= 0) return null;

  const leastPercent = (least / max) * 100;
  const mostPercent = (most / max) * 100;

  return {
    leastPercent,
    mostPercent,
    connectorLeft: Math.min(leastPercent, mostPercent),
    connectorWidth: Math.abs(mostPercent - leastPercent),
  };
}
