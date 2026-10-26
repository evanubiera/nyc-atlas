import { CRIME_CATEGORY_META, type CrimeCategory } from '@nyc-atlas/shared';
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

export function enforcementDrivenCaveat(category: CrimeCategory): string {
  const meta = CRIME_CATEGORY_META[category];
  return (
    `"${meta.label}" is enforcement-driven: counts reflect where police are deployed ` +
    `at least as much as where the behaviour occurs. Treat differences between ` +
    `neighborhoods as a measure of policing, not of underlying crime.`
  );
}

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

export interface DataAvailability {
  amenitiesAvailable: boolean;
  demographicsAvailable: boolean;
}

export function collectComputeCaveats(
  category: CrimeCategory,
  availability: DataAvailability,
): string[] {
  const caveats: string[] = [];

  if (!availability.amenitiesAvailable) caveats.push(AMENITIES_MISSING);
  if (!availability.demographicsAvailable) caveats.push(DEMOGRAPHICS_MISSING);
  if (CRIME_CATEGORY_META[category].isEnforcementDriven) {
    caveats.push(enforcementDrivenCaveat(category));
  }
  if (category !== 'SHOOTING') caveats.push(REPORTING_BIAS);

  return caveats;
}
