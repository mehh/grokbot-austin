import {
  avatarSpec,
  avatarSvg,
  SCREEN_COLORS,
  PRINT_COLORS,
  type AvatarColors,
  type BotState,
} from "@/lib/avatar";

interface Props {
  botName: string;
  personName: string;
  size?: number;
  print?: boolean;
  colors?: AvatarColors;
  className?: string;
  title?: string;
  /** Web-only behavioural state (idle/working/waiting/blocked/thinking/done). Ignored when `print`. */
  state?: BotState;
  /** Animation stagger in seconds. */
  delay?: number;
}

/** Renders the deterministic blob for (botName, personName). Works in server and client components. */
export function Avatar({ botName, personName, size = 96, print = false, colors, className, title, state, delay }: Props) {
  const spec = avatarSpec(botName || "grok", personName || "guest");
  const svg = avatarSvg(spec, {
    size,
    colors: colors ?? (print ? PRINT_COLORS : SCREEN_COLORS),
    state: print ? undefined : state,
    delay,
  });
  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      title={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Map a print-queue status to the bot's behavioural state. */
export function stateForStatus(status: string | null | undefined): BotState {
  switch (status) {
    case "queued":
      return "waiting";
    case "printing":
      return "working";
    case "printed":
      return "done";
    case "failed":
      return "blocked";
    case "loading":
      return "thinking";
    default:
      return "idle";
  }
}
