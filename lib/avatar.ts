/**
 * Procedural "blobby Grok Bot" avatars.
 *
 * Inspired by the Grok Bot visual system (simple body shapes, expressive eyes, controlled
 * variation, small accessories). Everything is drawn from primitives in a 100×100 viewBox
 * using exactly two colors so it survives 1-bit thermal printing at ~90px.
 *
 * Deterministic: the same (botName, personName) always yields the same bot.
 */
import { avatarSeed, fnv1a, pick, rng } from "./hash";

export const SHAPES = [
  "blob",
  "pebble",
  "bean",
  "egg",
  "squircle",
  "tablet",
  "capsule",
  "cylinder",
  "hex",
  "gem",
  "crystal",
  "wedge",
  "shield",
  "dome",
  "arch",
  "cloud",
  "teardrop",
  "leaf",
] as const;
export type Shape = (typeof SHAPES)[number];

export const EYES = [
  "dots",
  "wide",
  "happy",
  "wink",
  "sleepy",
  "sparkle",
  "pixel",
  "focused",
  "curious",
  "visor",
] as const;
export type Eyes = (typeof EYES)[number];

export const MOUTHS = ["none", "none", "none", "smile", "o", "flat", "smirk"] as const;
export type Mouth = (typeof MOUTHS)[number];

export const TOPS = [
  "none",
  "none",
  "antenna",
  "twin-antenna",
  "headphones",
  "bow",
  "cap",
  "propeller",
  "halo",
  "ears",
  "crown",
  "sprout",
] as const;
export type Top = (typeof TOPS)[number];

export const FACES = ["none", "none", "none", "glasses", "monocle", "blush"] as const;
export type Face = (typeof FACES)[number];

export type Style = "solid" | "outline";

export interface AvatarSpec {
  seed: string;
  shape: Shape;
  style: Style;
  eyes: Eyes;
  mouth: Mouth;
  top: Top;
  face: Face;
  feet: boolean;
  look: { dx: number; dy: number };
  eyeSpread: number;
}

interface ShapeDef {
  /** Body path or element markup, drawn with fill/stroke supplied via `{FILL}`/`{STROKE}` tokens. */
  body: string;
  /** Extra detail strokes drawn in the "mark" color (e.g. cylinder rim). */
  detail?: string;
  top: number;
  bottom: number;
  eyeY: number;
  spread: number;
  mouthY?: number;
}

