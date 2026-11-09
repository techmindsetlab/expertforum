import { getStroke } from "perfect-freehand";

/**
 * Stroke data is stored normalised (0..1) so the same drawing can be
 * re-rendered at any size: kiosk canvas, 1024px export, wall replay.
 * point = [x, y, pressure, tMs]
 */
export type StrokePoint = [number, number, number, number];
/** Drawing tools, as in Canva's Draw panel (no eraser). Strokes without a tool are "pen". */
export type Tool = "pen" | "marker" | "glow" | "highlighter";
/** `pen`: drawn with the S Pen (real pressure), not a finger. */
export type Stroke = { color: string; size: number; pen: boolean; tool?: Tool; points: StrokePoint[] };
export type Drawing = { v: 1; strokes: Stroke[] };

/** Canva's default colour set, white left out (on the white canvas it would act as an eraser). */
export const PALETTE = [
  "#000000",
  "#545454",
  "#737373",
  "#a6a6a6",
  "#d9d9d9",
  "#ff3131",
  "#ff5757",
  "#ff66c4",
  "#cb6ce6",
  "#8c52ff",
  "#5e17eb",
  "#0097b2",
  "#0cc0df",
  "#5ce1e6",
  "#38b6ff",
  "#5271ff",
  "#004aad",
  "#00bf63",
  "#7ed957",
  "#c1ff72",
  "#ffde59",
  "#ffbd59",
  "#ff914d",
  "#c6007e", // Astragraphia magenta in place of white
] as const;

/** Base stroke width per tool, relative to the canvas width. */
export const TOOLS: { id: Tool; size: number }[] = [
  { id: "pen", size: 0.012 },
  { id: "marker", size: 0.026 },
  { id: "glow", size: 0.017 },
  { id: "highlighter", size: 0.05 },
];

/** Small / medium / large, as multipliers of the tool's base width. */
export const SIZE_STEPS = [0.6, 1, 1.7] as const;

export function strokeOutline(stroke: Stroke, scale: number, upto = stroke.points.length, widthMul = 1) {
  const pts = stroke.points.slice(0, upto).map(([x, y, p]) => [x * scale, y * scale, p]);
  const size = stroke.size * scale * widthMul;
  const last = upto >= stroke.points.length;
  switch (stroke.tool ?? "pen") {
    case "marker": // even, round felt tip
      return getStroke(pts, { size, thinning: 0.08, smoothing: 0.6, streamline: 0.45, simulatePressure: false, last, start: { cap: true }, end: { cap: true } });
    case "highlighter": // wide, flat, see-through
      return getStroke(pts, { size, thinning: 0, smoothing: 0.65, streamline: 0.55, simulatePressure: false, last, start: { cap: true }, end: { cap: true } });
    case "glow": // neon tube: steady width, slight taper at the end
      return getStroke(pts, { size, thinning: stroke.pen ? 0.15 : 0, smoothing: 0.6, streamline: 0.5, simulatePressure: false, last, start: { cap: true }, end: { cap: true } });
    default: // pen: pressure and tapered ends
      return getStroke(pts, {
        size,
        thinning: stroke.pen ? 0.62 : 0.5,
        smoothing: 0.55,
        streamline: 0.45,
        simulatePressure: !stroke.pen,
        last,
        start: { taper: stroke.pen ? size * 1.2 : 0, cap: true },
        end: { taper: stroke.pen ? size * 1.5 : 0, cap: true },
      });
  }
}

/** Mix a #rrggbb colour with white (k = 0..1 share of white). */
function tint(hex: string, k: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number, upto?: number) {
  const outline = strokeOutline(stroke, scale, upto);
  if (!outline.length) return;
  const path = outlineToPath(outline);
  const tool = stroke.tool ?? "pen";
  ctx.save();
  ctx.fillStyle = stroke.color;
  if (tool === "highlighter") {
    ctx.globalAlpha = 0.42;
    ctx.fill(path);
  } else if (tool === "glow") {
    // Coloured halo (shadowBlur ignores the transform, so scale it by hand) + a light core.
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = stroke.size * scale * 1.9 * (ctx.getTransform().a || 1);
    ctx.fill(path);
    ctx.fill(path);
    ctx.shadowBlur = 0;
    const core = strokeOutline(stroke, scale, upto, 0.42);
    if (core.length) {
      ctx.fillStyle = tint(stroke.color, 0.78);
      ctx.fill(outlineToPath(core));
    }
  } else {
    ctx.fill(path);
  }
  ctx.restore();
}

export function renderDrawing(ctx: CanvasRenderingContext2D, drawing: Drawing, size: number, background = "#ffffff") {
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  for (const s of drawing.strokes) drawStroke(ctx, s, size);
  ctx.restore();
}

/** Total number of points, used to pace a replay. */
export function pointCount(drawing: Drawing) {
  return drawing.strokes.reduce((n, s) => n + s.points.length, 0);
}

/**
 * Draws the drawing progressively: `progress` 0..1 maps onto the total point
 * count so long drawings replay in the same duration as short ones.
 */
export function renderReplay(ctx: CanvasRenderingContext2D, drawing: Drawing, size: number, progress: number) {
  const total = pointCount(drawing);
  let budget = Math.floor(total * Math.min(1, Math.max(0, progress)));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  for (const s of drawing.strokes) {
    if (budget <= 0) break;
    const n = Math.min(s.points.length, budget);
    drawStroke(ctx, s, size, n);
    budget -= n;
  }
}

/** Rounds coordinates so the JSON stays small. */
export function compactDrawing(drawing: Drawing): Drawing {
  const r = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    v: 1,
    strokes: drawing.strokes.map((s) => ({
      ...s,
      size: r(s.size),
      points: s.points.map(([x, y, p, t]) => [r(x), r(y), r(p, 2), Math.round(t)] as StrokePoint),
    })),
  };
}
