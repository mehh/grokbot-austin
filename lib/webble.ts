/**
 * Web Bluetooth driver for the Phomemo M110 (Chrome / Edge only).
 * Fallback print path for the /booth dashboard when the Python agent isn't running.
 *
 * Same wire protocol as print-agent/print_agent.py:
 *   service 0xff00 · write 0xff02 · notify 0xff03 · 128-byte chunks
 */

export const M110_SERVICE = 0xff00;
export const M110_WRITE = 0xff02;
export const M110_NOTIFY = 0xff03;
const CHUNK = 128;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function hasWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function looksLikePhomemo(name: string | undefined): boolean {
  const n = (name ?? "").trim().toUpperCase();
  if (!n) return false;
  if (/^(M110|M120|M220|M200|M02|T02|PHOMEMO)/.test(n)) return true;
  // Bare serial like Q450E5CQ7550085
  return n.length >= 10 && n.length <= 18 && /^[A-Z0-9]+$/.test(n) && /\d/.test(n) && /[A-Z]/.test(n);
}

export type BleState = "unsupported" | "disconnected" | "connecting" | "connected" | "printing" | "error";

export class M110Browser {
  device: BluetoothDevice | null = null;
  private write: BluetoothRemoteGATTCharacteristic | null = null;
  private writeNoResponse = false;
  state: BleState = hasWebBluetooth() ? "disconnected" : "unsupported";
  onChange?: (state: BleState, message?: string) => void;

  constructor(public preferredName: string) {}

  private set(state: BleState, message?: string) {
    this.state = state;
    this.onChange?.(state, message);
  }

  get name(): string {
    return this.device?.name || this.preferredName;
  }

  /**
   * Reconnect to a previously-authorized device whose name contains the preferred serial,
   * without showing the chooser. Requires chrome://flags/#enable-web-bluetooth-new-permissions-backend
   * on older Chromes; on current Chrome `getDevices()` is available by default.
   */
  async reconnectKnown(): Promise<boolean> {
    if (!hasWebBluetooth() || typeof navigator.bluetooth.getDevices !== "function") return false;
    try {
      const devices = await navigator.bluetooth.getDevices();
      const want = this.preferredName.toLowerCase();
      const match =
        devices.find((d) => (d.name ?? "").toLowerCase().includes(want)) ??
        devices.find((d) => looksLikePhomemo(d.name));
      if (!match) return false;
      await this.open(match);
      return true;
    } catch {
      return false;
    }
  }

  /** Show the chooser. Filters prefer the known serial but also list any Phomemo-looking device. */
  async pick(): Promise<void> {
    if (!hasWebBluetooth()) throw new Error("Web Bluetooth is not available here. Use Chrome or Edge on the Mac.");
    const serial = this.preferredName.trim();
    const filters: BluetoothLEScanFilter[] = [];
    if (serial) {
      filters.push({ name: serial }, { name: serial.toUpperCase() }, { name: serial.toLowerCase() });
    }
    filters.push({ namePrefix: "M110" }, { namePrefix: "M120" }, { namePrefix: "M220" }, { namePrefix: "Q" }, { services: [M110_SERVICE] });
    const device = await navigator.bluetooth.requestDevice({ filters, optionalServices: [M110_SERVICE] });
    await this.open(device);
  }

  private async open(device: BluetoothDevice) {
    this.set("connecting", `connecting to ${device.name ?? "printer"}…`);
    try {
      this.device = device;
      device.addEventListener("gattserverdisconnected", () => {
        this.write = null;
        this.set("disconnected", "printer disconnected");
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(M110_SERVICE);
      const chars = await service.getCharacteristics();
      const write = chars.find((c) => c.uuid.includes("ff02")) ?? chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (!write) throw new Error("no writable characteristic on service ff00");
      this.write = write;
      this.writeNoResponse = write.properties.writeWithoutResponse;
      const notify = chars.find((c) => c.uuid.includes("ff03"));
      if (notify?.properties.notify) {
        try {
          await notify.startNotifications();
        } catch {
          /* best effort */
        }
      }
      this.set("connected", `connected · ${device.name ?? "printer"}`);
    } catch (err) {
      this.write = null;
      this.set("error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  disconnect() {
    try {
      this.device?.gatt?.disconnect();
    } catch {
      /* ignore */
    }
    this.write = null;
    this.set("disconnected");
  }

  private async send(bytes: Uint8Array) {
    if (!this.write) throw new Error("not connected");
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    if (this.writeNoResponse) await this.write.writeValueWithoutResponse(buf);
    else await this.write.writeValueWithResponse(buf);
  }

  /** Print a packed 1-bpp raster (1 = black, MSB left). */
  async printRaster(raster: Uint8Array, widthBytes: number, height: number, density = 15, speed = 5) {
    if (raster.length !== widthBytes * height) throw new Error(`raster ${raster.length} != ${widthBytes}×${height}`);
    if (!this.write) throw new Error("printer not connected");
    this.set("printing", "sending label…");
    try {
      await this.send(new Uint8Array([0x1b, 0x4e, 0x0d, speed]));
      await sleep(30);
      await this.send(new Uint8Array([0x1b, 0x4e, 0x04, density]));
      await sleep(30);
      await this.send(new Uint8Array([0x1f, 0x11, 0x0a]));
      await sleep(30);
      await this.send(new Uint8Array([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, height & 0xff, height >> 8]));
      for (let i = 0; i < raster.length; i += CHUNK) {
        await this.send(raster.subarray(i, i + CHUNK));
        await sleep(20);
      }
      await sleep(300);
      await this.send(new Uint8Array([0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00]));
      await sleep(500);
      this.set("connected", "label sent");
    } catch (err) {
      this.set("error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** Fetch a label PNG, threshold it in a canvas, and print it. */
  async printPngUrl(url: string, width = 320, height = 240) {
    const raster = await pngUrlToRaster(url, width, height);
    await this.printRaster(raster, width / 8, height);
  }
}

export async function pngUrlToRaster(url: string, width: number, height: number, threshold = 128): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("could not load label PNG"));
    el.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / img.width, height / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  const { data } = ctx.getImageData(0, 0, width, height);
  const widthBytes = width / 8;
  const out = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < threshold) out[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return out;
}
