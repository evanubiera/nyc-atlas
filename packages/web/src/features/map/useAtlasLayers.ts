import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
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

export function useAtlasLayers(options: AtlasLayerOptions): unknown[] {
  const {
    geometry, byNta, metrics, terciles, maxRate, mapMode,
    extrude, showInstitutions, institutions, theme,
  } = options;

  return useMemo(() => {
    if (!geometry) return [];

    const layers: unknown[] = [buildChoroplethLayer(options)];
    if (showInstitutions && institutions) {
      layers.push(buildInstitutionLayer(institutions, theme));
    }
    return layers;
  }, [
    geometry, byNta, metrics, terciles, maxRate, mapMode,
    extrude, showInstitutions, institutions, theme,
  ]);
}
