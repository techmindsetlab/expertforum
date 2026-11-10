/**
 * Prompts for the image models, one entry per kiosk style (lib/styles.ts).
 *
 * The task + fidelity rules are shared: the participant's sketch is the
 * composition authority — fidelity first, beauty second. Each style adds its
 * own STYLE section and AVOID list. Models without a negative-prompt field get
 * the AVOID list as an explicit section; `compact` is a < 2048-char form for
 * models with a prompt limit (e.g. Ideogram). A style may offer several
 * variants (colour story / background); one is picked at random per prompt
 * and fills {variant}.
 */
import { DEFAULT_STYLE, type StyleId } from "../styles";

type StylePrompt = {
  /** One line for the compact prompt: what the doodle becomes. */
  becomes: string;
  style: string;
  negative: string;
  compact: string;
  /** Background / output line. */
  output: string;
  /** Random options for {variant} in `style` / `compact`. */
  variants?: { full: string; compact: string }[];
};

export const STYLES: Record<StyleId, StylePrompt> = {
  // "Digital Art" on the kiosk (id stays "fashion" so older kiosk builds keep
  // working): an expressive fashion-week style painting — big juicy gouache and
  // watercolor brush strokes, crisp black brush accents, splatters, white paper.
  // The colour story is picked at random per generation.
  fashion: {
    becomes: "a finished, gallery-quality digital art illustration in the expressive style of a contemporary fashion-week illustration",
    style: `Expressive digital art illustration that looks hand-painted with gouache, watercolor and brush pen.
- Big, juicy, confident brush strokes of vivid, saturated, mostly opaque gouache laid fast in broad sweeps — strong colour at full intensity, never pastel or faded; visible bristle streaks and dry-brush edges, paint that overshoots or stops short of the outlines, some areas left as bare white paper.
- Thin doodle lines become thick, expressive painted strokes; every coloured shape gets layered, overlapping strokes of several related colours, with patterns as quick graphic dashes, stripes and dots.
- Crisp black brush-pen accents for the darkest details (hair, shadows, stripes, outlines), with lively, varied line weight.
- Colour story: {variant}. The visitor's own colours stay the dominant hue of each element they coloured; the colour story fills the rest.
- White paper background with one or two big, bold, saturated paint strokes sweeping behind and around the subject (as strong as the subject itself, not a pale wash), plus a few paint splatters and drips.
- Bold, energetic, trendy and joyful — like a live fashion-week illustration made by a top editorial illustrator.`,
    negative: `photorealism, photograph, 3D render, CGI, glossy or plastic digital painting, airbrush gradients, anime, cel-shaded cartoon, flat vector art, clip art, pixel art, neon glow, dark or busy background, pastel, faded or washed-out colours, timid thin lines, frame, border, text, letters, words, numbers, captions, signature, watermark, logo, extra people or objects that are not in the doodle, changed composition, cropped subject, distorted anatomy, extra limbs or fingers, blurry or muddy colors, low detail, violence, gore, nudity, offensive or political symbols`,
    compact: `Style: expressive digital art that looks hand-painted — big juicy strokes of vivid, saturated, opaque gouache in broad fast sweeps with bristle streaks, never pastel; thin lines become thick painted strokes; layered overlapping strokes in each coloured shape, patterns as quick dashes and stripes; crisp black brush-pen accents; colour story: {variant}, while keeping the visitor's colours dominant; white paper with one or two big bold saturated strokes sweeping behind the subject and a few splatters; bold, energetic fashion-week illustration.
Avoid photorealism, 3D render, anime, flat vector or clip art, neon, pastel or washed-out colours, dark or busy backgrounds, extra people or objects, cropped subject, distorted anatomy, violence, nudity.`,
    output: "A single square 1:1 illustration on full-bleed white paper.",
    variants: [
      {
        full: "deep ultraviolet purple and violet strokes with hot pink and signal red accents, a bold turquoise stroke and black ink details",
        compact: "deep ultraviolet purple and violet with hot pink, signal red, a bold turquoise stroke and black",
      },
      {
        full: "cobalt and ultramarine blue strokes with coral red and tangerine accents, a bold hot-pink stroke and black ink details",
        compact: "cobalt and ultramarine blue with coral red, tangerine, a bold hot-pink stroke and black",
      },
      {
        full: "magenta and fuchsia strokes with lemon yellow and orange accents, a bold emerald stroke and black ink details",
        compact: "magenta and fuchsia with lemon yellow, orange, a bold emerald stroke and black",
      },
      {
        full: "emerald and teal strokes with scarlet and hot pink accents, a bold violet stroke and black ink details",
        compact: "emerald and teal with scarlet, hot pink, a bold violet stroke and black",
      },
    ],
  },
  // "3D Partikel" on the kiosk (id stays "wpap" so kiosk builds still loaded
  // on a tablet keep working; it replaced WPAP on 2026-11-11): the doodle
  // rebuilt as a clean 3D studio render made of thousands of tiny beads or
  // cubes that break away into floating particles, after the client's four
  // references. Each variant is one reference: material + backdrop.
  wpap: {
    becomes: "a finished, gallery-quality 3D render in which every element is built from thousands of tiny spheres or cubes that partly break apart into floating particles",
    style: `Contemporary 3D particle art — a clean, photoreal CGI studio render (Cinema 4D / Octane / Houdini look).
- Every element of the doodle becomes a solid 3D object built from thousands of tiny identical units, packed in neat rows and grids on its faces: {variant}
- Parts of each object are breaking apart: along some edges the units come loose and drift away as floating particles, with a light trail of scattered units falling below and around it, as if the object is dissolving or assembling. Each subject stays clearly readable, at least three quarters intact.
- Thin doodle lines become chunky 3D bars or tubes of units with real thickness; filled shapes become blocks, slabs or rounded volumes.
- The visitor's own colours are the colour of the units of each element they coloured (one hue per element, with natural light-and-shadow shades); uncoloured lines take the variant's material colour.
- Soft studio lighting from above, gentle contact shadows and ambient occlusion between the units, a little depth of field on the particles nearest and farthest from the camera, crisp detail.
- The subject always contrasts with the backdrop: where an element shares the backdrop's hue, use a lighter or deeper shade of it.
- Minimal, premium and playful contemporary 3D art direction.`,
    negative: `flat 2D illustration, drawing, sketch or ink lines, outlines, watercolor, gouache, painterly brush strokes, cartoon, anime, vector art, clip art, flat pixel art, WPAP, stained glass, neon glow, subject completely exploded or unreadable, cluttered or busy background, room interior, landscape, frame, border, text, letters, words, numbers, signature, watermark, logo, extra people or objects that are not in the doodle, changed composition, cropped subject, distorted anatomy, extra limbs or fingers, violence, gore, nudity, offensive or political symbols`,
    compact: `Style: contemporary 3D particle art, a clean photoreal CGI studio render. Every element becomes a solid 3D object built from thousands of tiny identical units packed in neat rows: {variant}. Some edges break apart into floating, falling particles, but each subject stays clearly readable. Doodle lines become chunky 3D bars of units; the visitor's colours are the colour of each element's units. Soft studio light, contact shadows, slight depth of field, crisp detail; the subject contrasts with the backdrop; minimal, premium, playful.
Avoid flat 2D drawing, outlines, painterly strokes, cartoon, anime, vector or pixel art, neon glow, an unreadable exploded subject, busy backgrounds, extra people or objects, cropped subject, distorted anatomy, violence, nudity.`,
    output: "A single square 1:1 3D render, full bleed, on a seamless studio backdrop.",
    // Backdrops in Astragraphia colours, burgundy dominant (client brief):
    // burgundy #6C1D45, magenta #C6007E, orange #DE7C00 from the main gradient.
    variants: [
      {
        full: "small glossy beads, like magnetic ball toys, on a smooth seamless studio backdrop graded from deep burgundy (#6C1D45) at the bottom to Astragraphia magenta (#C6007E) at the top.",
        compact: "small glossy beads on a seamless deep-burgundy to magenta gradient backdrop",
      },
      {
        full: "small matte spheres, densely packed like a particle simulation, on a flat deep burgundy (#6C1D45) seamless studio backdrop with a warm orange (#DE7C00) glow behind the subject.",
        compact: "small matte spheres, densely packed, on a flat deep-burgundy backdrop with a warm orange glow behind the subject",
      },
      {
        full: "tiny soft-edged cubes, like a voxel mosaic skin, on a dark wine-burgundy seamless studio backdrop with a soft overhead spotlight and a faint magenta (#C6007E) rim light.",
        compact: "tiny soft-edged cubes like a voxel mosaic, on a dark wine-burgundy backdrop with a soft spotlight and a faint magenta rim light",
      },
      {
        full: "small faceted low-poly blocks, on a burgundy (#6C1D45) seamless studio floor and wall with a few small magenta, orange and soft-grey low-poly solids and glossy spheres resting around the subject.",
        compact: "small faceted low-poly blocks, on a burgundy floor and wall with a few magenta, orange and soft-grey low-poly solids and glossy spheres around",
      },
    ],
  },
};

