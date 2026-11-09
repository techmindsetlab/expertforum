import * as THREE from "three";

/**
 * Canvas-drawn textures for the booth mockup: placeholder artworks, TV /
 * tablet screens, product slides, rack poster and shelf props. The backdrop
 * print itself is the designer's FA (public/booth/backdrop-fa.webp).
 * Everything is generated at runtime so the client can tweak copy in code.
 */

export type Fonts = { sans: string; hand: string };

export const C = {
  plum: "#941F62",
  plumDeep: "#6F1D46",
  ink: "#1B1220",
  magenta: "#C4197F",
  gold: "#F2B81E",
  paper: "#F7F5F2",
  grey: "#EEECE8",
} as const;

export function fontFamilies(): Fonts {
  const cs = getComputedStyle(document.documentElement);
  return {
    sans: cs.getPropertyValue("--font-sans").trim() || "sans-serif",
    hand: cs.getPropertyValue("--font-hand").trim() || "cursive",
  };
}

export async function ensureFonts(f: Fonts) {
  await Promise.all([
    document.fonts.load(`700 40px ${f.sans}`),
    document.fonts.load(`400 40px ${f.sans}`),
    document.fonts.load(`700 40px ${f.hand}`),
  ]).catch(() => {});
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return { c, ctx: c.getContext("2d")! };
}

