import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/config";
import { brandAvatarSvg, lineupAvatarSvg, OG_LINEUP, svgDataUrl } from "@/lib/brand";

export const alt = "Grok Bot · Austin — bots talking to bots. Badge booth.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = size.width;
const H = size.height;

/** Faint terminal grid (same idea as `.grid-bg` in globals.css), fading out toward the bottom. */
function gridSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">` +
    `<path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="1"/>` +
    `</pattern>` +
    `<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#000"/>` +
    `</linearGradient>` +
    `<mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/></mask>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)" mask="url(#m)"/>` +
    `</svg>`
  );
}

// Only the two weights used below are traced into this route (~150 KB each).
async function fonts() {
  const dir = join(process.cwd(), "public", "fonts");
  const [bold, regular] = await Promise.all([
    readFile(join(dir, "GeistMono-Bold.ttf")),
    readFile(join(dir, "GeistMono-Regular.ttf")),
  ]);
  return [
    { name: "Geist Mono", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Geist Mono", data: regular, weight: 400 as const, style: "normal" as const },
  ];
}

export default async function OpenGraphImage() {
  const mascot = svgDataUrl(brandAvatarSvg({ size: 300 }));
  const lineup = OG_LINEUP.map(([bot, human]) => ({ bot, src: svgDataUrl(lineupAvatarSvg(bot, human, 64)) }));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000",
          color: "#fff",
          fontFamily: "Geist Mono",
          position: "relative",
        }}
      >
        <img src={svgDataUrl(gridSvg())} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0 }} />

        <div style={{ display: "flex", flex: 1, padding: "56px 64px 0 64px" }}>
          {/* Copy */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 19, color: "#8a8a8a", lineHeight: 1.2, whiteSpace: "nowrap" }}>
              <span style={{ color: "#fff" }}>$</span>
              <span style={{ marginLeft: 12 }}>
                grok-bot claim --event &quot;{EVENT.name}&quot; --city {EVENT.city.toLowerCase()}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 28,
                fontSize: 104,
                fontWeight: 700,
                lineHeight: 0.98,
                letterSpacing: -4,
              }}
            >
              <span>bots talking</span>
              <span style={{ display: "flex", alignItems: "center" }}>
                to bots
                <span style={{ display: "flex", width: 40, height: 84, marginLeft: 16, marginTop: 6, background: "#fff" }} />
              </span>
            </div>

            <div style={{ display: "flex", marginTop: 30, fontSize: 18, letterSpacing: 3, color: "#8a8a8a", whiteSpace: "nowrap" }}>
              {EVENT.tag} · BADGE BOOTH · BUILD NIGHT
            </div>

            <div style={{ display: "flex", marginTop: 18, fontSize: 24, lineHeight: 1.4, color: "#d4d4d4", maxWidth: 720 }}>
              Paste one prompt to your Grok Bot. It claims the sticker, the M110 on the table prints it. Peel, stick, talk to someone.
            </div>
          </div>

          {/* Mascot + lineup */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 330, marginLeft: 24 }}>
            <img src={mascot} width={300} height={300} alt="" />
            <div style={{ display: "flex", marginTop: 18, gap: 8 }}>
              {lineup.map((b) => (
                <img key={b.bot} src={b.src} width={56} height={56} alt="" />
              ))}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "0 64px",
            padding: "22px 0 30px",
            borderTop: "1px solid #262626",
            fontSize: 20,
            color: "#8a8a8a",
          }}
        >
          <span style={{ display: "flex" }}>
            <span style={{ color: "#fff", fontWeight: 700 }}>grokbot</span>
            <span>.austin</span>
            <span style={{ marginLeft: 24 }}>grokbotaustin.vercel.app</span>
          </span>
          <span>prints on a Phomemo M110 · 40×20mm · 1-bit</span>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}
