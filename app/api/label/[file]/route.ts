import { decodeBadge } from "@/lib/badge";
import { baseUrl } from "@/lib/config";
import { renderLabel4x6Png, renderLabelPng } from "@/lib/render";
import { ensureShortCode, isShortCode, resolveBadgeId } from "@/lib/short";
import { LABEL_4X6 } from "@/lib/label4x6";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/label/<badgeId|.short>.png[?scale=2][&size=4x6][&qr=...]
 * - default: 1-bit PNG 320×160 (40×20mm Phomemo M110)
 * - size=4x6: 1-bit PNG 812×1218 (4×6" PM-241-BT @ 203 dpi)
 * qrUrl prefers short /b/<code> when available, else long /b/<id>.
 */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const raw = decodeURIComponent(file);
  const idOrShort = raw.replace(/\.png$/i, "");
  const url = new URL(req.url);
  const size = (url.searchParams.get("size") || "").toLowerCase();
  const is4x6 = size === "4x6" || size === "4×6";
  const scale = Number(url.searchParams.get("scale") ?? "1");
  const download = url.searchParams.get("download") === "1";
  const qrOverride = url.searchParams.get("qr") || undefined;

  let badgeId = idOrShort;
  let shortHint: string | undefined;
  if (isShortCode(idOrShort)) {
    shortHint = idOrShort;
    const resolved = await resolveBadgeId(idOrShort);
    if (!resolved) {
      return new Response("Unknown short code", { status: 404 });
    }
    badgeId = resolved;
  }

  const badge = decodeBadge(badgeId);
  if (!badge) {
    return new Response("Unknown or tampered badge id", { status: 404 });
  }

  let qrUrl = qrOverride;
  if (!qrUrl && is4x6) {
    try {
      const short = shortHint || (await ensureShortCode(badge.id));
      qrUrl = `${baseUrl()}/b/${short}`;
    } catch {
      qrUrl = `${baseUrl()}/b/${encodeURIComponent(badge.id)}`;
    }
  }

  try {
    const png = is4x6
      ? renderLabel4x6Png(badge, { qrUrl })
      : renderLabelPng(badge, { scale: Number.isFinite(scale) ? scale : 1 });
    const safeName = `${badge.name}-${badge.botName}`.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
    const w = is4x6 ? String(LABEL_4X6.width) : "320";
    const h = is4x6 ? String(LABEL_4X6.height) : "160";
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Label-Width": w,
        "X-Label-Height": h,
        "X-Label-Size": is4x6 ? "4x6" : "40x20",
        ...(download ? { "Content-Disposition": `attachment; filename="grokbot-${safeName}${is4x6 ? "-4x6" : ""}.png"` } : {}),
      },
    });
  } catch (err) {
    console.error("label render failed", err);
    return new Response("Render failed", { status: 500 });
  }
}
