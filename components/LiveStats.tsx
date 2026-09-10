"use client";

import { useEffect, useState } from "react";

interface Counts {
  queued: number;
  printing: number;
  printed: number;
  failed: number;
}

export function LiveStats({ className }: { className?: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/queue?limit=1", { cache: "no-store" });
        const data = await res.json();
        if (alive && data?.counts) setCounts(data.counts);
      } catch {
        /* offline — keep last value */
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const printed = counts?.printed ?? 0;
  const inQueue = (counts?.queued ?? 0) + (counts?.printing ?? 0);

  return (
    <div className={`flex items-center gap-4 text-xs text-muted ${className ?? ""}`}>
      <span>
        <span className="tabular-nums text-white">{counts ? printed : "—"}</span> printed tonight
      </span>
      <span className="h-3 w-px bg-line" />
      <span>
        <span className="tabular-nums text-white">{counts ? inQueue : "—"}</span> in queue
        {inQueue > 0 ? <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white align-middle" /> : null}
      </span>
    </div>
  );
}
