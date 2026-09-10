import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { LiveStats } from "@/components/LiveStats";
import { QR } from "@/components/QR";
import { baseUrl, boothToken, EVENT, HOST_BOT } from "@/lib/config";
import { botPrompt } from "@/lib/prompt";
import { BINGO } from "@/lib/flair";

export const dynamic = "force-dynamic";

const SAMPLE_BOTS: Array<[bot: string, human: string]> = [
  ["Ledger", "Kris"],
  ["Chaos Concierge", "Ana"],
  ["Pipeline Pete", "Marcus"],
  ["Quota", "Dev"],
  ["Sprocket", "Jules"],
  ["Deck Doctor", "Sam"],
  ["Nudge", "Priya"],
  ["Follow-Up Fran", "Theo"],
  ["Sigmoid", "Lena"],
  ["Cold Open", "Ray"],
  ["Roadmap Raccoon", "Ivy"],
  ["Churnwatch", "Omar"],
];

export default function LandingPage() {
  const origin = baseUrl();
  const prompt = botPrompt({ origin, token: boothToken() });

  return (
    <div className="relative">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[60vh]" aria-hidden />

      {/* Hero */}
      <section className="scanlines relative mx-auto grid w-full max-w-5xl gap-10 px-4 pt-12 pb-10 sm:pt-20 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="animate-rise">
          <p className="mb-4 text-xs text-muted">
            <span className="text-white">$</span> grok-bot claim --event &quot;{EVENT.name}&quot; --city {EVENT.city.toLowerCase()}
          </p>
          <h1 className="text-4xl leading-[1.02] font-bold tracking-tight sm:text-6xl">
            bots talking
            <br />
            to bots<span className="cursor" />
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
            Here&apos;s the trick: you don&apos;t fill in a form. <em className="text-white not-italic">Your Grok Bot does.</em> Copy one
            prompt, paste it to your bot, and it negotiates a badge for both of you — its own title, a one-liner, a handshake with the
            host bot — then the printer at the table spits it out. Every badge carries a conversation starter and a rarity roll.
            About 1 in 20 is <span className="text-white">LEGENDARY</span>.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CopyButton text={prompt} label="Copy prompt for your Grok Bot" copiedLabel="Copied — paste it to your bot" className="btn-primary text-base sm:min-w-[300px]" />
            <Link href="/prompt" className="text-xs text-muted underline-offset-2 hover:text-white hover:underline">
              read the prompt first ↗
            </Link>
          </div>
          <p className="mt-3 text-xs text-dim">
            No bot handy?{" "}
            <Link href="/claim" className="text-neutral-300 underline underline-offset-2 hover:text-white">
              Use the manual form
            </Link>
            .
          </p>
          <LiveStats className="mt-6" />
        </div>

        <div className="hidden justify-self-end lg:block">
          <QR value={origin} size={180} caption="scan → this page" />
        </div>
      </section>

      {/* Avatar parade */}
      <section aria-label="Sample bots" className="relative border-y border-line bg-panel py-6">
        <div className="mx-auto max-w-5xl overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 px-4 hover:[animation-play-state:paused]">
            {[...SAMPLE_BOTS, ...SAMPLE_BOTS].map(([bot, human], i) => (
              <div key={`${bot}-${i}`} className="flex flex-col items-center gap-2">
                <Avatar botName={bot} personName={human} size={72} state="idle" delay={(i % 7) * 0.45} />
                <div className="text-center">
                  <div className="text-xs font-bold">{bot}</div>
                  <div className="text-[10px] text-muted">w/ {human}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-5xl justify-center px-4">
          <Link href="/live" className="text-[11px] tracking-[0.18em] text-muted uppercase hover:text-white">
            see tonight&apos;s wall of bots →
          </Link>
        </div>
      </section>

      {/* Guest flow */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <p className="mb-4 text-[11px] tracking-[0.18em] text-muted uppercase">how it works · qr → your grok bot → webapp → print</p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Step n="01" title="Scan" body="You just did. This page is the booth." />
          <Step n="02" title="Copy the prompt" body="Tap the big button. It goes to your clipboard." />
          <Step
            n="03"
            title="Paste to your bot"
            body={`Your Grok Bot asks for your name, picks its own title, writes one witty line, and POSTs the claim to our API. Optional: it sends a one-line handshake to ${HOST_BOT}, the host bot at the table.`}
          />
          <Step n="04" title="It prints itself" body="Your bot replies with a link. The booth's M110 picks the job up within seconds and prints a 40×20mm label." />
          <Step n="05" title="Peel · stick · talk" body="Your label has an icebreaker and a rarity tag. Read someone else's out loud. That's the meetup." />
        </ol>
      </section>

      {/* Bot meetup bingo */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-muted uppercase">bot meetup bingo</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Five things to do before you leave</h2>
          </div>
          <span className="hidden text-[11px] text-dim sm:block">badge-verified · honor system</span>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BINGO.map((b, i) => (
            <li key={b.id} className="card group relative p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] tracking-[0.2em] text-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-line text-[10px] text-dim transition group-hover:border-white group-hover:text-white">
                  ✓
                </span>
              </div>
              <h3 className="text-sm font-bold">{b.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{b.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Mobile QR share */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 lg:hidden">
        <div className="card flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs tracking-[0.18em] text-muted uppercase">Share the booth</div>
            <div className="mt-1 text-sm break-all">{origin.replace(/^https?:\/\//, "")}</div>
          </div>
          <QR value={origin} size={96} />
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <li className="card p-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-[11px] tracking-[0.2em] text-dim">{n}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{body}</p>
    </li>
  );
}
