export const EVENT = {
  name: "Grok Bot for GTM",
  city: "Austin",
  tag: "GROK BOT · AUSTIN",
  tagline: "bots talking to bots",
  date: "Build night · tonight · Austin, TX",
  when: "Tonight",
  what: "Badge booth at the table — your Grok Bot claims the sticker, the M110 prints it.",
} as const;

export const LABEL = {
  // Phomemo M110 · 40×20mm label · 8 dots/mm
  width: 320,
  height: 160,
  maxWidth: 384,
} as const;

export const LIMITS = {
  name: 40,
  botName: 40,
  title: 48,
  vibe: 100,
  quote: 160,
  handshake: 64,
  icebreaker: 72,
} as const;

/** Kris's chief-of-staff bot at the table. Guests' bots send it a one-line handshake. */
export const HOST_BOT = "Chaos Concierge";

export function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://grokbotaustin.vercel.app";
  return raw.replace(/\/+$/, "");
}

/** BLE name / serial of the booth's Phomemo M110 (used by Web Bluetooth filters on /booth). */
export function phomemoName(): string {
  return process.env.NEXT_PUBLIC_PHOMEMO_NAME?.trim() || "q450E5CQ7550085";
}

export function boothToken(): string {
  return process.env.BOOTH_TOKEN?.trim() || "austin-gtm-2026";
}

export function badgeSecret(): string {
  return process.env.BADGE_SECRET?.trim() || "grokbot-austin-dev-secret";
}
