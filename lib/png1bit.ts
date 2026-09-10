/**
 * Minimal 1-bit grayscale PNG encoder (bit depth 1, color type 0).
 * Thermal printers only know black/white, so we threshold RGBA pixels into a real
 * 1-bit image instead of shipping an 8-bit PNG that merely looks monochrome.
 */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, Buffer.from(data)])), 0);
  return Buffer.concat([len, typeBuf, Buffer.from(data), crc]);
}

export interface Bitmap1 {
  width: number;
  height: number;
  /** Packed rows, MSB = leftmost pixel, bit set = BLACK (printer convention). */
  rows: Uint8Array;
  bytesPerRow: number;
}

/** Threshold RGBA pixels (premultiplied or not) into a packed 1-bit bitmap where 1 = black. */
export function rgbaToBitmap(pixels: Uint8Array, width: number, height: number, threshold = 128): Bitmap1 {
  const bytesPerRow = Math.ceil(width / 8);
  const rows = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = pixels[i + 3] / 255;
      // Composite over white so transparent areas print as paper.
      const r = pixels[i] * a + 255 * (1 - a);
      const g = pixels[i + 1] * a + 255 * (1 - a);
      const b = pixels[i + 2] * a + 255 * (1 - a);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < threshold) rows[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, rows, bytesPerRow };
}

export function bitmapToPng(bmp: Bitmap1): Buffer {
  const { width, height, rows, bytesPerRow } = bmp;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  // PNG grayscale 1-bit: 1 = white. Our bitmap uses 1 = black, so invert.
  const raw = Buffer.alloc((bytesPerRow + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (bytesPerRow + 1)] = 0; // filter: none
    for (let i = 0; i < bytesPerRow; i++) {
      raw[y * (bytesPerRow + 1) + 1 + i] = ~rows[y * bytesPerRow + i] & 0xff;
    }
    // Mask padding bits in the final byte to white.
    const pad = bytesPerRow * 8 - width;
    if (pad) raw[y * (bytesPerRow + 1) + bytesPerRow] |= (1 << pad) - 1;
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
