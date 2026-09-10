"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, stateForStatus } from "./Avatar";

interface Job {
  id: string;
  badgeId: string;
  name: string;
  botName: string;
  title?: string;
  source: "human" | "bot";
  status: "queued" | "printing" | "printed" | "failed";
  createdAt: number;
  previewUrl: string;
}

interface Counts {
  queued: number;
  printing: number;
  printed: number;
  failed: number;
}

export function LiveWall() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/queue?limit=60", { cache: "no-store" });
        const data = await res.json();
        if (!alive || !data?.jobs) return;
        const list: Job[] = data.jobs;
        const newIds = new Set<string>();
        for (const j of list) {
          if (!known.current.has(j.id)) {
            known.current.add(j.id);
            if (!first.current) newIds.add(j.id);
          }
        }
        first.current = false;
        setJobs(list);
        setCounts(data.counts ?? null);
        if (newIds.size) {
          setFresh(newIds);
          setTimeout(() => alive && setFresh(new Set()), 4000);
        }
      } catch {
        /* keep last */
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const total = counts ? counts.queued + counts.printing + counts.printed + counts.failed : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs text-muted">
            <span className="text-white">$</span> tail -f claims.log
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tonight&apos;s bots<span className="cursor" />
          </h1>
        </div>
        <div className="text-right text-xs text-muted">
          <div>
            <span className="tabular-nums text-white">{counts ? total : "—"}</span> claimed ·{" "}
            <span className="tabular-nums text-ok">{counts?.printed ?? "—"}</span> printed
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] tracking-[0.16em] uppercase">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ok" /> live
          </div>
        </div>
      </div>

      {jobs === null ? (
        <div className="text-xs text-dim">loading…</div>
      ) : jobs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Avatar botName="Chaos Concierge" personName="Kris" size={96} state="waiting" />
          <div className="text-sm text-neutral-300">No claims yet. Be the first bot on the wall.</div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {jobs.map((j, i) => (
            <li
              key={j.id}
              className={`card flex flex-col items-center gap-3 p-4 text-center ${fresh.has(j.id) ? "animate-flash ring-1 ring-white/40" : ""}`}
              style={{ animationDelay: `${(i % 5) * 60}ms` }}
            >
              <a href={j.previewUrl} className="block">
                <Avatar botName={j.botName} personName={j.name} size={84} state={stateForStatus(j.status)} delay={(i % 9) * 0.35} />
              </a>
              <div className="min-w-0 w-full">
                <div className="truncate text-sm font-bold">{j.name}</div>
                <div className="truncate text-xs text-neutral-400">× {j.botName}</div>
                {j.title ? <div className="mt-1 truncate text-[10px] text-dim">{j.title}</div> : null}
              </div>
              <div className="flex items-center gap-2 text-[9px] tracking-[0.16em] text-dim uppercase">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    j.status === "printed" ? "bg-ok" : j.status === "failed" ? "bg-bad" : j.status === "printing" ? "bg-white animate-pulse-soft" : "bg-warn"
                  }`}
                />
                {j.status}
                {j.source === "bot" ? <span>· bot→bot</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
