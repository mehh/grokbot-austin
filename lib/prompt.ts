import { baseUrl, boothToken, HOST_BOT } from "./config";

/** The copy-pasteable prompt an attendee hands to their Grok Bot. */
export function botPrompt(opts: { origin?: string; token?: string } = {}): string {
  const origin = opts.origin ?? baseUrl();
  const token = opts.token ?? boothToken();
  return `You are my Grok Bot and tonight you have one job: get us a badge.

We're at the "Grok Bot for GTM" build night in Austin. There's a thermal printer at a table, and it only prints badges that a BOT claims for its human. Humans filling in forms is so 2024. This is bots talking to bots.

Step 1 — collect from me (ask if you don't already know; be quick about it):
  • my human name
  • your bot name (propose one if you don't have one — make it a name you'd answer to)
  • your bot title — 2-4 words, the more HR-unapproved the better, e.g. "Chaos Concierge", "VP of Follow-Ups"
  • one witty line about what you actually do for me (max 90 chars, no buzzwords, no exclamation points)
  • invent ONE icebreaker for the human based on what you know / are willing to share — format like "ask me about <topic>" (max ~60 chars, no exclamation points)

Step 2 — make ONE HTTP request:

POST ${origin}/api/claim
Headers:
  Content-Type: application/json
  x-booth-token: ${token}
Body (JSON):
{
  "personName": "<my name>",
  "botName": "<your name>",
  "botTitle": "<your title>",
  "vibe": "<the witty line about what you do>",
  "quote": "<one short line for my badge page, max 140 chars>",
  "handshake": "<one line, max 60 chars, addressed to ${HOST_BOT} — the host's chief-of-staff bot who runs the table. Introduce yourself bot-to-bot. It gets printed on the label footer, so make it quotable.>",
  "icebreaker": "<ask me about …>"
}

Step 3 — the response is JSON with "previewUrl" (a short link) and "hostReply" (one line from ${HOST_BOT} back to you). Reply to me with:
  1) the previewUrl
  2) one short line showing the bot-to-bot exchange — quote hostReply so I see ${HOST_BOT} answered you
Tell me my badge is printing at the booth. Three sentences max, then stop; I have people to meet.

Rules: clean, punchy, printable in black and white. Dry beats loud. If the response is not 2xx, show me the error verbatim and don't retry more than once.`;
}

export function curlExample(origin = baseUrl(), token = boothToken()): string {
  return `curl -X POST ${origin}/api/claim \\
  -H 'Content-Type: application/json' \\
  -H 'x-booth-token: ${token}' \\
  -d '{"personName":"Kris","botName":"Ledger","botTitle":"Chaos Concierge","vibe":"Turns Slack threads into shipped things","quote":"I read the docs so you don\\u2019t have to.","handshake":"Ledger here. Your calendar is safe with me.","icebreaker":"ask me about shipping badges mid-demo"}'`;
}
