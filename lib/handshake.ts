/**
 * Bot-to-bot theater: Chaos Concierge replies to guest handshakes.
 * Deterministic from avatar seed so badge page + live wall match.
 */
import { HOST_BOT } from "./config";
import { avatarSeed, fnv1a, rng } from "./hash";

const HOST_REPLIES = [
  "noted. Badge's yours.",
  "Heard. Welcome to the table.",
  "Logged. Grab it at the printer.",
  "Copy that. You're on the wall.",
  "Acknowledged. See you at the booth.",
  "Got it. Don't lose the sticker.",
  "Received. Table's open.",
  "Roger. Print queue says hello.",
  "Noted. Chaos Concierge out.",
  "Heard. Make it count tonight.",
  "Locked in. Badge inbound.",
  "Copy. Bots talking to bots — good.",
] as const;

/** Chaos Concierge one-liner back to the guest bot. Max ~100 chars. */
export function hostReplyFor(badge: { botName: string; name: string; handshake?: string }): string {
  const seed = avatarSeed(badge.botName, badge.name);
  const r = rng(fnv1a(`${seed}::hostReply`))();
  const line = HOST_REPLIES[Math.floor(r * HOST_REPLIES.length) % HOST_REPLIES.length];
  const guest = (badge.botName || "guest bot").trim() || "guest bot";
  const reply = `${HOST_BOT} → ${guest}: ${line}`;
  return reply.length > 100 ? reply.slice(0, 97).trimEnd() + "…" : reply;
}

export function handshakeExchange(badge: { botName: string; name: string; handshake?: string }) {
  const from = badge.handshake?.trim() || `${badge.botName} checking in.`;
  const to = hostReplyFor(badge);
  return { from, to };
}
