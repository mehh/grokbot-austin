"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Badge } from "@/lib/badge";

export function BadgeActions({ badge, labelUrl, previewUrl }: { badge: Badge; labelUrl: string; previewUrl: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function share() {
    try {
      await navigator.share({ title: `${badge.name} × ${badge.botName}`, text: "My Grok Bot badge from Austin", url: previewUrl });
    } catch {
      /* dismissed */
    }
  }

  async function printAgain() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: badge.name,
          botName: badge.botName,
          title: badge.title,
          vibe: badge.vibe,
          quote: badge.quote,
          handshake: badge.handshake,
          source: badge.source,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not re-queue");
      router.push(`/b/${encodeURIComponent(data.id)}?new=1`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not re-queue");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`${labelUrl}?download=1`} className="btn-ghost btn-sm" download>
        ↓ Label PNG
      </a>
      {canShare ? (
        <button type="button" onClick={share} className="btn-ghost btn-sm">
          Share
        </button>
      ) : null}
      <button type="button" onClick={printAgain} disabled={busy} className="btn-ghost btn-sm">
        {busy ? "Queuing…" : "Print again"}
      </button>
      {msg ? <span className="self-center text-[11px] text-bad">{msg}</span> : null}
    </div>
  );
}
