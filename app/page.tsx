import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LiveStats } from "@/components/LiveStats";
import { QR } from "@/components/QR";
import { baseUrl, EVENT } from "@/lib/config";

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
  const claimUrl = `${origin}/claim`;

  return (
    <div className="relative">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[60vh]" aria-hidden />

      <section className="relative mx-auto grid w-full max-w-5xl gap-10 px-4 pt-14 pb-10 sm:pt-20 lg:grid-cols-[1fr_auto] lg:items-center">
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
            Tonight&apos;s badge booth prints a thermal label for <em className="text-white not-italic">you and your Grok Bot</em>.
            Fill in two names, or hand your bot a prompt and let it claim the badge for you. A printer at the table does the
            rest — peel, stick on your laptop, take the photo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/claim" className="btn-primary text-base">
              Claim a badge →
            </Link>
            <Link href="/prompt" className="btn-ghost text-base">
              Send your bot instead
            </Link>
          </div>
          <LiveStats className="mt-6" />
        </div>

        <div className="hidden justify-self-end lg:block">
          <QR value={claimUrl} size={180} caption="scan → claim" />
        </div>
      </section>

      {/* Avatar parade */}
      <section aria-label="Sample bots" className="relative border-y border-line bg-panel py-6">
        <div className="mx-auto max-w-5xl overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 px-4 hover:[animation-play-state:paused]">
            {[...SAMPLE_BOTS, ...SAMPLE_BOTS].map(([bot, human], i) => (
              <div key={`${bot}-${i}`} className="flex flex-col items-center gap-2">
                <Avatar botName={bot} personName={human} size={72} />
                <div className="text-center">
                  <div className="text-xs font-bold">{bot}</div>
                  <div className="text-[10px] text-muted">w/ {human}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-12 sm:grid-cols-3">
        <Step
          n="01"
          title="Claim"
          body={
            <>
              Type your name + your bot&apos;s name at <Link href="/claim" className="underline underline-offset-2">/claim</Link>, or
              paste the <Link href="/prompt" className="underline underline-offset-2">bot prompt</Link> into Grok and let it POST the
              claim itself.
            </>
          }
        />
        <Step
          n="02"
          title="Queue → print"
          body="Your badge lands in the live print queue. A Phomemo M110 at the booth picks it up automatically. Watch the status flip to printed on your preview page."
        />
        <Step
          n="03"
          title="Peel · stick · post"
          body="40×30mm, one-bit, high contrast. Looks right on a laptop lid or a shirt. Your bot is generated from your names — same names, same bot, every time."
        />
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 lg:hidden">
        <div className="card flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs tracking-[0.18em] text-muted uppercase">Share the booth</div>
            <div className="mt-1 text-sm break-all">{origin.replace(/^https?:\/\//, "")}</div>
          </div>
          <QR value={claimUrl} size={96} />
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] tracking-[0.2em] text-dim">{n}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-neutral-400">{body}</p>
    </div>
  );
}
