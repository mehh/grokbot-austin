import { isAuthorized, json, readJson, unauthorized } from "@/lib/auth";
import { viewJob } from "@/lib/queue";
import { getStore, type JobStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["queued", "printing", "printed", "failed"];

/**
 * GET /api/queue?status=queued&limit=50&badge=<badgeId>
 * Newest first. Includes agent status + settings so dashboards need one call.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const badge = url.searchParams.get("badge");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100") || 100));
  const store = getStore();

  const [all, agent, settings] = await Promise.all([store.listJobs(200), store.getAgent(), store.getSettings()]);

  let jobs = all;
  if (badge) jobs = jobs.filter((j) => j.badgeId === badge);
  if (status && status !== "all") {
    const wanted = status.split(",").filter((s): s is JobStatus => STATUSES.includes(s as JobStatus));
    jobs = jobs.filter((j) => wanted.includes(j.status));
  }
  jobs = jobs.slice(0, limit);

  const counts: Record<JobStatus, number> = { queued: 0, printing: 0, printed: 0, failed: 0 };
  for (const j of all) counts[j.status] += 1;

  return json({
    ok: true,
    now: Date.now(),
    store: store.kind,
    settings,
    agent,
    counts,
    jobs: jobs.map((j) => viewJob(j)),
  });
}

/** PATCH /api/queue  { autoPrint: boolean }  — booth settings (admin token). */
export async function PATCH(req: Request) {
  if (!isAuthorized(req, "admin")) return unauthorized();
  const body = await readJson(req);
  const patch: { autoPrint?: boolean } = {};
  if (typeof body.autoPrint === "boolean") patch.autoPrint = body.autoPrint;
  const settings = await getStore().setSettings(patch);
  return json({ ok: true, settings });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
