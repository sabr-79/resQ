# ResQ — Precision Triage for the Vulnerable

> When the alert goes out, **we call them first.**

ResQ is an AI-powered emergency outreach system that connects people in disaster situations with first responders. Using **ElevenLabs Conversational AI** to collect critical information and **AI-powered triage** (Featherless Llama 3.1 or Anthropic Claude) to assess risk levels, ResQ creates a live priority map for emergency responders.

## 🚀 Key Features

- **🗣️ Voice-First Emergency Intake** - ElevenLabs AI collects name, location, and emergency details
- **🧠 AI-Powered Triage** - Analyzes risk level and generates priority scores (0-10)
- **🗺️ Live Responder Dashboard** - Real-time map showing emergency locations with priority indicators
- **⚡ Flexible AI Backend** - Supports both Featherless (Llama 3.1 70B) and Anthropic (Claude Sonnet 4)
- **📊 Priority-Based Dispatch** - Responders see who needs help most urgently
- **♿ Inclusive by Design** - Voice-first means no app, no typing, works for everyone

---

## Architecture

```
   ┌──────────────┐    ┌─────────────────┐    ┌────────────────┐
   │ Caller       │──▶ │  ElevenLabs     │──▶ │ ResQ backend   │
   │ (Emergency)  │    │  Conversational │    │  (Express)     │
   └──────────────┘    │  AI Agent       │    │                │
                      └─────────────────┘    │  /triage        │
   ┌──────────────┐                          │  /elevenlabs-   │
   │ Supabase     │◀────────────────────────▶│   webhook       │
   │ patients +   │    Real-time updates     └─────────────────┘
   │ calls tables │                                   │
   └──────────────┘                                   ▼
          ▲                                   ┌────────────────┐
          │                                   │ Featherless or │
          │ realtime                          │ Anthropic API  │
   ┌──────────────────────────────────┐      │ (AI Triage)    │
   │ Next.js Dashboard                │      └────────────────┘
   │  /            → landing page     │
   │  /register    → registry form    │
   │  /dashboard   → live map + list  │
   └──────────────────────────────────┘
```

---

## 🎯 How It Works

1. **Caller reaches out** - Person in emergency clicks the call button or dials in
2. **ElevenLabs AI answers** - Conversational AI calmly collects:
   - Full name
   - Exact location
   - Emergency situation/medical needs
   - Equipment status (oxygen, ventilator, etc.)
3. **AI analyzes risk** - Featherless (Llama 3.1) or Claude assesses:
   - Immediate danger level
   - Medical equipment needs
   - Evacuation urgency
   - Priority score (0-10)
4. **Dashboard updates live** - Responders see:
   - Map pins colored by priority (red = critical)
   - Sorted list of people needing help
   - One-sentence briefing for each case
5. **Responders dispatch** - Go to highest priority locations first

---

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- ElevenLabs account (for conversational AI)
- Featherless API key (free tier) OR Anthropic API key

### 1. Clone and Install

```bash
git clone <your-repo>
cd resQ

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in `backend/schema.sql` in the SQL Editor
3. Enable Realtime on the `patients` table
4. Get your project URL and anon key from Settings → API

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```bash
# AI Provider - choose one: "featherless" or "anthropic"
AI_PROVIDER=featherless

# Featherless API Key (recommended for development)
FEATHERLESS_API_KEY=sk-your-featherless-key

# OR Anthropic API Key (for production)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Twilio (optional - for outbound calls)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ElevenLabs
ELEVENLABS_AGENT_ID=your_agent_id
PUBLIC_BASE_URL=http://localhost:3001
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 4. Set Up AI Provider

**Option A: Featherless (Recommended for Development)**
- See [FEATHERLESS_SETUP.md](./FEATHERLESS_SETUP.md) for detailed instructions
- Free tier available
- Fast Llama 3.1 70B model
- No credit card required

