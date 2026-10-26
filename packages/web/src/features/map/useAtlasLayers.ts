import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { FillStyleExtension } from '@deck.gl/extensions';
import type { AppTheme } from '../../theme/index.js';
import type { InstitutionPoint, MetricsPayload, NeighborhoodMetric } from '../../store/atlasApi.js';
import type { MapMode } from '../filters/filtersSlice.js';
import { hexToRgba } from './colorScales.js';
import {
  buildElevationAccessor,
  buildFillAccessor,
  type NtaProps,
  type Terciles,
} from './mapEncoding.ts';
import type { HoverInfo } from './MapTooltip.tsx';
import { hatchPatternDataUri, PATTERN_MAPPING, PATTERN_NAME } from './excludedPattern.ts';
import { HEXBIN_MIN_ZOOM, LABEL_MIN_ZOOM } from './viewportBounds.ts';
import type { IncidentPoint } from '../../store/atlasApi.js';

/**
 * Radius is constant: the sources carry no reliable capacity or attendance
 * figure, and a varying radius would imply one.
 */
const INSTITUTION_RADIUS_METRES = 42;

export interface AtlasLayerOptions {
  geometry: GeoJSON.FeatureCollection | undefined;
  byNta: Map<string, NeighborhoodMetric>;
  metrics: MetricsPayload | undefined;
  terciles: Terciles | null;
  maxRate: number;
  mapMode: MapMode;
  extrude: boolean;
  showInstitutions: boolean;
  institutions: InstitutionPoint[] | undefined;
  theme: AppTheme;
  zoom: number;
  incidents: IncidentPoint[];
  onHover: (hover: HoverInfo | null) => void;
}

function buildChoroplethLayer(options: AtlasLayerOptions): unknown {
  const { byNta, metrics, terciles, maxRate, mapMode, extrude, theme, onHover } = options;

  return new GeoJsonLayer<NtaProps>({
    id: 'nta-choropleth',
    data: options.geometry as never,
    extruded: extrude,
    filled: true,
    stroked: true,
    pickable: true,
    getFillColor: buildFillAccessor({ byNta, mapMode, metrics, terciles, theme }) as never,
    getElevation: buildElevationAccessor({
      byNta,
      mapMode,
      metrics,
      maxRate,
      extrude,
    }) as never,
    getLineColor: hexToRgba(theme.baseline, 150),
    lineWidthMinPixels: 0.4,
    material: { ambient: 0.35, diffuse: 0.6, shininess: 32, specularColor: [40, 40, 40] },
    onHover: (info) => {
      if (!info.object) {
        onHover(null);
        return;
      }
      const props = (info.object as { properties: NtaProps }).properties;
      onHover({ x: info.x, y: info.y, props, metric: byNta.get(props.nta2020) ?? null });
    },
    updateTriggers: {
      getFillColor: [mapMode, theme.mode, metrics, terciles],
      getElevation: [extrude, mapMode, metrics, maxRate],
      getLineColor: [theme.mode],
    },
  });
}

function buildInstitutionLayer(
  institutions: InstitutionPoint[],
  theme: AppTheme,
): unknown {
  return new ScatterplotLayer({
    id: 'institutions',
    data: institutions,
    getPosition: (point: { lon: number; lat: number }) => [point.lon, point.lat],
    getRadius: INSTITUTION_RADIUS_METRES,
    radiusMinPixels: 2.2,
    radiusMaxPixels: 7,
    getFillColor: hexToRgba(theme.series[1], 225) as never,
    getLineColor: hexToRgba(theme.surface, 220) as never,
    lineWidthMinPixels: 0.5,
    stroked: true,
    pickable: false,
  });
}

/**
 * Excluded neighborhoods, hatched (specs/008 §5.6, FR-4.4).
 *
 * A separate layer rather than a per-feature pattern on the choropleth: the
 * pattern applies to a whole layer, and splitting it keeps the measured fills
 * solid while the unmeasured ones are categorically different. A flat grey
 * would still read as a value on the ramp; a hatch cannot.
 */
