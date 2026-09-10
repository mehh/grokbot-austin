import { BadgeError, badgeUrls, createBadge } from "@/lib/badge";
import { isAuthorized, json, readJson, unauthorized } from "@/lib/auth";
import { baseUrl } from "@/lib/config";
import { botPrompt } from "@/lib/prompt";
import { enqueueBadge } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Machine-readable description so a bot that lands here knows what to do. */
export async function GET() {
  return json({
    ok: true,
    service: "Grok Bot Austin badge booth",
    how: "POST JSON to /api/claim (or this URL) with header x-booth-token. Fields: personName (required), botName (required), botTitle, vibe, quote, handshake.",
    prompt: botPrompt({ token: "<x-booth-token from the /prompt page>" }),
    docs: `${baseUrl()}/prompt`,
  });
}

/** Bot-to-bot claim: same as /api/claim but authenticated with the shared booth token. */
export async function POST(req: Request) {
  if (!isAuthorized(req, "bot")) return unauthorized();
  const body = await readJson(req);
  try {
    const badge = createBadge({ ...body, source: "bot" });
    const job = await enqueueBadge(badge);
    const urls = badgeUrls(badge.id);
    return json(
      {
        ok: true,
        id: badge.id,
        jobId: job.id,
        status: job.status,
        ...urls,
        message: `Badge queued for ${badge.name}. Open previewUrl to watch it print.`,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BadgeError) return json({ ok: false, error: err.message }, { status: err.status });
    console.error("agent claim failed", err);
    return json({ ok: false, error: "Could not create badge." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
