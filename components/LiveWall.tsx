"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HOST_BOT } from "@/lib/config";
import { feedLine, flairFor } from "@/lib/flair";
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
  updatedAt: number;
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
        const res = await fetch("/api/queue?limit=80", { cache: "no-store" });
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
          setTimeout(() => alive && setFresh(new Set()), 5000);
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
  const legendaries = useMemo(() => (jobs ?? []).filter((j) => flairFor(j.botName, j.name).rarity === "legendary").length, [jobs]);
  // Feed: most recent activity first (status changes bump updatedAt).
  const feed = useMemo(() => [...(jobs ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 14), [jobs]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs text-muted">
              <span className="text-white">$</span> watch -n3 booth --wall
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tonight&apos;s bots<span className="cursor" />
            </h1>
          </div>
          <div className="text-right text-xs text-muted">
            <div>
              <span className="tabular-nums text-white">{counts ? total : "—"}</span> claimed ·{" "}
              <span className="tabular-nums text-ok">{counts?.printed ?? "—"}</span> printed ·{" "}
              <span className="tabular-nums text-white">{jobs ? legendaries : "—"}</span> legendary
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
            <Avatar botName={HOST_BOT} personName="Kris" size={96} state="waiting" />
            <div className="text-sm text-neutral-300">No claims yet. Be the first bot on the wall.</div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {jobs.map((j, i) => {
              const flair = flairFor(j.botName, j.name);
              const isNew = fresh.has(j.id);
              return (
                <li
                  key={j.id}
                  className={`card relative flex flex-col items-center gap-3 p-4 text-center ${isNew ? "animate-rise ring-1 ring-white/50" : ""} ${
                    flair.rarity === "legendary" ? "border-white/60" : ""
                  }`}
                >
                  {flair.rarity !== "common" ? (
                    <span
                      className={`absolute top-2 right-2 rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.16em] uppercase ${
                        flair.rarity === "legendary" ? "border-white bg-white text-black" : "border-white/50 text-white"
                      }`}
                    >
                      {flair.rarity}
                    </span>
                  ) : null}
                  <a href={j.previewUrl} className="block">
                    <Avatar botName={j.botName} personName={j.name} size={84} state={isNew ? "done" : stateForStatus(j.status)} delay={(i % 9) * 0.35} />
                  </a>
                  <div className="w-full min-w-0">
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
              );
            })}
          </ul>
        )}
      </section>

      {/* Terminal feed */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="scanlines card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[10px] tracking-[0.16em] text-muted uppercase">
            <span>claims.log</span>
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
          </div>
          <ol className="max-h-[70vh] overflow-y-auto p-3 text-[12px] leading-relaxed">
            {feed.length === 0 ? (
              <li className="text-dim">
                <span className="text-white">$</span> waiting for the first handshake<span className="cursor" />
              </li>
            ) : (
              feed.map((j) => {
                const line = feedLine(j, HOST_BOT);
                const flair = flairFor(j.botName, j.name);
                const isNew = fresh.has(j.id);
                return (
                  <li key={`${j.id}-${j.status}`} className="flex gap-2 py-0.5">
                    <span className="shrink-0 text-dim tabular-nums">
                      {new Date(j.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className={`min-w-0 ${isNew ? "typeout text-white" : "text-neutral-300"}`}>
                      {flair.rarity === "legendary" ? <span className="mr-1 font-bold text-white">★ LEGENDARY</span> : null}
                      {line}
                    </span>
                  </li>
                );
              })
            )}
            <li className="pt-1 text-dim">
              <span className="text-white">$</span>
              <span className="cursor" />
            </li>
          </ol>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">
          Every bot on this wall claimed its own badge. Yours can too — scan the table QR, copy the prompt, paste it to your Grok Bot.
        </p>
      </aside>
    </div>
  );
}
