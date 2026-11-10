/**
 * Expert Forum ornament in motion.
 *
 * The key visual's "ornament shapes" (expertforum2026.com) are a Bauhaus
 * mosaic: quarter circles, domes, rings and fine concentric arcs on a square
 * grid, in KV blue gradients, red, amber, cream and brown. This rebuilds that
 * vocabulary as a live grid: every few seconds a wave rolls across the screen
 * and the tiles it passes turn, flip or pop into new shapes, while the fine
 * arcs keep rippling outward. burst() sends a fast wave from a point (a new
 * artwork on the wall).
 *
 * Plain Canvas 2D (no WebGL) so the 2016 kiosk tablet can run it too: every
 * tile is drawn in a 0..1 unit square through setTransform, so the gradients
 * are created once and shared by all tiles.
 */

type FillKey = "gBlue" | "gViolet" | "gSky" | "red" | "crimson" | "amber" | "cream" | "brown";
type Shape = "quarter" | "dome" | "ring" | "arcs" | "lines" | "square" | "circle";
type AnimKind = "turn" | "flip" | "pop";

interface Look {
  shape: Shape;
  rot: number; // quarter turns; grows past 3 while turning
  fg: FillKey;
  bg: FillKey | null;
  acc: FillKey;
}

interface Anim {
  kind: AnimKind;
  t0: number;
  dur: number;
  from: Look | null;
  to: Look | null;
}

interface Tile {
  x: number; // px, CSS
  y: number;
  span: 1 | 2;
  d: number; // density 0..1 at this tile
  seed: number;
  look: Look | null;
  anim: Anim | null;
  queued: { at: number; kind: AnimKind; to: Look | null } | null;
}

export interface OrnamentOptions {
  /** Cell size in CSS px for a given canvas size. */
  cell: (w: number, h: number) => number;
  /** Probability (0..1) that a cell holds a shape; u, v are 0..1 across the canvas. */
  density: (u: number, v: number, aspect: number) => number;
  /** Frame cap (the kiosk tablet runs at 30). */
  fps?: number;
  /** Device-pixel-ratio cap. */
  maxDpr?: number;
  /** Seconds between ambient waves [min, max]. */
  waveEvery?: [number, number];
  /** Start blank and bloom outward from the centre (hero frame). */
  startEmpty?: boolean;
}

const SOLID: Record<string, string> = {
  red: "#e81327",
  crimson: "#d2001d",
  amber: "#fba500",
  cream: "#f8e9d4",
  brown: "#8f4c2f",
};

const FILLS: [FillKey, number][] = [
  ["gBlue", 5],
  ["gViolet", 3],
  ["gSky", 2],
  ["red", 2.2],
  ["crimson", 0.9],
  ["amber", 2.4],
  ["cream", 1.5],
  ["brown", 1.2],
];

const SHAPES: [Shape, number][] = [
  ["quarter", 3.4],
  ["arcs", 1.6],
  ["ring", 1.1],
  ["dome", 1.3],
  ["square", 0.9],
  ["circle", 0.8],
  ["lines", 0.6],
];

const DUR: Record<AnimKind, number> = { turn: 1.15, flip: 0.95, pop: 1.05 };

function pick<T>(list: [T, number][], not?: T): T {
  const pool = not === undefined ? list : list.filter(([k]) => k !== not);
  let r = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of pool) if ((r -= w) <= 0) return k;
  return pool[0][0];
}

function randomLook(): Look {
  const shape = pick(SHAPES);
  const gradients: FillKey[] = ["gBlue", "gViolet", "gSky"];
  if (shape === "arcs") {
    return { shape, rot: (Math.random() * 4) | 0, fg: "cream", bg: gradients[(Math.random() * 3) | 0], acc: "cream" };
  }
  const fg = pick(FILLS);
  const bg = Math.random() < 0.5 ? null : pick(FILLS, fg);
  return { shape, rot: (Math.random() * 4) | 0, fg, bg, acc: pick(FILLS, fg) };
}

