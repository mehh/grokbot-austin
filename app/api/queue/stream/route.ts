import { viewJob } from "@/lib/queue";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICK_MS = 2000;
// Serverless functions can't stream forever; EventSource reconnects automatically.
const MAX_MS = 55_000;

/** GET /api/queue/stream — Server-Sent Events snapshot of the queue whenever it changes. */
export async function GET(req: Request) {
  const store = getStore();
  const encoder = new TextEncoder();
  let closed = false;
  let lastPayload = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      const send = (event: string, data: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      send("hello", JSON.stringify({ ok: true, store: store.kind }));

      const tick = async () => {
        try {
          const [jobs, agent, settings] = await Promise.all([store.listJobs(60), store.getAgent(), store.getSettings()]);
          const payload = JSON.stringify({ now: Date.now(), store: store.kind, settings, agent, jobs: jobs.map((j) => viewJob(j)) });
          const fingerprint = JSON.stringify({ settings, agent, jobs });
          if (fingerprint !== lastPayload) {
            lastPayload = fingerprint;
            send("queue", payload);
          } else {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          }
        } catch (err) {
          send("error", JSON.stringify({ error: String(err) }));
        }
      };

      await tick();
      const timer = setInterval(async () => {
        if (closed || Date.now() - started > MAX_MS) {
          clearInterval(timer);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
          return;
        }
        await tick();
      }, TICK_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
