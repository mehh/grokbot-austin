import type { Badge } from "@/lib/badge";
import { labelSvg } from "@/lib/label";

interface Props {
  badge: Badge;
  className?: string;
}

/**
 * Exact-geometry preview of the 40×30mm label, rendered from the same SVG the printer path uses.
 * Scales with its container; the aspect ratio is locked to 4:3.
 */
export function LabelPreview({ badge, className }: Props) {
  const svg = labelSvg(badge, { responsive: true });
  return (
    <div
      className={`aspect-[4/3] w-full overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_30px_80px_-20px_rgba(255,255,255,0.15)] ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
