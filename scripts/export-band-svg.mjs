// Exports the backdrop's bottom ribbon band as a print-ready SVG at real size
// (4000 × 1000 mm, 1 user unit = 1 mm, transparent background).
//   node scripts/export-band-svg.mjs [out.svg]
// Geometry and colours come from the same module as the 3D mockup.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BAND_COLORS, BAND_MM, ribbonSlats } from "../src/components/booth/ribbonGeometry.ts";

const out = resolve(process.argv[2] ?? "design/booth-band-4000x1000mm.svg");
const { w: W, h: H } = BAND_MM;
const { lit, fold } = ribbonSlats(W, H);
const d = (polys) => polys.map((p) => "M" + p.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join("L") + "Z").join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Astragraphia × WCCE 2026 booth · bottom band 4000 × 1000 mm · transparent background -->
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <title>Booth band 4000 × 1000 mm</title>
  <defs>
    <linearGradient id="plum-magenta" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">
${BAND_COLORS.stops.map(([at, c]) => `      <stop offset="${at}" stop-color="${c}"/>`).join("\n")}
    </linearGradient>
    <clipPath id="artboard"><rect width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#artboard)">
    <path id="slats" fill="url(#plum-magenta)" d="${d(lit)}"/>
    <path id="folds" fill="${BAND_COLORS.fold}" d="${d(fold)}"/>
  </g>
</svg>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`${out} · ${lit.length} slats · ${(svg.length / 1024).toFixed(0)} KB`);
