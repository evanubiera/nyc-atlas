/**
 * Stepping between neighborhoods from the keyboard (specs/001 NFR-8, 008 §5.8).
 *
 * A WebGL canvas has nothing to tab to, so without this the entire map is
 * unreachable without a pointer. Traversal is spatial rather than
 * alphabetical: the arrow keys should move across the city the way the map
 * looks, so that "right" from Greenpoint is a neighbor and not Great Kills.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Traversable {
  nta2020: string;
  name: string;
  centroid: number[];
}

/**
 * Only candidates whose displacement is dominated by the pressed axis are
 * considered, which is what stops "right" drifting northward across the
 * harbour. Among those, the nearest wins.
 */
export function nextInDirection<T extends Traversable>(
  current: T | null,
  candidates: readonly T[],
  direction: Direction,
): T | null {
  const usable = candidates.filter((c) => c.centroid.length === 2);
  if (usable.length === 0) return null;
  if (current === null) return firstInReadingOrder(usable);

  const [cx, cy] = current.centroid as [number, number];
  let best: T | null = null;
  let bestDistance = Infinity;

  for (const candidate of usable) {
    if (candidate.nta2020 === current.nta2020) continue;

    const [x, y] = candidate.centroid as [number, number];
    const dx = x - cx;
    const dy = y - cy;

    if (!isInCone(dx, dy, direction)) continue;

    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  // At the edge of the city there is nothing further in that direction, so
  // the selection holds rather than jumping somewhere arbitrary.
  return best ?? current;
}

function isInCone(dx: number, dy: number, direction: Direction): boolean {
  switch (direction) {
    case 'right':
      return dx > 0 && Math.abs(dx) >= Math.abs(dy);
    case 'left':
      return dx < 0 && Math.abs(dx) >= Math.abs(dy);
    case 'up':
      return dy > 0 && Math.abs(dy) >= Math.abs(dx);
    case 'down':
      return dy < 0 && Math.abs(dy) >= Math.abs(dx);
  }
}

/** North-west first, so the first Tab lands somewhere predictable. */
function firstInReadingOrder<T extends Traversable>(candidates: readonly T[]): T {
  return [...candidates].sort((a, b) => {
    const [ax, ay] = a.centroid as [number, number];
    const [bx, by] = b.centroid as [number, number];
    return by - ay || ax - bx;
  })[0] as T;
}

export const ARROW_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
