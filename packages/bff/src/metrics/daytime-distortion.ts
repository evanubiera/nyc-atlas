import { quantile } from '@nyc-atlas/shared';

/**
 * Flags neighborhoods whose resident population is the wrong denominator
 * (specs/008 §2.6).
 *
 * A per-resident rate assumes the people at risk are the people who live
 * there. In Midtown they are not: a few tens of thousands of residents share
 * the place with hundreds of thousands of commuters, shoppers and tourists,
 * so dividing incidents by residents produces a rate that is arithmetically
 * correct and substantively meaningless.
 *
 * The honest fix is a daytime-population denominator, and no such figure is
 * published on any source this project uses — the catalog has nothing. So
 * this does not correct the rate. It detects the neighborhoods where the
 * denominator is most likely wrong and says so, which is the difference
 * between a caveat and a silent error.
 *
 * The signal is a proxy: non-residential activity per resident, counting the
 * venues, clinics and food stores already ingested. Somewhere with far more
 * destinations than residents is somewhere whose daytime population dwarfs
 * its census count. Like the supermarket floor-area threshold, this is
 * documented as a proxy rather than presented as a measurement.
 */

export interface ActivityInput {
  nta2020: string;
  population: number | null;
  institutionCount: number;
  healthcareSiteCount: number;
  foodStoreCount: number;
}

/**
 * How many times the citywide median a neighborhood must reach before its
 * denominator is called into question. A stated judgement: low enough to
 * catch the central business districts, high enough that an ordinary
 * commercial strip does not trip it.
 */
export const DISTORTION_MULTIPLE = 5;

/** Below this, the ratio is noise rather than a signal about daytime load. */
const MIN_POPULATION_FOR_SIGNAL = 500;

export function activityPerThousand(row: ActivityInput): number | null {
  if (row.population === null || row.population < MIN_POPULATION_FOR_SIGNAL) return null;
  const destinations = row.institutionCount + row.healthcareSiteCount + row.foodStoreCount;
  return (destinations / row.population) * 1000;
}

export interface DistortionScan {
  /** NTA codes whose per-resident rates should not be read at face value. */
  suspected: Set<string>;
  medianActivity: number;
  threshold: number;
}

/**
 * The threshold comes from the city's own distribution rather than a constant,
 * so it still means something if the institution scope or the ingest changes.
 */
export function scanForDistortion(rows: readonly ActivityInput[]): DistortionScan {
  const values: number[] = [];
  for (const row of rows) {
    const activity = activityPerThousand(row);
    if (activity !== null) values.push(activity);
  }

  if (values.length === 0) {
    return { suspected: new Set(), medianActivity: 0, threshold: Infinity };
  }

  const medianActivity = quantile(values, 0.5);
  const threshold = medianActivity * DISTORTION_MULTIPLE;

  const suspected = new Set<string>();
  for (const row of rows) {
    const activity = activityPerThousand(row);
    if (activity !== null && activity > threshold) suspected.add(row.nta2020);
  }

  return { suspected, medianActivity, threshold };
}

export function daytimeDistortionCaveat(scan: DistortionScan, count: number): string {
  return (
    `${count} neighborhood${count === 1 ? '' : 's'} carry far more destinations than ` +
    `residents — over ${DISTORTION_MULTIPLE}x the citywide median — which means their ` +
    `daytime population is much larger than the census count used as the denominator. ` +
    `Their per-resident rates are inflated and should not be compared with residential ` +
    `neighborhoods. No daytime-population figure is published for NYC neighborhoods, so ` +
    `this is flagged from the density of destinations rather than measured.`
  );
}
