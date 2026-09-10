# grokbot-austin

**Grok Bot for GTM · Austin build night — the badge booth.** Bots talking to bots.

Guests (or their Grok Bots) claim a badge → it lands in a print queue → a laptop at the table auto-prints it on a **Phomemo M110** (40×30mm thermal label) with a procedurally generated blobby Grok Bot avatar.

Production: **https://grokbotaustin.vercel.app**

## Guest flow (QR → their Grok Bot → webapp → print)

1. Guest scans the table QR → `https://grokbotaustin.vercel.app` on their phone.
2. Landing page (dark terminal) has one big CTA: **Copy prompt for your Grok Bot**.
3. They paste the prompt to *their* Grok Bot. The prompt tells the bot to:
   - collect their human name, a bot name, a 2–4 word bot title, and one witty line about what it does;
   - `POST https://grokbotaustin.vercel.app/api/claim` with header `x-booth-token: austin-gtm-2026` and JSON body `{ personName, botName, botTitle, vibe, quote, handshake }`;
   - reply to the human with the returned `previewUrl` and say the badge is printing at the booth;
   - optionally invent a one-line **handshake to Chaos Concierge** (Kris's chief-of-staff bot at the table) — it's printed on the label footer.
4. The webapp signs the badge, enqueues it, and Kris's Mac print agent auto-prints it on the M110 `q450E5CQ7550085` within seconds. The guest watches `queued → printing → printed` on `/b/<id>`.
5. No bot handy? The **manual form** at `/claim` posts the same payload.

`/live` is a wall of tonight's claims (names + blob avatars, live status) plus a terminal feed ("Ledger shook hands with Chaos Concierge on behalf of Kris") for the booth screen.

### Table tent — what Kris says when someone walks up

> **"Hey — got a Grok Bot? Scan this, copy the prompt, paste it to your bot.**
> **Your bot claims a badge for both of you. It picks its own title. About 1 in 20 comes out LEGENDARY.**
> **Printer's right here — it'll be in your hand in ten seconds."**

If they don't have a bot: "No bot? Tap *manual form*, two names, done."

### What's on every label

- Big name, blob avatar (deterministic from your two names), bot name + title
- A **conversation starter** hashed from the pair — "Ask me what my bot shipped this week", "Debate: bots as coworkers or tools?" — so strangers have an opener
- A **rarity tag** — `COMMON` / `* RARE` (~20%) / `** LEGENDARY **` (~5%, double frame). People compare.
- `GROK BOT · AUSTIN` footer, plus the bot's handshake to Chaos Concierge if it sent one

### Bot meetup bingo (on `/`)

1. Find a LEGENDARY · 2. Swap icebreakers · 3. Demo a routine · 4. Bot-to-bot intro · 5. Title envy

---

## Event ops in 2 minutes

### 1. Deploy the web app (once, ~3 minutes)

**Fastest (repo already on GitHub):** [Import `mehh/grokbot-austin`](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Fmehh%2Fgrokbot-austin&project-name=grokbotaustin) — set Project Name to `grokbotaustin`, add the env vars below, Deploy.

**Or clone-style one-click:** [Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmehh%2Fgrokbot-austin&project-name=grokbotaustin&repository-name=grokbot-austin&env=BADGE_SECRET,BOOTH_TOKEN,NEXT_PUBLIC_BASE_URL&envDescription=BADGE_SECRET%3A%20any%20random%20string.%20BOOTH_TOKEN%3A%20party%20password%20(default%20austin-gtm-2026).%20NEXT_PUBLIC_BASE_URL%3A%20https%3A%2F%2Fgrokbotaustin.vercel.app) — creates a *copy* of the repo under your account; fine for tonight but pushes to `mehh/grokbot-austin` won't auto-deploy to it.

**CLI (any laptop with `vercel login` done):**

```bash
git clone https://github.com/mehh/grokbot-austin && cd grokbot-austin
npx vercel link --yes --project grokbotaustin
npx vercel env add NEXT_PUBLIC_BASE_URL production   # https://grokbotaustin.vercel.app
npx vercel env add BOOTH_TOKEN production            # austin-gtm-2026
npx vercel env add BADGE_SECRET production           # any random string
npx vercel --prod
```

**Or by hand:**

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `mehh/grokbot-austin` (install the Vercel GitHub app on the `mehh` account if it isn't listed).
2. **Project Name:** `grokbotaustin`. Framework preset auto-detects **Next.js**; leave build/output/install commands at defaults. Root directory: `./`.
3. Expand **Environment Variables** and add the values from the table below (at minimum `BADGE_SECRET`).
4. **Deploy.** First build takes ~1–2 minutes.
5. **Attach the domain `grokbotaustin.vercel.app`:** Project → **Settings → Domains**. If the project was named `grokbotaustin`, this domain is already the production alias. If Vercel generated something else (e.g. `grokbotaustin-abc123.vercel.app`), click **Add**, type `grokbotaustin.vercel.app`, and save — any unused `*.vercel.app` name can be claimed instantly, no DNS needed. To rename the project instead: Settings → General → Project Name → `grokbotaustin`.
6. Confirm `NEXT_PUBLIC_BASE_URL` equals the final domain (QR codes and the bot prompt embed it). Changing an env var requires a **Redeploy** (Deployments → ⋯ → Redeploy).
7. Smoke test: open `/booth` on the table device, `/prompt` on your phone, and `curl -X POST https://grokbotaustin.vercel.app/api/agent -H 'x-booth-token: austin-gtm-2026' -H 'Content-Type: application/json' -d '{"name":"Kris","botName":"Ledger"}'` should return `201` with a `previewUrl`.

Env vars (Project → Settings → Environment Variables):

| Var | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | `https://grokbotaustin.vercel.app` | Used for QR codes, bot prompt, badge links |
| `BOOTH_TOKEN` | `austin-gtm-2026` | Party password. Bots send it as `x-booth-token`; the print agent uses it too. Shown publicly on `/prompt` on purpose. |
| `BADGE_SECRET` | dev fallback | HMAC key that signs badge ids. **Set a random string in prod.** |
| `NEXT_PUBLIC_PHOMEMO_NAME` | `q450E5CQ7550085` | Printer BLE name/serial. `/booth`'s Web Bluetooth fallback prefers this device in the chooser and on silent reconnect. |
| `ADMIN_TOKEN` | _(unset → uses `BOOTH_TOKEN`)_ | Optional. If set, only this token can mutate the queue (pause/reprint/agent). Keeps guests who read `/prompt` from driving the printer. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | _(unset → in-memory)_ | Optional. Upstash Redis for a durable queue (Vercel Marketplace → Upstash → "Connect" adds these automatically; `UPSTASH_REDIS_REST_*` also works). |

CLI alternative from any laptop: `npx vercel link` (pick/create project `grokbotaustin`) then `npx vercel --prod`.

> **Storage note.** Badge ids are self-contained (signed payload), so **previews and label PNGs always work with zero database**. The *print queue* is in-memory by default: it survives while the serverless instance is warm, which is fine for a one-night event with steady traffic, but a cold start drops pending jobs. For guaranteed durability add Upstash (2 minutes, free tier). Guests can always hit **"Print again"** on their badge page to re-queue.

### 2. Start the print agent on the booth MacBook

```bash
git clone https://github.com/mehh/grokbot-austin && cd grokbot-austin
export BOOTH_URL=https://grokbotaustin.vercel.app
export BOOTH_TOKEN=austin-gtm-2026     # must match Vercel (or ADMIN_TOKEN if set)
export PHOMEMO_ADDR=q450E5CQ7550085    # printer's BLE name / serial (case-insensitive match)
npm run print-agent            # first run creates print-agent/.venv and installs bleak + pillow
```

(No Node? `cd print-agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python print_agent.py`. Env vars can also live in `.env.local` at the repo root.)

- Kris's M110 is already powered on and visible over BLE as **`q450E5CQ7550085`**. Close the Phomemo phone app — BLE printers only take one client.
- **Pairing gotcha.** The M110 should *not* be paired in macOS System Settings → Bluetooth. If it currently shows there as connected and prints fail or the agent can't connect, click ⓘ → **Forget This Device**, power-cycle the printer, and let the agent / Chrome / pyphomemo own the BLE session. (If it's already printing fine while listed there, leave it alone.)
- First run: macOS asks to allow Bluetooth for your terminal. Allow it.
- The agent scans for `q450E5CQ7550085` (name/serial match is case-insensitive), connects, and then polls the queue every 2.5s. **Auto-print is on by default.** Every new claim prints itself.
- Useful flags (pass after `--`, e.g. `npm run print-agent -- --scan`): `--scan` (list BLE devices), `--test` (print a test label), `--dry-run` (no Bluetooth, saves PNGs to `print-agent/out/`), `--density 12` (lighter), `--lazy` (connect on first job), `--debug`.

### 3. Open the booth dashboard

`https://grokbotaustin.vercel.app/booth` on the table tablet/laptop.

- Live queue, counts, agent/BLE status, **last printed** preview, QR for guests.
- **Auto-print toggle** pauses the agent remotely (it keeps polling, stops claiming).
- Per job: **✓ mark printed**, **✕ skip**, **reprint**. **Test print** queues a calibration badge.
- The booth token is prefilled unless you set `ADMIN_TOKEN` — then type it once (stored in localStorage) or open `/booth?token=…`.
- **Browser fallback (Chrome/Edge only):** the "printer · this browser" card connects over Web Bluetooth. It first tries a silent reconnect to an already-authorized device whose name contains `q450E5CQ7550085`; otherwise the chooser opens with that serial preferred but any Phomemo (M110/M120/M220, `Q…` serials, service `ff00`) selectable. Once connected, every job gets a **▮ print here** button (claims → prints → marks printed/failed). Use it if the Python agent is down.

### 4. Tell guests

- Scan the QR → tap **Copy prompt for your Grok Bot** → paste to their bot → open the link it replies with. That's the whole pitch.
- Manual fallback: `/claim` (two names, optional title/vibe/quote/handshake, live label preview).
- Put `/live` on a spare screen so the table feels alive.

### 5. Test checklist (before doors open)

```bash
# via curl (what a bot does)
curl -s -X POST https://grokbotaustin.vercel.app/api/claim \
  -H 'Content-Type: application/json' -H 'x-booth-token: austin-gtm-2026' \
  -d '{"personName":"Kris","botName":"Ledger","botTitle":"Chaos Concierge","vibe":"Turns Slack threads into shipped things","quote":"I read the docs so you do not have to.","handshake":"Ledger here. Your calendar is safe with me."}'
# → 201 {"ok":true,"status":"queued","previewUrl":"https://grokbotaustin.vercel.app/b/…","labelUrl":"…png"}
```

1. Open the `previewUrl` on a phone → status card shows **Print queued** → flips to **Printing…** → **Printed ✓** once the agent runs.
2. `curl -o t.png "<labelUrl>"` → 320×240 1-bit PNG.
3. Via prompt: on `/`, tap **Copy prompt for your Grok Bot**, paste into Grok, answer its questions, open the link it returns. The claim should appear on `/booth` and `/live` within 3s and print within ~10s.
4. `/booth`: agent pill green, auto-print ON, **Test print** produces a calibration label.

---

## Print fallbacks

**BLE via pyphomemo** (if the bundled agent misbehaves) — [mkuhlmann/pyphomemo](https://github.com/mkuhlmann/pyphomemo):

```bash
pip install git+https://github.com/mkuhlmann/pyphomemo
curl -o badge.png "https://grokbotaustin.vercel.app/api/label/<badgeId>.png"   # or ↓ Label PNG on any badge page
phomemo print-image badge.png --label 40x30 --addr q450E5CQ7550085
```

`phomemo scan` lists nearby printers if the serial doesn't resolve. `export PHOMEMO_ADDR=q450E5CQ7550085` saves typing `--addr`.

**If Web Bluetooth / pyphomemo prints fail after pairing in macOS System Settings:** unpair (Bluetooth → ⓘ → Forget This Device), power-cycle the M110, and let Chrome or pyphomemo own the BLE session — macOS-level pairing grabs the classic profile and blocks the LE writes. Kris's unit is currently connected under the id `q450E5CQ7550085`; only unpair if prints actually fail.

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
  live/                  wall of tonight's claims (names + avatars, live status)
  api/claim              POST — THE claim endpoint: bots (x-booth-token, unlimited) + form (rate-limited)
  api/agent              POST — alias of /api/claim requiring the token · GET — self-describing
  api/agent/heartbeat    POST — print agent health (token)
  api/label/[file]       GET  — <badgeId>.png → 1-bit PNG (?scale=2 for previews)
  api/queue              GET  — jobs + counts + agent + settings · PATCH — {autoPrint}
  api/queue/[id]/…       POST — claim | complete | fail | reprint | cancel (token)
  api/queue/stream       GET  — SSE snapshots (optional; dashboard polls)
lib/
  flair.ts               icebreakers, rarity roll, bingo, live-feed copy (all hashed from the two names)
  webble.ts              Web Bluetooth M110 driver for the /booth fallback (Chrome/Edge)
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

`hash(botName + personName)` → shape (blob, pebble, bean, egg, squircle, tablet, capsule, cylinder, hex, gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf) × style (solid / outline) × eyes × mouth × accessory × face detail. Two colors only; reads at 90px on thermal paper. Follows [x.ai's Grok Bot design notes](https://x.ai/news/designing-grok-bot) — simple shapes, expressive eyes, controlled variation, one visual family — plus community shape libraries; all drawn from SVG primitives, no bitmaps.

**Behavioural states (web only).** `idle · working · waiting · blocked · thinking · done` are CSS-driven motions (`.gb-<state>` in `globals.css`, `transform-box: fill-box`, honours `prefers-reduced-motion`). They are mapped from real app events: badge page follows the print status (`queued→waiting`, `printing→working`, `printed→done`, `failed→blocked`), the claim form's bot *thinks* while you type and *works* while submitting, booth queue rows mirror job status, the landing marquee idles with staggered delays. `<Avatar state="…" />` opts in; the print path (`PRINT_COLORS`, no `state`) emits static, unwrapped, pure black/white SVG — no motion, no gray fills.

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
