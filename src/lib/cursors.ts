/**
 * Figma-style canvas cursors: dark arrow/crosshair with a white outline and soft
 * shadow, plus a small tool badge in the current accent colour. Generated as SVG
 * data URIs (1x and 2x) because CSS variables cannot reach into cursor images.
 */

const INK = "#141416";
const OUT = "#ffffff";

const SHADOW = `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="0.9" flood-color="#000" flood-opacity="0.35"/></filter></defs>`;

const ARROW = `<path d="M5 3.5 L5 21.2 L9.7 16.9 L12.6 23.7 Q12.9 24.4 13.6 24.1 L15.4 23.3 Q16.1 23 15.8 22.3 L12.9 15.6 L18.8 15.6 Z" fill="${INK}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`;

const CROSS = (cx: number, cy: number) => {
  const d = `M${cx} ${cy - 9} V${cy - 2.5} M${cx} ${cy + 2.5} V${cy + 9} M${cx - 9} ${cy} H${cx - 2.5} M${cx + 2.5} ${cy} H${cx + 9}`;
  return `<path d="${d}" stroke="${OUT}" stroke-width="3.6" stroke-linecap="round"/><path d="${d}" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="1.3" fill="${INK}" stroke="${OUT}" stroke-width="1"/>`;
};

function url(body: string, scale: 1 | 2) {
  const px = 32 * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32" fill="none">${SHADOW}<g filter="url(#s)">${body}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function cursor(body: string, x: number, y: number, fallback: string) {
  return `-webkit-image-set(${url(body, 1)} 1x, ${url(body, 2)} 2x) ${x} ${y}, ${fallback}`;
}

export interface CanvasCursors {
  select: string;
  move: string;
  state: string;
  transition: string;
  link: string;
  delete: string;
}

/** @param accent badge colour  @param fg icon colour drawn on top of the badge */
export function buildCursors(accent: string, fg: string): CanvasCursors {
  const badgeCircle = (inner: string, fill = accent) =>
    `<circle cx="23" cy="23" r="6" fill="${fill}" stroke="${OUT}" stroke-width="1.5"/>${inner}`;

  const arrowBadge = `<rect x="15.5" y="17.5" width="14" height="11" rx="5.5" fill="${accent}" stroke="${OUT}" stroke-width="1.5"/><path d="M19.1 23 H25.5 M23.1 20.6 L25.5 23 L23.1 25.4" stroke="${fg}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

  const moveBadge = badgeCircle(
    `<path d="M23 19.6 V26.4 M19.6 23 H26.4 M21.9 20.7 L23 19.6 L24.1 20.7 M21.9 25.3 L23 26.4 L24.1 25.3 M20.7 21.9 L19.6 23 L20.7 24.1 M25.3 21.9 L26.4 23 L25.3 24.1" stroke="${fg}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  const stateBadge = `<circle cx="23" cy="23" r="6" fill="${OUT}"/><circle cx="23" cy="23" r="4.2" fill="none" stroke="${accent}" stroke-width="2"/>`;

  const deleteBadge = badgeCircle(
    `<path d="M20.9 20.9 L25.1 25.1 M25.1 20.9 L20.9 25.1" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
    "#e5484d"
  );

  return {
    select: cursor(ARROW, 5, 3, "default"),
    move: cursor(ARROW + moveBadge, 5, 3, "move"),
    state: cursor(CROSS(12, 12) + stateBadge, 12, 12, "crosshair"),
    transition: cursor(ARROW + arrowBadge, 5, 3, "default"),
    link: cursor(CROSS(12, 12) + arrowBadge, 12, 12, "crosshair"),
    delete: cursor(ARROW + deleteBadge, 5, 3, "not-allowed"),
  };
}
