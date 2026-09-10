import { isAuthorized, json, readJson, unauthorized } from "@/lib/auth";
import { getStore, type AgentStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLE_STATES = new Set<AgentStatus["ble"]>(["connected", "scanning", "disconnected", "error", "dry-run"]);

/** The local print agent reports its health here every few seconds. */
export async function POST(req: Request) {
  if (!isAuthorized(req, "admin")) return unauthorized();
  const body = await readJson(req);
  const ble = BLE_STATES.has(body.ble as AgentStatus["ble"]) ? (body.ble as AgentStatus["ble"]) : "disconnected";
  const status: AgentStatus = {
    lastSeen: Date.now(),
    ble,
    host: typeof body.host === "string" ? body.host.slice(0, 64) : undefined,
    printer: typeof body.printer === "string" ? body.printer.slice(0, 64) : undefined,
    message: typeof body.message === "string" ? body.message.slice(0, 200) : undefined,
    version: typeof body.version === "string" ? body.version.slice(0, 32) : undefined,
    printed: typeof body.printed === "number" ? body.printed : undefined,
  };
  await getStore().setAgent(status);
  const settings = await getStore().getSettings();
  return json({ ok: true, settings });
}