export function toTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function contain(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ─── Placeholder artworks ──────────────────────────────────────────

const PALETTES = [
  ["#FFE45C", "#FF6FA8", "#3E8EF7"],
  ["#8EE3F5", "#FFB347", "#9B5DE5"],
  ["#B8F27C", "#FF7A59", "#5B6CFF"],
  ["#FFC8DD", "#2EC4B6", "#FF9F1C"],
  ["#CDB4DB", "#FFD166", "#06D6A0"],
  ["#FFD6A5", "#E63946", "#457B9D"],
  ["#A0E7E5", "#FF5D8F", "#FFC300"],
];
const NAMES = ["Raka", "Sari", "Aiko", "Bima", "Laila", "Tomás", "Kirana", "Yusuf", "Mei", "Dimas", "Olu", "Nadia", "Arif", "Luna"];

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Colourful kid-style illustration in the spirit of the reference wall. */
export function artPoster(seed: number, w = 480, h = 640, fonts?: Fonts) {
  const { c, ctx } = canvas(w, h);
  const r = rng(seed * 9301 + 49297);
  const [bg, a, b] = PALETTES[seed % PALETTES.length];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = C.ink;
  const u = w / 480;

  // backdrop pattern
  const pattern = seed % 3;
  if (pattern === 0) {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.95, (0.95 - i * 0.12) * w, Math.PI, 0);
      ctx.lineWidth = 26 * u;
      ctx.strokeStyle = [a, b, "#ffffff", a, b, "#ffffff"][i];
      ctx.globalAlpha = 0.55;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 1) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let y = 18 * u; y < h; y += 36 * u) for (let x = 18 * u; x < w; x += 36 * u) ctx.fillRect(x, y, 6 * u, 6 * u);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.45);
      const a0 = (i / 12) * Math.PI * 2;
      ctx.arc(w / 2, h * 0.45, w * 1.2, a0, a0 + 0.22);
      ctx.fill();
    }
  }

  // confetti
  for (let i = 0; i < 14; i++) {
    const x = r() * w;
    const y = r() * h;
    ctx.fillStyle = [a, b, "#ffffff", C.ink][i % 4];
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3 * u;
    if (i % 3 === 0) {
      star(ctx, x, y, (10 + r() * 14) * u);
      ctx.fill();
      ctx.stroke();
    } else if (i % 3 === 1) {
      ctx.beginPath();
      ctx.arc(x, y, (5 + r() * 8) * u, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 14 * u, y);
      for (let k = 0; k < 4; k++) ctx.lineTo(x - 14 * u + (k + 1) * 7 * u, y + (k % 2 ? -7 : 7) * u);
      ctx.strokeStyle = [a, b][i % 2];
      ctx.lineWidth = 5 * u;
      ctx.stroke();
    }
  }

  // character
  const cx = w / 2 + (r() - 0.5) * 40 * u;
  const cy = h * 0.55;
  const s = Math.min(w, h) * (0.28 + r() * 0.06);
  ctx.lineWidth = 7 * u;
  ctx.strokeStyle = C.ink;
  const kind = seed % 4;
  ctx.fillStyle = a;
  if (kind === 0) {
    // blob monster
    ctx.beginPath();
    ctx.ellipse(cx, cy, s, s * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const dx of [-0.6, -0.2, 0.2, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * s, cy - s);
      ctx.lineTo(cx + dx * s + 8 * u, cy - s * 1.35);
      ctx.stroke();
    }
  } else if (kind === 1) {
    // robot
    roundRect(ctx, cx - s, cy - s * 0.9, s * 2, s * 1.8, 26 * u);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.9);
    ctx.lineTo(cx, cy - s * 1.3);
    ctx.stroke();
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 1.38, 14 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 2) {
    // cat
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.75, cy - s * 1.25);
    ctx.lineTo(cx - s * 0.25, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.75, cy - s * 1.25);
    ctx.lineTo(cx + s, cy - s * 0.2);
    ctx.quadraticCurveTo(cx + s * 1.05, cy + s, cx, cy + s);
    ctx.quadraticCurveTo(cx - s * 1.05, cy + s, cx - s, cy - s * 0.2);
    ctx.fill();
    ctx.stroke();
  } else {
    // flower
    ctx.fillStyle = b;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(ang) * s * 0.8, cy + Math.sin(ang) * s * 0.8, s * 0.45, s * 0.3, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // face
  const ey = cy - s * 0.15;
  for (const dx of [-0.35, 0.35]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx + dx * s, ey, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(cx + dx * s + 4 * u, ey + 3 * u, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#FF8FB1";
  for (const dx of [-0.6, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, cy + s * 0.18, s * 0.13, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.12, s * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  if (fonts) {
    ctx.fillStyle = C.ink;
    ctx.font = `700 ${40 * u}px ${fonts.hand}`;
    ctx.textAlign = "right";
    ctx.fillText(NAMES[seed % NAMES.length], w - 22 * u, h - 24 * u);
  }
  return c;
}

/** Art for a slot: a live wall artwork if available, otherwise a placeholder. */
export async function artCanvas(i: number, src: string | undefined, w: number, h: number, fonts: Fonts) {
  if (src) {
    const img = await loadImage(src);
    if (img) {
      const { c, ctx } = canvas(w, h);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      cover(ctx, img, 0, 0, w, h);
      return c;
    }
  }
  return artPoster(i + 1, w, h, fonts);
}

// ─── ApeosPrint C5570 (left TV slideshow) ─────────────────────────

/** FUJIFILM ApeosPrint C5570 (A3 colour printer), figures from fujifilm.com. */
export const PRINTER = {
  name: "ApeosPrint C5570",
  tag: "Unit interaksi utama",
  img: "/booth/c5570.webp",
  specs: [
    ["55 ppm", "Warna & hitam-putih · A4"],
    ["1.200 × 2.400", "dpi · resolusi cetak"],
    ["≤ 5 detik", "Cetak pertama (warna)"],
    ["52–300 gsm", "Media · kertas panjang 320 × 1.200 mm"],
  ],
  capacity: "6.140",
} as const;

/** Four 1920×1080 slides for the 55" product TV above the printer. */
export async function productSlides(fonts: Fonts) {
  const img = await loadImage(PRINTER.img);
  const out: HTMLCanvasElement[] = [];

  // 1 · hero
  {
    const { c, ctx } = canvas(1920, 1080);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = C.ink;
    ctx.font = `700 34px ${fonts.sans}`;
    ctx.fillText("ASTRAGRAPHIA × FUJIFILM", 110, 140);
    ctx.fillRect(110, 168, 760, 6);
    ctx.font = `700 150px ${fonts.sans}`;
    ctx.fillText("ApeosPrint", 100, 470);
    ctx.fillText("C5570", 100, 630);
    ctx.fillStyle = C.plum;
    ctx.font = `400 46px ${fonts.sans}`;
    ctx.fillText(PRINTER.tag, 110, 730);
    ctx.fillStyle = C.grey;
    ctx.fillRect(1080, 110, 720, 860);
    if (img) contain(ctx, img, 1120, 150, 640, 780);
    out.push(c);
  }
  // 2 · numbers
  {
    const { c, ctx } = canvas(1920, 1080);
    ctx.fillStyle = C.plum;
    ctx.fillRect(0, 0, 1920, 1080);
    const cells = PRINTER.specs;
    cells.forEach(([v, l], i) => {
      const x = 110 + (i % 2) * 860;
      const y = 150 + Math.floor(i / 2) * 430;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, y, 760, 4);
      ctx.fillStyle = "#fff";
      ctx.font = `700 36px ${fonts.sans}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), x, y + 60);
      ctx.font = `700 ${v.length > 10 ? 120 : 150}px ${fonts.sans}`;
      ctx.fillText(v, x, y + 230);
      ctx.font = `400 40px ${fonts.sans}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(l, x, y + 300);
    });
    out.push(c);
  }
  // 3 · capacity
  {
    const { c, ctx } = canvas(1920, 1080);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = C.gold;
    ctx.font = `700 260px ${fonts.sans}`;
    ctx.fillText(PRINTER.capacity, 100, 420);
    ctx.fillStyle = "#fff";
    ctx.font = `700 92px ${fonts.sans}`;
    ["lembar kapasitas maks.", "55 ppm warna & mono", "kertas 52–300 gsm"].forEach((t, i) => ctx.fillText(t, 110, 600 + i * 120));
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `400 38px ${fonts.sans}`;
    ctx.fillText("ApeosPrint C5570 · siap untuk volume tinggi", 110, 990);
    out.push(c);
  }
  // 4 · call to action
  {
    const { c, ctx } = canvas(1920, 1080);
    const g = ctx.createLinearGradient(0, 0, 1920, 1080);
    g.addColorStop(0, "#b0237c");
    g.addColorStop(1, "#4d0f45");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = "#fff";
    ctx.font = `700 170px ${fonts.sans}`;
    ctx.fillText("Cetak", 100, 380);
    ctx.fillText("karyamu.", 100, 560);
    ctx.font = `400 50px ${fonts.sans}`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Poster A4 dengan QR — langsung dari ApeosPrint C5570", 110, 680);
    ctx.fillStyle = C.gold;
    ctx.font = `700 120px ${fonts.hand}`;
    ctx.fillText("print your mark", 110, 900);
    ctx.fillStyle = "#fff";
    ctx.font = `700 220px ${fonts.sans}`;
    ctx.fillText("↓", 1640, 960);
    out.push(c);
  }
  return out;
}

// ─── Screens ───────────────────────────────────────────────────────

export function tvScreen(fonts: Fonts, arts: HTMLCanvasElement[], wordmark: HTMLImageElement | null, mark: HTMLImageElement | null) {
  const { c, ctx } = canvas(1920, 1080);
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, "#3a1670");
  g.addColorStop(1, "#160f36");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
  const rg = ctx.createRadialGradient(200, 0, 50, 200, 0, 900);
  rg.addColorStop(0, "rgba(196,25,127,0.55)");
  rg.addColorStop(1, "rgba(196,25,127,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 1920, 1080);
  if (wordmark) ctx.drawImage(wordmark, 60, 44, 240, 60);
  if (mark) ctx.drawImage(mark, 320, 46, 62, 56);
  ctx.fillStyle = "#fff";
  ctx.font = `700 96px ${fonts.sans}`;
  ctx.fillText("print", 60, 210);
  const yourX = 60 + ctx.measureText("print").width + 26;
  ctx.font = `700 110px ${fonts.hand}`;
  const markX = yourX + ctx.measureText("your").width + 22;
  ctx.font = `700 96px ${fonts.sans}`;
  ctx.fillText("mark", markX, 210);
  // "your" last: it sits in front of print / mark.
  ctx.fillStyle = C.gold;
  ctx.font = `700 110px ${fonts.hand}`;
  ctx.fillText("your", yourX, 205);
  ctx.textAlign = "right";
  ctx.fillStyle = C.gold;
  ctx.font = `700 150px ${fonts.sans}`;
  ctx.fillText(String(Math.max(arts.length * 9, 128)), 1860, 170);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 26px ${fonts.sans}`;
  ctx.fillText("KARYA · ARTWORKS", 1860, 215);
  ctx.textAlign = "left";
  const card = 230;
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 9; k++) {
      const x = -60 + k * 250 + (row % 2) * 110;
      const y = 280 + row * 262;
      const art = arts[(row * 9 + k) % arts.length];
      ctx.save();
      ctx.translate(x + card / 2, y + 125);
      ctx.rotate((((row * 9 + k) * 47) % 9) / 300 - 0.015);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 18;
      ctx.fillRect(-card / 2, -125, card, 250);
      ctx.shadowBlur = 0;
      if (art) cover(ctx, art, -card / 2 + 10, -115, card - 20, card - 20);
      ctx.fillStyle = C.plum;
      ctx.font = `700 18px ${fonts.sans}`;
      ctx.fillText(`#${String(row * 9 + k + 1).padStart(3, "0")}`, -card / 2 + 12, 112);
      ctx.restore();
    }
  }
  return c;
}

export function tabletScreen(fonts: Fonts, wordmark: HTMLImageElement | null) {
  const { c, ctx } = canvas(800, 1280);
  const g = ctx.createLinearGradient(0, 0, 0, 1280);
  g.addColorStop(0, "#b0237c");
  g.addColorStop(0.35, "#5c1046");
  g.addColorStop(1, "#170f38");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 1280);
  if (wordmark) ctx.drawImage(wordmark, 44, 44, 190, 48);
  ctx.fillStyle = "#fff";
  ctx.font = `700 200px ${fonts.sans}`;
  ctx.fillText("print", 36, 480);
  ctx.fillText("mark", 36, 800);
  // "your" last: it sits in front of print / mark.
  ctx.fillStyle = C.gold;
  ctx.font = `700 170px ${fonts.hand}`;
  ctx.fillText("your", 90, 620);
  ctx.font = `400 30px ${fonts.sans}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Tulis namamu, gambar apa saja,", 44, 900);
  ctx.fillText("lalu saksikan AI melukisnya ulang.", 44, 942);
  ctx.fillStyle = "#fff";
  roundRect(ctx, 44, 1010, 380, 90, 45);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = `700 32px ${fonts.sans}`;
  ctx.fillText("Ketuk untuk mulai  →", 80, 1066);
  return c;
}

export function printerPanel() {
  const { c, ctx } = canvas(512, 320);
  const g = ctx.createLinearGradient(0, 0, 512, 320);
  g.addColorStop(0, "#1d3f8f");
  g.addColorStop(1, "#4b2a8a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 6; i++) {
    roundRect(ctx, 28 + (i % 3) * 160, 70 + Math.floor(i / 3) * 120, 136, 96, 14);
    ctx.fill();
  }
  return c;
}

// ─── Display rack poster (A2) ─────────────────────────────────────

export function rackPoster(fonts: Fonts, wordmark: HTMLImageElement | null, mark: HTMLImageElement | null) {
  const W = 840;
  const H = 1188;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, "#b0237c");
  g.addColorStop(1, "#4d0f45");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 420);
  ctx.fillStyle = "#fff";
  ctx.font = `700 120px ${fonts.sans}`;
  ctx.fillText("print", 56, 170);
  const yourX = 56 + ctx.measureText("print").width + 24;
  ctx.fillText("mark", 56, 290);
  // "your" last: it sits in front of print / mark.
  ctx.fillStyle = C.gold;
  ctx.font = `700 110px ${fonts.hand}`;
  ctx.fillText("your", yourX, 165);
  ctx.fillStyle = "#fff";
  ctx.font = `700 30px ${fonts.sans}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("CARA IKUT · HOW TO JOIN", 56, 370);

  const steps = [
    ["Tulis nama & email", "di tablet"],
    ["Gambar apa saja", "pakai S Pen"],
    ["AI melukis ulang", "dalam 10–30 detik"],
    ["Karyamu tampil", "di layar — cari nomornya"],
    ["Ambil cetakan A4", "& scan QR-nya"],
  ];
  steps.forEach(([t, s], i) => {
    const y = 480 + i * 128;
    ctx.fillStyle = C.plum;
    ctx.beginPath();
    ctx.arc(96, y + 20, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 40px ${fonts.sans}`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), 96, y + 34);
    ctx.textAlign = "left";
    ctx.fillStyle = C.ink;
    ctx.font = `700 42px ${fonts.sans}`;
    ctx.fillText(t, 164, y + 18);
    ctx.fillStyle = "#6b5562";
    ctx.font = `400 30px ${fonts.sans}`;
    ctx.fillText(s, 164, y + 58);
  });
  ctx.fillStyle = C.grey;
  ctx.fillRect(0, H - 120, W, 120);
  if (wordmark) ctx.drawImage(wordmark, 56, H - 88, 220, 55);
  if (mark) ctx.drawImage(mark, W - 120, H - 92, 62, 56);
  ctx.fillStyle = "#5a4a55";
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillText("WCCE 2026 · 21–25 Okt", 320, H - 52);
  return c;
}

// ─── Shelf display: QuickLabel QL-E100 + batik packaging ─────────

export type BatikScheme = "green" | "brown" | "violet";

const BATIK: Record<BatikScheme, { base: string; field: string; line: string; motif: string; dot: string }> = {
  green: { base: "#0F3B2A", field: "#151515", line: "#3FB06A", motif: "#E2C15A", dot: "#9BE3A8" },
  brown: { base: "#2A1A12", field: "#5A3A22", line: "#C99A5B", motif: "#F0D9A8", dot: "#E7C48A" },
  violet: { base: "#2B2238", field: "#1E5A5A", line: "#57C2B4", motif: "#E6B44C", dot: "#A6E3DA" },
};

/** Batik-inspired print: dark field, flowing blobs, dotted outlines, gold flowers. */
export function batik(seed: number, w = 512, h = 512, scheme: BatikScheme = "green") {
  const { c, ctx } = canvas(w, h);
  const p = BATIK[scheme];
  const r = rng(seed * 7919 + 13);
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, w, h);
  // fine background texture
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 6; y < h; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < w; x += 12) ctx.fillRect(x, y, 2, 2);
  // flowing fields with dotted outlines
  for (let i = 0; i < 3; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const rad = (0.25 + r() * 0.25) * Math.max(w, h);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad, rad * (0.5 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = p.field;
    ctx.fill();
    ctx.lineWidth = Math.max(2, w / 120);
    ctx.strokeStyle = p.line;
    ctx.stroke();
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = Math.max(2, w / 160);
    ctx.strokeStyle = p.dot;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad * 0.93, rad * (0.5 + r() * 0.4) * 0.9, r() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // gold flowers + tendrils
  const flowers = 2 + Math.floor(r() * 3);
  for (let i = 0; i < flowers; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = (0.08 + r() * 0.1) * Math.min(w, h);
    ctx.strokeStyle = p.motif;
    ctx.lineWidth = Math.max(1.5, s / 18);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r() * 0.2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.55, s * 0.28, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.motif;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3);
      ctx.lineTo(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.bezierCurveTo(x + s * 2, y - s, x + s * 2.4, y + s, x + s * 3, y + s * 0.4);
    ctx.stroke();
  }
  return c;
}

/** Inside of the gift-box lid: batik with an emblem and a thank-you line. */
export function lidPrint(fonts: Fonts) {
  const c = batik(3, 840, 450, "green");
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(15,59,42,0.88)";
  ctx.fillRect(170, 60, 500, 330);
  ctx.strokeStyle = "#E2C15A";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(420, 150, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#E2C15A";
  ctx.textAlign = "center";
  ctx.font = `700 30px ${fonts.sans}`;
  ctx.fillText("KEMASAN · PACKAGING", 420, 268);
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillStyle = "#d9efe0";
  ctx.fillText("Dicetak di Apeos · Astragraphia", 420, 312);
  ctx.fillText("Terima kasih · Thank you", 420, 346);
  return c;
}

export function qlScreen(fonts: Fonts) {
  const { c, ctx } = canvas(640, 400);
  ctx.fillStyle = "#f3f2f5";
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#e7e3ec";
  for (let i = 0; i < 9; i++) {
    roundRect(ctx, 400 + (i % 3) * 76, 40 + Math.floor(i / 3) * 76, 62, 62, 10);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(40, 40, 330, 300);
  ctx.fillStyle = C.plum;
  ctx.fillRect(60, 70, 290, 90);
  ctx.fillStyle = "#fff";
  ctx.font = `700 34px ${fonts.sans}`;
  ctx.fillText("print your mark", 76, 128);
  ctx.fillStyle = C.ink;
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillText("Label · WCCE 2026", 70, 210);
  ctx.fillStyle = "#6a1b7a";
  roundRect(ctx, 470, 300, 110, 56, 10);
  ctx.fill();
  return c;
}

/** Label strip coming out of the QL-E100. */
export function labelStrip(fonts: Fonts) {
  const { c, ctx } = canvas(256, 320);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 2; i++) {
    const y = 12 + i * 154;
    ctx.fillStyle = C.plum;
    roundRect(ctx, 14, y, 228, 140, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 36px ${fonts.sans}`;
    ctx.fillText("print", 34, y + 56);
    ctx.fillStyle = C.gold;
    ctx.font = `700 34px ${fonts.hand}`;
    ctx.fillText("your mark", 34, y + 98);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `400 14px ${fonts.sans}`;
    ctx.fillText("WCCE 2026", 34, y + 124);
  }
  return c;
}

export function qlLogo(fonts: Fonts) {
  const { c, ctx } = canvas(400, 80);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 400, 80);
  ctx.fillStyle = "#5b2a86";
  ctx.font = `700 40px ${fonts.sans}`;
  ctx.textBaseline = "middle";
  ctx.fillText("QuickLabel", 70, 42);
  ctx.beginPath();
  ctx.arc(36, 40, 24, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function fujifilmLabel(fonts: Fonts) {
  const { c, ctx } = canvas(256, 48);
  ctx.fillStyle = "#e9e9e7";
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = "#222";
  ctx.font = `700 28px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FUJIFILM", 128, 25);
  return c;
}
