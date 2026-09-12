/**
 * Brand assets for favicon / app icons / Open Graph, all drawn from the same procedural
 * Grok Bot avatar system the badges use (see `lib/avatar.ts`). No binaries in `public/`.
 */
import { avatarInner, avatarSpec, SCREEN_COLORS, type AvatarColors } from "./avatar";

/**
 * The site's mascot: the bot `<Avatar botName="Grok Bot" />` renders for an anonymous guest.
 * Seed resolves to a solid blob with wide eyes and a single antenna.
 */
export const BRAND_BOT = { botName: "Grok Bot", personName: "guest" } as const;

/** Bots shown in the OG lineup. First entry is the host bot at the table. */
export const OG_LINEUP: ReadonlyArray<readonly [bot: string, human: string]> = [
  ["Chaos Concierge", "Ana"],
  ["Ledger", "Kris"],
  ["Sprocket", "Jules"],
  ["Nudge", "Priya"],
  ["Sigmoid", "Lena"],
];

export interface BrandAvatarOptions {
  size: number;
  colors?: AvatarColors;
  /** Fill the canvas with `paper`. Off by default so the icon keeps its own background. */
  background?: boolean;
  /**
   * Crop applied to the 100×100 avatar space. The mascot's body spans roughly x 12–88 /
   * y 8–92 (antenna included), so the default trims dead space for small favicons.
   */
  viewBox?: string;
}

const MASCOT_VIEWBOX = "4 4 92 92";

/** Standalone SVG string of the mascot. Safe to embed as a `data:image/svg+xml` URL. */
export function brandAvatarSvg(opts: BrandAvatarOptions): string {
  const colors = opts.colors ?? SCREEN_COLORS;
  const spec = avatarSpec(BRAND_BOT.botName, BRAND_BOT.personName);
  const viewBox = opts.viewBox ?? MASCOT_VIEWBOX;
  const bg = opts.background ? `<rect x="-50" y="-50" width="200" height="200" fill="${colors.paper}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${opts.size}" height="${opts.size}">` +
    bg +
    avatarInner(spec, colors) +
    `</svg>`
  );
}

/** Any (bot, human) pair as a standalone SVG, for the OG lineup. */
export function lineupAvatarSvg(botName: string, personName: string, size: number): string {
  const spec = avatarSpec(botName, personName);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    avatarInner(spec, SCREEN_COLORS) +
    `</svg>`
  );
}

/** Data URL for `<img src>` inside `ImageResponse` (satori renders nested SVG images). */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
