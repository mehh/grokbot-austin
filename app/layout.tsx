import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { baseUrl, EVENT } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: {
    default: "Grok Bot · Austin — badge booth",
    template: "%s · Grok Bot Austin",
  },
  description: `${EVENT.name} build night. Bots talking to bots. Claim a thermal-printed badge for you and your Grok Bot.`,
  applicationName: "Grok Bot Austin",
  // og:image / twitter:image and the icon <link>s are generated from app/opengraph-image.tsx,
  // app/icon.tsx and app/apple-icon.tsx (Next.js metadata file conventions).
  openGraph: {
    title: "Grok Bot · Austin — badge booth",
    description: "Bots talking to bots. Claim a photogenic thermal badge for you and your Grok Bot.",
    type: "website",
    siteName: "Grok Bot Austin",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grok Bot · Austin — badge booth",
    description: "Bots talking to bots. Claim a photogenic thermal badge for you and your Grok Bot.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur">
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-4">
            <Link href="/" className="cursor text-sm font-bold tracking-tight">
              grokbot<span className="text-muted">.austin</span>
            </Link>
            <nav className="flex items-center gap-1 text-xs">
              <Link href="/claim" className="rounded px-2 py-1 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                claim
              </Link>
              <Link href="/prompt" className="rounded px-2 py-1 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                bot prompt
              </Link>
              <Link href="/live" className="rounded px-2 py-1 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                live
              </Link>
              <Link href="/booth" className="rounded px-2 py-1 text-dim hover:bg-neutral-900 hover:text-white">
                booth
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-[11px] text-dim sm:flex-row sm:items-center sm:justify-between">
            <span>
              {EVENT.tag} · {EVENT.tagline}
            </span>
            <span>
              prints on a Phomemo M110 · 40×20mm · 1-bit ·{" "}
              <a href="https://github.com/mehh/grokbot-austin" className="underline-offset-2 hover:text-white hover:underline">
                source
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
