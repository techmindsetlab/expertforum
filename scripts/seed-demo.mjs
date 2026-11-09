// Seeds demo artworks through the real kiosk API (create → generate → submit).
//   node scripts/seed-demo.mjs [baseUrl] [count] [kioskKey]
// Use against local dev / a Neon dev branch — not production.
import sharp from "sharp";

const [, , base = "http://localhost:3000", countArg = "6", key = ""] = process.argv;
const NAMES = ["Inkwynk", "Raka", "Sari Dewi", "Tomás", "Aiko", "Bima", "Laila", "Yusuf", "Mei Lin", "Kirana", "Dimas", "Olu"];
const COLORS = ["#1B1220", "#941F62", "#E5332A", "#F2B81E", "#2BA36B", "#2F6FE4", "#E85FA8"];
const rnd = (a, b) => a + Math.random() * (b - a);

function doodle() {
  const strokes = [];
  const shapes = Math.floor(rnd(3, 6));
  for (let s = 0; s < shapes; s++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const cx = rnd(0.25, 0.75), cy = rnd(0.25, 0.75), r = rnd(0.08, 0.22);
    const kind = Math.random();
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let x, y;
      if (kind < 0.4) { x = cx + Math.cos(t * Math.PI * 2) * r; y = cy + Math.sin(t * Math.PI * 2) * r * rnd(0.8, 1); }
      else if (kind < 0.7) { x = cx - r + t * 2 * r; y = cy + Math.sin(t * Math.PI * 4) * r * 0.4; }
      else { x = cx + (t < 0.5 ? -r + t * 4 * r : r - (t - 0.5) * 4 * r); y = cy + (t < 0.5 ? r - t * 4 * r : -r + (t - 0.5) * 4 * r) * 0.6; }
      pts.push([+x.toFixed(4), +y.toFixed(4), 0.5, Math.round(t * 700 + s * 900)]);
    }
    strokes.push({ color, size: [0.008, 0.016, 0.032][Math.floor(rnd(0, 3))], pen: false, points: pts });
  }
  return { v: 1, strokes };
}

async function render(drawing) {
  const paths = drawing.strokes
    .map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="${s.size * 1024}" stroke-linecap="round" stroke-linejoin="round" points="${s.points.map(([x, y]) => `${x * 1024},${y * 1024}`).join(" ")}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#fff"/>${paths}</svg>`;
  return "data:image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

const h = { "content-type": "application/json", ...(key ? { "x-kiosk-key": key } : {}) };
for (let i = 0; i < Number(countArg); i++) {
  const drawing = doodle();
  const name = NAMES[i % NAMES.length];
  const c = await fetch(`${base}/api/artworks`, { method: "POST", headers: h, body: JSON.stringify({ name, email: `demo${i}@example.com`, sketch: await render(drawing), strokes: drawing }) }).then((r) => r.json());
  const g = await fetch(`${base}/api/artworks/${c.id}/generate`, { method: "POST", headers: h }).then((r) => r.json());
  const s = await fetch(`${base}/api/artworks/${c.id}/submit`, { method: "POST", headers: h, body: JSON.stringify({ generationId: g.id }) }).then((r) => r.json());
  console.log(`#${s.number} ${name} (${g.status})`);
}