function buildExcludedHatchLayer(options: AtlasLayerOptions): unknown {
  const { geometry, byNta, theme } = options;

  const excluded = {
    type: 'FeatureCollection' as const,
    features: ((geometry?.features ?? []) as unknown as { properties: NtaProps }[]).filter((feature) => {
      const row = byNta.get(feature.properties.nta2020);
      return !row || row.excluded !== null;
    }),
  };

  // The extension's props are not part of GeoJsonLayer's own prop type.
  return new GeoJsonLayer<NtaProps>({
    id: 'nta-excluded-hatch',
    data: excluded as never,
    filled: true,
    stroked: false,
    pickable: false,
    extruded: false,
    getFillColor: hexToRgba(theme.textMuted, 150),
    fillPatternAtlas: hatchPatternDataUri(),
    fillPatternMapping: PATTERN_MAPPING as never,
    getFillPattern: () => PATTERN_NAME,
    getFillPatternScale: 1,
    getFillPatternOffset: [0, 0],
    extensions: [new FillStyleExtension({ pattern: true })],
    updateTriggers: { getFillColor: [theme.mode] },
  } as never);
}

/**
 * Neighborhood names with a halo in the surface colour (specs/008 §5.7).
 *
 * The halo is what makes a label legible over both a dark choropleth cell and
 * the pale basemap beneath it, without boxing every name. Labels appear only
 * once the view is tight enough to fit them; below that they overlap into
 * noise and hide the thing they annotate.
 */
function buildLabelLayer(options: AtlasLayerOptions): unknown {
  const { byNta, theme } = options;

  const labels = [...byNta.values()]
    .filter((row) => row.centroid.length === 2)
    .map((row) => ({ name: row.name, position: row.centroid as [number, number] }));

  return new TextLayer({
    id: 'nta-labels',
    data: labels,
    getPosition: (d: { position: [number, number] }) => d.position,
    getText: (d: { name: string }) => d.name,
    getSize: 11,
    sizeUnits: 'pixels',
    getColor: hexToRgba(theme.textPrimary, 235) as never,
    outlineColor: hexToRgba(theme.surface, 255) as never,
    outlineWidth: 3,
    fontSettings: { sdf: true, radius: 12 },
    fontFamily: theme.font,
    characterSet: 'auto',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    pickable: false,
    parameters: { depthTest: false },
    updateTriggers: { getColor: [theme.mode], outlineColor: [theme.mode] },
  });
}

/**
 * Individual incidents, binned (specs/008 §5.4).
 *
 * Only above z13, and only for the points the server was willing to send for
 * this viewport. Drawing 50k raw dots would say nothing except where the city
 * is dense; the bins say how many, where.
 */
function buildIncidentHexLayer(options: AtlasLayerOptions): unknown {
  const { incidents, theme } = options;

  return new HexagonLayer({
    id: 'incident-hexbins',
    data: incidents,
    getPosition: (point: IncidentPoint) => [point.lon, point.lat],
    radius: 80,
    coverage: 0.85,
    elevationScale: 0,
    extruded: false,
    opacity: 0.55,
    colorRange: theme.sequential.slice(1).map((hex) => hexToRgba(hex, 255).slice(0, 3)) as never,
    pickable: false,
  });
}

export function useAtlasLayers(options: AtlasLayerOptions): unknown[] {
  const {
    geometry, byNta, metrics, terciles, maxRate, mapMode,
    extrude, showInstitutions, institutions, theme, zoom, incidents,
  } = options;

  return useMemo(() => {
    if (!geometry) return [];

    const layers: unknown[] = [buildChoroplethLayer(options), buildExcludedHatchLayer(options)];

    if (incidents.length > 0 && zoom >= HEXBIN_MIN_ZOOM) {
      layers.push(buildIncidentHexLayer(options));
    }
    if (showInstitutions && institutions) {
      layers.push(buildInstitutionLayer(institutions, theme));
    }
    // Last, so names sit above every fill rather than under the next layer.
    if (zoom >= LABEL_MIN_ZOOM) layers.push(buildLabelLayer(options));

    return layers;
  }, [
    geometry, byNta, metrics, terciles, maxRate, mapMode,
    extrude, showInstitutions, institutions, theme, zoom, incidents,
  ]);
}
