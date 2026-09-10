import "server-only";
import { badgeUrls, type Badge } from "./badge";
import { baseUrl } from "./config";
import { getStore, type Job } from "./store";

export function jobIdFor(badge: Badge): string {
  const sig = badge.id.slice(badge.id.lastIndexOf(".") + 1).replace(/[^a-zA-Z0-9]/g, "");
  return `j${badge.createdAt.toString(36)}${sig.slice(0, 6)}`;
}

export async function enqueueBadge(badge: Badge): Promise<Job> {
  const now = Date.now();
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
  await getStore().putJob(job);
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

/** Simple in-memory rate limiter: `limit` hits per `windowMs` per key. Best effort on serverless. */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 12, windowMs = 60_000): boolean {
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