const SHAPE_DEFS: Record<Shape, ShapeDef> = {
  blob: {
    body: "M48 22 C70 18 90 32 88 54 C86 72 78 92 52 92 C28 92 10 80 12 58 C14 38 28 26 48 22 Z",
    top: 21,
    bottom: 92,
    eyeY: 55,
    spread: 15,
  },
  pebble: {
    body: "M50 30 C76 28 92 42 90 60 C88 78 70 90 50 90 C28 90 10 78 10 60 C10 42 26 32 50 30 Z",
    top: 29,
    bottom: 90,
    eyeY: 58,
    spread: 16,
  },
  bean: {
    body:
      "M42 24 C62 18 84 30 86 50 C88 66 78 72 76 82 C74 92 58 94 46 90 C34 86 28 78 20 72 C8 62 10 36 26 28 C32 25 36 26 42 24 Z",
    top: 21,
    bottom: 92,
    eyeY: 52,
    spread: 14,
  },
  egg: {
    body: "M50 22 C68 22 84 42 84 64 C84 82 68 92 50 92 C32 92 16 82 16 64 C16 42 32 22 50 22 Z",
    top: 22,
    bottom: 92,
    eyeY: 58,
    spread: 14,
  },
  squircle: {
    body: "M50 22 C82 22 88 28 88 57 C88 86 82 92 50 92 C18 92 12 86 12 57 C12 28 18 22 50 22 Z",
    top: 22,
    bottom: 92,
    eyeY: 55,
    spread: 16,
  },
  tablet: {
    body: '<rect x="20" y="22" width="60" height="70" rx="14" fill="{FILL}" stroke="{STROKE}" stroke-width="5" />',
    top: 22,
    bottom: 92,
    eyeY: 54,
    spread: 14,
  },
  capsule: {
    body: '<rect x="24" y="20" width="52" height="72" rx="26" fill="{FILL}" stroke="{STROKE}" stroke-width="5" />',
    top: 20,
    bottom: 92,
    eyeY: 54,
    spread: 12,
  },
  cylinder: {
    body: "M18 32 A32 9 0 0 1 82 32 L82 80 A32 9 0 0 1 18 80 Z",
    detail: '<path d="M18 32 A32 9 0 0 0 82 32" fill="none" stroke="{MARK}" stroke-width="3" />',
    top: 23,
    bottom: 89,
    eyeY: 58,
    spread: 15,
  },
  hex: {
    body: "M50 20 L86 39 L86 75 L50 94 L14 75 L14 39 Z",
    top: 20,
    bottom: 94,
    eyeY: 55,
    spread: 15,
  },
  gem: {
    body: "M30 24 L70 24 L90 46 L50 94 L10 46 Z",
    top: 24,
    bottom: 94,
    eyeY: 48,
    spread: 15,
    mouthY: 64,
  },
  crystal: {
    body: "M50 18 L78 40 L70 92 L30 92 L22 40 Z",
    top: 18,
    bottom: 92,
    eyeY: 56,
    spread: 12,
  },
  wedge: {
    body: "M50 22 L88 86 Q90 92 84 92 L16 92 Q10 92 12 86 Z",
    top: 22,
    bottom: 92,
    eyeY: 68,
    spread: 12,
    mouthY: 82,
  },
  shield: {
    body: "M50 20 L86 32 C86 62 74 82 50 94 C26 82 14 62 14 32 Z",
    top: 20,
    bottom: 94,
    eyeY: 50,
    spread: 15,
  },
  dome: {
    body: "M12 92 L12 62 A38 38 0 0 1 88 62 L88 92 Z",
    top: 24,
    bottom: 92,
    eyeY: 60,
    spread: 15,
  },
  arch: {
    body: "M14 94 L14 54 A36 36 0 0 1 86 54 L86 94 L72 94 L72 84 L28 84 L28 94 Z",
    top: 18,
    bottom: 94,
    eyeY: 52,
    spread: 14,
  },
  cloud: {
    body:
      "M28 90 C14 90 8 76 16 66 C10 54 22 42 34 46 C36 30 58 24 68 38 C84 34 94 50 86 62 C96 72 88 90 74 90 Z",
    top: 28,
    bottom: 90,
    eyeY: 62,
    spread: 14,
  },
  teardrop: {
    body: "M50 20 C56 40 86 52 86 66 C86 84 70 94 50 94 C30 94 14 84 14 66 C14 52 44 40 50 20 Z",
    top: 20,
    bottom: 94,
    eyeY: 68,
    spread: 13,
  },
  leaf: {
    body: "M50 20 C80 30 92 62 74 88 C64 96 36 96 26 88 C8 62 20 30 50 20 Z",
    top: 20,
    bottom: 94,
    eyeY: 60,
    spread: 13,
  },
};

export function avatarSpec(botName: string, personName: string): AvatarSpec {
  const seed = avatarSeed(botName, personName);
  const r = rng(fnv1a(seed));
  const shape = pick(r, SHAPES);
  const style: Style = r() < 0.6 ? "solid" : "outline";
  const eyes = pick(r, EYES);
  const mouth = pick(r, MOUTHS);
  const top = pick(r, TOPS);
  let face = pick(r, FACES);
  if (eyes === "visor" || eyes === "happy" || eyes === "sleepy") {
    if (face === "glasses" || face === "monocle") face = "none";
  }
  const feet = r() < 0.35;
  const look = { dx: Math.round((r() - 0.5) * 4), dy: Math.round((r() - 0.5) * 3) };
  return {
    seed,
    shape,
    style,
    eyes,
    mouth,
    top,
    face,
    feet,
    look,
    eyeSpread: SHAPE_DEFS[shape].spread,
  };
}

export interface AvatarColors {
  /** The "ink" color: black on paper, white on screen. */
  ink: string;
  /** The "paper" color: white on paper, black on screen. */
  paper: string;
}

