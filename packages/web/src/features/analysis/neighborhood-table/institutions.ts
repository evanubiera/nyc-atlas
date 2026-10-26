import type { InstitutionPoint } from '../../../store/atlasApi.js';
import { titleCaseFromShout } from '../../../format/values.ts';

export function groupInstitutionsByNeighborhood(
  institutions: readonly InstitutionPoint[],
): Map<string, InstitutionPoint[]> {
  const byNta = new Map<string, InstitutionPoint[]>();

  for (const institution of institutions) {
    if (institution.nta2020 === null) continue;
    const existing = byNta.get(institution.nta2020);
    if (existing === undefined) byNta.set(institution.nta2020, [institution]);
    else existing.push(institution);
  }

  return byNta;
}

export function byDisplayName(a: InstitutionPoint, b: InstitutionPoint): number {
  return a.name.localeCompare(b.name);
}

/**
 * The most specific label the source offers. DCLA records carry a discipline;
 * FacDB carries a facility type, which beats its subgroup — 83% of cultural
 * facilities share the subgroup OTHER CULTURAL INSTITUTIONS.
 *
 * Which directory a venue came from is provenance rather than a kind, and
 * spending a third of the line on it truncated the kind itself, so the source
 * lives in the item's tooltip.
 */
export function describeInstitutionKind(institution: InstitutionPoint): string {
  const label =
    institution.discipline ?? institution.facilityType ?? institution.facilitySubgroup;
  return label === null || label === undefined ? '—' : titleCaseFromShout(label);
}

export function describeInstitutionSource(institution: InstitutionPoint): string {
  return `${titleCaseFromShout(institution.name)} — listed in ${institution.source}`;
}
