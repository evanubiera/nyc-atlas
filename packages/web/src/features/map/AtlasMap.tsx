import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as BaseMap } from 'react-map-gl/maplibre';
import { useTheme } from 'styled-components';
import 'maplibre-gl/dist/maplibre-gl.css';
import { quantile } from '@nyc-atlas/shared';
import {
  useGeometryQuery,
  useInstitutionsQuery,
  useMetricsQuery,
  type MetricsInput,
  type NeighborhoodMetric,
} from '../../store/atlasApi.js';
import { useAppSelector } from '../../store/hooks.js';
import {
  bivariateColor,
  divergingColor,
  hexToRgba,
  sequentialColor,
  tercile,
  type Rgba,
} from './colorScales.js';

const INITIAL_VIEW_STATE = {
  longitude: -73.95,
  latitude: 40.7,
  zoom: 9.6,
  pitch: 45,
  bearing: 0,
};

const TRANSPARENT: Rgba = [0, 0, 0, 0];

interface NtaProps {
  nta2020: string;
  ntaname: string;
  boroname: string;
  ntatype: string;
}

interface HoverInfo {
  x: number;
  y: number;
  metric: NeighborhoodMetric | null;
  props: NtaProps;
}

export function AtlasMap({ input }: { input: MetricsInput }): JSX.Element {
  const theme = useTheme();
  const { data: geometry, error: geoError } = useGeometryQuery();
  const { data: metrics } = useMetricsQuery(input);
  const { mapMode, showInstitutions, extrude, institutionScope } = useAppSelector(
    (s) => s.filters,
  );
  const { data: institutions } = useInstitutionsQuery(
    { scope: institutionScope },
    { skip: !showInstitutions },
  );
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const byNta = useMemo(() => {
    const m = new Map<string, NeighborhoodMetric>();
    for (const row of metrics?.rows ?? []) m.set(row.nta2020, row);
    return m;
  }, [metrics]);

  // Tercile cuts for the bivariate grid, computed once per dataset.
  const terciles = useMemo(() => {
    const rows = (metrics?.rows ?? []).filter(
      (r) => r.excluded === null && r.smoothedRatePer100k !== null && r.exposureValue !== null,
    );
    const outcomes = rows.map((r) => r.smoothedRatePer100k as number);
    const exposures = rows.map((r) => r.exposureValue as number);
    if (rows.length === 0) return null;
    return {
      outcome: [quantile(outcomes, 1 / 3), quantile(outcomes, 2 / 3)] as [number, number],
      exposure: [quantile(exposures, 1 / 3), quantile(exposures, 2 / 3)] as [number, number],
    };
  }, [metrics]);

  const maxElevationValue = useMemo(() => {
    const vals = (metrics?.rows ?? [])
      .map((r) => r.smoothedRatePer100k)
      .filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [metrics]);

  const layers = useMemo(() => {
    if (!geometry) return [];

    const fill = (f: { properties: NtaProps }): Rgba => {
      const row = byNta.get(f.properties.nta2020);

      // Non-residential and excluded areas render as recessive texture rather
      // than disappearing — specs/001 FR-4.4.
      if (!row || row.excluded !== null) {
        return hexToRgba(theme.gridline, 90);
      }

      if (mapMode === 'RESIDUAL') {
        if (row.residual === null) return hexToRgba(theme.gridline, 70);
        const extent = metrics?.residualExtent?.[1] ?? 1;
        return divergingColor(row.residual, extent, theme.divergingNeutral);
      }

      if (mapMode === 'BIVARIATE' && terciles) {
        if (row.smoothedRatePer100k === null || row.exposureValue === null) {
          return hexToRgba(theme.gridline, 70);
        }
        return bivariateColor(
          tercile(row.exposureValue, terciles.exposure),
          tercile(row.smoothedRatePer100k, terciles.outcome),
        );
      }

      if (row.smoothedRatePer100k === null) return hexToRgba(theme.gridline, 70);
      return sequentialColor(row.smoothedRatePer100k, metrics?.scaleBreaks ?? []);
    };

    const elevation = (f: { properties: NtaProps }): number => {
      if (!extrude) return 0;
      const row = byNta.get(f.properties.nta2020);
      if (!row) return 0;

      if (mapMode === 'RESIDUAL') {
        // Height encodes magnitude of departure; the sign is carried by color.
        const extent = metrics?.residualExtent?.[1] ?? 1;
        return row.residual === null ? 0 : (Math.abs(row.residual) / extent) * 2600;
      }
      // Smoothed, never raw: one event in a small NTA would otherwise spike.
      return row.smoothedRatePer100k === null
        ? 0
        : (row.smoothedRatePer100k / maxElevationValue) * 2600;
    };

    const result: unknown[] = [
      new GeoJsonLayer<NtaProps>({
        id: 'nta-choropleth',
        data: geometry as never,
        extruded: extrude,
        filled: true,
        stroked: true,
        pickable: true,
        getFillColor: fill as never,
        getElevation: elevation as never,
        getLineColor: hexToRgba(theme.baseline, 150),
        lineWidthMinPixels: 0.4,
        material: { ambient: 0.35, diffuse: 0.6, shininess: 32, specularColor: [40, 40, 40] },
        onHover: (info) => {
          if (!info.object) {
            setHover(null);
            return;
          }
          const props = (info.object as { properties: NtaProps }).properties;
          setHover({
            x: info.x,
            y: info.y,
            props,
            metric: byNta.get(props.nta2020) ?? null,
          });
        },
        updateTriggers: {
          getFillColor: [mapMode, theme.mode, metrics, terciles],
          getElevation: [extrude, mapMode, metrics, maxElevationValue],
          getLineColor: [theme.mode],
        },
      }),
    ];

    if (showInstitutions && institutions) {
      result.push(
        new ScatterplotLayer({
          id: 'institutions',
          data: institutions,
          getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
          // Radius is constant: the sources carry no reliable capacity or
          // attendance figure, and a varying radius would imply one.
          getRadius: 42,
          radiusMinPixels: 2.2,
          radiusMaxPixels: 7,
          getFillColor: hexToRgba(theme.series[1], 225) as never,
          getLineColor: hexToRgba(theme.surface, 220) as never,
          lineWidthMinPixels: 0.5,
          stroked: true,
          pickable: false,
        }),
      );
    }

    return result;
  }, [
    geometry, byNta, mapMode, extrude, theme, metrics, terciles,
    maxElevationValue, showInstitutions, institutions,
  ]);

  if (geoError) {
    return <Centered role="alert">Could not load geometry. Is the BFF running on port 4000?</Centered>;
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers as never}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <BaseMap mapStyle={theme.basemapStyle} attributionControl />
      </DeckGL>

      {hover && <Tooltip hover={hover} rateMode={metrics?.outcomeMode === 'RATE_PER_100K'} />}
    </div>
  );
}

