"use client";

import { useState } from "react";

interface Props {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className={className ?? "btn-primary"} aria-live="polite">
      {copied ? (
        <>
          <span aria-hidden>✓</span> {copiedLabel}
        </>
      ) : (
        <>
          <span aria-hidden>⧉</span> {label}
        </>
      )}
    </button>
  );
}
