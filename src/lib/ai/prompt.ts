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
  // WPAP (Wedha's Pop Art Portrait), the Indonesian geometric pop-art style:
  // straight-edged flat facets, neon palette, navy shadow facets, colour-block
  // background with small sparkles — blue, yellow or magenta at random so the
  // wall does not fill up with one colour.
  wpap: {
    becomes: "a finished WPAP-style geometric pop-art illustration (Wedha's Pop Art Portrait)",
    style: `WPAP — Wedha's Pop Art Portrait, the Indonesian geometric pop-art style.
- Every form is built from flat, sharp-edged polygon facets bounded by straight lines only, like stained glass cut with a ruler: no curves, no soft edges, no gradients inside a facet.
- Light and shadow are expressed by switching facet colours, never by shading: bright facets toward the light, deep navy and indigo facets for shadows and contours.
- Bold, saturated neon palette: hot magenta, fuchsia, electric cyan, turquoise, lime green, lemon yellow, tangerine orange and violet. The visitor's own colours stay the dominant hue family of each element they coloured.
- Inside each element the colour is split across several neighbouring neon shades from facet to facet (e.g. yellow → lemon, tangerine and lime with a magenta accent), giving the rainbow-faceted WPAP look.
- Background of {variant}.
- The subject must stand out from the background: where an element shares the background hue, edge it with deep navy facets and shift its facets to contrasting neon shades.
- High-contrast, energetic, celebratory poster art.`,
    negative: `photorealism, photograph, soft shading, airbrush, smooth gradients, watercolor, pencil or ink sketch, painterly brush strokes, blurry edges, 3D render, CGI, anime or manga characters, existing cartoon characters or celebrities, muted or pastel colours, plain white background, frame, border, text, letters, words, numbers, signature, watermark, logo, extra people or objects that are not in the doodle, changed composition, cropped subject, distorted anatomy, extra limbs or fingers, violence, gore, nudity, offensive or political symbols`,
    compact: `Style: WPAP (Wedha's Pop Art Portrait), Indonesian geometric pop art. Every form made of flat, sharp-edged polygon facets with straight lines only; light and shadow shown by switching facet colours (deep navy facets for shadows), never by shading; saturated neon palette of magenta, cyan, turquoise, lime, yellow, orange and violet while keeping the visitor's colours dominant; split each colour across several neighbouring neon shades from facet to facet; background of {variant}; subject always stands out from it (navy edge facets, contrasting shades); high-contrast poster art.
Avoid photorealism, soft shading, gradients, watercolor, sketchy lines, 3D render, anime or existing characters, pastel colours, plain white background, extra people or objects, cropped subject, distorted anatomy, violence, nudity.`,
    output: "A single square 1:1 illustration, full bleed, with a geometric colour-block background.",
    variants: [
      {
        full: "large flat geometric colour blocks in teal, cyan and deep navy, with a few small white four-point sparkle stars",
        compact: "flat teal, cyan and navy colour blocks with a few small white sparkle stars",
      },
      {
        full: "large flat geometric colour blocks in lemon yellow, golden amber and tangerine orange, with a few deep navy and plum facets at the edges and a few small white four-point sparkle stars",
        compact: "flat lemon-yellow, amber and tangerine colour blocks with a few navy and plum edge facets and small white sparkle stars",
      },
      {
        full: "large flat geometric colour blocks in hot magenta, fuchsia and deep plum-violet, with a few small white four-point sparkle stars",
        compact: "flat hot-magenta, fuchsia and deep plum colour blocks with a few small white sparkle stars",
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
  return `You are the resident illustrator of a live art wall at WCCE 2026, the World Conference on Creative Economy (theme: "Inclusively Creative"), presented by Astragraphia.

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
  return `Redraw the attached tablet doodle as ${p.becomes} for the WCCE 2026 live art wall by Astragraphia.
Fidelity first: keep every subject the visitor drew at the same position, size and orientation; keep the composition exactly as drawn. Read rough shapes kindly (circle with dots = face, zig-zags = hair or grass, wavy lines = water or wind). Keep the visitor's colors dominant. Do not add new main subjects.
${withVariant(p.compact, p, "compact", variant)}
Square 1:1. No text, letters, signature, watermark, logo or frame.`;
}
