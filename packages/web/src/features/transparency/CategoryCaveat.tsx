import styled from 'styled-components';
import { CRIME_CATEGORY_META, enforcementDrivenCaveat, type CrimeCategory } from '@nyc-atlas/shared';

/**
 * The enforcement-driven caveat, stated where the figures are (specs/008 §7.5).
 *
 * The limitations panel already carries the general warning, but someone
 * reading a drug-arrest choropleth is reading a map of police deployment, and
 * that has to be legible without opening a panel. Renders nothing for the
 * categories where it does not apply, so it can sit unconditionally in a
 * layout.
 *
 * The wording comes from `shared` — the same string the server attaches to
 * the payload caveats, so the inline note and the panel cannot disagree.
 */
export function CategoryCaveat({
  category,
  className,
}: {
  category: string;
  className?: string;
}): JSX.Element | null {
  // The selection is a plain string on MetricsInput; an unrecognised one simply
  // has no metadata and therefore no caveat.
  const meta = CRIME_CATEGORY_META[category as CrimeCategory];
  if (!meta?.isEnforcementDriven) return null;

  return (
    <Note role="note" className={className}>
      <Marker aria-hidden>!</Marker>
      <span>{enforcementDrivenCaveat(category as CrimeCategory)}</span>
    </Note>
  );
}

/** The same note floated over the map, where there is no flow to sit in. */
export const FloatingCategoryCaveat = styled(CategoryCaveat)`
  position: absolute;
  top: ${({ theme }) => theme.space(3)};
  left: ${({ theme }) => theme.space(3)};
  z-index: 5;
  max-width: 420px;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.16);
`;

const Note = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space(2)};
  margin: 0;
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(3)};
  background: ${({ theme }) => theme.pagePlane};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
  font-size: 11px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textSecondary};
`;

/**
 * A bordered glyph rather than a coloured one: this must read in both modes
 * and for a reader who cannot distinguish a warning hue (NFR-9).
 */
const Marker = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  margin-top: 1px;
  border: 1px solid ${({ theme }) => theme.baseline};
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  color: ${({ theme }) => theme.textPrimary};
`;
