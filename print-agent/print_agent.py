#!/usr/bin/env python3
"""
Grok Bot Austin — local print agent.

Runs on the booth laptop. Polls the web app for queued badges, downloads each
1-bit label PNG, and prints it on a Phomemo M110 over Bluetooth LE. Auto-print
is on by default; pause it from the /booth dashboard.

    export BOOTH_URL=https://grokbotaustin.vercel.app
    export BOOTH_TOKEN=austin-gtm-2026
    export PHOMEMO_ADDR=q450E5CQ7550085      # BLE name (serial) or MAC/UUID
    python3 print_agent.py

Options:
    --dry-run       don't touch Bluetooth; save labels to ./out and mark printed
    --once          process the queue once and exit
    --scan          list nearby BLE devices and exit
    --test          print a test label and exit
    --label 40x20   label size in mm (default 40x20 → 320×160 dots)
    --density 15    1 (light) .. 15 (dark)

Protocol notes (M110, reverse-engineered by phomemo-tools / phomymo / pyphomemo):
    speed   : 1b 4e 0d <speed>
    density : 1b 4e 04 <density>
    media   : 1f 11 0a                 (labels with gaps)
    raster  : 1d 76 30 00 <wBytes LE16=width//8> <lines LE16> <bitmap, 1 = black>
    footer  : 1f f0 05 00 1f f0 03 00
GATT: service 0xff00, write 0xff02, notify 0xff03, 128-byte chunks.
Packing matches pyphomemo imaging.image_to_raster (invert + convert "1" + tobytes).
"""
from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import platform
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

VERSION = "1.0.5"

DEFAULT_URL = "https://grokbotaustin.vercel.app"
DEFAULT_TOKEN = "austin-gtm-2026"
DEFAULT_ADDR = "q450E5CQ7550085"

SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"
WRITE_CHAR_UUID = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR_UUID = "0000ff03-0000-1000-8000-00805f9b34fb"
KNOWN_SERVICE_UUIDS = {
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "0000ae30-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
}
MODEL_PREFIXES = ("M110", "M120", "M220", "M200", "M02", "T02", "PHOMEMO")

CHUNK_SIZE = 128
# Match pyphomemo protocol.CHUNK_DELAY_S (prefer write-without-response when available).
CHUNK_DELAY = float(os.environ.get("CHUNK_DELAY", "0.02"))
DELAY_INIT = 0.03
DELAY_BEFORE_FOOTER = float(os.environ.get("DELAY_BEFORE", "0.30"))
DELAY_AFTER_FOOTER = float(os.environ.get("DELAY_AFTER", "0.50"))
PX_PER_MM = 8
# Print head max is 384 dots; for a label use width_bytes = width // 8 (e.g. 40 for 40x20).
# Do NOT pad rows to 48 — that caused vertical stripes on Kris's M110 (pyphomemo ground truth).
HEAD_WIDTH = 384


# --------------------------------------------------------------------------- log
def log(msg: str, level: str = "info") -> None:
    icons = {"info": "·", "ok": "✓", "warn": "!", "err": "✗", "ble": "⌁", "print": "▮"}
    stamp = time.strftime("%H:%M:%S")
    print(f"{stamp} {icons.get(level, '·')} {msg}", flush=True)


# --------------------------------------------------------------------------- http
class Booth:
    """Tiny HTTP client for the queue API (stdlib only)."""

    def __init__(self, base_url: str, token: str):
        self.base = base_url.rstrip("/")
        self.token = token

    def _req(self, method: str, path: str, body: dict | None = None, timeout: float = 15.0):
        url = path if path.startswith("http") else f"{self.base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("x-booth-token", self.token)
        req.add_header("User-Agent", f"grokbot-print-agent/{VERSION}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                raw = res.read()
                ctype = res.headers.get("Content-Type", "")
                if "json" in ctype:
                    return res.status, json.loads(raw or b"{}")
                return res.status, raw
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw or b"{}")
            except Exception:
                return e.code, {"ok": False, "error": raw.decode(errors="replace")[:200]}

    def queued(self, limit: int = 10):
        status, data = self._req("GET", f"/api/queue?status=queued&limit={limit}")
        if status != 200 or not isinstance(data, dict):
            raise RuntimeError(f"queue fetch failed ({status}): {data}")
        return data

    def claim(self, job_id: str, agent: str):
        return self._req("POST", f"/api/queue/{urllib.parse.quote(job_id)}/claim", {"agent": agent})

    def complete(self, job_id: str, agent: str):
        return self._req("POST", f"/api/queue/{urllib.parse.quote(job_id)}/complete", {"agent": agent})

    def fail(self, job_id: str, agent: str, error: str):
        return self._req("POST", f"/api/queue/{urllib.parse.quote(job_id)}/fail", {"agent": agent, "error": error[:280]})

    def heartbeat(self, payload: dict):
        return self._req("POST", "/api/agent/heartbeat", payload, timeout=8.0)

    def label_png(self, badge_id: str) -> bytes:
        path = f"/api/label/{urllib.parse.quote(badge_id, safe='')}.png"
        status, data = self._req("GET", path, timeout=30.0)
        if status != 200 or not isinstance(data, (bytes, bytearray)):
            raise RuntimeError(f"label download failed ({status})")
        return bytes(data)


