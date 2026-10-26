import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as BaseMap } from 'react-map-gl/maplibre';
import { useTheme } from 'styled-components';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  useGeometryQuery,
  useInstitutionsQuery,
  useMetricsQuery,
  type MetricsInput,
  type MetricsPayload,
} from '../../store/atlasApi.js';
import { useAppSelector } from '../../store/hooks.js';
import { MapTooltip, type HoverInfo } from './MapTooltip.tsx';
import { MapCanvas, Overlay, OverlayMessage } from './mapStyles.ts';
import { computeTerciles, indexByNta, maxSmoothedRate } from './mapEncoding.ts';
import { useAtlasLayers } from './useAtlasLayers.ts';

const INITIAL_VIEW_STATE = {
  longitude: -73.95,
  latitude: 40.7,
  zoom: 9.6,
  pitch: 45,
  bearing: 0,
};

function MapUnavailable({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Overlay role="alert">
      <OverlayMessage>{children}</OverlayMessage>
    </Overlay>
  );
}

/** The per-dataset statistics every encoder reads, memoised together. */
function useMapStatistics(metrics: MetricsPayload | undefined) {
  const rows = metrics?.rows ?? [];
  return {
    byNta: useMemo(() => indexByNta(rows), [metrics]),
    terciles: useMemo(() => computeTerciles(rows), [metrics]),
    maxRate: useMemo(() => maxSmoothedRate(rows), [metrics]),
  };
}

export function AtlasMap({ input }: { input: MetricsInput }): JSX.Element {
  const theme = useTheme();
  const { data: geometry, error: geoError } = useGeometryQuery();
  const { data: metrics } = useMetricsQuery(input);
  const { mapMode, showInstitutions, extrude, institutionScope } = useAppSelector(
    (state) => state.filters,
  );
  const { data: institutions } = useInstitutionsQuery(
    { scope: institutionScope },
    { skip: !showInstitutions },
  );
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { byNta, terciles, maxRate } = useMapStatistics(metrics);

  const layers = useAtlasLayers({
    geometry,
    byNta,
    metrics,
    terciles,
    maxRate,
    mapMode,
    extrude,
    showInstitutions,
    institutions,
    theme,
    onHover: setHover,
  });

  if (geoError) {
    return (
      <MapUnavailable>Could not load geometry. Is the BFF running on port 4000?</MapUnavailable>
    );
  }

  return (
    <MapCanvas>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers as never}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <BaseMap mapStyle={theme.basemapStyle} attributionControl />
      </DeckGL>

      {hover && <MapTooltip hover={hover} rateMode={metrics?.outcomeMode === 'RATE_PER_100K'} />}
    </MapCanvas>
  );
}
