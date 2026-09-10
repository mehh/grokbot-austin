import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveAvatar } from "@/components/LiveAvatar";
import { BadgeActions } from "@/components/BadgeActions";
import { PrintStatus } from "@/components/PrintStatus";
import { ShareX } from "@/components/ShareX";
import { shareText } from "@/lib/share";
import { SparkBurst } from "@/components/SparkBurst";
import { flairFor } from "@/lib/flair";
import { avatarDescription, avatarSpec } from "@/lib/avatar";
import { badgeUrls, decodeBadge } from "@/lib/badge";
import { EVENT, HOST_BOT } from "@/lib/config";
import { shortCode } from "@/lib/label";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const badge = decodeBadge(decodeURIComponent(id));
  if (!badge) return { title: "Badge not found" };
  const { labelUrl } = badgeUrls(badge.id);
  return {
    title: `${badge.name} × ${badge.botName}`,
    description: badge.title ? `${badge.botName}, ${badge.title}` : `${badge.botName} — Grok Bot Austin badge`,
    openGraph: { images: [{ url: `${labelUrl}?scale=3`, width: 960, height: 480 }] },
  };
}

export default async function BadgePage({ params, searchParams }: { params: Params; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const badge = decodeBadge(decodeURIComponent(id));
  if (!badge) notFound();
  const { previewUrl } = badgeUrls(badge.id);
  const labelPath = `/api/label/${encodeURIComponent(badge.id)}.png`;
  const spec = avatarSpec(badge.botName, badge.name);
  const flair = flairFor(badge.botName, badge.name);
  const isNew = sp?.new === "1";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:pt-12">
      {isNew ? (
        <>
          <SparkBurst count={flair.rarity === "legendary" ? 60 : 30} />
          <div className="mb-6 animate-rise rounded-md border border-white/20 bg-white/5 px-4 py-3 text-sm">
            <span className="font-bold">Claimed.</span> Your badge is in the print queue. At the event: grab it at the booth. Remote: you're done.
            {flair.rarity === "legendary" ? <span className="ml-2 font-bold">You pulled a LEGENDARY. Tell everyone.</span> : null}
          </div>
        </>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        {/* Hero card */}
        <section className="animate-rise">
          <p className="mb-3 text-xs text-muted">
            <span className="text-white">$</span> badge --id {shortCode(badge.id)} {badge.source === "bot" ? "--claimed-by bot" : ""}
          </p>
          <div className="card relative overflow-hidden p-6 sm:p-8">
            <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <LiveAvatar
                botName={badge.botName}
                personName={badge.name}
                size={168}
                className="shrink-0 self-center sm:self-start"
                initialStatus={isNew ? "queued" : "loading"}
              />
              <div className="min-w-0">
                <div className="mb-2">
                  <RarityChip rarity={flair.rarity} tag={flair.rarityTag} />
                </div>
                <h1 className="text-3xl leading-tight font-bold tracking-tight break-words sm:text-5xl">{badge.name}</h1>
                <div className="mt-3 text-[11px] tracking-[0.2em] text-muted uppercase">Grok Bot ▸</div>
                <div className="text-xl font-bold break-words sm:text-2xl">{badge.botName}</div>
                {badge.title ? <div className="mt-1 text-sm text-neutral-300">{badge.title}</div> : null}
                {badge.vibe ? <p className="mt-3 text-sm leading-relaxed text-neutral-400">{badge.vibe}</p> : null}
              </div>
            </div>
            <p className="relative mt-6 rounded-md border border-dashed border-white/25 px-3 py-2 text-sm text-neutral-100">
              <span className="text-dim">&gt; </span>
              {flair.icebreaker}
              <span className="ml-2 text-[10px] tracking-[0.16em] text-dim uppercase">icebreaker · printed on your badge</span>
            </p>
            {badge.quote ? (
              <blockquote className="relative mt-6 border-l-2 border-white/30 pl-4 text-sm leading-relaxed text-neutral-200 italic">
                “{badge.quote}”
              </blockquote>
            ) : null}
            {badge.handshake ? (
              <p className="relative mt-4 text-xs text-neutral-400">
                <span className="text-dim">→ {HOST_BOT}:</span> {badge.handshake}
              </p>
            ) : null}
            <div className="relative mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] tracking-[0.16em] text-dim uppercase">
              <span>{EVENT.tag}</span>
              <span>·</span>
              <span>{avatarDescription(spec)}</span>
              {badge.source === "bot" ? (
                <>
                  <span>·</span>
                  <span className="text-white">bot→bot</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <BadgeActions badge={badge} labelUrl={labelPath} previewUrl={previewUrl} />
          </div>
          <div className="mt-6">
            <ShareX text={shareText(flair.rarity, badge.botName)} url={previewUrl} />
          </div>
        </section>

        {/* Print column */}
        <aside className="grid gap-4 lg:sticky lg:top-20">
          <PrintStatus badgeId={badge.id} initial={isNew ? "queued" : undefined} />
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.18em] text-muted uppercase">
              <span>what the printer sees</span>
              <span className="text-dim">320×160 · 1-bit</span>
            </div>
            {/* Actual rendered PNG so the preview is exactly what prints */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${labelPath}?scale=2`}
              alt={`Label for ${badge.name} and ${badge.botName}`}
              width={640}
              height={480}
              className="pixelated aspect-[4/3] w-full rounded-md bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
            />
          </div>
          <Link href="/claim" className="btn-ghost">
            Claim another →
          </Link>
        </aside>
      </div>
    </div>
  );
}

function RarityChip({ rarity, tag }: { rarity: string; tag: string }) {
  const cls =
    rarity === "legendary"
      ? "border-white bg-white text-black animate-pulse-soft"
      : rarity === "rare"
        ? "border-white/60 text-white"
        : "border-line text-muted";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.2em] uppercase ${cls}`}>{tag}</span>;
}
