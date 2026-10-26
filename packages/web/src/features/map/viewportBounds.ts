import { WebMercatorViewport } from '@deck.gl/core';

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Below this the labels are unreadable noise; above it they fit. */
export const LABEL_MIN_ZOOM = 11.5;

/** specs/006: individual incidents only appear once the view is a few blocks wide. */
export const HEXBIN_MIN_ZOOM = 13;

/**
 * The geographic box currently on screen.
 *
 * Returns null until the canvas has been measured: a viewport of zero width
 * unprojects to a degenerate box, and asking the server for points inside it
 * would be a wasted round trip on every first paint.
 */
export function boundsOf(
  viewState: MapViewState,
  width: number,
  height: number,
): Bounds | null {
  if (width <= 0 || height <= 0) return null;

  const viewport = new WebMercatorViewport({ ...viewState, width, height });
  // getBounds() is flat: [west, south, east, north].
  const [west, south, east, north] = viewport.getBounds() as unknown as [
    number,
    number,
    number,
    number,
  ];

  if (![west, south, east, north].every(Number.isFinite)) return null;
  return { west, south, east, north };
}

/**
 * Rounded so that nudging the map by a pixel is not a new cache key.
 *
 * Three decimals is about 100 m, well inside one hexbin, so the points served
 * are still the right ones for what is on screen.
 */
export function quantizeBounds(bounds: Bounds, decimals = 3): Bounds {
  const round = (n: number): number => Number(n.toFixed(decimals));
  return {
    west: round(bounds.west),
    south: round(bounds.south),
    east: round(bounds.east),
    north: round(bounds.north),
  };
}
