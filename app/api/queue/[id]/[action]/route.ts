import { isAuthorized, json, readJson, unauthorized } from "@/lib/auth";
import { viewJob } from "@/lib/queue";
import { getStore, type JobStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "claim" | "complete" | "fail" | "reprint" | "cancel";

const RULES: Record<Action, { from: JobStatus[]; to: JobStatus }> = {
  // Atomic: only one agent wins a queued job.
  claim: { from: ["queued"], to: "printing" },
  complete: { from: ["printing", "queued"], to: "printed" },
  fail: { from: ["printing", "queued"], to: "failed" },
  reprint: { from: ["printed", "failed", "printing", "queued"], to: "queued" },
  cancel: { from: ["queued", "printing"], to: "failed" },
};

/**
 * POST /api/queue/:id/(claim|complete|fail|reprint|cancel)
 * All transitions require the admin/booth token.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  if (!isAuthorized(req, "admin")) return unauthorized();
  const { id, action } = await ctx.params;
  const rule = RULES[action as Action];
  if (!rule) return json({ ok: false, error: `Unknown action "${action}".` }, { status: 404 });

  const body = await readJson(req);
  const store = getStore();
  const existing = await store.getJob(id);
  if (!existing) return json({ ok: false, error: "Job not found." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  const agent = typeof body.agent === "string" ? body.agent.slice(0, 64) : undefined;
  if (agent) patch.agent = agent;

  switch (action as Action) {
    case "claim":
      patch.attempts = (existing.attempts ?? 0) + 1;
      patch.error = "";
      break;
    case "complete":
      patch.printedAt = Date.now();
      patch.error = "";
      break;
    case "fail":
      patch.error = typeof body.error === "string" ? body.error.slice(0, 300) : "Print failed";
      break;
    case "cancel":
      patch.error = "Cancelled at the booth";
      break;
    case "reprint":
      patch.error = "";
      break;
  }

  const job = await store.transition(id, rule.from, rule.to, patch);
  if (!job) {
    const fresh = await store.getJob(id);
    return json(
      {
        ok: false,
        error: `Cannot ${action}: job is "${fresh?.status ?? "gone"}".`,
        job: fresh ? viewJob(fresh) : null,
      },
      { status: 409 },
    );
  }
  return json({ ok: true, job: viewJob(job) });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