# --------------------------------------------------------------------------- raster
def parse_label(spec: str) -> tuple[int, int]:
    m = re.fullmatch(r"\s*(\d+)\s*[xX×]\s*(\d+)\s*", spec)
    if not m:
        raise ValueError("label must look like 40x20 (mm)")
    w = int(m.group(1)) * PX_PER_MM
    h = int(m.group(2)) * PX_PER_MM
    w -= w % 8
    if not 8 <= w <= 384:
        raise ValueError("label width must be 1..48mm")
    return w, h


def png_to_raster(
    png: bytes, width: int, height: int, threshold: int | None = 128
) -> tuple[bytes, int, int]:
    """Return (raster, height, width_bytes) matching pyphomemo image_to_raster.

    Invert grayscale so dark ink becomes set bits after Pillow ``"1"`` packing
    (MSB-first). ``width_bytes = width // 8`` — no 48-byte head padding.
    """
    from PIL import Image, ImageOps  # imported lazily so --scan works without Pillow

    if width % 8 != 0:
        raise ValueError("width must be a multiple of 8")
    width_bytes = width // 8

    img = Image.open(io.BytesIO(png))
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img.convert("RGBA"))
    gray = img.convert("L")

    if gray.size != (width, height):
        scale = min(width / gray.width, height / gray.height)
        new = (max(1, round(gray.width * scale)), max(1, round(gray.height * scale)))
        resized = gray.resize(new, Image.LANCZOS)
        canvas = Image.new("L", (width, height), 255)
        canvas.paste(resized, ((width - new[0]) // 2, (height - new[1]) // 2))
        gray = canvas

    # Invert so dark input -> high value -> set bit after "1" conversion (pyphomemo).
    inverted = ImageOps.invert(gray)
    if threshold is None:
        bw = inverted.convert("1")  # Floyd-Steinberg dithering
    else:
        bw = inverted.point(lambda p: 255 if p >= threshold else 0).convert("1")

    raster = bw.tobytes()
    out_height = bw.height
    if len(raster) != width_bytes * out_height:
        raise ValueError(
            f"unexpected raster length {len(raster)}; "
            f"expected {width_bytes * out_height} for {width}x{out_height}"
        )
    # Tiny trim only — 40×20 stock is 160 dots tall, so height now matches the media.
    # Overshoot/gap-hunt was from printing 240-tall artwork on 20mm labels.
    trim = max(0, min(24, int(os.environ.get("RASTER_TRIM", "16"))))
    if trim and out_height > trim + 32:
        out_height -= trim
        raster = raster[: width_bytes * out_height]
    return raster, out_height, width_bytes


def test_label_png(width: int, height: int) -> bytes:
    from PIL import Image, ImageDraw

    img = Image.new("1", (width, height), 1)
    d = ImageDraw.Draw(img)
    d.rectangle((3, 3, width - 4, height - 4), outline=0, width=2)
    foot_top = max(height - 28, height // 2)
    d.rectangle((12, foot_top, width - 13, height - 8), fill=0)
    bar_h = max(8, height // 8)
    for i in range(0, width - 36, 14):
        d.rectangle((16 + i, 10, 16 + i + 7, 10 + bar_h), fill=0)
    cy = 10 + bar_h + max(18, (foot_top - (10 + bar_h)) // 2)
    r = min(28, max(16, (foot_top - 10 - bar_h) // 2 - 4))
    d.ellipse((width // 2 - r, cy - r, width // 2 + r, cy + r), fill=0)
    er = max(4, r // 4)
    d.ellipse((width // 2 - r // 2 - er, cy - er, width // 2 - r // 2 + er, cy + er), fill=1)
    d.ellipse((width // 2 + r // 2 - er, cy - er, width // 2 + r // 2 + er, cy + er), fill=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# --------------------------------------------------------------------------- ble
def _u16(v: int) -> bytes:
    return v.to_bytes(2, "little")


def looks_like_serial(name: str | None) -> bool:
    n = (name or "").strip()
    return 10 <= len(n) <= 18 and n.isalnum() and n == n.upper() and any(c.isdigit() for c in n) and any(c.isalpha() for c in n)


def looks_like_phomemo(name: str | None, uuids) -> bool:
    n = (name or "").strip().upper()
    if n.startswith(MODEL_PREFIXES) or looks_like_serial(n):
        return True
    return bool({str(u).lower() for u in (uuids or [])} & KNOWN_SERVICE_UUIDS)


def is_address(s: str) -> bool:
    return bool(re.fullmatch(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", s)) or bool(
        re.fullmatch(r"[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}", s)
    )


@dataclass
class PrinterInfo:
    address: str
    name: str


class Printer:
    """Keeps one BLE connection to the M110 and streams raster jobs to it."""

    def __init__(self, target: str, density: int = 15, speed: int = 5, debug: bool = False):
        self.target = target
        self.density = max(1, min(15, density))
        self.speed = max(1, min(5, speed))
        self.debug = debug
        self.client = None
        self.info: PrinterInfo | None = None
        self.write_char = WRITE_CHAR_UUID
        self._write_with_response: bool | None = None
        self.state = "disconnected"

    # -- discovery -----------------------------------------------------------
    async def find(self, timeout: float = 12.0):
        from bleak import BleakScanner

        want = self.target.strip()
        self.state = "scanning"
        log(f"scanning for '{want}' ({timeout:.0f}s max)…", "ble")

        def match(dev, adv) -> bool:
            name = (dev.name or adv.local_name or "").strip()
            if want and (name.lower() == want.lower() or dev.address.lower() == want.lower()):
                return True
            if want and want.lower() in name.lower():
                return True
            return False

        dev = await BleakScanner.find_device_by_filter(match, timeout=timeout)
        if dev is None:
            log("exact match not found; looking for any Phomemo-looking device…", "warn")
            found = await BleakScanner.discover(timeout=6.0, return_adv=True)
            candidates = [
                (d, a) for d, a in found.values() if looks_like_phomemo(d.name or a.local_name, a.service_uuids)
            ]
            candidates.sort(key=lambda t: -(t[1].rssi or -999))
            if candidates:
                dev = candidates[0][0]
                log(f"using {dev.name or '?'} @ {dev.address}", "warn")
        if dev is None:
            self.state = "disconnected"
            raise RuntimeError(
                f"Printer '{want}' not found. Is it on (blinking blue), unpaired from macOS Bluetooth settings, and not "
                "connected to the Phomemo phone app?"
            )
        self.info = PrinterInfo(dev.address, dev.name or want)
        return dev

    # -- connection ----------------------------------------------------------
    @property
    def connected(self) -> bool:
        return self.client is not None and self.client.is_connected

    async def connect(self, retries: int = 4):
        from bleak import BleakClient

        last = None
        for attempt in range(1, retries + 1):
            try:
                if is_address(self.target) and attempt == 1:
                    target = self.target
                    self.info = PrinterInfo(self.target, self.target)
                else:
                    target = await self.find()
                log(f"connecting to {self.info.name} ({self.info.address}) attempt {attempt}/{retries}…", "ble")
                client = BleakClient(target, timeout=20.0, disconnected_callback=self._on_disconnect)
                await client.connect()
                self.client = client
                self._write_with_response = None
                self._pick_write_char()
                await self._subscribe()
                self.state = "connected"
                log(f"connected · write char {self.write_char[4:8]}", "ok")
                return
            except Exception as exc:  # noqa: BLE001
                last = exc
                self.client = None
                self.state = "error"
                wait = min(1.5 * attempt, 6.0)
                log(f"connect failed: {exc} — retrying in {wait:.1f}s", "warn")
                await asyncio.sleep(wait)
        self.state = "disconnected"
        raise RuntimeError(f"could not connect to printer: {last}")

    def _on_disconnect(self, _client):
        self.state = "disconnected"
        log("printer disconnected", "warn")

    def _pick_write_char(self):
        assert self.client is not None
        chars = {c.uuid.lower(): c for s in self.client.services for c in s.characteristics}
        if self.debug:
            for s in self.client.services:
                log(f"service {s.uuid}", "ble")
                for c in s.characteristics:
                    log(f"  char {c.uuid} {sorted(c.properties)}", "ble")
        if WRITE_CHAR_UUID in chars:
            self.write_char = WRITE_CHAR_UUID
            return
        for svc in self.client.services:
            if svc.uuid.lower() != SERVICE_UUID:
                continue
            for c in svc.characteristics:
                if "write-without-response" in c.properties or "write" in c.properties:
                    self.write_char = c.uuid
                    return
        for c in chars.values():
            if "write-without-response" in c.properties or "write" in c.properties:
                self.write_char = c.uuid
                return
        raise RuntimeError("no writable GATT characteristic found on this device")

    async def _subscribe(self):
        assert self.client is not None
        try:
            await self.client.start_notify(NOTIFY_CHAR_UUID, self._on_notify)
        except Exception as exc:  # noqa: BLE001
            if self.debug:
                log(f"notify subscribe skipped: {exc}", "ble")

    def _on_notify(self, _sender, data: bytearray):
        if self.debug:
            log(f"notify <- {bytes(data).hex(' ')}", "ble")

    async def disconnect(self):
        if self.client is not None:
            try:
                await self.client.disconnect()
            except Exception:  # noqa: BLE001
                pass
            self.client = None
        self.state = "disconnected"

    # -- printing ------------------------------------------------------------
    def _supports_no_response(self) -> bool:
        """Prefer write-without-response when the char supports it (pyphomemo)."""
        assert self.client is not None
        if self._write_with_response is not None:
            return not self._write_with_response
        for s in self.client.services:
            for c in s.characteristics:
                if c.uuid.lower() == self.write_char.lower():
                    no_resp = "write-without-response" in c.properties
                    self._write_with_response = not no_resp
                    return no_resp
        self._write_with_response = True
        return False

    async def _write(self, data: bytes):
        assert self.client is not None
        if not self.connected:
            raise RuntimeError("printer disconnected during write")
        response = not self._supports_no_response()
        await self.client.write_gatt_char(self.write_char, data, response=response)

    async def print_raster(self, raster: bytes, height: int, width_bytes: int):
        if not self.connected:
            await self.connect()
        if len(raster) != width_bytes * height:
            raise ValueError(f"raster {len(raster)} bytes != {width_bytes}*{height}")
        mode = f"no-response + {CHUNK_DELAY*1000:.0f}ms" if self._supports_no_response() else "with-response"
        log(f"sending {len(raster)} bytes ({height} lines × {width_bytes}B) · {mode}", "print")
        await self._write(b"\x1b\x4e\x0d" + bytes([self.speed]))
        await asyncio.sleep(DELAY_INIT)
        await self._write(b"\x1b\x4e\x04" + bytes([self.density]))
        await asyncio.sleep(DELAY_INIT)
        await self._write(b"\x1f\x11\x0a")
        await asyncio.sleep(DELAY_INIT)
        await self._write(b"\x1d\x76\x30\x00" + _u16(width_bytes) + _u16(height))
        n_chunks = (len(raster) + CHUNK_SIZE - 1) // CHUNK_SIZE
        for n, i in enumerate(range(0, len(raster), CHUNK_SIZE), start=1):
            if not self.connected:
                raise RuntimeError(f"printer disconnected mid-raster at chunk {n}/{n_chunks}")
            await self._write(raster[i : i + CHUNK_SIZE])
            # With-response already paces; keep CHUNK_DELAY for no-response path.
            delay = 0.005 if not self._supports_no_response() else CHUNK_DELAY
            if delay:
                await asyncio.sleep(delay)
            if n == 1 or n == n_chunks or n % 25 == 0:
                log(f"raster chunk {n}/{n_chunks}", "ble")
        await asyncio.sleep(DELAY_BEFORE_FOOTER)
        if not self.connected:
            raise RuntimeError("printer disconnected before footer")
        await self._write(b"\x1f\xf0\x05\x00\x1f\xf0\x03\x00")
        # Drain OS BLE TX queue + let the head finish before we tear down GATT.
        log(f"footer sent · draining {DELAY_AFTER_FOOTER:.1f}s…", "ble")
        await asyncio.sleep(DELAY_AFTER_FOOTER)
        if not self.connected:
            # Some M110 firmware drops GATT after accepting the job; treat as OK post-footer.
            log("printer dropped during drain (common after accept) — assuming job queued", "warn")


async def scan_cmd(timeout: float = 8.0):
    from bleak import BleakScanner

    log(f"scanning {timeout:.0f}s…", "ble")
    found = await BleakScanner.discover(timeout=timeout, return_adv=True)
    rows = []
    for d, a in found.values():
        name = d.name or a.local_name or "(unknown)"
        rows.append((looks_like_phomemo(name, a.service_uuids), a.rssi or -999, d.address, name))
    rows.sort(key=lambda r: (not r[0], -r[1]))
    for is_p, rssi, addr, name in rows:
        flag = "← Phomemo?" if is_p else ""
        print(f"  {rssi:>5} dBm  {addr:<38} {name:<24} {flag}")
    if not rows:
        print("  nothing found — is Bluetooth on and permitted for your terminal?")


# --------------------------------------------------------------------------- agent
class Agent:
    def __init__(self, args):
        self.args = args
        self.booth = Booth(args.url, args.token)
        self.width, self.height = parse_label(args.label)
        self.printer = None if args.dry_run else Printer(args.addr, density=args.density, speed=args.speed, debug=args.debug)
        self.agent_name = f"{socket.gethostname()}".split(".")[0][:40]
        self.printed = 0
        self.last_heartbeat = 0.0
        self.last_message = ""
        # Coalesce duplicate queue jobs for the same guest (double-POST / retries).
        self._recent_keys: dict[str, float] = {}
        self._dedupe_window = float(os.environ.get("PRINT_DEDUPE_SEC", "12"))
        self.out_dir = Path(args.save_dir) if args.save_dir else (Path(__file__).parent / "out" if args.dry_run else None)
        if self.out_dir:
            self.out_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def guest_key(job: dict) -> str:
        name = str(job.get("name") or "").strip().lower()
        bot = str(job.get("botName") or "").strip().lower()
        bid = str(job.get("badgeId") or "")
        return f"{name}|{bot}" if name and bot else bid

    def _seen_recently(self, key: str) -> bool:
        if not key:
            return False
        ts = self._recent_keys.get(key)
        return ts is not None and (time.time() - ts) < self._dedupe_window

    def _remember(self, job: dict) -> None:
        key = self.guest_key(job)
        now = time.time()
        if key:
            self._recent_keys[key] = now
        bid = str(job.get("badgeId") or "")
        if bid:
            self._recent_keys[bid] = now
        # Drop stale entries
        cutoff = now - self._dedupe_window * 3
        self._recent_keys = {k: v for k, v in self._recent_keys.items() if v >= cutoff}

    # -- heartbeat -----------------------------------------------------------
    def ble_state(self) -> str:
        if self.args.dry_run:
            return "dry-run"
        return self.printer.state if self.printer else "disconnected"

    def heartbeat(self, message: str | None = None, force: bool = False):
        now = time.time()
        if message is not None:
            self.last_message = message
        if not force and now - self.last_heartbeat < 5.0:
            return
        self.last_heartbeat = now
        payload = {
            "ble": self.ble_state(),
            "host": self.agent_name,
            "printer": (self.printer.info.name if self.printer and self.printer.info else self.args.addr),
            "message": self.last_message[:200],
            "version": VERSION,
            "printed": self.printed,
        }
        try:
            status, data = self.booth.heartbeat(payload)
            if status == 401:
                log("heartbeat rejected: wrong BOOTH_TOKEN (set it to match the Vercel project)", "err")
            elif status != 200:
                log(f"heartbeat {status}: {data}", "warn")
        except Exception as exc:  # noqa: BLE001
            log(f"heartbeat failed: {exc}", "warn")

    # -- one job -------------------------------------------------------------
    async def process(self, job: dict) -> bool:
        jid = job["id"]
        who = f"{job.get('name', '?')} × {job.get('botName', '?')}"
        key = self.guest_key(job)
        if self._seen_recently(key) or self._seen_recently(str(job.get("badgeId") or "")):
            log(f"coalesce duplicate job for {who} — complete without reprint", "warn")
            status, data = self.booth.claim(jid, self.agent_name)
            if status == 200:
                self.booth.complete(jid, self.agent_name)
            elif status == 409:
                log(f"skip {jid}: already {data.get('job', {}).get('status', 'taken')}", "warn")
            return False
        status, data = self.booth.claim(jid, self.agent_name)
        if status == 409:
            log(f"skip {jid}: already {data.get('job', {}).get('status', 'taken')}", "warn")
            return False
        if status == 401:
            raise RuntimeError("claim rejected (401): BOOTH_TOKEN mismatch")
        if status != 200:
            raise RuntimeError(f"claim failed ({status}): {data}")
        log(f"claimed {who}", "print")
        self.heartbeat(f"printing {who}", force=True)

        try:
            png = self.booth.label_png(job["badgeId"])
            raster, height, width_bytes = png_to_raster(png, self.width, self.height, self.args.threshold)
            if self.out_dir:
                path = self.out_dir / f"{int(time.time())}-{re.sub(r'[^a-zA-Z0-9]+', '_', who)[:40]}.png"
                path.write_bytes(png)
                log(f"saved {path}", "info")
            if self.args.dry_run:
                await asyncio.sleep(0.6)
            else:
                await self.print_with_retry(raster, height, width_bytes)
            self.printed += 1
            self._remember(job)
            self.booth.complete(jid, self.agent_name)
            log(f"printed {who}", "ok")
            self.heartbeat(f"printed {who}", force=True)
            return True
        except Exception as exc:  # noqa: BLE001
            msg = f"{type(exc).__name__}: {exc}"
            log(f"failed {who}: {msg}", "err")
            self.booth.fail(jid, self.agent_name, msg)
            self.heartbeat(f"failed: {msg}", force=True)
            return False

    async def print_with_retry(self, raster: bytes, height: int, width_bytes: int, attempts: int = 2):
        assert self.printer is not None
        last = None
        for i in range(1, attempts + 1):
            try:
                await self.printer.print_raster(raster, height, width_bytes)
                return
            except Exception as exc:  # noqa: BLE001
                last = exc
                log(f"print attempt {i}/{attempts} failed: {exc}", "warn")
                await self.printer.disconnect()
                await asyncio.sleep(1.0)
        raise RuntimeError(f"print failed after {attempts} attempts: {last}")

    # -- loop ----------------------------------------------------------------
    async def run(self):
        log(f"grokbot print agent v{VERSION} on {platform.system()} · {self.agent_name}")
        log(f"booth  {self.booth.base}")
        log(f"label  {self.args.label} mm → {self.width}×{self.height} dots · density {self.args.density}")
        if self.args.dry_run:
            log(f"DRY RUN · labels saved to {self.out_dir}", "warn")
        else:
            log(f"printer {self.args.addr}", "ble")
            if not self.args.lazy:
                try:
                    await self.printer.connect()
                except Exception as exc:  # noqa: BLE001
                    log(f"{exc} — will keep retrying when a job arrives", "err")

        self.heartbeat("agent started", force=True)
        try:
            await self.loop()
        finally:
            if self.printer:
                await self.printer.disconnect()

    async def loop(self):
        paused_logged = False
        idle_logged = False

        while True:
            try:
                data = self.booth.queued(limit=10)
                auto = bool(data.get("settings", {}).get("autoPrint", True))
                jobs = sorted(data.get("jobs", []), key=lambda j: j.get("createdAt", 0))
                if not auto:
                    if not paused_logged:
                        log("auto-print PAUSED from the booth dashboard — waiting", "warn")
                        paused_logged = True
                    self.heartbeat("paused from dashboard")
                elif jobs:
                    paused_logged = idle_logged = False
                    for job in jobs:
                        # process() coalesces same guest/badgeId within PRINT_DEDUPE_SEC
                        await self.process(job)
                        if self.args.once:
                            break
                else:
                    paused_logged = False
                    if not idle_logged:
                        log("queue empty · listening…")
                        idle_logged = True
                    self.heartbeat("idle · listening")
                if self.args.once:
                    return
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # noqa: BLE001
                log(f"loop error: {exc}", "err")
                self.heartbeat(f"error: {exc}", force=True)
                await asyncio.sleep(3.0)
            await asyncio.sleep(self.args.interval)


async def test_cmd(args):
    width, height = parse_label(args.label)
    png = test_label_png(width, height)
    raster, h, width_bytes = png_to_raster(png, width, height)
    log(f"raster {len(raster)} bytes · {h} lines × {width_bytes}B/line", "info")
    if args.dry_run:
        out = Path(args.save_dir or Path(__file__).parent / "out")
        out.mkdir(parents=True, exist_ok=True)
        (out / "test.png").write_bytes(png)
        log(f"dry run: wrote {out / 'test.png'}", "ok")
        return
    printer = Printer(args.addr, density=args.density, speed=args.speed, debug=args.debug)
    await printer.connect()
    log("printing test label…", "print")
    try:
        await printer.print_raster(raster, h, width_bytes)
        if not printer.connected:
            raise RuntimeError("printer dropped before test completed")
        log("test label sent", "ok")
    finally:
        await printer.disconnect()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Grok Bot Austin — Phomemo M110 print agent")
    p.add_argument("--url", default=os.environ.get("BOOTH_URL", DEFAULT_URL), help="web app base URL (BOOTH_URL)")
    p.add_argument("--token", default=os.environ.get("BOOTH_TOKEN", DEFAULT_TOKEN), help="booth token (BOOTH_TOKEN)")
    p.add_argument("--addr", default=os.environ.get("PHOMEMO_ADDR", DEFAULT_ADDR), help="printer BLE name/serial or MAC/UUID (PHOMEMO_ADDR)")
    p.add_argument("--label", default=os.environ.get("LABEL", "40x20"), help="label size in mm, e.g. 40x20")
    p.add_argument("--density", type=int, default=int(os.environ.get("DENSITY", "15")), help="1..15")
    p.add_argument("--speed", type=int, default=int(os.environ.get("SPEED", "5")), help="1..5")
    p.add_argument("--threshold", type=int, default=128, help="gray → black cutoff (0..255)")
    p.add_argument("--interval", type=float, default=float(os.environ.get("POLL_INTERVAL", "2.5")), help="poll seconds")
    p.add_argument("--save-dir", default=os.environ.get("SAVE_DIR"), help="also save every label PNG here")
    p.add_argument("--dry-run", action="store_true", help="no Bluetooth; save PNGs and mark printed")
    p.add_argument("--lazy", action="store_true", help="don't connect to the printer until the first job")
    p.add_argument("--once", action="store_true", help="drain the queue once and exit")
    p.add_argument("--scan", action="store_true", help="list nearby BLE devices and exit")
    p.add_argument("--test", action="store_true", help="print a test label and exit")
    p.add_argument("--debug", action="store_true", help="log GATT services and notifications")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Single-instance lock so accidental double-launch (or forked shells) cannot dual-print.
    if not args.scan and not args.test:
        import fcntl
        lock_path = Path(__file__).parent / ".print-agent.lock"
        lock_fh = open(lock_path, "a+")
        try:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log(f"another print-agent already holds {lock_path} — exiting", "err")
            return 3
        lock_fh.seek(0)
        lock_fh.truncate()
        lock_fh.write(str(os.getpid()))
        lock_fh.flush()
        # keep lock_fh open for process lifetime
        globals()["_PRINT_AGENT_LOCK_FH"] = lock_fh
    try:
        if args.scan:
            asyncio.run(scan_cmd())
            return 0
        if args.test:
            asyncio.run(test_cmd(args))
            return 0
        asyncio.run(Agent(args).run())
        return 0
    except KeyboardInterrupt:
        print()
        log("bye", "info")
        return 0
    except ModuleNotFoundError as exc:
        log(f"missing dependency: {exc.name}. Run: pip install -r print-agent/requirements.txt", "err")
        return 2
    except Exception as exc:  # noqa: BLE001
        log(str(exc), "err")
        return 1


if __name__ == "__main__":
    sys.exit(main())
