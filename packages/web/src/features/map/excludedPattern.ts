/**
 * The hatch used to fill excluded neighborhoods (specs/008 §5.6).
 *
 * Excluded areas must stay visible — a park or an airport is part of the city
 * and dropping it leaves a hole the reader reads as missing data. But a flat
 * grey is also a value on a sequential ramp, so colour alone cannot say "this
 * is not measured". A hatch is categorically different from every fill the
 * scales produce, which is the point: it cannot be misread as a quantity, and
 * it survives both themes and any colour vision (NFR-9).
 *
 * The atlas is generated rather than shipped as a file: it is sixteen pixels
 * of diagonal line, and a build step or a binary asset for that is not worth
 * the bytes.
 */

export const PATTERN_SIZE = 16;
export const PATTERN_NAME = 'hatch';

/** deck.gl's FillStyleExtension indexes the atlas by name. */
export const PATTERN_MAPPING = {
  [PATTERN_NAME]: { x: 0, y: 0, width: PATTERN_SIZE, height: PATTERN_SIZE, mask: true },
} as const;

/**
 * A 45-degree hatch as an SVG data URI.
 *
 * `mask: true` above means only the alpha channel is read and the colour comes
 * from getFillColor, so this draws in white and lets the theme tint it.
 */
export function hatchPatternDataUri(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PATTERN_SIZE}" height="${PATTERN_SIZE}">` +
    `<path d="M-4,4 l8,-8 M0,16 L16,0 M12,20 l8,-8" ` +
    `stroke="white" stroke-width="2.5" fill="none"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
