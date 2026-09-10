import { createHmac, timingSafeEqual } from "node:crypto";
import { LIMITS, badgeSecret, baseUrl } from "./config";

export type BadgeSource = "human" | "bot";

export interface Badge {
  id: string;
  name: string;
  botName: string;
  title?: string;
  vibe?: string;
  quote?: string;
  /** One-line handshake from the guest's bot to the host bot; printed in the label footer. */
  handshake?: string;
  /** Guest-supplied icebreaker ("ask me about …"); falls back to flair when absent. */
  icebreaker?: string;
  source: BadgeSource;
  createdAt: number;
}

export interface BadgeInput {
  name?: unknown;
  personName?: unknown;
  botName?: unknown;
  title?: unknown;
  botTitle?: unknown;
  vibe?: unknown;
  quote?: unknown;
  handshake?: unknown;
  icebreaker?: unknown;
  iceBreaker?: unknown;
  askMeAbout?: unknown;
  source?: unknown;
}

/** Compact wire form that gets encoded into the badge id. */
interface Payload {
  n: string;
  b: string;
  t?: string;
  v?: string;
  q?: string;
  h?: string;
  i?: string;
  s: 0 | 1;
  c: number;
}

export class BadgeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function clean(value: unknown, max: number): string {
  if (value === undefined || value === null) return "";
  const s = String(value)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

export function normalizeInput(input: BadgeInput): Omit<Badge, "id" | "createdAt"> {
  // Accept both the documented bot payload (personName/botTitle) and the form's (name/title).
  const name = clean(input.personName ?? input.name, LIMITS.name);
  const botName = clean(input.botName, LIMITS.botName);
  if (!name) throw new BadgeError("`personName` is required (the human).");
  if (!botName) throw new BadgeError("`botName` is required (the Grok Bot).");
  const title = clean(input.botTitle ?? input.title, LIMITS.title) || undefined;
  const vibe = clean(input.vibe, LIMITS.vibe) || undefined;
  const quote = clean(input.quote, LIMITS.quote) || undefined;
  const handshake = clean(input.handshake, LIMITS.handshake) || undefined;
  const icebreaker =
    clean(input.icebreaker ?? input.iceBreaker ?? input.askMeAbout, LIMITS.icebreaker) || undefined;
  const source: BadgeSource = input.source === "bot" ? "bot" : "human";
  return { name, botName, title, vibe, quote, handshake, icebreaker, source };
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(body: string): string {
  const mac = createHmac("sha256", badgeSecret()).update(body).digest();
  return b64url(mac.subarray(0, 12));
}

/**
 * Badge ids are self-describing: base64url(payload) + "." + HMAC tag.
 * Preview and label rendering work with zero database access.
 */
export function createBadge(input: BadgeInput, createdAt = Date.now()): Badge {
  const data = normalizeInput(input);
  const payload: Payload = {
    n: data.name,
    b: data.botName,
    s: data.source === "bot" ? 1 : 0,
    c: createdAt,
  };
  if (data.title) payload.t = data.title;
  if (data.vibe) payload.v = data.vibe;
  if (data.quote) payload.q = data.quote;
  if (data.handshake) payload.h = data.handshake;
  if (data.icebreaker) payload.i = data.icebreaker;
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const id = `${body}.${sign(body)}`;
  return { id, ...data, createdAt };
}

export function decodeBadge(id: string): Badge | null {
  if (typeof id !== "string" || id.length > 2048) return null;
  const dot = id.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = id.slice(0, dot);
  const tag = id.slice(dot + 1);
  const expected = sign(body);
  if (tag.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(tag), Buffer.from(expected))) return null;
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as Payload;
    if (!payload || typeof payload.n !== "string" || typeof payload.b !== "string") return null;
    return {
      id,
      name: payload.n,
      botName: payload.b,
      title: payload.t || undefined,
      vibe: payload.v || undefined,
      quote: payload.q || undefined,
      handshake: payload.h || undefined,
      icebreaker: payload.i || undefined,
      source: payload.s === 1 ? "bot" : "human",
      createdAt: typeof payload.c === "number" ? payload.c : 0,
    };
  } catch {
    return null;
  }
}

export function badgeUrls(id: string, origin = baseUrl()) {
  const encoded = encodeURIComponent(id);
  return {
    previewUrl: `${origin}/b/${encoded}`,
    labelUrl: `${origin}/api/label/${encoded}.png`,
    label4x6Url: `${origin}/api/label/${encoded}.png?size=4x6`,
  };
}
