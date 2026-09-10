/**
 * 4×6" badge card for the PM-241-BT (203 dpi → 812×1218 dots).
 * Same procedural blob avatar as the M110 sticker; agent icebreaker when present.
 */
import QRCode from "qrcode";
import type { Badge } from "./badge";
import { PRINT_COLORS, avatarInner, avatarSpec } from "./avatar";
import { EVENT, HOST_BOT, baseUrl } from "./config";
import { flairFor, resolveIcebreaker } from "./flair";
import { escapeXml, fitText, LABEL_FONT_FAMILY } from "./label";

export const LABEL_4X6 = { width: 812, height: 1218 } as const;

export interface Label4x6Options {
  qrUrl?: string;
  /** Pre-rendered QR SVG markup (outer <svg>…</svg>). Overrides qrUrl generation. */
  qrSvg?: string;
}

function qrModulesSvg(url: string, sizePx: number, ink: string, paper: string): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = sizePx / (n + 2); // 1-module quiet zone
  const parts: string[] = [];
  parts.push(`<rect width="${sizePx}" height="${sizePx}" fill="${paper}"/>`);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y)) continue;
      const px = ((x + 1) * cell).toFixed(2);
      const py = ((y + 1) * cell).toFixed(2);
      parts.push(`<rect x="${px}" y="${py}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${ink}"/>`);
    }
  }
  return parts.join("");
}

