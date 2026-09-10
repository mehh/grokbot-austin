/**
 * Label layout for the Phomemo M110 (40×30mm → 320×240 dots).
 * Pure string SVG so the exact same artwork renders in the browser (live preview)
 * and on the server (rasterized to a 1-bit PNG for the printer).
 */
import type { Badge } from "./badge";
import { PRINT_COLORS, avatarInner, avatarSpec } from "./avatar";
import { EVENT, HOST_BOT, LABEL } from "./config";
import { flairFor } from "./flair";

export const LABEL_FONT_FAMILY = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
/** Geist Mono advance width as a fraction of font-size. */
const CHAR_W = 0.6;

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface Fitted {
  lines: string[];
  size: number;
}

/** Fit text into a box with a monospace font: shrink first, then wrap, then ellipsize. */
export function fitText(text: string, maxWidth: number, maxSize: number, minSize: number, maxLines: number): Fitted {
  const t = text.trim();
  if (!t) return { lines: [], size: maxSize };
  const widthAt = (size: number, s: string) => s.length * size * CHAR_W;

  for (let size = maxSize; size >= minSize; size -= 1) {
    if (widthAt(size, t) <= maxWidth) return { lines: [t], size };
  }
  // Wrap at the minimum-ish size that still reads well: try a few sizes from large to small.
  for (let size = Math.max(minSize, Math.round(maxSize * 0.75)); size >= minSize; size -= 1) {
    const maxChars = Math.max(1, Math.floor(maxWidth / (size * CHAR_W)));
    const lines = wrap(t, maxChars);
    if (lines.length <= maxLines) return { lines, size };
  }
  const maxChars = Math.max(1, Math.floor(maxWidth / (minSize * CHAR_W)));
  const all = wrap(t, maxChars);
  const lines = all.slice(0, maxLines);
  const last = lines[lines.length - 1];
  if (all.length > maxLines || last.length >= maxChars) {
    lines[lines.length - 1] = last.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…";
  }
  return { lines, size: minSize };
}

