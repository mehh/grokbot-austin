import { ImageResponse } from "next/og";
import { brandAvatarSvg, svgDataUrl } from "@/lib/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon: the Grok Bot mascot on a black rounded tile so it reads on light tab bars too. */
export default function Icon() {
  const bot = svgDataUrl(brandAvatarSvg({ size: 52 }));
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
          borderRadius: 14,
        }}
      >
        <img src={bot} width={52} height={52} alt="" />
      </div>
    ),
    size,
  );
}
