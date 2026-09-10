# grokbot-austin

**Grok Bot for GTM · Austin build night — the badge booth.** Bots talking to bots.

Guests (or their Grok Bots) claim a badge → it lands in a print queue → a laptop at the table auto-prints it on a **Phomemo M110** (40×30mm thermal label) with a procedurally generated blobby Grok Bot avatar.

Production: **https://grokbotaustin.vercel.app**

---

## Event ops in 2 minutes

### 1. Deploy the web app (once)

1. Import `https://github.com/mehh/grokbot-austin` into Vercel (framework auto-detects Next.js). Name the project **`grokbotaustin`** so production is `grokbotaustin.vercel.app` (rename/assign a domain in the Vercel UI if needed).
2. Set env vars (Project → Settings → Environment Variables):

| Var | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | `https://grokbotaustin.vercel.app` | Used for QR codes, bot prompt, badge links |
| `BOOTH_TOKEN` | `austin-gtm-2026` | Party password. Bots send it as `x-booth-token`; the print agent uses it too. Shown publicly on `/prompt` on purpose. |
| `BADGE_SECRET` | dev fallback | HMAC key that signs badge ids. **Set a random string in prod.** |
| `ADMIN_TOKEN` | _(unset → uses `BOOTH_TOKEN`)_ | Optional. If set, only this token can mutate the queue (pause/reprint/agent). Keeps guests who read `/prompt` from driving the printer. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | _(unset → in-memory)_ | Optional. Upstash Redis for a durable queue (Vercel Marketplace → Upstash → "Connect" adds these automatically; `UPSTASH_REDIS_REST_*` also works). |

3. Deploy. One command from a laptop with the Vercel CLI: `npx vercel --prod`.

> **Storage note.** Badge ids are self-contained (signed payload), so **previews and label PNGs always work with zero database**. The *print queue* is in-memory by default: it survives while the serverless instance is warm, which is fine for a one-night event with steady traffic, but a cold start drops pending jobs. For guaranteed durability add Upstash (2 minutes, free tier). Guests can always hit **"Print again"** on their badge page to re-queue.

### 2. Start the print agent on the booth MacBook

```bash
git clone https://github.com/mehh/grokbot-austin && cd grokbot-austin
export BOOTH_URL=https://grokbotaustin.vercel.app
export BOOTH_TOKEN=austin-gtm-2026     # must match Vercel (or ADMIN_TOKEN if set)
export PHOMEMO_ADDR=Q450E5CQ7550085    # printer's BLE name / serial
npm run print-agent            # first run creates print-agent/.venv and installs bleak + pillow
```

(No Node? `cd print-agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python print_agent.py`. Env vars can also live in `.env.local` at the repo root.)

- Turn the M110 on (blue blinking light). **Do not pair it in macOS Bluetooth settings** and close the Phomemo phone app — BLE printers only take one client.
- First run: macOS asks to allow Bluetooth for your terminal. Allow it.
- The agent scans for `Q450E5CQ7550085`, connects, and then polls the queue every 2.5s. **Auto-print is on by default.** Every new claim prints itself.
- Useful flags (pass after `--`, e.g. `npm run print-agent -- --scan`): `--scan` (list BLE devices), `--test` (print a test label), `--dry-run` (no Bluetooth, saves PNGs to `print-agent/out/`), `--density 12` (lighter), `--lazy` (connect on first job), `--debug`.

### 3. Open the booth dashboard

`https://grokbotaustin.vercel.app/booth` on the table tablet/laptop.

- Live queue, counts, agent/BLE status, **last printed** preview, QR for guests.
- **Auto-print toggle** pauses the agent remotely (it keeps polling, stops claiming).
- Per job: **✓ mark printed**, **✕ skip**, **reprint**. **Test print** queues a calibration badge.
- The booth token is prefilled unless you set `ADMIN_TOKEN` — then type it once (stored in localStorage) or open `/booth?token=…`.

### 4. Tell guests

- Phone: scan the QR on `/` or `/booth` → `/claim` → two names → **Print my badge**. They get `/b/<id>` with a live "queued → printing → printed" status.
- Bot-to-bot (the party trick): send them to **`/prompt`**. They copy the prompt into their Grok Bot; the bot POSTs `/api/agent` with the token, invents a title + one-liner, and replies with a preview URL. The badge prints itself.

---

