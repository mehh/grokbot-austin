"use client";

import { CopyButton } from "./CopyButton";

export function ShareX({ text, url }: { text: string; url: string }) {
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="card p-4">
      <div className="mb-2 text-[11px] tracking-[0.18em] text-muted uppercase">share card</div>
      <p className="text-sm leading-relaxed text-neutral-200">{text}</p>
      <p className="mt-1 text-xs break-all text-muted">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={intent} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
          Post on X ↗
        </a>
        <CopyButton text={`${text} ${url}`} label="Copy text" className="btn-ghost btn-sm" />
      </div>
    </div>
  );
}
