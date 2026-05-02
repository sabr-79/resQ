# ResQ Updates - Summary of Changes

## Overview
Updated ResQ to use ElevenLabs for emergency intake and added flexible AI backend support (Featherless + Anthropic).

---

## ✅ What's New

### 1. **Flexible AI Backend**
- ✅ Added support for **Featherless API** (Llama 3.1 70B)
- ✅ Kept support for **Anthropic Claude**
- ✅ Easy switching via `AI_PROVIDER` environment variable
- ✅ Automatic fallback to heuristic triage if no API key

### 2. **Enhanced Triage System**
- ✅ Accepts both registered patients AND new callers
- ✅ Collects: name, location, reason for calling
- ✅ Improved priority scoring (0-10 scale)
- ✅ Better evacuation determination logic
- ✅ More detailed responder briefings

### 3. **ElevenLabs Integration**
- ✅ New `/elevenlabs-webhook` endpoint
- ✅ Receives structured data from conversational AI
- ✅ Automatically creates patient records
- ✅ Triggers AI triage on call completion
- ✅ Updates dashboard in real-time

### 4. **Improved Error Handling**
- ✅ Fixed Twilio initialization error
- ✅ Better validation for API credentials
- ✅ Graceful degradation when services unavailable
- ✅ Clear console logging for debugging

### 5. **Documentation**
- ✅ Created `FEATHERLESS_SETUP.md` - Complete Featherless guide
- ✅ Created `ELEVENLABS_SETUP.md` - ElevenLabs agent setup
- ✅ Updated `README.md` - Comprehensive project documentation
- ✅ Added API endpoint documentation
- ✅ Included testing instructions

---

## 🔧 Technical Changes

### Backend (`backend/index.js`)

#### New Features:
```javascript
// AI Provider selection
const AI_PROVIDER = process.env.AI_PROVIDER || 'featherless';

// Featherless API support
async function callFeatherlessAPI(messages, systemPrompt) { ... }

// Enhanced triage function
async function runAITriage({ patient, transcript, name, location, reason }) { ... }

// Heuristic fallback
function runHeuristicTriage({ transcript, reason, equipment }) { ... }

// New webhook endpoint
app.post('/elevenlabs-webhook', async (req, res) => { ... });
```

#### Updated Functions:
- `runAITriage()` - Now supports both AI providers + new caller data
- `POST /triage` - Accepts name/location/reason for new callers
- Health check endpoint - Shows active AI provider
- Console logging - Displays AI provider on startup

### Environment Variables (`backend/.env`)

#### New Variables:
```bash
AI_PROVIDER=featherless          # Choose: "featherless" or "anthropic"
FEATHERLESS_API_KEY=sk-...       # Featherless API key
```

#### Updated Variables:
```bash
ANTHROPIC_API_KEY=...            # Now optional
```

### API Endpoints

#### New Endpoints:
- `POST /elevenlabs-webhook` - Receive ElevenLabs agent data
  - Input: `{ name, location, reason, transcript, patient_id? }`
  - Output: `{ ok, patient_id, priority, briefing, status }`

#### Updated Endpoints:
- `POST /triage` - Now accepts new caller data
  - Old: Required `patient_id` + `transcript`
  - New: Accepts `name` + `location` + `reason` OR `patient_id`

- `GET /` - Health check now shows AI provider
  - Added: `ai_provider` field in response

---

## 📋 Migration Guide

### If You're Using the Old Version:

1. **Update your `.env` file:**
   ```bash
   # Add these new lines
   AI_PROVIDER=featherless
   FEATHERLESS_API_KEY=your_key_here
   ```

2. **Get a Featherless API key:**
   - See `FEATHERLESS_SETUP.md` for instructions
   - Free tier available at https://featherless.ai

3. **Restart your backend:**
   ```bash
   cd backend
   node index.js
   ```

4. **Verify it's working:**
   ```bash
   curl http://localhost:3001/
   # Should show: "ai_provider": "featherless"
   ```

### If You Want to Keep Using Anthropic:

1. **Set AI provider in `.env`:**
   ```bash
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-your-key
   ```