## Print fallbacks

**BLE via pyphomemo** (if the bundled agent misbehaves) — [mkuhlmann/pyphomemo](https://github.com/mkuhlmann/pyphomemo):

```bash
pip install git+https://github.com/mkuhlmann/pyphomemo
export PHOMEMO_ADDR=Q450E5CQ7550085
curl -o badge.png "https://grokbotaustin.vercel.app/api/label/<badgeId>.png"
phomemo print-image badge.png --label 40x30
```

**Phone app** — download the label PNG from any badge page (`↓ Label PNG`) and print it from the Phomemo app at 40×30mm.

**Browser** — `/booth` is also reachable from Chrome; the agent is the print path, so no Web Bluetooth pairing dance is needed at the table.

---

## What's inside

```
app/
  page.tsx               landing (event framing, QR, live counter)
  claim/                 human claim form with live label preview
  prompt/                copy-pasteable bot prompt + curl
  b/[id]/                badge page: avatar, quote, print status, exact label PNG
  booth/                 live ops dashboard
  api/claim              POST — public claim (rate-limited, honeypot)
  api/agent              POST — bot claim (x-booth-token) · GET — self-describing
  api/agent/heartbeat    POST — print agent health (token)
  api/label/[file]       GET  — <badgeId>.png → 1-bit PNG (?scale=2 for previews)
  api/queue              GET  — jobs + counts + agent + settings · PATCH — {autoPrint}
  api/queue/[id]/…       POST — claim | complete | fail | reprint | cancel (token)
  api/queue/stream       GET  — SSE snapshots (optional; dashboard polls)
lib/
  avatar.ts              procedural SVG avatars (18 shapes · 10 eyes · accessories)
  label.ts               320×240 label layout, text fitting
  render.ts              resvg → threshold → real 1-bit PNG
  badge.ts               HMAC-signed self-describing badge ids
  store.ts               queue store: in-memory or Upstash Redis (atomic claim via Lua)
print-agent/
  print_agent.py         poll → claim → download PNG → BLE print → complete/fail
```

### Badge ids

`base64url({n,b,t,v,q,s,c}) + "." + HMAC-SHA256(BADGE_SECRET)[:12]`. Tamper-proof, DB-free. A badge URL is the badge.

### Avatars

`hash(botName + personName)` → shape (blob, pebble, bean, egg, squircle, tablet, capsule, cylinder, hex, gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf) × style (solid / outline) × eyes × mouth × accessory × face detail. Two colors only; reads at 90px on thermal paper. Inspired by [x.ai's Grok Bot design notes](https://x.ai/news/designing-grok-bot) and community shape libraries — all drawn from SVG primitives, no bitmaps.

### Queue API cheatsheet

```bash
T='x-booth-token: austin-gtm-2026'
curl -s 'https://grokbotaustin.vercel.app/api/queue?status=queued'
curl -s -X POST -H "$T" https://grokbotaustin.vercel.app/api/queue/<jobId>/claim
curl -s -X POST -H "$T" https://grokbotaustin.vercel.app/api/queue/<jobId>/complete
curl -s -X POST -H "$T" -H 'Content-Type: application/json' -d '{"error":"jam"}' https://grokbotaustin.vercel.app/api/queue/<jobId>/fail
curl -s -X PATCH -H "$T" -H 'Content-Type: application/json' -d '{"autoPrint":false}' https://grokbotaustin.vercel.app/api/queue
```

Job lifecycle: `queued → printing → printed | failed`, `reprint` puts anything back to `queued`. `claim` is atomic (409 if someone else got it).

### M110 protocol (as implemented in the agent)

GATT service `ff00`, write `ff02`, notify `ff03`, 128-byte chunks. Job: `1b 4e 0d <speed>` · `1b 4e 04 <density>` · `1f 11 0a` · `1d 76 30 00 <wBytes LE16> <lines LE16> <bitmap>` · `1f f0 05 00 1f f0 03 00`. 40mm label → 320 dots → 40 bytes/line, MSB left, 1 = black.

---

## Local dev

```bash
npm install
cp .env.example .env.local
npm run dev                      # http://localhost:3000
python3 print-agent/print_agent.py --dry-run --url http://localhost:3000
```

`npm run build` must pass before pushing. Fonts: Geist Mono (OFL) is bundled in `public/fonts` for both the site and server-side label rendering.