export const PRINT_COLORS: AvatarColors = { ink: "#000000", paper: "#ffffff" };
export const SCREEN_COLORS: AvatarColors = { ink: "#ffffff", paper: "#000000" };

function eyesMarkup(spec: AvatarSpec, def: ShapeDef, mark: string, body: string): string {
  const y = def.eyeY;
  const s = spec.eyeSpread;
  const lx = 50 - s;
  const rx = 50 + s;
  const { dx, dy } = spec.look;
  const sw = 4;
  switch (spec.eyes) {
    case "dots":
      return `<circle cx="${lx}" cy="${y}" r="5.5" fill="${mark}"/><circle cx="${rx}" cy="${y}" r="5.5" fill="${mark}"/>`;
    case "wide":
      return (
        `<circle cx="${lx}" cy="${y}" r="8" fill="${mark}"/><circle cx="${rx}" cy="${y}" r="8" fill="${mark}"/>` +
        `<circle cx="${lx + dx}" cy="${y + dy}" r="3.4" fill="${body}"/><circle cx="${rx + dx}" cy="${y + dy}" r="3.4" fill="${body}"/>`
      );
    case "happy":
      return (
        `<path d="M${lx - 7} ${y + 3} Q${lx} ${y - 7} ${lx + 7} ${y + 3}" fill="none" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M${rx - 7} ${y + 3} Q${rx} ${y - 7} ${rx + 7} ${y + 3}" fill="none" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
    case "wink":
      return (
        `<circle cx="${lx}" cy="${y}" r="6" fill="${mark}"/>` +
        `<path d="M${rx - 7} ${y} L${rx + 7} ${y}" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
    case "sleepy":
      return (
        `<path d="M${lx - 7} ${y - 2} Q${lx} ${y + 6} ${lx + 7} ${y - 2}" fill="none" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M${rx - 7} ${y - 2} Q${rx} ${y + 6} ${rx + 7} ${y - 2}" fill="none" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
    case "sparkle": {
      const star = (cx: number) =>
        `<path d="M${cx} ${y - 8} Q${cx + 1.5} ${y - 1.5} ${cx + 8} ${y} Q${cx + 1.5} ${y + 1.5} ${cx} ${y + 8} Q${cx - 1.5} ${y + 1.5} ${cx - 8} ${y} Q${cx - 1.5} ${y - 1.5} ${cx} ${y - 8} Z" fill="${mark}"/>`;
      return star(lx) + star(rx);
    }
    case "pixel":
      return (
        `<rect x="${lx - 5.5}" y="${y - 5.5}" width="11" height="11" fill="${mark}"/>` +
        `<rect x="${rx - 5.5}" y="${y - 5.5}" width="11" height="11" fill="${mark}"/>`
      );
    case "focused":
      return (
        `<ellipse cx="${lx}" cy="${y}" rx="4" ry="8" fill="${mark}"/><ellipse cx="${rx}" cy="${y}" rx="4" ry="8" fill="${mark}"/>`
      );
    case "curious":
      return (
        `<circle cx="${lx}" cy="${y}" r="8" fill="${mark}"/><circle cx="${lx + dx}" cy="${y + dy}" r="3.4" fill="${body}"/>` +
        `<circle cx="${rx}" cy="${y + 1}" r="4.5" fill="${mark}"/>`
      );
    case "visor": {
      const w = s * 2 + 18;
      return (
        `<rect x="${50 - w / 2}" y="${y - 6}" width="${w}" height="12" rx="6" fill="${mark}"/>` +
        `<rect x="${lx - 3 + dx}" y="${y - 2.5}" width="6" height="5" rx="1" fill="${body}"/>` +
        `<rect x="${rx - 3 + dx}" y="${y - 2.5}" width="6" height="5" rx="1" fill="${body}"/>`
      );
    }
  }
}

function mouthMarkup(spec: AvatarSpec, def: ShapeDef, mark: string): string {
  const y = def.mouthY ?? def.eyeY + 15;
  switch (spec.mouth) {
    case "smile":
      return `<path d="M43 ${y} Q50 ${y + 7} 57 ${y}" fill="none" stroke="${mark}" stroke-width="3.5" stroke-linecap="round"/>`;
    case "o":
      return `<circle cx="50" cy="${y + 2}" r="3.5" fill="${mark}"/>`;
    case "flat":
      return `<path d="M44 ${y + 2} L56 ${y + 2}" stroke="${mark}" stroke-width="3.5" stroke-linecap="round"/>`;
    case "smirk":
      return `<path d="M46 ${y + 2} Q52 ${y + 5} 58 ${y - 1}" fill="none" stroke="${mark}" stroke-width="3.5" stroke-linecap="round"/>`;
    default:
      return "";
  }
}

function faceMarkup(spec: AvatarSpec, def: ShapeDef, mark: string): string {
  const y = def.eyeY;
  const s = spec.eyeSpread;
  const lx = 50 - s;
  const rx = 50 + s;
  switch (spec.face) {
    case "glasses":
      return (
        `<circle cx="${lx}" cy="${y}" r="11" fill="none" stroke="${mark}" stroke-width="3"/>` +
        `<circle cx="${rx}" cy="${y}" r="11" fill="none" stroke="${mark}" stroke-width="3"/>` +
        `<path d="M${lx + 11} ${y} L${rx - 11} ${y}" stroke="${mark}" stroke-width="3"/>`
      );
    case "monocle":
      return (
        `<circle cx="${rx}" cy="${y}" r="11" fill="none" stroke="${mark}" stroke-width="3"/>` +
        `<path d="M${rx + 8} ${y + 8} L${rx + 12} ${y + 18}" stroke="${mark}" stroke-width="2.5" stroke-linecap="round"/>`
      );
    case "blush":
      return (
        `<ellipse cx="${lx - 4}" cy="${y + 11}" rx="4.5" ry="2.5" fill="${mark}"/>` +
        `<ellipse cx="${rx + 4}" cy="${y + 11}" rx="4.5" ry="2.5" fill="${mark}"/>`
      );
    default:
      return "";
  }
}

function topMarkup(spec: AvatarSpec, def: ShapeDef, ink: string, paper: string): string {
  const t = def.top;
  // Accessories that overlap a solid body need a paper outline or they vanish (ink on ink).
  const sticker = spec.style === "solid" ? ` stroke="${paper}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"` : "";
  switch (spec.top) {
    case "antenna":
      return (
        `<path d="M50 ${t + 2} L50 ${t - 10}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` +
        `<circle cx="50" cy="${t - 13}" r="4.5" fill="${ink}"/>`
      );
    case "twin-antenna":
      return (
        `<path d="M40 ${t + 3} L34 ${t - 9}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M60 ${t + 3} L66 ${t - 9}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` +
        `<circle cx="33" cy="${t - 12}" r="4" fill="${ink}"/><circle cx="67" cy="${t - 12}" r="4" fill="${ink}"/>`
      );
    case "headphones":
      return (
        `<path d="M18 ${t + 22} A32 32 0 0 1 82 ${t + 22}" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>` +
        `<rect x="10" y="${t + 18}" width="13" height="20" rx="5" fill="${ink}"${sticker}/>` +
        `<rect x="77" y="${t + 18}" width="13" height="20" rx="5" fill="${ink}"${sticker}/>`
      );
    case "bow":
      return (
        `<path d="M62 ${t + 4} L50 ${t + 9} L62 ${t + 14} Z" fill="${ink}"${sticker}/>` +
        `<path d="M74 ${t + 4} L86 ${t + 9} L74 ${t + 14} Z" fill="${ink}"${sticker}/>` +
        `<circle cx="68" cy="${t + 9}" r="4" fill="${ink}"${sticker}/>` +
        `<circle cx="68" cy="${t + 9}" r="1.8" fill="${paper}"/>`
      );
    case "cap":
      return (
        `<path d="M26 ${t + 8} A24 16 0 0 1 74 ${t + 8} L74 ${t + 12} L26 ${t + 12} Z" fill="${ink}"${sticker}/>` +
        `<rect x="22" y="${t + 10}" width="66" height="6" rx="3" fill="${ink}"${sticker}/>`
      );
    case "propeller":
      return (
        `<path d="M50 ${t + 2} L50 ${t - 6}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M28 ${t - 8} Q50 ${t - 14} 72 ${t - 8} Q50 ${t - 2} 28 ${t - 8} Z" fill="${ink}"/>`
      );
    case "halo":
      return `<ellipse cx="50" cy="${t - 8}" rx="24" ry="7" fill="none" stroke="${ink}" stroke-width="4"/>`;
    case "ears":
      return (
        `<circle cx="26" cy="${t + 8}" r="8" fill="${ink}"/><circle cx="74" cy="${t + 8}" r="8" fill="${ink}"/>` +
        (spec.style === "outline"
          ? `<circle cx="26" cy="${t + 8}" r="3.5" fill="${paper}"/><circle cx="74" cy="${t + 8}" r="3.5" fill="${paper}"/>`
          : "")
      );
    case "crown":
      return `<path d="M30 ${t + 10} L30 ${t - 6} L40 ${t + 2} L50 ${t - 10} L60 ${t + 2} L70 ${t - 6} L70 ${t + 10} Z" fill="${ink}"${sticker}/>`;
    case "sprout":
      return (
        `<path d="M50 ${t + 2} Q50 ${t - 6} 46 ${t - 12}" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M46 ${t - 12} Q34 ${t - 20} 32 ${t - 8} Q42 ${t - 4} 46 ${t - 12} Z" fill="${ink}"/>` +
        `<path d="M46 ${t - 12} Q56 ${t - 22} 62 ${t - 12} Q52 ${t - 4} 46 ${t - 12} Z" fill="${ink}"/>`
      );
    default:
      return "";
  }
}

function feetMarkup(def: ShapeDef, ink: string): string {
  const b = def.bottom;
  return (
    `<rect x="30" y="${b - 2}" width="14" height="8" rx="4" fill="${ink}"/>` +
    `<rect x="56" y="${b - 2}" width="14" height="8" rx="4" fill="${ink}"/>`
  );
}

/**
 * Inner markup (no <svg> wrapper) in a 100×100 coordinate space.
 * Embed inside your own <svg> or a <g transform>.
 */
export function avatarInner(spec: AvatarSpec, colors: AvatarColors = SCREEN_COLORS): string {
  const def = SHAPE_DEFS[spec.shape];
  const { ink, paper } = colors;
  const solid = spec.style === "solid";
  const bodyFill = solid ? ink : paper;
  const mark = solid ? paper : ink;

  let body: string;
  if (def.body.startsWith("<")) {
    body = def.body.replace(/\{FILL\}/g, bodyFill).replace(/\{STROKE\}/g, ink);
  } else {
    body = `<path d="${def.body}" fill="${bodyFill}" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  }
  const detail = def.detail ? def.detail.replace(/\{MARK\}/g, mark) : "";

  return [
    spec.feet ? feetMarkup(def, ink) : "",
    // Accessories that sit behind the body outline are drawn first.
    spec.top === "ears" ? topMarkup(spec, def, ink, paper) : "",
    body,
    detail,
    eyesMarkup(spec, def, mark, bodyFill),
    mouthMarkup(spec, def, mark),
    faceMarkup(spec, def, mark),
    spec.top !== "ears" ? topMarkup(spec, def, ink, paper) : "",
  ].join("");
}

export interface AvatarSvgOptions {
  size?: number;
  colors?: AvatarColors;
  /** Fill the square background with `paper`. */
  background?: boolean;
  className?: string;
}

export function avatarSvg(spec: AvatarSpec, opts: AvatarSvgOptions = {}): string {
  const size = opts.size ?? 100;
  const colors = opts.colors ?? SCREEN_COLORS;
  const bg = opts.background ? `<rect width="100" height="100" fill="${colors.paper}"/>` : "";
  const cls = opts.className ? ` class="${opts.className}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"${cls} role="img" aria-label="Grok Bot avatar">` +
    bg +
    avatarInner(spec, colors) +
    `</svg>`
  );
}

export function avatarDescription(spec: AvatarSpec): string {
  const bits = [spec.shape, spec.style, `${spec.eyes} eyes`];
  if (spec.top !== "none") bits.push(spec.top.replace("-", " "));
  if (spec.face !== "none") bits.push(spec.face);
  if (spec.feet) bits.push("feet");
  return bits.join(" · ");
}
