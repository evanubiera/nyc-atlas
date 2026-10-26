import { isWithinNycBounds } from '@nyc-atlas/shared';

export interface GeoPoint {
  lon: number;
  lat: number;
}

/** A Socrata `point` column, as it arrives in JSON. */
export interface SocrataGeoreference {
  type?: string;
  coordinates?: [number, number];
}

export function pointFromGeoreference(
  georeference: SocrataGeoreference | null | undefined,
): GeoPoint | null {
  const coordinates = georeference?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  return toPointWithinNyc(coordinates[0], coordinates[1]);
}

export function pointFromLatLonFields(
  latitude: string | number | undefined,
  longitude: string | number | undefined,
): GeoPoint | null {
  return toPointWithinNyc(Number(longitude), Number(latitude));
}

function toPointWithinNyc(lon: number, lat: number): GeoPoint | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (!isWithinNycBounds(lon, lat)) return null;
  return { lon, lat };
}
