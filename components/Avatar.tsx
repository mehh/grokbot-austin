import { avatarSpec, avatarSvg, SCREEN_COLORS, PRINT_COLORS, type AvatarColors } from "@/lib/avatar";

interface Props {
  botName: string;
  personName: string;
  size?: number;
  print?: boolean;
  colors?: AvatarColors;
  className?: string;
  title?: string;
}

/** Renders the deterministic blob for (botName, personName). Works in server and client components. */
export function Avatar({ botName, personName, size = 96, print = false, colors, className, title }: Props) {
  const spec = avatarSpec(botName || "grok", personName || "guest");
  const svg = avatarSvg(spec, { size, colors: colors ?? (print ? PRINT_COLORS : SCREEN_COLORS) });
  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      title={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
