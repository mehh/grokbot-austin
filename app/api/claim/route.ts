import { BadgeError, badgeUrls, createBadge } from "@/lib/badge";
import { isAuthorized, json, readJson } from "@/lib/auth";
import { clientKey, enqueueBadge, rateLimit } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The claim endpoint — for guests' Grok Bots (with `x-booth-token`) and the manual form (without).
 * Body: { personName, botName, botTitle?, vibe?, quote?, handshake? }  (name/title aliases accepted)
 * Requests carrying the booth token are treated as bot-to-bot claims and skip the per-IP rate limit.
 */
export async function POST(req: Request) {
  const fromBot = isAuthorized(req, "bot");
  if (!fromBot && !rateLimit(`claim:${clientKey(req)}`)) {
    return json({ ok: false, error: "Slow down — too many claims from this device." }, { status: 429 });
  }
  const body = await readJson(req);
  if (typeof body.website === "string" && body.website.trim()) {
    // Honeypot field filled → pretend success, drop silently.
    return json({ ok: true, ignored: true });
  }
  try {
    const badge = createBadge({ ...body, source: fromBot || body.source === "bot" ? "bot" : "human" });
    const job = await enqueueBadge(badge);
    const urls = badgeUrls(badge.id);
    return json(
      {
        ok: true,
        id: badge.id,
        jobId: job.id,
        status: job.status,
        ...urls,
        message: `Badge queued for ${badge.name} × ${badge.botName}. Open previewUrl to watch status — the booth printer picks it up when the agent is online.`,
        badge: {
          personName: badge.name,
          botName: badge.botName,
          botTitle: badge.title,
          vibe: badge.vibe,
          quote: badge.quote,
          handshake: badge.handshake,
        },
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