/** Fuzzy threshold: clusters keep a solid core and a ragged, breathing edge. */
const present = (d: number) => d + (Math.random() - 0.5) * 0.45 > 0.5;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutBack = (p: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

export class OrnamentField {
  private ctx: CanvasRenderingContext2D;
  private tiles: Tile[] = [];
  private grads: Record<string, CanvasGradient | string> = {};
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cellPx = 100;
  private raf = 0;
  private last = 0;
  private start = performance.now();
  private nextWave = 0;
  private tempo = 1;
  private running = true;
  private ro: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: OrnamentOptions,
  ) {
    this.ctx = canvas.getContext("2d")!;
    const g = (a: string, b: string) => {
      const lg = this.ctx.createLinearGradient(0, 0, 1, 0);
      lg.addColorStop(0, a);
      lg.addColorStop(1, b);
      return lg;
    };
    this.grads = {
      ...SOLID,
      gBlue: g("#0380e1", "#2040da"),
      gViolet: g("#0b6fe0", "#370cd5"),
      gSky: g("#25a6e1", "#1a73f5"),
    };
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(canvas);
    this.layout();
    this.nextWave = this.now() + (opts.startEmpty ? 2.5 : 1.2);
    this.raf = requestAnimationFrame(this.loop);
  }

  private now() {
    return (performance.now() - this.start) / 1000;
  }

  /** Build the grid for the current canvas size (big 2×2 tiles where it is dense). */
  private layout() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr ?? 1.5);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const cell = (this.cellPx = this.opts.cell(w, h));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    const ox = (w - cols * cell) / 2;
    const oy = (h - rows * cell) / 2;
    const used = new Uint8Array(cols * rows);
    const dens = (cx: number, cy: number) => Math.max(0, Math.min(1, this.opts.density((ox + (cx + 0.5) * cell) / w, (oy + (cy + 0.5) * cell) / h, w / h)));
    const tiles: Tile[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (used[y * cols + x]) continue;
        const d = dens(x, y);
        if (d <= 0.2) continue; // never reaches the threshold: skip the tile entirely
        let span: 1 | 2 = 1;
        if (x + 1 < cols && y + 1 < rows && d > 0.5 && Math.random() < 0.2 && !used[y * cols + x + 1] && !used[(y + 1) * cols + x] && !used[(y + 1) * cols + x + 1] && dens(x + 1, y + 1) > 0.4) span = 2;
        for (let j = 0; j < span; j++) for (let i = 0; i < span; i++) used[(y + j) * cols + x + i] = 1;
        tiles.push({
          x: ox + x * cell,
          y: oy + y * cell,
          span,
          d,
          seed: Math.random(),
          look: !this.opts.startEmpty && present(d) ? randomLook() : null,
          anim: null,
          queued: null,
        });
      }
    }
    this.tiles = tiles;
  }

  /** Speed up (generating step) or calm down the ambient waves. */
  setTempo(t: number) {
    this.tempo = t;
    this.nextWave = Math.min(this.nextWave, this.now() + 1 / t);
  }

  pause() {
    this.running = false;
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
  }

  /** A fast wave from (u, v) in 0..1 canvas space: nearly every tile changes. */
  burst(u = 0.5, v = 0.5) {
    this.wave(u * this.w, v * this.h, 16, 0.92, "flip");
  }

  private wave(ox: number, oy: number, cellsPerSec: number, chance: number, prefer?: AnimKind) {
    const t = this.now();
    const speed = cellsPerSec * this.cellPx;
    for (const tile of this.tiles) {
      if (Math.random() > chance) continue;
      const size = this.cellPx * tile.span;
      const dist = Math.hypot(tile.x + size / 2 - ox, tile.y + size / 2 - oy);
      const at = t + dist / speed + Math.random() * 0.12;
      let kind: AnimKind;
      let to: Look | null;
      if (!tile.look) {
        if (!present(tile.d)) continue;
        kind = "pop";
        to = randomLook();
      } else if (!present(tile.d)) {
        kind = "pop"; // thin areas breathe: shapes leave as well as arrive
        to = null;
      } else {
        const r = Math.random();
        kind = prefer && r < 0.6 ? prefer : r < 0.45 ? "turn" : r < 0.8 ? "flip" : "pop";
        to = kind === "turn" ? null : randomLook();
      }
      tile.queued = { at, kind, to };
    }
  }

  private ambientWave() {
    // Start from a corner or an edge midpoint so the change sweeps across.
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0.5, 0],
      [0.5, 1],
      [0, 0.5],
      [1, 0.5],
    ];
    const [u, v] = pts[(Math.random() * pts.length) | 0];
    this.wave(u * this.w, v * this.h, 5 + Math.random() * 4, 0.45 + Math.random() * 0.2);
  }

  private loop = (ms: number) => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.running || !this.w) return;
    const fps = this.opts.fps ?? 60;
    if (this.last && ms - this.last < 1000 / fps - 2) return;
    this.last = ms;
    const t = this.now();

    if (t >= this.nextWave) {
      this.ambientWave();
      const [a, b] = this.opts.waveEvery ?? [5, 9];
      this.nextWave = t + (a + Math.random() * (b - a)) / this.tempo;
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const tile of this.tiles) {
      const q = tile.queued;
      if (q && t >= q.at && !tile.anim) {
        const from = tile.look;
        const to = q.kind === "turn" && from ? { ...from, rot: from.rot + (tile.seed > 0.5 ? 1 : -1) } : q.to;
        tile.anim = { kind: q.kind, t0: t, dur: DUR[q.kind], from, to };
        tile.queued = null;
      }
      this.drawTile(tile, t);
      if (tile.anim && t - tile.anim.t0 >= tile.anim.dur) {
        tile.look = tile.anim.to;
        tile.anim = null;
      }
    }
  };

  private drawTile(tile: Tile, t: number) {
    const ctx = this.ctx;
    const s = this.cellPx * tile.span * this.dpr;
    const base = () => ctx.setTransform(s, 0, 0, s, tile.x * this.dpr, tile.y * this.dpr);
    const a = tile.anim;
    if (!a) {
      if (!tile.look) return;
      base();
      this.drawLook(tile.look, tile, t, tile.look.rot);
      return;
    }
    const p = Math.min(1, (t - a.t0) / a.dur);
    if (a.kind === "turn" && a.from && a.to) {
      base();
      const k = easeOutBack(Math.min(1, p * 1.05));
      this.drawLook(a.from, tile, t, a.from.rot + (a.to.rot - a.from.rot) * k);
      return;
    }
    if (a.kind === "flip") {
      const look = p < 0.5 ? a.from : a.to;
      if (!look) return;
      const sx = Math.max(0.001, Math.abs(Math.cos(Math.PI * easeInOut(p))));
      base();
      ctx.translate(0.5, 0);
      ctx.scale(sx, 1);
      ctx.translate(-0.5, 0);
      this.drawLook(look, tile, t, look.rot);
      return;
    }
    // pop: the old shape shrinks into its corner, the new one springs out.
    const out = p < 0.42;
    const look = out ? a.from : a.to;
    if (!look) return;
    const k = out ? 1 - easeInOut(p / 0.42) : easeOutBack((p - 0.42) / 0.58);
    if (k <= 0.001) return;
    base();
    ctx.translate(0.5, 0.5);
    ctx.scale(k, k);
    ctx.translate(-0.5, -0.5);
    this.drawLook(look, tile, t, look.rot);
  }

  /** One tile in unit space; rot (quarter turns, may be fractional) turns the shape, not the backing square. */
  private drawLook(L: Look, tile: Tile, t: number, rot: number) {
    const ctx = this.ctx;
    const fill = (k: FillKey) => (ctx.fillStyle = this.grads[k]);
    if (L.bg) {
      fill(L.bg);
      ctx.fillRect(0, 0, 1, 1);
    }
    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.rotate((rot * Math.PI) / 2);
    ctx.translate(-0.5, -0.5);
    // Shapes pivot on the bottom-left corner (0, 1) before rotation.
    switch (L.shape) {
      case "quarter":
        fill(L.fg);
        ctx.beginPath();
        ctx.moveTo(0, 1);
        ctx.arc(0, 1, 1, -Math.PI / 2, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "ring":
        for (const [r, k] of [
          [1, L.fg],
          [0.74, "cream"],
          [0.5, L.acc === "cream" ? "amber" : L.acc],
        ] as [number, FillKey][]) {
          fill(k);
          ctx.beginPath();
          ctx.moveTo(0, 1);
          ctx.arc(0, 1, r, -Math.PI / 2, 0);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case "dome":
        fill(L.fg);
        ctx.beginPath();
        ctx.moveTo(0, 1);
        ctx.arc(0.5, 1, 0.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "square":
        fill(L.fg);
        ctx.fillRect(0.18, 0.18, 0.64, 0.64);
        break;
      case "circle":
        fill(L.fg);
        ctx.beginPath();
        ctx.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "arcs":
      case "lines": {
        // Fine concentric arcs that keep rippling outward from the corner.
        const gap = L.shape === "arcs" ? 0.072 : 0.14;
        const phase = ((t * (L.shape === "arcs" ? 0.09 : 0.06) + tile.seed) % 1) * gap;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, 1, 1);
        ctx.clip();
        ctx.strokeStyle = L.shape === "arcs" ? "rgba(255,255,255,0.88)" : "#1a73f5";
        ctx.lineWidth = (L.shape === "arcs" ? 0.011 : 0.028) / tile.span;
        for (let r = gap * 0.5 + phase; r <= 1.0; r += gap) {
          ctx.beginPath();
          ctx.arc(0, 1, r, -Math.PI / 2, 0);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }
}

/** Density presets: shapes gather in the corners like the key visual, the middle stays calm. */
export const ORNAMENT_PRESETS = {
  /** 16:9 TV wall: rich top-right and bottom corners, header text area kept clear. */
  wall: {
    cell: (_w: number, h: number) => h / 7.5,
    density: (u: number, v: number) => {
      const corner = Math.max(
        1 - Math.hypot((1 - u) * 1.15, v * 1.6), // top right
        1 - Math.hypot(u * 1.5, (1 - v) * 1.9), // bottom left
        1 - Math.hypot((1 - u) * 1.6, (1 - v) * 1.9), // bottom right
      );
      const header = u < 0.5 && v < 0.24 ? 0 : 1; // logos + headline stay readable
      const footer = v > 0.88 && u > 0.3 && u < 0.7 ? 0 : 1; // Expert Forum logo, bottom centre
      return corner * 1.25 * header * footer;
    },
    fps: 60,
    maxDpr: 1.25,
    waveEvery: [4.5, 8],
  },
  /** Portrait kiosk tablet: one top-right cluster (the bottom holds the nav buttons), 30 fps. */
  kiosk: {
    cell: (w: number) => w / 6,
    density: (u: number, v: number, aspect: number) => {
      const tr = 1 - Math.hypot((1 - u) * 1.6, (v / aspect) * 1.25); // clear of the "print" headline
      // Logo row and the "print" headline stay clear: two right-hand columns, the top row only at the ID/EN corner.
      const header = u < 0.62 || (v < 0.085 && u < 0.8) ? 0 : 1;
      return Math.max(0, tr * 1.3) * header;
    },
    fps: 30,
    maxDpr: 1,
    waveEvery: [5, 9],
  },
  /** Wall hero: an ornament frame around the new artwork that blooms from the centre. */
  hero: {
    cell: (_w: number, h: number) => h / 7.5,
    density: (u: number, v: number, aspect: number) => {
      const x = Math.min(u, 1 - u) * aspect; // distance to the nearest side, in screen heights
      const y = Math.min(v, 1 - v);
      // The partner logos stay above the hero: keep their cells empty (16:9 grid,
      // top-left logo row and the Expert Forum logo bottom centre).
      const logos = v < 0.1 && u < 0.26 ? 0 : 1;
      const footer = v > 0.93 && u > 0.42 && u < 0.58 ? 0 : 1;
      return Math.max(1 - x * 4.2, 1 - y * 7.5) * 1.2 * logos * footer;
    },
    fps: 60,
    maxDpr: 1.25,
    waveEvery: [2.6, 4.2],
    startEmpty: true,
  },
  /** Share page: a band along the top, clear of the logos on the left. */
  band: {
    cell: (_w: number, h: number) => h / 2,
    density: (u: number, v: number) => (u - 0.5) * 2.4 + (0.5 - v) * 0.4,
    fps: 30,
    maxDpr: 1.5,
    waveEvery: [4, 7],
  },
} satisfies Record<string, OrnamentOptions>;

export type OrnamentPreset = keyof typeof ORNAMENT_PRESETS;
