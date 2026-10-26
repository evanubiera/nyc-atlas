import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as BaseMap } from 'react-map-gl/maplibre';
import { useTheme } from 'styled-components';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  useGeometryQuery,
  useIncidentPointsQuery,
  useInstitutionsQuery,
  useMetricsQuery,
  type MetricsInput,
  type MetricsPayload,
} from '../../store/atlasApi.js';
import { useAppSelector } from '../../store/hooks.js';
import { MapTooltip, type HoverInfo } from './MapTooltip.tsx';
import { KeyboardLayer, MapCanvas, Overlay, OverlayMessage, VisuallyHidden } from './mapStyles.ts';
import { computeTerciles, indexByNta, maxSmoothedRate } from './mapEncoding.ts';
import { ARROW_DIRECTIONS, nextInDirection } from './keyboardTraversal.ts';
import {
  boundsOf,
  quantizeBounds,
  HEXBIN_MIN_ZOOM,
  type MapViewState,
} from './viewportBounds.ts';
import { useAtlasLayers } from './useAtlasLayers.ts';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -73.95,
  latitude: 40.7,
  zoom: 9.6,
  pitch: 45,
  bearing: 0,
};

/** `YYYY-MM` to the ISO day the incidents resolver expects. */
function toIsoDay(month: string, endOfMonth: boolean): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return endOfMonth ? '2026-12-31' : '2006-01-01';
  if (!endOfMonth) return `${month}-01`;
  const [year, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

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

  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Deck reports no size of its own, and unprojecting against a zero-sized
  // viewport would ask the server for points inside a degenerate box.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;

    const measure = (): void =>
      setCanvasSize({ width: node.clientWidth, height: node.clientHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const bounds = useMemo(() => {
    if (viewState.zoom < HEXBIN_MIN_ZOOM) return null;
    const box = boundsOf(viewState, canvasSize.width, canvasSize.height);
    return box ? quantizeBounds(box) : null;
  }, [viewState, canvasSize]);

  // Points are only fetched once the view is tight enough to draw them; below
  // that the choropleth is the answer and the query would be refused anyway.
  const { data: incidentData } = useIncidentPointsQuery(
    bounds
      ? {
          ...bounds,
          category: input.category,
          from: toIsoDay(input.from, false),
          to: toIsoDay(input.to, true),
        }
      : ({} as never),
    { skip: bounds === null },
  );

  /**
   * The canvas is not focusable and has no DOM to traverse, so NFR-8 is met
   * with a focusable overlay: arrows step between neighborhoods, the view
   * follows, and a live region reads out where focus landed.
   */
  const [focusedNta, setFocusedNta] = useState<string | null>(null);
  const focusedRow = focusedNta === null ? null : (byNta.get(focusedNta) ?? null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const direction = ARROW_DIRECTIONS[event.key];
    if (direction === undefined) {
      if (event.key === 'Escape') setFocusedNta(null);
      return;
    }

    event.preventDefault();
    const next = nextInDirection(focusedRow, [...byNta.values()], direction);
    if (!next) return;

    setFocusedNta(next.nta2020);
    setViewState((current) => ({
      ...current,
      longitude: next.centroid[0] as number,
      latitude: next.centroid[1] as number,
      zoom: Math.max(current.zoom, 12),
    }));
  };

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
    zoom: viewState.zoom,
    incidents: incidentData?.points ?? [],
    onHover: setHover,
  });

  if (geoError) {
    return (
      <MapUnavailable>Could not load geometry. Is the BFF running on port 4000?</MapUnavailable>
    );
  }

  return (
    <MapCanvas ref={canvasRef}>
      <DeckGL
        viewState={viewState as never}
        onViewStateChange={({ viewState: next }) => setViewState(next as MapViewState)}
        controller
        layers={layers as never}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <BaseMap mapStyle={theme.basemapStyle} attributionControl />
      </DeckGL>

      <KeyboardLayer
        tabIndex={0}
        role="application"
        aria-label="Neighborhood map. Use the arrow keys to move between neighborhoods, Escape to leave."
        onKeyDown={handleKeyDown}
        onBlur={() => setFocusedNta(null)}
      />

      <VisuallyHidden aria-live="polite">
        {focusedRow
          ? `${focusedRow.name}, ${focusedRow.boroughName}. ` +
            `${focusedRow.institutionCount} cultural institutions. ` +
            (focusedRow.smoothedRatePer100k === null
              ? 'No rate available.'
              : `Smoothed rate ${focusedRow.smoothedRatePer100k.toFixed(1)} per 100,000.`)
          : ''}
      </VisuallyHidden>

      {hover && <MapTooltip hover={hover} rateMode={metrics?.outcomeMode === 'RATE_PER_100K'} />}
    </MapCanvas>
  );
}
