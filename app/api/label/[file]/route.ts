import { decodeBadge } from "@/lib/badge";
import { renderLabelPng } from "@/lib/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/label/<badgeId>.png[?scale=2]
 * Print-ready 1-bit PNG (320×240 @ scale 1 = 40×30mm on a Phomemo M110).
 */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const raw = decodeURIComponent(file);
  const id = raw.replace(/\.png$/i, "");
  const badge = decodeBadge(id);
  if (!badge) {
    return new Response("Unknown or tampered badge id", { status: 404 });
  }
  const url = new URL(req.url);
  const scale = Number(url.searchParams.get("scale") ?? "1");
  const download = url.searchParams.get("download") === "1";
  try {
    const png = renderLabelPng(badge, { scale: Number.isFinite(scale) ? scale : 1 });
    const safeName = `${badge.name}-${badge.botName}`.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Label-Width": "320",
        "X-Label-Height": "240",
        ...(download ? { "Content-Disposition": `attachment; filename="grokbot-${safeName}.png"` } : {}),
      },
    });
  } catch (err) {
    console.error("label render failed", err);
    return new Response("Render failed", { status: 500 });
  }
}