2. **Restart backend** - That's it!

---

## 🧪 Testing the New Features

### Test 1: AI Provider Status
```bash
curl http://localhost:3001/
```
Should show which AI provider is active.

### Test 2: New Caller Triage
```bash
curl -X POST http://localhost:3001/triage \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "location": "123 Test St",
    "reason": "Power outage, on oxygen, battery low"
  }'
```
Should return priority score and briefing.

### Test 3: ElevenLabs Webhook
```bash
curl -X POST http://localhost:3001/elevenlabs-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "location": "456 Main St",
    "reason": "Trapped, wheelchair user, smoke in building",
    "transcript": "Full conversation transcript here"
  }'
```
Should create patient record and return triage results.

### Test 4: Full Flow
1. Start backend and frontend
2. Open http://localhost:3000
3. Click ElevenLabs widget
4. Have a conversation
5. Check dashboard for new entry

---

## 🎯 Priority Scoring Logic

### AI-Powered (Featherless/Anthropic):
- Analyzes full context of the call
- Considers medical equipment needs
- Evaluates environmental hazards
- Assesses mobility limitations
- Determines battery life urgency

### Heuristic Fallback:
- Scores based on keywords
- Critical equipment: +7-9 points
- Power/battery issues: +1-2 points
- Medical emergencies: 10 points
- Environmental hazards: +7 points
- Mobility issues: +1 point

---

## 📊 Data Flow

### Old Flow:
```
Registered Patient → Outbound Call → Transcript → Claude → Dashboard
```

### New Flow:
```
Any Caller → ElevenLabs → Webhook → AI Triage → Patient Record → Dashboard
                                      ↓
                              Featherless or Anthropic
```

---

## 🚀 Next Steps

### Recommended Improvements:

1. **Map Integration**
   - Add Google Maps or Mapbox
   - Show caller locations as pins
   - Color-code by priority
   - Add weather overlay

2. **Real-Time Updates**
   - Already supported via Supabase Realtime
   - Just need to implement in frontend

3. **Enhanced ElevenLabs Agent**
   - Add follow-up questions
   - Collect more medical details
   - Verify location accuracy
   - Estimate battery life

4. **Responder Features**
   - Mark cases as "dispatched"
   - Add notes to cases
   - Filter by priority/status
   - Export reports

5. **Analytics**
   - Response time tracking
   - Priority distribution
   - Call volume metrics
   - Outcome tracking

---

## 🐛 Known Issues & Limitations

### Current Limitations:
- No actual map display yet (just placeholder)
- Weather integration not implemented
- No authentication/authorization
- Single-region support only
- No SMS/text notifications

### Workarounds:
- Use Supabase dashboard to view data
- Check NWS alerts manually
- Run in trusted environment
- Configure for your region
- Use phone calls only

---

## 💡 Tips for Development

### Debugging:
```bash
# Check backend logs
cd backend && node index.js

# Test endpoints
curl http://localhost:3001/

# Check Supabase data
# Go to Supabase dashboard → Table Editor
```

### Common Issues:

**"AI Provider: Heuristic fallback"**
- Check your API key in `.env`
- Verify `AI_PROVIDER` is set correctly
- Restart the backend

**"Webhook not receiving data"**
- Check ElevenLabs webhook URL
- Verify backend is accessible
- Use ngrok for local testing

**"Priority scores seem wrong"**
- Review the triage prompt
- Check the input data quality
- Try different AI provider

---

## 📚 Resources

- [Featherless Setup Guide](./FEATHERLESS_SETUP.md)
- [ElevenLabs Setup Guide](./ELEVENLABS_SETUP.md)
- [Main README](./README.md)
- [Backend Code](./backend/index.js)

---

## ✨ Credits

- **Original ResQ**: Emergency response system concept
- **Updates**: Flexible AI backend + ElevenLabs integration
- **AI Models**: Llama 3.1 70B (Featherless) + Claude Sonnet 4 (Anthropic)
- **Voice AI**: ElevenLabs Conversational AI

---

**Questions? Check the setup guides or review the inline code comments!**
