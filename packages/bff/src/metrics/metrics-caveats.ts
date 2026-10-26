import {
  CRIME_CATEGORY_META,
  enforcementDrivenCaveat,
  type CrimeCategory,
} from '@nyc-atlas/shared';
import { CONFOUNDER_LABELS } from './metrics.types.js';

export const AMENITIES_MISSING =
  'Grocery, healthcare and school columns are empty: the amenity stage of the last ' +
  'ingest produced nothing. Re-run `npm run ingest`.';

export const DEMOGRAPHICS_MISSING =
  'No Census data: rates per resident cannot be computed, so counts are shown raw. ' +
  'Set CENSUS_API_KEY and re-run ingest to enable rates and confounder adjustment.';

export const REPORTING_BIAS =
  'Complaint data measures reported crime. Reporting is lower where trust in police ' +
  'is lower, which is often the same neighborhoods with least cultural investment — ' +
  'this biases the association toward zero. Shootings are the more robust outcome.';

export const GROUPS_ARE_DESCRIBED_NOT_EXPLAINED =
  'These are two groups of neighborhoods described side by side. Cultural institutions are ' +
  'sited where income already is, so this contrast shows the shape of that siting — not an ' +
  'effect of institutions on groceries, schools or clinics.';

export function residualAdjustmentCaveat(rSquared: number): string {
  return (
    `Residuals adjust for ${CONFOUNDER_LABELS.join(', ')} ` +
    `(model R² = ${rSquared.toFixed(2)}). Residual confounding from redlining and ` +
    `historical disinvestment remains — these are associations, not effects.`
  );
}

export function missingStoreGradeCaveat(missing: number, total: number): string {
  return (
    `${missing} of ${total} neighborhoods have no food store ` +
    `with a current inspection on file, and are excluded from the store-grade row only.`
  );
}

export function missingSchoolProficiencyCaveat(missing: number, total: number): string {
  return (
    `${missing} of ${total} neighborhoods have no school ` +
    `with published proficiency — either no elementary or middle school, or none that ` +
    `reported. They are excluded from the school row only, not from the rest.`
  );
}

export const WALKABILITY_MISSING =
  'Walkable access is not available: the tract geometry stage of the last ingest ' +
  'produced nothing, so no exposure can be shown for this measure. Re-run `npm run ingest`.';

export const WALKABILITY_IS_STRAIGHT_LINE =
  'Walkable access counts institutions within 800 m in a straight line, not along the ' +
  'street network. It overstates reach wherever water, rail or a park edge breaks the ' +
  'grid — most visibly along the waterfront and either side of a rail cut.';

export interface DataAvailability {
  amenitiesAvailable: boolean;
  demographicsAvailable: boolean;
  walkabilityAvailable?: boolean;
  exposure?: string;
}

export function collectComputeCaveats(
  category: CrimeCategory,
  availability: DataAvailability,
): string[] {
  const caveats: string[] = [];

  if (!availability.amenitiesAvailable) caveats.push(AMENITIES_MISSING);
  if (!availability.demographicsAvailable) caveats.push(DEMOGRAPHICS_MISSING);
  if (availability.exposure === 'ACCESS') {
    caveats.push(
      availability.walkabilityAvailable === false ? WALKABILITY_MISSING : WALKABILITY_IS_STRAIGHT_LINE,
    );
  }
  if (CRIME_CATEGORY_META[category].isEnforcementDriven) {
    caveats.push(enforcementDrivenCaveat(category));
  }
  if (category !== 'SHOOTING') caveats.push(REPORTING_BIAS);

  return caveats;
}
