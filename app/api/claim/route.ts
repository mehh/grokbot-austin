import { BadgeError, badgeUrls, createBadge } from "@/lib/badge";
import { json, readJson } from "@/lib/auth";
import { clientKey, enqueueBadge, rateLimit } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public claim endpoint (humans via the form, bots that skipped /prompt).
 * Body: { name, botName, title?, vibe?, quote?, source? }
 */
export async function POST(req: Request) {
  if (!rateLimit(`claim:${clientKey(req)}`)) {
    return json({ ok: false, error: "Slow down — too many claims from this device." }, { status: 429 });
  }
  const body = await readJson(req);
  if (typeof body.website === "string" && body.website.trim()) {
    // Honeypot field filled → pretend success, drop silently.
    return json({ ok: true, ignored: true });
  }
  try {
    const badge = createBadge({ ...body, source: body.source === "bot" ? "bot" : "human" });
    const job = await enqueueBadge(badge);
    const urls = badgeUrls(badge.id);
    return json(
      {
        ok: true,
        id: badge.id,
        jobId: job.id,
        status: job.status,
        ...urls,
        badge: { name: badge.name, botName: badge.botName, title: badge.title, vibe: badge.vibe, quote: badge.quote },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BadgeError) return json({ ok: false, error: err.message }, { status: err.status });
    console.error("claim failed", err);
    return json({ ok: false, error: "Could not create badge." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
