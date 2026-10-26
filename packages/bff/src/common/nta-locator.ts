import { hasValue, type Nta2020Code } from '@nyc-atlas/shared';
import type { GeoPoint } from './geo-point.js';

/**
 * The slice of the geography service this needs. Narrow on purpose: it makes
 * the locator testable without standing up the full NTA index.
 */
export interface NeighborhoodIndex {
  resolvePoint(lon: number, lat: number): Nta2020Code | null;
  getRecord(code: Nta2020Code): unknown;
}

/**
 * Places a record in a 2020 neighborhood.
 *
 * An upstream neighborhood code is accepted only when it names a neighborhood
 * that exists: several sources still ship 2010 codes, whose boundaries were
 * redrawn rather than renamed, and a blind trust would silently file records
 * under the wrong neighborhood. Anything unrecognised falls back to
 * point-in-polygon against the exact geometry.
 */
export class NtaLocator {
  constructor(private readonly geography: NeighborhoodIndex) {}

  fromPoint(point: GeoPoint | null): Nta2020Code | null {
    if (point === null) return null;
    return this.geography.resolvePoint(point.lon, point.lat);
  }

  fromUpstreamCodeOrPoint(
    upstreamCode: string | undefined,
    point: GeoPoint | null,
  ): Nta2020Code | null {
    if (hasValue(upstreamCode)) {
      const code = upstreamCode.trim();
      if (this.geography.getRecord(code) !== undefined) return code;
    }
    return this.fromPoint(point);
  }
}
