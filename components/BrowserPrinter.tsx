"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { M110Browser, hasWebBluetooth, type BleState } from "@/lib/webble";

export interface BrowserPrinterHandle {
  state: BleState;
  message: string;
  name: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  printLabel: (badgeId: string) => Promise<void>;
}

/** Owns one Web Bluetooth connection for the dashboard. Tries a silent reconnect on mount. */
export function useBrowserPrinter(preferredName: string): BrowserPrinterHandle {
  const ref = useRef<M110Browser | null>(null);
  const [state, setState] = useState<BleState>("disconnected");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(preferredName);

  useEffect(() => {
    const p = new M110Browser(preferredName);
    p.onChange = (s, m) => {
      setState(s);
      setMessage(m ?? "");
      setName(p.name);
    };
    ref.current = p;
    setState(p.state);
    if (p.state !== "unsupported") {
      p.reconnectKnown().then((ok) => {
        if (!ok) setMessage(`looking for ${preferredName} · click connect`);
      });
    }
    return () => p.disconnect();
  }, [preferredName]);

  const connect = useCallback(async () => {
    const p = ref.current;
    if (!p) return;
    if (await p.reconnectKnown()) return;
    await p.pick();
  }, []);

  const disconnect = useCallback(() => ref.current?.disconnect(), []);

  const printLabel = useCallback(async (badgeId: string) => {
    const p = ref.current;
    if (!p) throw new Error("printer not ready");
    if (p.state !== "connected") await connect();
    await p.printPngUrl(`/api/label/${encodeURIComponent(badgeId)}.png`);
  }, [connect]);

  return { state, message, name, connect, disconnect, printLabel };
}

export function BrowserPrinterCard({ printer, agentOnline }: { printer: BrowserPrinterHandle; agentOnline: boolean }) {
  const supported = hasWebBluetooth();
  const color =
    printer.state === "connected" || printer.state === "printing"
      ? "text-ok"
      : printer.state === "connecting"
        ? "text-warn"
        : printer.state === "error"
          ? "text-bad"
          : "text-muted";

  return (
    <div className="card p-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.18em] text-muted uppercase">printer · this browser</div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase ${color}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-current ${printer.state === "printing" || printer.state === "connecting" ? "animate-pulse-soft" : ""}`} />
          {printer.state}
        </span>
      </div>
      <div className="mt-2 truncate text-neutral-300">{printer.name}</div>
      {printer.message ? <div className="mt-1 truncate text-dim">{printer.message}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {printer.state === "connected" || printer.state === "printing" ? (
          <button type="button" onClick={printer.disconnect} className="btn-ghost btn-sm">
            disconnect
          </button>
        ) : (
          <button type="button" onClick={() => printer.connect().catch(() => undefined)} disabled={!supported || printer.state === "connecting"} className="btn-primary btn-sm">
            {printer.state === "connecting" ? "connecting…" : "connect M110"}
          </button>
        )}
      </div>
      <p className="mt-3 leading-relaxed text-dim">
        {!supported
          ? "Web Bluetooth needs Chrome or Edge. The Python agent is the primary print path."
          : agentOnline
            ? "Agent is online and auto-printing. Use this only as a manual fallback."
            : "Fallback when the agent is down: connect here, then hit ▮ on a queued job. If it won't connect, unpair the M110 in macOS System Settings → Bluetooth and retry."}
      </p>
    </div>
  );
}
