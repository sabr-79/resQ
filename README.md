# ResQ — Precision Triage for the Vulnerable

> When the alert goes out, **we call them first.**

ResQ is an AI-powered emergency outreach system that bridges the gap between
live disaster alerts and a secure Vulnerable Needs Registry. Instead of waiting
for a website click or a 911 call, ResQ monitors federal emergency feeds and
**proactively** initiates outbound AI voice calls to at-risk residents in the
danger zone.

- **ElevenLabs Conversational AI** speaks with the resident.
- **Claude (Anthropic)** analyses the live transcript and produces a priority
  score + one-sentence responder briefing.
- A real-time **Responder Dashboard** shows a prioritised map: red pins where
  life-support is failing, green where people are sheltered.

---

## Architecture

```
   ┌──────────────┐    ┌─────────────────┐    ┌────────────────┐
   │ NWS CAP feed │──▶ │  ResQ backend   │──▶ │ Twilio voice   │
   └──────────────┘    │  (Express)      │    │ + ElevenLabs   │
                      │                 │◀── │ Conversational │
   ┌──────────────┐    │  /trigger-      │    │ AI agent       │
   │ Supabase     │◀──▶│   outbound      │    └────────────────┘
   │ patients +   │    │  /triage        │            │
   │ calls tables │    │  /simulate-     │            ▼
   └──────────────┘    │   disaster      │    ┌────────────────┐
          ▲            └─────────────────┘    │ Claude Sonnet  │
          │                                   │ (triage JSON)  │
          │ realtime                          └────────────────┘
   ┌──────────────────────────────────┐
   │ Next.js front-end                │
   │  /            → pitch + agent    │
   │  /register    → registry form    │
   │  /dashboard   → live map + list  │
   └──────────────────────────────────┘
```

---

## One-time setup

### 1. Supabase

Create a project, then in the SQL editor run [`backend/schema.sql`](./backend/schema.sql).
Enable Realtime on the `patients` table so the dashboard live-updates.

Grab the project URL + anon key from **Project Settings → API**.

### 2. Twilio (optional for the demo)

Buy a phone number and grab the Account SID / Auth Token. Skip this and ResQ
will run in *simulated* mode — outbound calls are logged but not actually placed,
so the rest of the pipeline (triage → dashboard) still demos end-to-end.

### 3. Anthropic

Create an API key at console.anthropic.com. Without one, ResQ falls back to a
heuristic triage (still good enough for the demo to make sense).

### 4. ElevenLabs

The home page and outbound TwiML are wired to a public Conversational AI agent
(`agent_1801kqkw46cbf23sqy34vvcyem9w`). Replace with your own agent ID via
`ELEVENLABS_AGENT_ID` if you want.

### 5. Env files

`backend/.env`:
```
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
PUBLIC_BASE_URL=https://<your-tunnel>.ngrok.app
ELEVENLABS_AGENT_ID=agent_...
```

`frontend/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## Run it

```bash
# terminal 1
cd backend && npm install && node index.js

# terminal 2
cd frontend && npm install && npm run dev
```

Open http://localhost:3000.

---

## The 90-second demo (judges)

1. **Open the dashboard** at `/dashboard`. Map shows green pins — every
   registered resident is safe. NWS active-alerts banner runs across the top.
2. **Click 🚨 Simulate Disaster.** The activity feed scrolls:
   - "Disaster signal received — triggering proactive outreach"
   - "✓ N residents contacted, N triaged"
3. **Watch the pins repaint** as Claude scores each call. Pins for ventilator
   and oxygen patients pulse red. The right-hand list re-orders by priority.
4. **Click a red pin.** The side panel shows the AI-generated briefing —
   *"On oxygen concentrator, ~2hrs battery left, immobile. Evacuate first."*
5. **Click 📞 Trigger Call** to demonstrate the proactive outbound flow on a
   single resident.
6. Optional: **Open `/`** and talk to the live ElevenLabs agent yourself.

---

## Why ResQ wins

- **Solves the exact "Double Crisis"** the prompt called out (slides 4 & 5).
- **Inclusive by design** — voice-first means no app, no panic-typing,
  works for the blind, mobility-impaired, and elderly.
- **Proactive, not reactive** — we are the only system that calls *first*.
- **Practical & scalable** — connects to existing city registries (CalOES,
  511, county lists) and existing federal feeds (NWS CAP).