/** Picks one of the style's variants at random (index fixed for tests). */
function withVariant(text: string, p: StylePrompt, key: "full" | "compact", pick?: number) {
  if (!p.variants?.length) return text;
  const v = p.variants[pick ?? Math.floor(Math.random() * p.variants.length)];
  return text.replace("{variant}", v[key]);
}

export function buildPrompt(style: StyleId = DEFAULT_STYLE, variant?: number) {
  const p = STYLES[style];
  return `You are the resident illustrator of a live art wall at Astra Expert Forum 2026 (theme: "15 Years of Astra Expert"), presented by Astragraphia and AGIT.

TASK
The attached image is a quick doodle a visitor drew on a tablet in under a minute. Redraw it as ${p.becomes}.

FIDELITY — most important
- Keep every subject the visitor drew, at the same position, size and orientation; keep the overall composition exactly as drawn. Do not move, crop, mirror, merge or remove elements.
- Interpret rough shapes generously and kindly: a circle with dots is a face, zig-zags can be hair, grass or energy, wavy lines can be water or wind. Turn each scribble into the most plausible, charming version of what the visitor meant.
- Keep the visitor's chosen colors as the dominant hue of each element they colored.
- Do not invent new main subjects. Small supporting touches (shadows, texture, a few accent strokes, background details) are welcome.

STYLE
${withVariant(p.style, p, "full", variant)}

OUTPUT
${p.output} No text of any kind — the visitor's name is added later by us.

AVOID
${p.negative}`;
}

/** Short form (< 2048 chars) for models with a prompt limit, e.g. Ideogram. */
export function buildCompactPrompt(style: StyleId = DEFAULT_STYLE, variant?: number) {
  const p = STYLES[style];
  return `Redraw the attached tablet doodle as ${p.becomes} for the Astra Expert Forum 2026 live art wall by Astragraphia & AGIT.
Fidelity first: keep every subject the visitor drew at the same position, size and orientation; keep the composition exactly as drawn. Read rough shapes kindly (circle with dots = face, zig-zags = hair or grass, wavy lines = water or wind). Keep the visitor's colors dominant. Do not add new main subjects.
${withVariant(p.compact, p, "compact", variant)}
Square 1:1. No text, letters, signature, watermark, logo or frame.`;
}
