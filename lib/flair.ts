/**
 * Party-trick layer: icebreakers, rarity, bingo, and live-feed copy.
 * Everything is derived from hash(botName + personName) so the label, the web page and the
 * live wall always agree — and the same pair always gets the same line and rarity.
 */
import { avatarSeed, fnv1a, rng } from "./hash";

export const ICEBREAKERS = [
  "Ask me what my bot shipped this week",
  "Debate: bots as coworkers or tools?",
  "I automate outreach — ask me my weirdest win",
  "Find someone whose bot has a cooler title",
  "Ask my bot's origin story. It has one.",
  "My bot has opinions about your CRM",
  "Ask me what I stopped doing by hand",
  "Trade one prompt with me. Best one wins.",
  "Guess my bot's job from its face",
  "Ask me what my bot refuses to do",
  "Bet you my bot replies faster than yours",
  "Ask me what broke at 2am and who fixed it",
  "Tell me your bot's name. I'll rate it.",
  "Ask me which meeting my bot replaced",
  "Swap icebreakers with me. Yes, this one.",
  "Ask me the dumbest thing I automated",
  "My bot and yours should meet. Introduce them.",
  "Ask what my bot says about me behind my back",
  "Pitch me in one line. My bot is listening.",
  "Ask me what GTM stands for tonight",
  "Compare rarity tags with me. Loser buys tacos.",
  "Ask me what my bot would print if it could",
  "My bot wrote my title. Ask if I approved.",
  "Ask me who's in charge: me or the bot",
] as const;

export type Rarity = "common" | "rare" | "legendary";

export interface Flair {
  icebreaker: string;
  rarity: Rarity;
  /** Web label with symbols: "★ LEGENDARY ★". */
  rarityTag: string;
  /** Print-safe label (Geist Mono has no ★/◆): "** LEGENDARY **". */
  rarityTagPrint: string;
}

/** ~5% legendary, ~20% rare, rest common. */
export function rarityFor(seed: string): Rarity {
  const r = rng(fnv1a(`${seed}::rarity`))();
  if (r < 0.05) return "legendary";
  if (r < 0.25) return "rare";
  return "common";
}

export function icebreakerFor(seed: string): string {
  const r = rng(fnv1a(`${seed}::ice`))();
  return ICEBREAKERS[Math.floor(r * ICEBREAKERS.length) % ICEBREAKERS.length];
}

export function flairFor(botName: string, personName: string): Flair {
  const seed = avatarSeed(botName, personName);
  const rarity = rarityFor(seed);
  return {
    icebreaker: icebreakerFor(seed),
    rarity,
    rarityTag: rarity === "legendary" ? "★ LEGENDARY ★" : rarity === "rare" ? "◆ RARE" : "COMMON",
    rarityTagPrint: rarity === "legendary" ? "** LEGENDARY **" : rarity === "rare" ? "* RARE" : "COMMON",
  };
}

export const BINGO = [
  { id: "legendary", title: "Find a LEGENDARY", body: "Only ~1 in 20 badges. Photograph it with its human." },
  { id: "swap", title: "Swap icebreakers", body: "Read yours out loud. Do theirs. No skipping." },
  { id: "demo", title: "Demo a routine", body: "Show one thing your bot does for you every day. 60 seconds." },
  { id: "handshake", title: "Bot-to-bot intro", body: "Get two bots to greet each other via their humans. Awkward is fine." },
  { id: "title", title: "Title envy", body: "Find a bot title cooler than yours. Admit it publicly." },
] as const;

const HANDSHAKE_VERBS = ["shook hands with", "pinged", "traded prompts with", "nodded at", "sent a calendar invite to", "fist-bumped"];

/** One line for the live feed, deterministic per job so it doesn't flicker between polls. */
export function feedLine(job: { name: string; botName: string; title?: string; source: "human" | "bot"; handshake?: string; status: string }, hostBot: string): string {
  const seed = avatarSeed(job.botName, job.name);
  const r = rng(fnv1a(`${seed}::feed`));
  const rarity = rarityFor(seed);
  const verb = HANDSHAKE_VERBS[Math.floor(r() * HANDSHAKE_VERBS.length)];
  const who = job.title ? `${job.botName} (${job.title})` : job.botName;
  if (job.status === "printed") return `${who} printed a ${rarity.toUpperCase()} badge for ${job.name}`;
  if (job.status === "printing") return `${who} is coming out of the printer right now`;
  if (job.status === "failed") return `${who} jammed the printer. Classic.`;
  if (job.source === "bot") return `${who} ${verb} ${hostBot} on behalf of ${job.name}`;
  return `${job.name} typed ${who} into existence`;
}