function wrap(text: string, maxChars: number): string[] {
  // Hard-break words longer than a line so nothing is silently dropped.
  const words = text.split(" ").flatMap((w) => {
    const chunks: string[] = [];
    for (let i = 0; i < w.length; i += maxChars) chunks.push(w.slice(i, i + maxChars));
    return chunks.length ? chunks : [w];
  });
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface LabelOptions {
  width?: number;
  height?: number;
  /** Emit width/height="100%" so the SVG scales to its container in the browser. */
  responsive?: boolean;
}

export function labelSvg(badge: Badge, opts: LabelOptions = {}): string {
  const W = opts.width ?? LABEL.width;
  const H = opts.height ?? LABEL.height;
  const { ink, paper } = PRINT_COLORS;

  const pad = 16;
  const flair = flairFor(badge.botName, badge.name);
  const legendary = flair.rarity === "legendary";
  const handshake = badge.handshake ? fitHandshake(badge.handshake, W - pad * 2 - 16) : null;
  const footerH = handshake ? 48 : 36;
  const footerY = H - pad - footerH;
  const contentH = footerY - pad;

  // Avatar block on the left.
  const avatarSize = Math.min(96, contentH);
  const avatarX = pad + 2;
  const avatarY = pad + (contentH - avatarSize) / 2;
  const spec = avatarSpec(badge.botName, badge.name);
  const avatar = `<g transform="translate(${avatarX} ${avatarY}) scale(${avatarSize / 100})">${avatarInner(spec, PRINT_COLORS)}</g>`;

  // Text column on the right.
  const textX = avatarX + avatarSize + 12;
  const textW = W - pad - textX;

  const name = fitText(badge.name.toUpperCase(), textW, 32, 16, 2);
  const bot = fitText(badge.botName, textW, 19, 12, 1);
  const subtitle = badge.title || badge.vibe || "";
  const sub = subtitle ? fitText(subtitle, textW, 12, 10, 1) : { lines: [], size: 12 };
  // Conversation starter — the whole point of wearing the thing.
  const ice = fitText(`> ${flair.icebreaker}`, textW, 10, 8, 2);

  const lineH = (size: number) => Math.round(size * 1.1);
  const nameBlock = name.lines.length * lineH(name.size);
  const capH = 9;
  const botBlock = capH + 3 + lineH(bot.size);
  const subBlock = sub.lines.length ? sub.lines.length * lineH(sub.size) + 5 : 0;
  const iceBlock = ice.lines.length * lineH(ice.size) + 9;
  const total = nameBlock + 6 + botBlock + subBlock + iceBlock;
  let y = pad + Math.max(0, (contentH - total) / 2);

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${paper}"/>`);
  if (legendary) {
    // Double frame so a LEGENDARY reads from across the room.
    parts.push(`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="6" fill="none" stroke="${ink}" stroke-width="3"/>`);
    parts.push(`<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="4" fill="none" stroke="${ink}" stroke-width="1.5"/>`);
  }
  parts.push(avatar);

  // Person name
  for (const line of name.lines) {
    y += name.size;
    parts.push(
      `<text x="${textX}" y="${y.toFixed(1)}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${name.size}" fill="${ink}">${escapeXml(line)}</text>`,
    );
    y += lineH(name.size) - name.size;
  }
  y += 6;

  // Bot caption + name
  y += capH;
  parts.push(
    `<text x="${textX}" y="${y.toFixed(1)}" font-family="${LABEL_FONT_FAMILY}" font-weight="500" font-size="${capH}" letter-spacing="1" fill="${ink}">GROK BOT →</text>`,
  );
  y += 3 + bot.size;
  parts.push(
    `<text x="${textX}" y="${y.toFixed(1)}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${bot.size}" fill="${ink}">${escapeXml(bot.lines[0] ?? "")}</text>`,
  );
  y += lineH(bot.size) - bot.size;

  // Title / vibe
  if (sub.lines.length) {
    y += 5;
    for (const line of sub.lines) {
      y += sub.size;
      parts.push(
        `<text x="${textX}" y="${y.toFixed(1)}" font-family="${LABEL_FONT_FAMILY}" font-weight="500" font-size="${sub.size}" fill="${ink}">${escapeXml(line)}</text>`,
      );
      y += lineH(sub.size) - sub.size;
    }
  }

  // Icebreaker, separated by a thin rule
  y += 6;
  parts.push(`<rect x="${textX}" y="${y.toFixed(1)}" width="${Math.min(textW, 60)}" height="1.5" fill="${ink}"/>`);
  y += 3;
  for (const line of ice.lines) {
    y += ice.size;
    parts.push(
      `<text x="${textX}" y="${y.toFixed(1)}" font-family="${LABEL_FONT_FAMILY}" font-weight="500" font-size="${ice.size}" fill="${ink}">${escapeXml(line)}</text>`,
    );
    y += lineH(ice.size) - ice.size;
  }

  // Footer strip
  const tag = flair.rarityTagPrint;
  parts.push(`<rect x="${pad + (legendary ? 3 : 0)}" y="${footerY}" width="${W - pad * 2 - (legendary ? 6 : 0)}" height="${footerH}" rx="4" fill="${ink}"/>`);
  const mainY = handshake ? footerY + 22 : footerY + footerH / 2 + 6;
  // paint-order stroke+fill: white halo keeps glyphs thick after 1-bit threshold (thermal AA blur fix)
  const footerStroke = `stroke="${paper}" stroke-width="1.25" paint-order="stroke fill" stroke-linejoin="round"`;
  parts.push(
    `<text x="${pad + 10}" y="${mainY}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="16" letter-spacing="1" fill="${paper}" ${footerStroke}>${escapeXml(EVENT.tag)}</text>`,
  );
  parts.push(
    `<text x="${W - pad - 10}" y="${mainY - 1}" text-anchor="end" font-family="${LABEL_FONT_FAMILY}" font-weight="${legendary ? 700 : 500}" font-size="12" letter-spacing="1" fill="${paper}" ${footerStroke}>${escapeXml(tag)}</text>`,
  );
  if (handshake) {
    parts.push(
      `<text x="${pad + 8}" y="${footerY + footerH - 9}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${handshake.size}" fill="${paper}" ${footerStroke}>${escapeXml(handshake.lines[0] ?? "")}</text>`,
    );
  }

  const dims = opts.responsive ? 'width="100%" height="100%"' : `width="${W}" height="${H}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${dims}>${parts.join("")}</svg>`;
}

/** Prefer the host bot's full name; fall back to initials so the guest's line survives intact. */
function fitHandshake(text: string, maxWidth: number): Fitted {
  const full = fitText(`→ ${HOST_BOT}: ${text}`, maxWidth, 11, 9, 1);
  if (!full.lines[0]?.endsWith("…")) return full;
  const initials = HOST_BOT.split(/\s+/).map((w) => w[0]).join("");
  return fitText(`→ ${initials}: ${text}`, maxWidth, 11, 9, 1);
}

export function shortCode(id: string): string {
  const dot = id.lastIndexOf(".");
  const sig = dot >= 0 ? id.slice(dot + 1) : id;
  return sig.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "GROK";
}
