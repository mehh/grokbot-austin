import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { boothToken } from "./config";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function extractToken(req: Request): string | null {
  const header = req.headers.get("x-booth-token");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  return q ? q.trim() : null;
}

/**
 * Two scopes share one header:
 *  - "bot": claiming badges via /api/agent (BOOTH_TOKEN — printed on the /prompt page)
 *  - "admin": mutating the print queue (ADMIN_TOKEN if set, otherwise BOOTH_TOKEN)
 */
export function isAuthorized(req: Request, scope: "bot" | "admin" = "bot"): boolean {
  const token = extractToken(req);
  if (!token) return false;
  const admin = process.env.ADMIN_TOKEN?.trim() || boothToken();
  if (safeEqual(token, admin)) return true;
  return scope === "bot" && safeEqual(token, boothToken());
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Unauthorized. Send the booth token in the `x-booth-token` header." },
    { status: 401 },
  );
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      const body = await req.json();
      return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (type.includes("form")) {
    const form = await req.formData();
    const out: Record<string, unknown> = {};
    form.forEach((v, k) => {
      out[k] = typeof v === "string" ? v : "";
    });
    return out;
  }
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
