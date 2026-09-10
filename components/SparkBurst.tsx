"use client";

import { useEffect, useState } from "react";

const GLYPHS = ["*", "+", "·", "✦", "x", "◦", "/", "\\", "|", "—"];

interface Spark {
  id: number;
  glyph: string;
  x: number;
  y: number;
  delay: number;
  size: number;
}

/** B/W ASCII confetti: glyphs burst outward from the center once, then fade. */
export function SparkBurst({ count = 28, duration = 1400 }: { count?: number; duration?: number }) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const out: Spark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 90 + Math.random() * 140;
      out.push({
        id: i,
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.7,
        delay: Math.random() * 120,
        size: 12 + Math.random() * 14,
      });
    }
    setSparks(out);
    const t = setTimeout(() => setDone(true), duration + 300);
    return () => clearTimeout(t);
  }, [count, duration]);

  if (done || sparks.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-hidden>
      {sparks.map((s) => (
        <span
          key={s.id}
          className="absolute font-bold text-white"
          style={
            {
              fontSize: s.size,
              animation: `gb-spark ${duration}ms cubic-bezier(0.1, 0.8, 0.3, 1) ${s.delay}ms both`,
              "--dx": `${s.x}px`,
              "--dy": `${s.y}px`,
            } as React.CSSProperties
          }
        >
          {s.glyph}
        </span>
      ))}
    </div>
  );
}
