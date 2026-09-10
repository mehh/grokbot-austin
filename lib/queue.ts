import "server-only";
import { badgeUrls, type Badge } from "./badge";
import { baseUrl } from "./config";
import { getStore, type Job } from "./store";

export function jobIdFor(badge: Badge): string {
  const sig = badge.id.slice(badge.id.lastIndexOf(".") + 1).replace(/[^a-zA-Z0-9]/g, "");
  return `j${badge.createdAt.toString(36)}${sig.slice(0, 6)}`;
}

/** Collapse double-POSTs (bot retry / form double-click) into one job. */
const CLAIM_DEDUPE_MS = 8_000;

function sameGuest(a: { name: string; botName: string }, b: { name: string; botName: string }): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && a.botName.trim().toLowerCase() === b.botName.trim().toLowerCase();
}

export async function enqueueBadge(badge: Badge): Promise<Job> {
  const now = Date.now();
  const store = getStore();
  // Same guest within a few seconds → reuse existing job (queued/printing/just printed).
  const recent = await store.listJobs(40);
  const dup = recent.find(
    (j) =>
      sameGuest(j, badge) &&
      now - j.createdAt < CLAIM_DEDUPE_MS &&
      (j.status === "queued" || j.status === "printing" || j.status === "printed"),
  );
  if (dup) return dup;

  // Concurrent double-POSTs (two serverless invokes at once) race listJobs — use NX lock.
  const lockKey = `${badge.name.trim().toLowerCase()}|${badge.botName.trim().toLowerCase()}`;
  const won = await store.tryClaimDedupe(lockKey, CLAIM_DEDUPE_MS);
  if (!won) {
    const again = await store.listJobs(40);
    const existing = again.find((j) => sameGuest(j, badge) && now - j.createdAt < CLAIM_DEDUPE_MS);
    if (existing) return existing;
    // Loser arrived first in list but winner's putJob not visible yet — brief wait then re-list.
    await new Promise((r) => setTimeout(r, 150));
    const retry = (await store.listJobs(40)).find((j) => sameGuest(j, badge) && Date.now() - j.createdAt < CLAIM_DEDUPE_MS);
    if (retry) return retry;
  }

  const job: Job = {
    id: jobIdFor(badge),
    badgeId: badge.id,
    name: badge.name,
    botName: badge.botName,
    title: badge.title,
    source: badge.source,
    status: "queued",
    createdAt: badge.createdAt || now,
    updatedAt: now,
    attempts: 0,
  };
  await store.putJob(job);
  return job;
}

export interface JobView extends Job {
  previewUrl: string;
  labelUrl: string;
}

export function viewJob(job: Job, origin = baseUrl()): JobView {
  const urls = badgeUrls(job.badgeId, origin);
  return { ...job, ...urls };
}

/**
 * Simple in-memory rate limiter: `limit` hits per `windowMs` per key. Best effort on serverless.
 * Generous by default because a whole venue often shares one NAT IP.
 */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}
