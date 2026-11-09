/**
 * Geometry of the backdrop's bottom band (4 × 1 m): the WCCE ribbon element
 * redrawn as clean vector slats — four folded groups converging on the
 * centre. Units are millimetres, origin top-left, y down. Pure data (no DOM),
 * shared by the 3D mockup texture and `scripts/export-band-svg.mjs`.
 */

export type Pt = [number, number];

export const BAND_MM = { w: 4000, h: 1000 } as const;

/** Plum → magenta → plum linear gradient (left → right) and the fold colour. */
export const BAND_COLORS = {
  stops: [
    [0, "#6F1D46"],
    [0.5, "#C4197F"],
    [1, "#6F1D46"],
  ] as [number, string][],
  fold: "#3A0A26",
};

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const unit = (a: Pt): Pt => mul(a, 1 / Math.hypot(a[0], a[1]));
/** Where the ray p + t·d meets the line through q along e. */
const meet = (p: Pt, d: Pt, q: Pt, e: Pt): Pt => add(p, mul(d, cross(sub(q, p), e) / cross(d, e)));

/**
 * Lit faces and dark fold faces of every slat, all four groups. Slats run past
 * the band edges; clip to 0…W × 0…H when drawing.
 */
export function ribbonSlats(W: number = BAND_MM.w, H: number = BAND_MM.h) {
  // Upper-left group: slats between a shallow low edge and a steeper high
  // edge that meet at the tip; the other three groups are mirror images.
  const T: Pt = [W / 2 - 170, H / 2 - 70];
  const eLow = unit(sub([-150, 40], T));
  const eHigh = unit(sub([W / 2 - 1020, -120], T));
  const d = unit([Math.cos((56 * Math.PI) / 180), -Math.sin((56 * Math.PI) / 180)]); // slat axis
  const n: Pt = [-d[1], d[0]]; // across the slat
  const pitch = 84;
  const half = 25; // lit face 50 mm
  const side = 16; // dark fold face
  const step = pitch / Math.abs(cross(eLow, d));
  const lit: Pt[][] = [];
  const fold: Pt[][] = [];
  for (let s = pitch * 0.6; s < W / 2 + 400; s += step) {
    const p0 = add(T, mul(eLow, s));
    const a0 = add(p0, mul(n, -half));
    const a1 = add(p0, mul(n, half));
    const b0 = meet(a0, d, T, eHigh);
    const b1 = meet(a1, d, T, eHigh);
    if ((b1[1] - a1[1]) * d[1] < 0) continue; // high edge is behind the slat
    const c1 = add(a1, mul(n, side));
    lit.push([a0, a1, b1, b0]);
    fold.push([a1, c1, meet(c1, d, T, eHigh), b1]);
  }
  const mirrored = (polys: Pt[][]) =>
    [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ].flatMap(([mx, my]) => polys.map((poly) => poly.map(([x, y]): Pt => [mx ? W - x : x, my ? H - y : y])));
  return { lit: mirrored(lit), fold: mirrored(fold) };
}
