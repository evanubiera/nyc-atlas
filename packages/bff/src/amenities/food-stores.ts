import { SUPERMARKET_MIN_SQFT, type Nta2020Code } from '@nyc-atlas/shared';
import { getOrCreate } from '../common/map-utils.js';
import { pointFromGeoreference } from '../common/geo-point.js';
import type { NtaLocator } from '../common/nta-locator.js';
import type { RejectionLog } from '../common/rejection-log.js';
import type { FoodStoreRow, FoodStoreTally } from './amenities.types.js';

export const STORE_WITHOUT_LOCATION = 'food stores: licence has no georeference';
export const STORE_OUTSIDE_NEIGHBORHOODS = 'food stores: could not resolve to an NTA';

/**
 * Floor area is self-reported at licensing and never audited, so this is a
 * proxy: area predicts produce, dairy and meat depth rather than measuring it.
 * A plain store count would mostly measure bodegas and run opposite to grocery
 * access, which is why the threshold is worth its noise.
 */
export function isSupermarket(squareFootage: string | number | undefined): boolean {
  const area = Number(squareFootage);
  return Number.isFinite(area) && area >= SUPERMARKET_MIN_SQFT;
}

export function tallyFoodStoresByNeighborhood(
  rows: readonly FoodStoreRow[],
  locator: NtaLocator,
  rejections: RejectionLog,
): Map<Nta2020Code, FoodStoreTally> {
  const byNta = new Map<Nta2020Code, FoodStoreTally>();

  for (const store of rows) {
    const point = pointFromGeoreference(store.georeference);
    if (point === null) {
      rejections.record(STORE_WITHOUT_LOCATION);
      continue;
    }

    const nta2020 = locator.fromPoint(point);
    if (nta2020 === null) {
      rejections.record(STORE_OUTSIDE_NEIGHBORHOODS);
      continue;
    }

    const tally = getOrCreate(byNta, nta2020, () => ({ total: 0, supermarkets: 0 }));
    tally.total += 1;
    if (isSupermarket(store.square_footage)) tally.supermarkets += 1;
  }

  return byNta;
}
