import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
  /** Draw white modules on black (default) or black on white. */
  invert?: boolean;
  className?: string;
  caption?: string;
}

/** Server component: renders a crisp SVG QR code. */
export async function QR({ value, size = 160, invert = false, className, caption }: Props) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: invert ? { dark: "#000000", light: "#ffffff" } : { dark: "#ffffff", light: "#000000" },
  });
  const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" shape-rendering="crispEdges" `);
  return (
    <figure className={`inline-flex flex-col items-center gap-2 ${className ?? ""}`}>
      <div
        className={`rounded-md p-2 ${invert ? "bg-white" : "border border-line bg-black"}`}
        style={{ lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: sized }}
      />
      {caption ? <figcaption className="text-[11px] tracking-[0.18em] text-muted uppercase">{caption}</figcaption> : null}
    </figure>
  );
}
