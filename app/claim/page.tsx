import type { Metadata } from "next";
import Link from "next/link";
import { ClaimForm } from "@/components/ClaimForm";

export const metadata: Metadata = {
  title: "Claim a badge",
  description: "Two names in, one thermal badge out.",
};

export default function ClaimPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:pt-12">
      <div className="mb-8">
        <p className="mb-2 text-xs text-muted">
          <span className="text-white">$</span> claim --human --bot
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Claim your badge</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-400">
          Two names in, one label out. Prefer to let your bot do the talking?{" "}
          <Link href="/prompt" className="text-white underline underline-offset-2">
            Grab the bot prompt
          </Link>
          .
        </p>
      </div>
      <ClaimForm />
    </div>
  );
}
