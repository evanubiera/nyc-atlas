import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import { useTheme } from 'styled-components';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RESIDENTIAL_NTA_TYPE } from '@nyc-atlas/shared';
import { useGeometryQuery } from '../../store/atlasApi.js';
import { useAppSelector } from '../../store/hooks.js';

const INITIAL_VIEW_STATE = {
  longitude: -73.95,
  latitude: 40.7,
  zoom: 9.6,
  pitch: 45,
  bearing: 0,
};

interface NtaProps {
  nta2020: string;
  ntaname: string;
  boroname: string;
  ntatype: string;
}

interface HoverInfo {
  x: number;
  y: number;
  props: NtaProps;
}

export function AtlasMap(): JSX.Element {
  const theme = useTheme();
  const { data: geometry, isLoading, error } = useGeometryQuery();
  const extrude = useAppSelector((s) => s.filters.extrude);
  const residentialOnly = useAppSelector((s) => s.filters.residentialOnly);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const layers = useMemo(() => {
    if (!geometry) return [];

    return [
      new GeoJsonLayer<NtaProps>({
        id: 'nta-choropleth',
        data: geometry as never,
        extruded: extrude,
        wireframe: false,
        filled: true,
        stroked: true,
        pickable: true,

        // Placeholder encoding until the metrics pipeline lands (specs/008 §2).
        // Area stands in for magnitude so the sequential ramp and the 3D
        // extrusion are verifiable end to end; it is NOT a crime rate.
        getElevation: (f) => {
          const p = f.properties;
          if (p.ntatype !== RESIDENTIAL_NTA_TYPE) return 0;
          return 400;
        },
        getFillColor: (f) => {
          const p = f.properties;
          if (p.ntatype !== RESIDENTIAL_NTA_TYPE) {
            return residentialOnly ? [0, 0, 0, 0] : hexToRgba(theme.gridline, 110);
          }
          return hexToRgba(theme.sequential[5] as string, 190);
        },
        getLineColor: hexToRgba(theme.baseline, 160),
        lineWidthMinPixels: 0.5,
        material: { ambient: 0.35, diffuse: 0.6, shininess: 32, specularColor: [40, 40, 40] },
        onHover: (info) => {
          setHover(
            info.object
              ? { x: info.x, y: info.y, props: (info.object as { properties: NtaProps }).properties }
              : null,
          );
        },
        updateTriggers: {
          getFillColor: [theme.mode, residentialOnly],
          getElevation: [extrude],
          getLineColor: [theme.mode],
        },
      }),
    ];
  }, [geometry, extrude, residentialOnly, theme]);

  if (error) {
    return (
      <Centered role="alert">
        Could not load neighborhood geometry from the BFF. Is it running on port 4000?
      </Centered>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <Map mapStyle={theme.basemapStyle} attributionControl />
      </DeckGL>

      {isLoading && <Centered>Loading 262 neighborhoods…</Centered>}

      {hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.x + 12,
            top: hover.y + 12,
            pointerEvents: 'none',
            background: theme.surface,
            color: theme.textPrimary,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            font: `13px ${theme.font}`,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            maxWidth: 260,
          }}
        >
          <strong>{hover.props.ntaname}</strong>
          <div style={{ color: theme.textSecondary, marginTop: 2 }}>
            {hover.props.boroname} · {hover.props.nta2020}
          </div>
          {hover.props.ntatype !== RESIDENTIAL_NTA_TYPE && (
            <div style={{ color: theme.textMuted, marginTop: 4 }}>
              Non-residential — excluded from rates
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Centered({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}): JSX.Element {
  return (
    <div
      role={role}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        font: '14px system-ui',
      }}
    >
      <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 14px', borderRadius: 8 }}>
        {children}
      </span>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128, alpha];
  return [
    parseInt(m[1] as string, 16),
    parseInt(m[2] as string, 16),
    parseInt(m[3] as string, 16),
    alpha,
  ];
}
