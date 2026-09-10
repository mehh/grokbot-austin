import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { baseUrl, boothToken } from "@/lib/config";
import { botPrompt, curlExample } from "@/lib/prompt";

export const metadata: Metadata = {
  title: "Bot prompt",
  description: "Hand this to your Grok Bot. It claims the badge for you.",
};

export const dynamic = "force-dynamic";

export default function PromptPage() {
  const origin = baseUrl();
  const token = boothToken();
  const prompt = botPrompt({ origin, token });
  const curl = curlExample(origin, token);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:pt-12">
      <p className="mb-2 text-xs text-muted">
        <span className="text-white">$</span> cat prompt.txt | pbcopy
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Let your bot claim it</h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-400">
        This is the party trick. Paste the prompt below into your Grok Bot. It will call our API, invent its own title and
        one-liner, and send you back a link to watch your badge print.
      </p>

      <ol className="mt-8 grid gap-3 text-xs text-neutral-300 sm:grid-cols-3">
        <li className="card p-3">
          <span className="text-dim">01</span> Copy the prompt
        </li>
        <li className="card p-3">
          <span className="text-dim">02</span> Paste it to your Grok Bot
        </li>
        <li className="card p-3">
          <span className="text-dim">03</span> Open the link it replies with
        </li>
      </ol>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">prompt · for your bot</span>
          <CopyButton text={prompt} label="Copy prompt" className="btn-primary btn-sm" />
        </div>
        <pre className="card overflow-x-auto p-4 text-[12px] leading-relaxed whitespace-pre-wrap break-words text-neutral-200 sm:text-[13px]">
          {prompt}
        </pre>
        <div className="mt-3 sm:hidden">
          <CopyButton text={prompt} label="Copy prompt" className="btn-primary w-full" />
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">or do it by hand · curl</span>
          <CopyButton text={curl} label="Copy" className="btn-ghost btn-sm" />
        </div>
        <pre className="card overflow-x-auto p-4 text-[11px] leading-relaxed text-neutral-300">{curl}</pre>
      </section>

      <section className="mt-10 grid gap-4 text-xs text-neutral-400 sm:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-bold text-white">API contract</h2>
          <p>
            <code className="text-white">POST {origin}/api/claim</code> with header <code className="kbd">x-booth-token</code>.
            JSON fields: <code className="text-white">personName</code>, <code className="text-white">botName</code> (required);{" "}
            <code className="text-white">botTitle</code>, <code className="text-white">vibe</code>, <code className="text-white">quote</code>,{" "}
            <code className="text-white">handshake</code> (optional). Returns <code className="text-white">previewUrl</code> and{" "}
            <code className="text-white">labelUrl</code>.
          </p>
          <p className="mt-2">
            Without the token the same endpoint still works, just rate-limited per device (that&apos;s what the manual form uses).
          </p>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-bold text-white">Why the token?</h2>
          <p>
            It keeps random crawlers from printing labels, without making your bot solve a CAPTCHA. It&apos;s printed on this page on
            purpose — it is the party password, not a secret.
          </p>
          <p className="mt-2">
            Rather type it yourself?{" "}
            <Link href="/claim" className="text-white underline underline-offset-2">
              Use the form
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