**Option B: Anthropic Claude**
- Get API key from [console.anthropic.com](https://console.anthropic.com)
- Uses Claude Sonnet 4
- Paid API (excellent for production)

### 5. Set Up ElevenLabs Agent

See [ELEVENLABS_SETUP.md](./ELEVENLABS_SETUP.md) for complete guide.

Quick steps:
1. Create agent at [elevenlabs.io/conversational-ai](https://elevenlabs.io/conversational-ai)
2. Use the emergency dispatcher prompt from the guide
3. Configure webhook to `your-backend-url/elevenlabs-webhook`
4. Update `ELEVENLABS_AGENT_ID` in your `.env`

### 6. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
node index.js
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

---

## 📱 Using ResQ

### For Emergency Callers

1. Go to the ResQ website
2. Click the call button (ElevenLabs widget)
3. Speak with the AI dispatcher:
   - Provide your name
   - Give your exact location
   - Explain your emergency situation
4. Help is automatically dispatched

### For Responders

1. Open the **Dashboard** at `/dashboard`
2. See live map with emergency locations
3. Red pins = critical priority
4. Click any pin to see:
   - Person's name and location
   - Priority score (0-10)
   - One-sentence briefing
   - Medical equipment needs
5. Dispatch to highest priority first

### For Administrators

1. Use `/register` to pre-register vulnerable individuals
2. Monitor the `/dashboard` for incoming calls
3. Use "Simulate Disaster" button to test the system
4. Review call logs in Supabase

---

## 🧪 Testing

### Test the AI Triage

```bash
curl -X POST http://localhost:3001/triage \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "location": "123 Oak Street, Apt 4B",
    "reason": "Power outage, on oxygen concentrator, battery has 1 hour left"
  }'
```

### Test ElevenLabs Integration

1. Click the call widget on the homepage
2. Have a conversation with the AI
3. Check backend logs for webhook data
4. Verify new entry appears in dashboard

### Test Full Flow

1. Open dashboard at `/dashboard`
2. Click "🚨 Simulate Disaster"
3. Watch as:
   - Calls are "placed" to registered patients
   - AI triages each case
   - Map pins update with priority colors
   - List re-sorts by urgency

---

## 🎨 Priority System

| Priority | Color | Status | Meaning |
|----------|-------|--------|---------|
| 10 | 🔴 Red | Critical | Immediate life threat - dispatch now |
| 8-9 | 🔴 Red | Critical | Life-sustaining equipment failing |
| 6-7 | 🟠 Orange | Urgent | Medical needs within hours |
| 4-5 | 🟡 Yellow | Moderate | Stable but needs assistance |
| 2-3 | 🟢 Green | Low | Safe, can shelter in place |
| 0-1 | 🟢 Green | Safe | No immediate needs |

---

## 🔧 Customization

### Adjust Triage Logic

Edit `backend/index.js` → `runAITriage()` function:
- Modify priority guidance
- Add new risk factors
- Adjust evacuation thresholds

### Customize ElevenLabs Agent

Edit your agent prompt to:
- Change conversation flow
- Add more questions
- Adjust tone and personality

### Enhance Dashboard

Edit `frontend/app/dashboard/page.tsx`:
- Add weather overlay
- Customize map markers
- Add filtering options

---

## 📊 API Endpoints

### `POST /triage`
Analyze emergency call and assign priority
```json
{
  "name": "John Smith",
  "location": "123 Oak St",
  "reason": "Power out, oxygen low"
}
```

### `POST /elevenlabs-webhook`
Receive data from ElevenLabs agent
```json
{
  "name": "Jane Doe",
  "location": "456 Main St",
  "reason": "Trapped, wheelchair user",
  "transcript": "Full conversation..."
}
```

### `POST /simulate-disaster`
Test the full system with mock data
```json
{
  "event": "Wildfire",
  "area": "Demo County"
}
```

### `GET /alerts/active?area=CA`
Get current NWS disaster alerts

---

## 🚀 Deployment

### Backend (Railway, Render, Fly.io)

1. Push code to GitHub
2. Connect to deployment platform
3. Set environment variables
4. Deploy!

### Frontend (Vercel, Netlify)

1. Push code to GitHub
2. Connect to Vercel/Netlify
3. Set environment variables
4. Deploy!

### Database (Supabase)

Already hosted! Just use your production credentials.

---

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - feel free to use this for good!

---

## 🆘 Support

- **Setup Issues**: Check [FEATHERLESS_SETUP.md](./FEATHERLESS_SETUP.md) and [ELEVENLABS_SETUP.md](./ELEVENLABS_SETUP.md)
- **API Questions**: See inline comments in `backend/index.js`
- **Frontend Issues**: Check browser console for errors

---

## 🌟 Why ResQ Matters

During disasters, people with disabilities face a **double crisis**:
- They're not just fleeing the disaster
- They're racing against failing medical equipment
- They often can't use standard emergency systems

ResQ solves this by:
- ✅ Being **proactive** - we reach out first
- ✅ Being **inclusive** - voice-first, no app needed
- ✅ Being **intelligent** - AI prioritizes who needs help most
- ✅ Being **practical** - works with existing infrastructure

---

**Built with ❤️ for emergency responders and the people they serve**
