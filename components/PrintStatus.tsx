"use client";

import { useEffect, useState } from "react";

const STATUS_EVENT = "gb:status";

type Status = "queued" | "printing" | "printed" | "failed" | "missing" | "loading";

interface Job {
  id: string;
  status: Status;
  error?: string;
  printedAt?: number;
}

interface Agent {
  lastSeen: number;
  ble: string;
}

const COPY: Record<Status, { label: string; hint: string; dot: string }> = {
  loading: { label: "Checking the queue…", hint: "", dot: "bg-neutral-500 animate-pulse-soft" },
  queued: { label: "Print queued", hint: "The booth printer grabs jobs in order. Usually under 10s.", dot: "bg-warn animate-pulse-soft" },
  printing: { label: "Printing…", hint: "Listen for the little thermal whirr.", dot: "bg-white animate-pulse-soft" },
  printed: { label: "Printed ✓", hint: "Grab it at the booth. Peel, stick, photograph.", dot: "bg-ok" },
  failed: { label: "Print failed", hint: "Wave at the booth host — they can reprint from the dashboard.", dot: "bg-bad" },
  missing: {
    label: "Not in the live queue",
    hint: "The queue may have been reset. Tap “Print again” to re-queue this exact badge.",
    dot: "bg-neutral-600",
  },
};

export function PrintStatus({ badgeId, initial }: { badgeId: string; initial?: Status }) {
  const [job, setJob] = useState<Job | null>(initial ? { id: "", status: initial } : null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [status, setStatus] = useState<Status>(initial ?? "loading");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const res = await fetch(`/api/queue?badge=${encodeURIComponent(badgeId)}&limit=1`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        const j: Job | undefined = data.jobs?.[0];
        setAgent(data.agent ?? null);
        if (j) {
          setJob(j);
          setStatus(j.status);
        } else {
          setStatus("missing");
        }
        const next = j?.status === "printed" || j?.status === "failed" ? 8000 : 2000;
        timer = setTimeout(poll, next);
      } catch {
        if (alive) timer = setTimeout(poll, 4000);
      }
    };
    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [badgeId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: status }));
  }, [status]);

  const c = COPY[status];
  const agentOnline = agent ? Date.now() - agent.lastSeen < 20_000 : false;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <span className="text-sm font-bold">{c.label}</span>
        {status === "printed" && job?.printedAt ? (
          <span className="ml-auto text-[11px] text-dim">{new Date(job.printedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        ) : null}
      </div>
      {c.hint ? <p className="mt-2 text-xs text-neutral-400">{c.hint}</p> : null}
      {status === "failed" && job?.error ? <p className="mt-1 text-[11px] text-bad">{job.error}</p> : null}
      <div className="mt-3 flex items-center gap-2 text-[10px] tracking-[0.16em] text-dim uppercase">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${agentOnline ? "bg-ok" : "bg-neutral-700"}`} />
        {agent ? (agentOnline ? `printer agent online · ${agent.ble}` : "printer agent offline") : "waiting for printer agent"}
      </div>
    </div>
  );
}