function Tooltip({ hover, rateMode }: { hover: HoverInfo; rateMode: boolean }): JSX.Element {
  const theme = useTheme();
  const m = hover.metric;
  const unit = rateMode ? 'per 100k' : 'per km²';

  return (
    <div
      style={{
        position: 'absolute',
        left: hover.x + 14,
        top: hover.y + 14,
        pointerEvents: 'none',
        background: theme.surface,
        color: theme.textPrimary,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: '9px 11px',
        font: `12.5px ${theme.font}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        maxWidth: 290,
        lineHeight: 1.45,
      }}
    >
      <strong>{hover.props.ntaname}</strong>
      <div style={{ color: theme.textSecondary }}>{hover.props.boroname}</div>

      {m === null || m.excluded !== null ? (
        <div style={{ color: theme.textMuted, marginTop: 6 }}>
          {m?.excluded?.explanation ?? 'Not a residential neighborhood — excluded from rates.'}
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <Line label="Incidents" value={m.rawCount.toLocaleString()} />
          {m.population !== null && (
            <Line label="Population" value={m.population.toLocaleString()} />
          )}
          {m.smoothedRatePer100k !== null && (
            <Line label={`Smoothed ${unit}`} value={m.smoothedRatePer100k.toFixed(1)} />
          )}
          {/* Raw shown beside smoothed: the tooltip is where honesty about
              the shrinkage lives. */}
          {m.ratePer100k !== null && (
            <Line label={`Raw ${unit}`} value={m.ratePer100k.toFixed(1)} muted />
          )}
          {m.confidenceInterval && (
            <Line
              label="95% CI"
              value={`${m.confidenceInterval[0]?.toFixed(1)} – ${m.confidenceInterval[1]?.toFixed(1)}`}
              muted
            />
          )}
          <Line label="Institutions" value={String(m.institutionCount)} />
          {m.residual !== null && (
            <Line
              label="vs. predicted"
              value={`${m.residual > 0 ? '+' : ''}${m.residual.toFixed(1)}`}
            />
          )}
          {m.medianHouseholdIncome !== null && (
            <Line
              label="Median income"
              value={`$${Math.round(m.medianHouseholdIncome).toLocaleString()}`}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}): JSX.Element {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
      <span style={{ color: muted ? theme.textMuted : theme.textSecondary }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: muted ? theme.textMuted : theme.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

function Centered({ children, role }: { children: React.ReactNode; role?: string }): JSX.Element {
  return (
    <div
      role={role}
      style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '14px system-ui' }}
    >
      <span style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '8px 14px', borderRadius: 8 }}>
        {children}
      </span>
    </div>
  );
}

export { TRANSPARENT };
