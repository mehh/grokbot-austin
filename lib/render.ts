import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Badge } from "./badge";
import { labelSvg } from "./label";
import { bitmapToPng, rgbaToBitmap, type Bitmap1 } from "./png1bit";

const FONT_FILES = ["GeistMono-Bold.ttf", "GeistMono-Medium.ttf", "GeistMono-Regular.ttf"];

let resolvedFonts: string[] | null = null;

/** Bundled Geist Mono files (traced into the serverless function via outputFileTracingIncludes). */
function fontFiles(): string[] {
  if (resolvedFonts) return resolvedFonts;
  const candidates = [path.join(process.cwd(), "public", "fonts"), path.join(process.cwd(), ".next", "public", "fonts")];
  for (const dir of candidates) {
    const files = FONT_FILES.map((f) => path.join(dir, f)).filter((p) => existsSync(p));
    if (files.length) {
      resolvedFonts = files;
      return files;
    }
  }
  console.warn("label fonts not found; falling back to system fonts");
  resolvedFonts = [];
  return resolvedFonts;
}

export interface RenderOptions {
  /** Integer upscale factor for on-screen previews (printer uses 1). */
  scale?: number;
  threshold?: number;
}

export function renderLabelBitmap(badge: Badge, opts: RenderOptions = {}): Bitmap1 {
  const scale = Math.max(1, Math.min(4, Math.floor(opts.scale ?? 1)));
  const svg = labelSvg(badge);
  const files = fontFiles();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    background: "#ffffff",
    font: {
      loadSystemFonts: files.length === 0,
      fontFiles: files,
      defaultFontFamily: "Geist Mono",
      monospaceFamily: "Geist Mono",
    },
    textRendering: 1,
    shapeRendering: 2,
  });
  const img = resvg.render();
  return rgbaToBitmap(img.pixels, img.width, img.height, opts.threshold ?? 140);
}

export function renderLabelPng(badge: Badge, opts: RenderOptions = {}): Buffer {
  return bitmapToPng(renderLabelBitmap(badge, opts));
}
