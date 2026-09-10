/**
 * One-shot: sample 4×6 badge PNG (preview + crisp 1-bit) with blob avatar + custom icebreaker.
 * Usage: npx --yes tsx scripts/render-4x6.ts
 */
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createBadge } from "../lib/badge";
import { label4x6Svg, LABEL_4X6 } from "../lib/label4x6";
import { bitmapToPng, rgbaToBitmap } from "../lib/png1bit";

const OUT_DIR = "/Users/krischase/gba-austin";
const ARTIFACTS = path.join(process.cwd(), "artifacts");

const badge = createBadge({
  personName: "Annie",
  botName: "Conner",
  botTitle: "Delegation Officer",
  vibe: "Runs her errands, drafts, and agents so she can stay in the room",
  handshake: "Conner checking in for Annie",
  icebreaker: "ask me about shipping PeptIQ to clinics",
  source: "bot",
});

const svg = label4x6Svg(badge, { qrUrl: "https://grokbotaustin.vercel.app/b/sample-annie" });
const fontDir = path.join(process.cwd(), "public", "fonts");
const fontFiles = ["GeistMono-Bold.ttf", "GeistMono-Medium.ttf", "GeistMono-Regular.ttf"].map((f) =>
  path.join(fontDir, f),
);

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: LABEL_4X6.width },
  background: "#ffffff",
  font: {
    loadSystemFonts: false,
    fontFiles,
    defaultFontFamily: "Geist Mono",
    monospaceFamily: "Geist Mono",
  },
  textRendering: 1,
  shapeRendering: 2,
});
const img = resvg.render();
const previewPng = Buffer.from(img.asPng());
const bmp = rgbaToBitmap(img.pixels, img.width, img.height, 128);
const oneBit = bitmapToPng(bmp);

const previewPath = path.join(OUT_DIR, "badge-4x6-preview.png");
const oneBitPath = path.join(OUT_DIR, "badge-4x6-1bit.png");
writeFileSync(previewPath, previewPng);
writeFileSync(oneBitPath, oneBit);

if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });
copyFileSync(previewPath, path.join(ARTIFACTS, "badge-4x6-preview.png"));
copyFileSync(oneBitPath, path.join(ARTIFACTS, "badge-4x6-1bit.png"));

console.log(
  JSON.stringify(
    {
      id: badge.id,
      icebreaker: badge.icebreaker,
      width: img.width,
      height: img.height,
      previewPath,
      oneBitPath,
      payloadHasI: badge.id.includes(".") && Buffer.from(badge.id.split(".")[0].replace(/-/g, "+").replace(/_/g, "/") + "==", "base64").toString().includes('"i"'),
    },
    null,
    2,
  ),
);
