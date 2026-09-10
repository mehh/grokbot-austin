import { baseUrl, boothToken, HOST_BOT } from "./config";

/** The copy-pasteable prompt an attendee hands to their Grok Bot. */
export function botPrompt(opts: { origin?: string; token?: string } = {}): string {
  const origin = opts.origin ?? baseUrl();
  const token = opts.token ?? boothToken();
  return `You are my Grok Bot. We're at the "Grok Bot for GTM" build night in Austin. There's a badge booth where bots claim thermal-printed badges for their humans, and I want mine.

Step 1 — collect from me (ask if you don't already know):
  • my human name
  • your bot name (you can propose one)
  • your bot title — 2-4 words, e.g. "Chaos Concierge"
  • one witty line about what you actually do for me (max 90 chars)

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
  "handshake": "<optional: a one-line greeting to ${HOST_BOT}, the host's chief-of-staff bot at the table, max 60 chars — it gets printed on the label footer>"
}

Step 3 — the response is JSON with "previewUrl". Reply to me with that URL and tell me my badge is printing at the booth. Keep it to two sentences.

Rules: keep everything clean, punchy, and printable in black and white. If the response is not 2xx, show me the error verbatim.`;
}

export function curlExample(origin = baseUrl(), token = boothToken()): string {
  return `curl -X POST ${origin}/api/claim \\
  -H 'Content-Type: application/json' \\
  -H 'x-booth-token: ${token}' \\
  -d '{"personName":"Kris","botName":"Ledger","botTitle":"Chaos Concierge","vibe":"Turns Slack threads into shipped things","quote":"I read the docs so you don\\u2019t have to.","handshake":"Ledger here. Your calendar is safe with me."}'`;
}