export function label4x6Svg(badge: Badge, opts: Label4x6Options = {}): string {
  const W = LABEL_4X6.width;
  const H = LABEL_4X6.height;
  const { ink, paper } = PRINT_COLORS;
  const pad = 48;
  const flair = flairFor(badge.botName, badge.name);
  const legendary = flair.rarity === "legendary";
  const iceText = resolveIcebreaker(badge);
  const previewUrl = opts.qrUrl || `${baseUrl()}/b/${encodeURIComponent(badge.id)}`;

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${paper}"/>`);
  // Outer frame
  parts.push(
    `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="18" fill="none" stroke="${ink}" stroke-width="4"/>`,
  );
  if (legendary) {
    parts.push(
      `<rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="14" fill="none" stroke="${ink}" stroke-width="2.5"/>`,
    );
  }

  // Event chip + rarity
  const chipY = pad + 8;
  const chipH = 36;
  const eventLabel = EVENT.tag;
  const eventW = Math.min(320, 24 + eventLabel.length * 11 * 0.62);
  parts.push(
    `<rect x="${pad}" y="${chipY}" width="${eventW}" height="${chipH}" rx="10" fill="none" stroke="${ink}" stroke-width="2.5"/>`,
  );
  parts.push(
    `<text x="${pad + 14}" y="${chipY + 24}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="15" letter-spacing="1.2" fill="${ink}">${escapeXml(eventLabel)}</text>`,
  );
  const rarity = flair.rarityTagPrint;
  const rarW = Math.min(220, 28 + rarity.length * 12 * 0.62);
  parts.push(
    `<rect x="${W - pad - rarW}" y="${chipY}" width="${rarW}" height="${chipH}" rx="10" fill="${ink}"/>`,
  );
  parts.push(
    `<text x="${W - pad - rarW / 2}" y="${chipY + 24}" text-anchor="middle" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="15" letter-spacing="1.2" fill="${paper}">${escapeXml(rarity)}</text>`,
  );

  // Large avatar on the right
  const avatarSize = 260;
  const avatarX = W - pad - avatarSize - 8;
  const avatarY = chipY + chipH + 36;
  const spec = avatarSpec(badge.botName, badge.name);
  parts.push(
    `<g transform="translate(${avatarX} ${avatarY}) scale(${avatarSize / 100})">${avatarInner(spec, PRINT_COLORS)}</g>`,
  );

  // Identity column (left of avatar)
  const textX = pad;
  const textW = avatarX - pad - 28;
  let y = chipY + chipH + 56;

  const name = fitText(badge.name.toUpperCase(), textW, 64, 36, 2);
  for (const line of name.lines) {
    y += name.size;
    parts.push(
      `<text x="${textX}" y="${y}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${name.size}" fill="${ink}">${escapeXml(line)}</text>`,
    );
    y += Math.round(name.size * 0.18);
  }

  const bot = fitText(badge.botName, textW, 36, 24, 1);
  y += 10 + bot.size;
  parts.push(
    `<text x="${textX}" y="${y}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${bot.size}" fill="${ink}">${escapeXml(bot.lines[0] ?? "")}</text>`,
  );

  if (badge.title) {
    const title = fitText(badge.title, textW, 26, 18, 2);
    y += 14;
    for (const line of title.lines) {
      y += title.size;
      parts.push(
        `<text x="${textX}" y="${y}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${title.size}" fill="${ink}">${escapeXml(line)}</text>`,
      );
      y += Math.round(title.size * 0.15);
    }
  }

  // Rule under identity
  y += 28;
  parts.push(`<rect x="${textX}" y="${y}" width="${Math.min(textW, 420)}" height="4" fill="${ink}"/>`);
  y += 28;

  // Vibe / quote body
  const body = badge.vibe || badge.quote || "";
  if (body) {
    const vibe = fitText(body, textW + avatarSize * 0.15, 24, 18, 3);
    for (const line of vibe.lines) {
      y += vibe.size;
      parts.push(
        `<text x="${textX}" y="${y}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${vibe.size}" fill="${ink}">${escapeXml(line)}</text>`,
      );
      y += Math.round(vibe.size * 0.28);
    }
    y += 18;
  }

  // Icebreaker card — full width under avatar when needed
  const cardX = pad;
  const cardW = W - pad * 2;
  const ice = fitText(`> ${iceText}`, cardW - 48, 28, 20, 3);
  const iceLineH = Math.round(ice.size * 1.35);
  const cardH = 36 + ice.lines.length * iceLineH;
  // Place card below the taller of text column / avatar
  const belowAvatar = avatarY + avatarSize + 24;
  y = Math.max(y + 8, belowAvatar);
  parts.push(
    `<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="14" fill="none" stroke="${ink}" stroke-width="3.5"/>`,
  );
  let iy = y + 28;
  for (const line of ice.lines) {
    iy += ice.size * 0.15;
    parts.push(
      `<text x="${cardX + 24}" y="${iy + ice.size}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${ice.size}" fill="${ink}">${escapeXml(line)}</text>`,
    );
    iy += iceLineH;
  }
  y += cardH + 22;

  // Handshake
  if (badge.handshake) {
    const hs = fitText(`→ ${HOST_BOT}: ${badge.handshake}`, cardW, 20, 16, 2);
    for (const line of hs.lines) {
      y += hs.size;
      parts.push(
        `<text x="${textX}" y="${y}" font-family="${LABEL_FONT_FAMILY}" font-weight="700" font-size="${hs.size}" fill="${ink}">${escapeXml(line)}</text>`,
      );
      y += Math.round(hs.size * 0.25);
    }
  }

  // Footer: QR + caption
  const qrSize = 220;
  const footerY = H - pad - qrSize - 8;
  parts.push(`<rect x="${pad}" y="${footerY - 18}" width="${W - pad * 2}" height="3" fill="${ink}"/>`);

  if (opts.qrSvg) {
    const inner = opts.qrSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    parts.push(`<svg x="${pad}" y="${footerY}" width="${qrSize}" height="${qrSize}" viewBox="0 0 120 120">${inner}</svg>`);
  } else {
    parts.push(`<g transform="translate(${pad} ${footerY})">${qrModulesSvg(previewUrl, qrSize, ink, paper)}</g>`);
  }

  const capX = pad + qrSize + 28;
  const capW = W - pad - capX;
  let cy = footerY + 36;
  const capLines = [
    { text: "Scan for your", size: 22 },
    { text: "badge page", size: 28 },
    { text: EVENT.tagline, size: 20 },
    { text: "grokbotaustin.vercel.app", size: 16 },
  ];
  for (const [idx, line] of capLines.entries()) {
    const fitted = fitText(line.text, capW, line.size, 14, 2);
    for (const l of fitted.lines) {
      cy += fitted.size;
      const weight = idx === 1 ? "700" : "700";
      parts.push(
        `<text x="${capX}" y="${cy}" font-family="${LABEL_FONT_FAMILY}" font-weight="${weight}" font-size="${fitted.size}" fill="${ink}">${escapeXml(l)}</text>`,
      );
      cy += Math.round(fitted.size * 0.35);
    }
    if (idx === 1) cy += 10;
    if (idx === 2) cy += 8;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>`;
}
