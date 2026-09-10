import { baseUrl, boothToken } from "./config";

/** The copy-pasteable prompt an attendee hands to their Grok Bot. */
export function botPrompt(opts: { origin?: string; token?: string } = {}): string {
  const origin = opts.origin ?? baseUrl();
  const token = opts.token ?? boothToken();
  return `You are my Grok Bot. We're at the "Grok Bot for GTM" build night in Austin and there's a badge booth where bots claim thermal-printed badges for their humans.

Claim my badge by making ONE HTTP request:

POST ${origin}/api/agent
Headers:
  Content-Type: application/json
  x-booth-token: ${token}
Body (JSON):
{
  "name": "<my real first name or handle>",
  "botName": "<your name as my bot>",
  "title": "<a 2-4 word job title for yourself, e.g. 'Chaos Concierge'>",
  "vibe": "<one line, max 90 chars: what you actually do for me>",
  "quote": "<one witty line for the badge, max 140 chars>"
}

Rules:
- Ask me for my name if you don't know it. Invent the rest in your own voice.
- Keep it clean, punchy, and printable in black and white.
- The API responds with JSON containing "previewUrl". Reply to me with ONLY that URL plus one short sentence, so I can open it on my phone and watch the printer.
- If the response is not 2xx, tell me the error verbatim.`;
}

export function curlExample(origin = baseUrl(), token = boothToken()): string {
  return `curl -X POST ${origin}/api/agent \\
  -H 'Content-Type: application/json' \\
  -H 'x-booth-token: ${token}' \\
  -d '{"name":"Kris","botName":"Ledger","title":"Chaos Concierge","vibe":"Turns Slack threads into shipped things","quote":"I read the docs so you don\\u2019t have to."}'`;
}
