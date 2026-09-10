import "server-only";
import { createHash } from "node:crypto";
import { getStore } from "./store";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // no 0/O/1/l
const CODE_LEN = 7;

function hashToCode(badgeId: string, salt: number): string {
  const h = createHash("sha256").update(`${badgeId}:${salt}`).digest();
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[h[i] % ALPHABET.length];
  }
  return out;
}

/** Allocate a short public code for a signed badge id. Idempotent per badge when possible. */
export async function ensureShortCode(badgeId: string): Promise<string> {
  const store = getStore();
  // Prefer deterministic first candidate so re-claims reuse the same short URL.
  for (let salt = 0; salt < 12; salt++) {
    const code = hashToCode(badgeId, salt);
    const existing = await store.getShort(code);
    if (existing === badgeId) return code;
    if (!existing) {
      await store.putShort(code, badgeId);
      return code;
    }
  }
  // Extremely unlikely fallback
  const code = hashToCode(badgeId, Date.now());
  await store.putShort(code, badgeId);
  return code;
}

export async function resolveBadgeId(param: string): Promise<string | null> {
  const raw = decodeURIComponent(param);
  // Full signed ids contain a "." between body and HMAC tag.
  if (raw.includes(".")) return raw;
  // Short codes are alphabet-only, ~7 chars
  if (/^[0-9A-Za-z]{4,16}$/.test(raw)) {
    return (await getStore().getShort(raw)) ?? null;
  }
  return null;
}

export function isShortCode(param: string): boolean {
  const raw = decodeURIComponent(param);
  return !raw.includes(".") && /^[0-9A-Za-z]{4,16}$/.test(raw);
}
