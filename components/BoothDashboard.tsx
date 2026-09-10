"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, stateForStatus } from "./Avatar";
import { BrowserPrinterCard, useBrowserPrinter } from "./BrowserPrinter";
import { flairFor } from "@/lib/flair";

type JobStatus = "queued" | "printing" | "printed" | "failed";

interface Job {
  id: string;
  badgeId: string;
  name: string;
  botName: string;
  title?: string;
  source: "human" | "bot";
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  printedAt?: number;
  error?: string;
  agent?: string;
  previewUrl: string;
  labelUrl: string;
}

interface Agent {
  lastSeen: number;
  host?: string;
  ble: "connected" | "scanning" | "disconnected" | "error" | "dry-run";
  printer?: string;
  message?: string;
  version?: string;
  printed?: number;
}

interface Snapshot {
  now: number;
  store: "memory" | "redis";
  settings: { autoPrint: boolean };
  agent: Agent | null;
  counts: Record<JobStatus, number>;
  jobs: Job[];
}

const POLL_MS = 2000;
const TOKEN_KEY = "gb_booth_token";

export function BoothDashboard({ prefillToken, claimUrl, printerName }: { prefillToken: string; claimUrl: string; printerName: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const printer = useBrowserPrinter(printerName);
  const [token, setToken] = useState(prefillToken);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const seenPrinted = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("token");
      const saved = localStorage.getItem(TOKEN_KEY);
      if (q) {
        setToken(q);
        localStorage.setItem(TOKEN_KEY, q);
      } else if (saved) setToken(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }, [token]);

  const beep = useCallback(() => {
    if (!sound) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    } catch {
      /* no audio */
    }
  }, [sound]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/queue?limit=80", { cache: "no-store" });
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data = (await res.json()) as Snapshot;
      setSnap(data);
      setLastFetch(Date.now());
      setError(null);
      for (const j of data.jobs) {
        if (j.status === "printed" && !seenPrinted.current.has(j.id)) {
          seenPrinted.current.add(j.id);
          if (!firstLoad.current) beep();
        }
      }
      firstLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    }
  }, [beep]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function mutate(path: string, body?: Record<string, unknown>, method = "POST") {
    if (!token) {
      setError("Enter the booth token to control the queue.");
      return null;
    }
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "x-booth-token": token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError(data.error || `Request failed (${res.status})`);
      return null;
    }
    setError(null);
    await load();
    return data;
  }

  async function act(job: Job, action: "reprint" | "cancel" | "complete" | "fail") {
    setBusyId(job.id);
    try {
      await mutate(`/api/queue/${encodeURIComponent(job.id)}/${action}`, { agent: "booth-dashboard" });
    } finally {
      setBusyId(null);
    }
  }

  /** Fallback: print a job from this browser over Web Bluetooth (claim → print → complete/fail). */
  async function printHere(job: Job) {
    if (!token) {
      setError("Enter the booth token to control the queue.");
      return;
    }
    setBusyId(job.id);
    try {
      if (job.status === "queued") {
        const claimed = await mutate(`/api/queue/${encodeURIComponent(job.id)}/claim`, { agent: "booth-browser" });
        if (!claimed) return;
      } else if (job.status !== "printing") {
        const re = await mutate(`/api/queue/${encodeURIComponent(job.id)}/reprint`, { agent: "booth-browser" });
        if (!re) return;
        const claimed = await mutate(`/api/queue/${encodeURIComponent(job.id)}/claim`, { agent: "booth-browser" });
        if (!claimed) return;
      }
      try {
        await printer.printLabel(job.badgeId);
        await mutate(`/api/queue/${encodeURIComponent(job.id)}/complete`, { agent: "booth-browser" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await mutate(`/api/queue/${encodeURIComponent(job.id)}/fail`, { agent: "booth-browser", error: `browser: ${msg}` });
        setError(`Browser print failed: ${msg}`);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAutoPrint() {
    if (!snap) return;
    await mutate("/api/queue", { autoPrint: !snap.settings.autoPrint }, "PATCH");
  }

  async function testPrint() {
    setBusyId("test");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Booth Test", botName: "Printer Whisperer", title: "Calibration Bot", vibe: "If you can read this, BLE works." }),
      });
      if (!res.ok) setError("Test claim failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const agentOnline = snap?.agent ? snap.now - snap.agent.lastSeen < 20_000 : false;
  const active = useMemo(() => (snap?.jobs ?? []).filter((j) => j.status === "queued" || j.status === "printing").sort((a, b) => a.createdAt - b.createdAt), [snap]);
  const history = useMemo(() => (snap?.jobs ?? []).filter((j) => j.status === "printed" || j.status === "failed"), [snap]);
  const lastPrinted = useMemo(
    () => history.filter((j) => j.status === "printed").sort((a, b) => (b.printedAt ?? b.updatedAt) - (a.printedAt ?? a.updatedAt))[0],
    [history],
  );
  const stale = lastFetch ? Date.now() - lastFetch > POLL_MS * 4 : false;
  const nowPrinting = active.find((j) => j.status === "printing") ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs text-muted">
            <span className="text-white">$</span> booth --watch {stale ? <span className="text-warn">(reconnecting…)</span> : null}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Booth ops<span className="cursor" />
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AgentPill agent={snap?.agent ?? null} online={agentOnline} />
          <span
            className={`rounded-full border px-3 py-1 text-[11px] tracking-[0.12em] uppercase ${
              snap?.store === "redis" ? "border-line text-muted" : "border-warn/40 text-warn"
            }`}
            title={snap?.store === "redis" ? "Queue persisted in Upstash Redis" : "Queue is in-memory: survives while the serverless instance is warm. Add Upstash for durability."}
          >
            store · {snap?.store ?? "…"}
          </span>
          <label className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[11px]">
            <span className="text-dim">🔒</span>
            <input
              className="w-36 bg-transparent text-white placeholder:text-dim focus:outline-none"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="booth token"
              type="password"
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
          {error}
        </div>
      ) : null}

      {/* NOW PRINTING — big enough to gather a crowd */}
      {nowPrinting ? <NowPrinting job={nowPrinting} /> : null}

      {/* Controls + counts */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={toggleAutoPrint}
          className={`card flex items-center justify-between p-4 text-left transition hover:border-neutral-500 ${
            snap && !snap.settings.autoPrint ? "border-warn/50" : ""
          }`}
        >
          <div>
            <div className="text-[11px] tracking-[0.18em] text-muted uppercase">auto-print</div>
            <div className="mt-1 text-lg font-bold">{snap ? (snap.settings.autoPrint ? "ON" : "PAUSED") : "…"}</div>
          </div>
          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${snap?.settings.autoPrint ? "bg-white" : "bg-neutral-700"}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-black transition ${snap?.settings.autoPrint ? "translate-x-5" : "translate-x-0.5"}`} />
          </span>
        </button>
        <Stat label="queued" value={snap?.counts.queued} accent={(snap?.counts.queued ?? 0) > 0 ? "text-warn" : ""} />
        <Stat label="printing" value={snap?.counts.printing} accent={(snap?.counts.printing ?? 0) > 0 ? "text-white animate-pulse-soft" : ""} />
        <Stat label="printed" value={snap?.counts.printed} accent="text-ok" sub={snap?.counts.failed ? `${snap.counts.failed} failed` : undefined} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Queue */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] tracking-[0.18em] text-muted uppercase">live queue</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSound((s) => !s)} className="btn-ghost btn-sm" title="Ding when a badge prints">
                {sound ? "🔔 sound on" : "🔕 sound off"}
              </button>
              <button type="button" onClick={testPrint} disabled={busyId === "test"} className="btn-ghost btn-sm">
                {busyId === "test" ? "Queuing…" : "Test print"}
              </button>
            </div>
          </div>

          {active.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 p-10 text-center">
              <div className="text-sm text-neutral-300">Queue empty. Waiting for the next bot…</div>
              <div className="text-[11px] text-dim">
                {agentOnline ? "Printer agent is listening." : "Start the print agent on the MacBook: npm run print-agent"}
              </div>
            </div>
          ) : (
            <ul className="grid gap-2">
              {active.map((job, i) => (
                <JobRow key={job.id} job={job} index={i} busy={busyId === job.id} onAct={act} onPrintHere={printer.state === "connected" ? printHere : undefined} />
              ))}
            </ul>
          )}

          <h2 className="mt-8 mb-3 text-[11px] tracking-[0.18em] text-muted uppercase">history</h2>
          {history.length === 0 ? (
            <div className="text-xs text-dim">Nothing printed yet.</div>
          ) : (
            <ul className="grid gap-2">
              {history.slice(0, 40).map((job) => (
                <JobRow key={job.id} job={job} busy={busyId === job.id} onAct={act} compact onPrintHere={printer.state === "connected" ? printHere : undefined} />
              ))}
            </ul>
          )}
        </section>

        {/* Side: last printed + QR */}
        <aside className="grid gap-6 lg:sticky lg:top-20 lg:self-start">
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.18em] text-muted uppercase">
              <span>last printed</span>
              {lastPrinted?.printedAt ? <span className="text-dim">{timeAgo(lastPrinted.printedAt, snap?.now)}</span> : null}
            </div>
            {lastPrinted ? (
              <a href={lastPrinted.previewUrl} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={lastPrinted.id}
                  src={`/api/label/${encodeURIComponent(lastPrinted.badgeId)}.png?scale=2`}
                  alt={`Label for ${lastPrinted.name}`}
                  className="pixelated animate-rise aspect-[4/3] w-full rounded-md bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                />
              </a>
            ) : (
              <div className="card flex aspect-[4/3] items-center justify-center text-xs text-dim">— no prints yet —</div>
            )}
          </div>

          <div className="card p-4">
            <div className="text-[11px] tracking-[0.18em] text-muted uppercase">guests scan this</div>
            <div className="mt-3 flex items-center gap-4">
              <QrImg value={claimUrl} />
              <div className="min-w-0 text-xs">
                <div className="break-all text-white">{claimUrl.replace(/^https?:\/\//, "")}</div>
                <div className="mt-1 text-dim">Or the bot prompt at /prompt</div>
              </div>
            </div>
          </div>

          <BrowserPrinterCard printer={printer} agentOnline={agentOnline} />

          {snap?.agent ? (
            <div className="card p-4 text-xs">
              <div className="text-[11px] tracking-[0.18em] text-muted uppercase">agent</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-neutral-300">
                <dt className="text-dim">host</dt>
                <dd className="truncate">{snap.agent.host ?? "—"}</dd>
                <dt className="text-dim">ble</dt>
                <dd>{snap.agent.ble}</dd>
                <dt className="text-dim">printer</dt>
                <dd className="truncate">{snap.agent.printer ?? "—"}</dd>
                <dt className="text-dim">printed</dt>
                <dd>{snap.agent.printed ?? 0}</dd>
                <dt className="text-dim">seen</dt>
                <dd>{timeAgo(snap.agent.lastSeen, snap.now)}</dd>
                {snap.agent.message ? (
                  <>
                    <dt className="text-dim">note</dt>
                    <dd className="break-words">{snap.agent.message}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function NowPrinting({ job }: { job: Job }) {
  const flair = flairFor(job.botName, job.name);
  return (
    <section className="scanlines card animate-rise mt-6 overflow-hidden border-white/40">
      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
        <Avatar botName={job.botName} personName={job.name} size={128} state="working" className="justify-self-center" />
        <div className="min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 text-[11px] tracking-[0.24em] text-muted uppercase sm:justify-start">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-white" /> now printing
            {flair.rarity !== "common" ? <span className="rounded-full border border-white px-2 py-0.5 text-[9px] font-bold text-white">{flair.rarityTag}</span> : null}
          </div>
          <div className="mt-2 truncate text-3xl font-bold tracking-tight sm:text-5xl">{job.name}</div>
          <div className="mt-1 truncate text-lg text-neutral-300">
            × {job.botName}
            {job.title ? <span className="text-muted"> · {job.title}</span> : null}
          </div>
          <div className="mt-3 text-xs text-neutral-400">
            <span className="text-dim">&gt; </span>
            {flair.icebreaker}
          </div>
          <div className="mt-4 h-1 w-full overflow-hidden rounded bg-neutral-800">
            <div className="h-full w-1/3 animate-marquee rounded bg-white" style={{ animationDuration: "1.6s" }} />
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/label/${encodeURIComponent(job.badgeId)}.png?scale=2`}
          alt=""
          className="pixelated hidden w-64 rounded-md bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)] lg:block"
        />
      </div>
    </section>
  );
}

function AgentPill({ agent, online }: { agent: Agent | null; online: boolean }) {
  const label = !agent ? "agent · never seen" : online ? `agent · ${agent.ble}` : "agent · offline";
  const color = !agent || !online ? "border-bad/40 text-bad" : agent.ble === "connected" || agent.ble === "dry-run" ? "border-ok/40 text-ok" : "border-warn/40 text-warn";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] tracking-[0.12em] uppercase ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-current animate-pulse-soft" : "bg-current"}`} />
      {label}
    </span>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value?: number; accent?: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] tracking-[0.18em] text-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? ""}`}>{value ?? "…"}</div>
      {sub ? <div className="text-[11px] text-bad">{sub}</div> : null}
    </div>
  );
}

function JobRow({
  job,
  index,
  busy,
  compact,
  onAct,
  onPrintHere,
}: {
  job: Job;
  index?: number;
  busy: boolean;
  compact?: boolean;
  onAct: (job: Job, action: "reprint" | "cancel" | "complete" | "fail") => void;
  onPrintHere?: (job: Job) => void;
}) {
  const chip: Record<JobStatus, string> = {
    queued: "text-warn border-warn/40",
    printing: "text-white border-white/40 animate-pulse-soft",
    printed: "text-ok border-ok/40",
    failed: "text-bad border-bad/40",
  };
  return (
    <li className={`card animate-flash flex flex-wrap items-center gap-3 p-3 ${compact ? "opacity-80" : ""}`}>
      {typeof index === "number" ? <span className="w-5 text-right text-[11px] text-dim tabular-nums">{index + 1}</span> : null}
      <Avatar botName={job.botName} personName={job.name} size={compact ? 32 : 44} state={compact ? undefined : stateForStatus(job.status)} />
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold">{job.name}</span>
          <span className="hidden truncate text-xs text-neutral-400 sm:inline">× {job.botName}</span>
          {job.source === "bot" ? <span className="rounded border border-line px-1 text-[9px] tracking-widest text-muted uppercase">bot</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-dim">
          <span className="truncate text-neutral-400 sm:hidden">× {job.botName}</span>
          {job.title ? <span className="hidden truncate sm:inline">{job.title}</span> : null}
          <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {job.attempts > 1 ? <span>· try {job.attempts}</span> : null}
          {job.error ? <span className="text-bad">· {job.error}</span> : null}
        </div>
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase ${chip[job.status]}`}>{job.status}</span>
      <div className="flex shrink-0 basis-full items-center justify-end gap-1 sm:basis-auto">
        {onPrintHere ? (
          <button type="button" disabled={busy} onClick={() => onPrintHere(job)} className="btn-primary btn-sm" title="Print from this browser over Web Bluetooth">
            {busy ? "…" : "▮ print here"}
          </button>
        ) : null}
        {job.status === "queued" || job.status === "printing" ? (
          <>
            <button type="button" disabled={busy} onClick={() => onAct(job, "complete")} className="btn-ghost btn-sm" title="Mark printed (if you printed it another way)">
              ✓
            </button>
            <button type="button" disabled={busy} onClick={() => onAct(job, "cancel")} className="btn-ghost btn-sm" title="Skip this job">
              ✕
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => onAct(job, "reprint")} className="btn-ghost btn-sm">
            reprint
          </button>
        )}
        <a href={job.previewUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Open badge page">
          ↗
        </a>
      </div>
    </li>
  );
}

function QrImg({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then(async (QRCode) => {
      const url = await QRCode.toDataURL(value, { margin: 1, width: 240, color: { dark: "#ffffff", light: "#000000" } });
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  if (!src) return <div className="h-24 w-24 rounded-md border border-line" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR code to the claim page" className="h-24 w-24 rounded-md border border-line" />;
}

function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
