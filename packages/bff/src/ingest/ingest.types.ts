import type { IncidentAggregate } from '../incidents/incidents.service.js';
import type { NtaDemographics } from '../census/census.service.js';
import type { UnifiedInstitution } from '../institutions/institutions.service.js';
import type { NtaAmenities } from '../amenities/amenities.service.js';

export const CACHE_FILES = {
  incidents: 'incidents.json',
  institutions: 'institutions.json',
  demographics: 'demographics.json',
  amenities: 'amenities.json',
  quality: 'quality-report.json',
  provenance: 'provenance.json',
} as const;

export interface IncidentCache {
  /** nta2020 -> category -> 'YYYY-MM' -> count */
  aggregate: IncidentAggregate;
  earliestMonth: string | null;
  latestMonth: string | null;
}

export interface InstitutionCache {
  institutions: UnifiedInstitution[];
}

export interface DemographicsCache {
  byNta: Record<string, NtaDemographics>;
  available: boolean;
  /** Explains why demographics are missing, when they are. */
  unavailableReason: string | null;
}

/**
 * Grocery, healthcare and school-outcome access per neighborhood. Separate
 * from demographics because it needs no Census key — it degrades independently.
 */
export interface AmenitiesCache {
  byNta: Record<string, NtaAmenities>;
  available: boolean;
  unavailableReason: string | null;
}

export interface QualityReport {
  generatedAt: string;
  totalRowsProcessed: number;
  rejections: { dataset: string; reason: string; count: number }[];
  unmappedOffenses: string[];
  recoveredViaFallback: number;
  coordinatesRepaired: number;
  notes: string[];
}
