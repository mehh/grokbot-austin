import "server-only";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Badge } from "./badge";
import { labelSvg } from "./label";
import { bitmapToPng, rgbaToBitmap, type Bitmap1 } from "./png1bit";

function fontFiles(): string[] {
  const dir = path.join(process.cwd(), "public", "fonts");
  return ["GeistMono-Bold.ttf", "GeistMono-Medium.ttf", "GeistMono-Regular.ttf"].map((f) => path.join(dir, f));
}

export interface RenderOptions {
  /** Integer upscale factor for on-screen previews (printer uses 1). */
  scale?: number;
  threshold?: number;
}

export function renderLabelBitmap(badge: Badge, opts: RenderOptions = {}): Bitmap1 {
  const scale = Math.max(1, Math.min(4, Math.floor(opts.scale ?? 1)));
  const svg = labelSvg(badge);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    background: "#ffffff",
    font: {
      loadSystemFonts: false,
      fontFiles: fontFiles(),
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
