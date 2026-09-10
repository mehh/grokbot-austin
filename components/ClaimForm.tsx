"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Badge } from "@/lib/badge";
import { avatarDescription, avatarSpec } from "@/lib/avatar";
import { HOST_BOT, LIMITS } from "@/lib/config";
import { flairFor } from "@/lib/flair";
import { Avatar } from "./Avatar";
import { LabelPreview } from "./LabelPreview";

const PLACEHOLDER_BOTS = ["Chaos Concierge", "Pipeline Pete", "Quota", "Nudge", "Deck Doctor", "Sprocket", "Cold Open"];
const PLACEHOLDER_TITLES = ["Chaos Concierge", "VP of Follow-Ups", "Chief Vibes Officer", "Head of Cold Opens", "Roadmap Whisperer"];

export function ClaimForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [botName, setBotName] = useState("");
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState("");
  const [quote, setQuote] = useState("");
  const [handshake, setHandshake] = useState("");
  const [website, setWebsite] = useState("");
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [typingUntil, setTypingUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 2600);
    return () => clearInterval(t);
  }, []);

  // Cheap "am I typing?" clock for the avatar's thinking state.
  useEffect(() => {
    if (!typingUntil) return;
    const t = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(t);
  }, [typingUntil]);
  const typing = typingUntil > (now || Date.now());
  const botState = busy ? "working" : typing ? "thinking" : "idle";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gb_name");
      if (saved) setName(saved);
    } catch {
      /* private mode */
    }
  }, []);

  const preview: Badge = useMemo(
    () => ({
      id: "preview.LIVE",
      name: name.trim() || "YOUR NAME",
      botName: botName.trim() || "your bot",
      title: title.trim() || vibe.trim() || undefined,
      vibe: vibe.trim() || undefined,
      quote: quote.trim() || undefined,
      handshake: handshake.trim() || undefined,
      source: "human",
      createdAt: 0,
    }),
    [name, botName, title, vibe, quote, handshake],
  );

  const spec = avatarSpec(preview.botName, preview.name);
  const flair = flairFor(preview.botName, preview.name);
  const ready = name.trim().length > 0 && botName.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem("gb_name", name.trim());
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personName: name, botName, botTitle: title, vibe, quote, handshake, website, source: "human" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Claim failed (${res.status})`);
      if (sound) click();
      router.push(`/b/${encodeURIComponent(data.id)}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Preview */}
      <div className="order-first lg:order-last lg:sticky lg:top-20">
        <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.18em] text-muted uppercase">
          <span>live label · 40×20mm</span>
          <span className="text-dim">updates as you type</span>
        </div>
        <LabelPreview badge={preview} />
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
          <Avatar botName={preview.botName} personName={preview.name} size={28} state={botState} />
          <span className="truncate">{avatarDescription(spec)}</span>
          {ready ? (
            <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] uppercase ${
              flair.rarity === "legendary" ? "border-white bg-white text-black" : flair.rarity === "rare" ? "border-white/60 text-white" : "border-line text-dim"
            }`}>
              {flair.rarity}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-dim">
          Your bot is derived from both names. Same names → same bot, every time. Want a different look? Try a nickname.
        </p>
      </div>

      {/* Fields */}
      <div className="grid gap-5" onInput={() => setTypingUntil(Date.now() + 1500)}>
        <Field label="Your name" hint="required" count={name.length} max={LIMITS.name}>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, LIMITS.name))}
            placeholder="Kris"
            autoComplete="given-name"
            autoFocus
            required
          />
        </Field>

        <Field label="Your Grok Bot's name" hint="required" count={botName.length} max={LIMITS.botName}>
          <input
            className="field"
            value={botName}
            onChange={(e) => setBotName(e.target.value.slice(0, LIMITS.botName))}
            placeholder={PLACEHOLDER_BOTS[tick % PLACEHOLDER_BOTS.length]}
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Bot title / role" hint="optional" count={title.length} max={LIMITS.title}>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
            placeholder={PLACEHOLDER_TITLES[tick % PLACEHOLDER_TITLES.length]}
            autoComplete="off"
          />
        </Field>

        <Field label="One-line vibe · what it does" hint="optional" count={vibe.length} max={LIMITS.vibe}>
          <input
            className="field"
            value={vibe}
            onChange={(e) => setVibe(e.target.value.slice(0, LIMITS.vibe))}
            placeholder="Turns Slack threads into shipped things"
            autoComplete="off"
          />
        </Field>

        <Field label="Prompt it used · or a fun quote" hint="optional · shows on your badge page" count={quote.length} max={LIMITS.quote}>
          <textarea
            className="field min-h-[72px] resize-y"
            value={quote}
            onChange={(e) => setQuote(e.target.value.slice(0, LIMITS.quote))}
            placeholder="“Book the demo, skip the pleasantries.”"
          />
        </Field>

        <Field label={`Handshake to ${HOST_BOT}`} hint="optional · printed on the label footer" count={handshake.length} max={LIMITS.handshake}>
          <input
            className="field"
            value={handshake}
            onChange={(e) => setHandshake(e.target.value.slice(0, LIMITS.handshake))}
            placeholder="Your calendar is safe with me."
            autoComplete="off"
          />
        </Field>

        {/* Honeypot — real humans never see this */}
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label>
            Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        {error ? (
          <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={!ready || busy} className="btn-primary text-base sm:min-w-[220px]">
            {busy ? (
              <>
                <span className="animate-pulse-soft">▮</span> Sending to printer…
              </>
            ) : (
              "Print my badge →"
            )}
          </button>
          <span className="text-[11px] text-dim">Queues instantly. The booth printer picks it up in a few seconds.</span>
          <button type="button" onClick={() => setSound((v) => !v)} className="text-[11px] text-dim hover:text-white sm:ml-auto" title="Soft click on claim">
            {sound ? "🔈 click on" : "🔇 click off"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Soft mechanical click, WebAudio only, never autoplayed. */
function click() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(1800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  } catch {
    /* no audio */
  }
}

function Field({
  label,
  hint,
  count,
  max,
  children,
}: {
  label: string;
  hint?: string;
  count: number;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label">{label}</label>
        <span className="text-[10px] text-dim">
          {hint ? <span className="mr-2">{hint}</span> : null}
          <span className={count > max * 0.9 ? "text-warn" : ""}>
            {count}/{max}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}
