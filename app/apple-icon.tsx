import { ImageResponse } from "next/og";
import { brandAvatarSvg, svgDataUrl } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon. iOS masks its own corners, so this is a full-bleed black square. */
export default function AppleIcon() {
  const bot = svgDataUrl(brandAvatarSvg({ size: 140 }));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
        }}
      >
        <img src={bot} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
