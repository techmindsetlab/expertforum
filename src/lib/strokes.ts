import { getStroke } from "perfect-freehand";

/**
 * Stroke data is stored normalised (0..1) so the same drawing can be
 * re-rendered at any size: kiosk canvas, 1024px export, wall replay.
 * point = [x, y, pressure, tMs]
 */
export type StrokePoint = [number, number, number, number];
export type Stroke = { color: string; size: number; pen: boolean; points: StrokePoint[] };
export type Drawing = { v: 1; strokes: Stroke[] };

export const PALETTE = [
  "#1B1220", // ink
  "#941F62", // astragraphia plum
  "#E5332A", // red
  "#F2B81E", // gold
  "#2BA36B", // green
  "#2F6FE4", // blue
  "#E85FA8", // pink
  "#8A5A3B", // sepia
] as const;

/** Brush sizes relative to canvas width. */
export const BRUSHES = [0.008, 0.016, 0.032] as const;

export function strokeOutline(stroke: Stroke, scale: number, upto = stroke.points.length) {
  const pts = stroke.points.slice(0, upto).map(([x, y, p]) => [x * scale, y * scale, p]);
  return getStroke(pts, {
    size: stroke.size * scale,
    thinning: stroke.pen ? 0.62 : 0.5,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: !stroke.pen,
    last: upto >= stroke.points.length,
    start: { taper: stroke.pen ? stroke.size * scale * 1.2 : 0, cap: true },
    end: { taper: stroke.pen ? stroke.size * scale * 1.5 : 0, cap: true },
  });
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
  ctx.fillStyle = stroke.color;
  ctx.fill(outlineToPath(outline));
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
