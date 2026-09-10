import "server-only";
import { Redis } from "@upstash/redis";
import type { Badge } from "./badge";

export type JobStatus = "queued" | "printing" | "printed" | "failed";

export interface Job {
  id: string;
  badgeId: string;
  /** Public short code for /b/<short> links. */
  short?: string;
  name: string;
  botName: string;
  title?: string;
  /** Guest bot handshake line (optional). */
  handshake?: string;
  /** Chaos Concierge deterministic reply. */
  hostReply?: string;
  source: Badge["source"];
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  printedAt?: number;
  error?: string;
  agent?: string;
}

export interface Settings {
  autoPrint: boolean;
}

export interface AgentStatus {
  lastSeen: number;
  host?: string;
  ble: "connected" | "scanning" | "disconnected" | "error" | "dry-run";
  printer?: string;
  message?: string;
  version?: string;
  printed?: number;
}

export interface Store {
  kind: "memory" | "redis";
  putJob(job: Job): Promise<void>;
  getJob(id: string): Promise<Job | null>;
  listJobs(limit?: number): Promise<Job[]>;
  transition(id: string, from: JobStatus[], to: JobStatus, patch?: Partial<Job>): Promise<Job | null>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  getAgent(): Promise<AgentStatus | null>;
  setAgent(status: AgentStatus): Promise<void>;
  /** Atomic short-lived lock. Returns true if this caller won the window. */
  tryClaimDedupe(key: string, ttlMs: number): Promise<boolean>;
  /** Map a short public code ↔ full signed badge id (TTL ~7d). */
  putShort(code: string, badgeId: string): Promise<void>;
  getShort(code: string): Promise<string | null>;
}

const DEFAULT_SETTINGS: Settings = { autoPrint: true };
const MAX_JOBS = 500;

/* ---------------------------------- memory ---------------------------------- */

interface MemState {
  jobs: Map<string, Job>;
  shorts: Map<string, string>;
  settings: Settings;
  agent: AgentStatus | null;
}

function memState(): MemState {
  const g = globalThis as unknown as { __grokbotStore?: MemState };
  if (!g.__grokbotStore) {
    g.__grokbotStore = { jobs: new Map(), shorts: new Map(), settings: { ...DEFAULT_SETTINGS }, agent: null };
  }
  return g.__grokbotStore;
}

function memoryStore(): Store {
  const s = memState();
  return {
    kind: "memory",
    async putJob(job) {
      s.jobs.set(job.id, job);
      if (s.jobs.size > MAX_JOBS) {
        const oldest = [...s.jobs.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
        if (oldest) s.jobs.delete(oldest.id);
      }
    },
    async getJob(id) {
      return s.jobs.get(id) ?? null;
    },
    async listJobs(limit = 100) {
      return [...s.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },
    async transition(id, from, to, patch = {}) {
      const job = s.jobs.get(id);
      if (!job || !from.includes(job.status)) return null;
      const next: Job = { ...job, ...patch, status: to, updatedAt: Date.now() };
      s.jobs.set(id, next);
      return next;
    },
    async getSettings() {
      return { ...s.settings };
    },
    async setSettings(patch) {
      s.settings = { ...s.settings, ...patch };
      return { ...s.settings };
    },
    async getAgent() {
      return s.agent;
    },
    async setAgent(status) {
      s.agent = status;
    },
    async tryClaimDedupe(key, ttlMs) {
      const g = globalThis as unknown as { __grokbotDedupe?: Map<string, number> };
      if (!g.__grokbotDedupe) g.__grokbotDedupe = new Map();
      const now = Date.now();
      const until = g.__grokbotDedupe.get(key);
      if (until && until > now) return false;
      g.__grokbotDedupe.set(key, now + ttlMs);
      return true;
    },
    async putShort(code, badgeId) {
      s.shorts.set(code, badgeId);
    },
    async getShort(code) {
      return s.shorts.get(code) ?? null;
    },
  };
}

/* ---------------------------------- redis ----------------------------------- */

const K = {
  job: (id: string) => `gb:job:${id}`,
  index: "gb:jobs",
  settings: "gb:settings",
  agent: "gb:agent",
  dedupe: (key: string) => `gb:dedupe:${key}`,
  short: (code: string) => `gb:short:${code}`,
};

// Atomic status transition: only apply when the current status is in the allowed set.
const TRANSITION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local job = cjson.decode(raw)
local ok = false
for s in string.gmatch(ARGV[3], '[^,]+') do
  if job.status == s then ok = true end
end
if not ok then return nil end
local patch = cjson.decode(ARGV[2])
for k, v in pairs(patch) do job[k] = v end
job.status = ARGV[1]
local out = cjson.encode(job)
redis.call('SET', KEYS[1], out)
return out
`;

function parseJob(raw: unknown): Job | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Job;
    } catch {
      return null;
    }
  }
  return raw as Job;
}

function redisStore(redis: Redis): Store {
  return {
    kind: "redis",
    async putJob(job) {
      await redis
        .multi()
        .set(K.job(job.id), job)
        .zadd(K.index, { score: job.createdAt, member: job.id })
        .zremrangebyrank(K.index, 0, -(MAX_JOBS + 1))
        .exec();
    },
    async getJob(id) {
      return parseJob(await redis.get(K.job(id)));
    },
    async listJobs(limit = 100) {
      const ids = await redis.zrange<string[]>(K.index, 0, limit - 1, { rev: true });
      if (!ids.length) return [];
      const raws = await redis.mget<unknown[]>(...ids.map(K.job));
      return raws.map(parseJob).filter((j): j is Job => j !== null);
    },
    async transition(id, from, to, patch = {}) {
      const res = await redis.eval(
        TRANSITION_LUA,
        [K.job(id)],
        [to, JSON.stringify({ ...patch, updatedAt: Date.now() }), from.join(",")],
      );
      return parseJob(res);
    },
    async getSettings() {
      const raw = await redis.get<Settings>(K.settings);
      return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
    },
    async setSettings(patch) {
      const cur = await this.getSettings();
      const next = { ...cur, ...patch };
      await redis.set(K.settings, next);
      return next;
    },
    async getAgent() {
      return (await redis.get<AgentStatus>(K.agent)) ?? null;
    },
    async setAgent(status) {
      await redis.set(K.agent, status, { ex: 3600 });
    },
    async tryClaimDedupe(key, ttlMs) {
      // SET NX PX — only the first concurrent claim wins. Upstash returns "OK" | null.
      const res = await redis.set(K.dedupe(key), "1", { nx: true, px: Math.max(1000, ttlMs) });
      return res === "OK";
    },
    async putShort(code, badgeId) {
      // 7 days — long enough for the event + share after
      await redis.set(K.short(code), badgeId, { ex: 60 * 60 * 24 * 7 });
    },
    async getShort(code) {
      const v = await redis.get<string>(K.short(code));
      return typeof v === "string" ? v : null;
    },
  };
}

/* ---------------------------------- factory --------------------------------- */

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    cached = redisStore(new Redis({ url, token }));
  } else {
    cached = memoryStore();
  }
  return cached;
}
