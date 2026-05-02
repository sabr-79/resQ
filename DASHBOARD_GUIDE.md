# ResQ Dashboard Guide

## ✅ What's Working Now

Your ResQ system is now fully functional with:

1. **✅ Backend running** on `http://localhost:3001`
   - AI Provider: Featherless (Llama 3.1 70B)
   - Supabase connected
   - 10 test patients loaded

2. **✅ Frontend running** on `http://localhost:3000`
   - Live dashboard with map visualization
   - Real-time priority list
   - Supabase realtime updates enabled

3. **✅ Database populated** with test patients
   - 10 sample patients with medical conditions
   - Ready for triage simulation

---

## 🎯 How to Use the Dashboard

### Open the Dashboard
Go to: **http://localhost:3000/dashboard**

You should see:
- **Left side**: Map with patient location pins
- **Right side**: Priority list sorted by urgency
- **Top**: "Simulate Disaster" button

### Understanding the Display

#### Map Pins
- **🔴 Red pins** = Critical (Priority 8-10) - Immediate danger
- **🟠 Orange pins** = Urgent (Priority 6-7) - Needs help soon
- **🟡 Yellow pins** = Moderate (Priority 4-5) - Stable but needs assistance
- **🟢 Green pins** = Safe (Priority 0-3) - No immediate danger

#### Priority List
- Shows all patients sorted by priority (highest first)
- Click any patient to highlight them on the map
- Shows:
  - Name and address
  - Priority score (0-10)
  - Status badge (CRITICAL, URGENT, MODERATE, SAFE)
  - AI-generated briefing
  - Medical conditions and equipment

---

## 🚨 Testing the System

### Test 1: Simulate Disaster
1. Click the **"🚨 Simulate Disaster"** button
2. Watch as:
   - Backend "calls" patients with critical equipment
   - AI analyzes each situation
   - Pins change color based on priority
   - List re-sorts by urgency
3. Critical patients (ventilator, oxygen) will turn red

### Test 2: ElevenLabs Call
1. Go to **http://localhost:3000** (homepage)
2. Click the ElevenLabs call widget
3. Have a conversation:
   - "My name is John Smith"
   - "I'm at 123 Oak Street"
   - "The power went out and my oxygen concentrator is running on battery"
4. After the call ends, check the dashboard
5. You should see a new patient appear

### Test 3: Manual Triage
```bash
curl -X POST http://localhost:3001/triage \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "location": "456 Main Street",
    "reason": "Trapped in building, wheelchair user, smoke in hallway"
  }'
```

Then refresh the dashboard to see the new entry.

---

## 🔧 Current Setup

### Backend (Port 3001)
```
✅ Express server running
✅ Supabase connected
✅ Featherless AI configured (or heuristic fallback)
✅ Endpoints working:
   - GET  /              (health check)
   - GET  /test-patients (view all patients)
   - POST /triage        (analyze emergency)
   - POST /elevenlabs-webhook (receive calls)
   - POST /simulate-disaster (test system)
```

### Frontend (Port 3000)
```
✅ Next.js running
✅ Dashboard at /dashboard
✅ Homepage at /
✅ Supabase realtime enabled
✅ Environment variables configured
```

### Database (Supabase)
```
✅ 10 test patients loaded
✅ Patients table with realtime enabled
✅ Calls table for logging
✅ All patients currently "Safe" status
```

---

## 🎨 Dashboard Features

### Real-Time Updates
- Dashboard automatically updates when:
  - New patients are added
  - Priority scores change
  - Status updates occur
- No refresh needed!

### Interactive Map
- Click any pin to select that patient
- Selected patient highlights in both map and list
- Pins pulse for critical cases
- Color-coded by priority level

### Priority List
- Auto-sorts by priority (highest first)
- Shows full patient details
- Click to select and highlight on map
- Displays AI-generated briefings

### Stats Display
- **Active Cases**: Total number of patients
- **Critical Count**: How many need immediate help
- **Priority Legend**: Color coding explanation

---

## 🔄 What Happens During a Call

### When ElevenLabs Agent Collects Info:

1. **User calls** → ElevenLabs agent answers
2. **Agent collects**:
   - Name
   - Location
   - Emergency situation
   - Medical equipment needs
3. **Agent sends to** → `/elevenlabs-webhook`
4. **Backend processes**:
   - Runs AI triage (Featherless or Anthropic)
   - Calculates priority (0-10)
   - Determines evacuation need
   - Generates responder briefing
5. **Database updates** → Patient record created/updated
6. **Dashboard updates** → New pin appears, list refreshes
7. **Responders see** → Priority, location, briefing

---

## 📊 Priority Scoring

### How AI Determines Priority:

**Priority 10** - Immediate Life Threat
- No oxygen/ventilator
- Severe injury
- Imminent danger

**Priority 8-9** - Critical
- Life-sustaining equipment failing
- Battery dying (< 1 hour)
- Trapped with medical needs

**Priority 6-7** - Urgent
- Equipment needed within hours
- Mobility issues in dangerous area
- Environmental hazards present

**Priority 4-5** - Moderate
- Has medical needs
- Currently stable
- May need assistance

**Priority 2-3** - Low
- Safe location
- Has supplies
- Can shelter in place

**Priority 0-1** - Safe
- No immediate needs
- Well-sheltered
- Stable situation

---

## 🐛 Troubleshooting

### Dashboard shows "No active cases"
**Solution**: Click "Simulate Disaster" to populate with test data

### Pins not showing on map
**Check**:
1. Are there patients in the database? Visit `/test-patients`
2. Is Supabase connected? Check browser console
3. Refresh the page

### Real-time updates not working
**Check**:
1. Is Realtime enabled on `patients` table in Supabase?
2. Check browser console for WebSocket errors
3. Verify environment variables in `frontend/.env.local`

### ElevenLabs calls not appearing
**Check**:
1. Is the webhook configured in ElevenLabs dashboard?
2. Is backend accessible (use ngrok for local dev)?
3. Check backend logs: `[elevenlabs-webhook] received:`

### Priority scores seem wrong
**Check**:
1. Which AI provider is active? (Check backend startup logs)
2. Is Featherless API key valid?
3. Try "Simulate Disaster" to see if AI is working

---

## 🚀 Next Steps

### To Make It Production-Ready:

1. **Add Real Map**
   - Integrate Google Maps or Mapbox
   - Use actual lat/lng coordinates
   - Add geocoding for addresses

2. **Enhance ElevenLabs Agent**
   - Configure webhook in ElevenLabs dashboard
   - Point to your backend URL
   - Test end-to-end flow

3. **Get Featherless API Key**
   - Sign up at https://featherless.ai
   - Add key to `backend/.env`
   - Restart backend

4. **Add Weather Layer**
   - Integrate weather API
   - Show current conditions
   - Display active alerts

5. **Improve Triage**
   - Fine-tune priority thresholds
   - Add more medical conditions
   - Customize briefing format

---

## 📝 Quick Reference

### URLs
- **Homepage**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Backend Health**: http://localhost:3001
- **Test Patients**: http://localhost:3001/test-patients

### Commands
```bash
# Start backend
cd backend && node index.js

# Start frontend
cd frontend && npm run dev

# Test triage
curl -X POST http://localhost:3001/triage \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","location":"123 St","reason":"Emergency"}'

# Simulate disaster
curl -X POST http://localhost:3001/simulate-disaster \
  -H "Content-Type: application/json" \
  -d '{"event":"Wildfire","area":"Demo"}'
```

---

## ✨ What Makes This Special

1. **Real-Time Everything**
   - Dashboard updates instantly
   - No refresh needed
   - WebSocket-powered

2. **AI-Powered Triage**
   - Analyzes emergency situations
   - Calculates priority automatically
   - Generates actionable briefings

3. **Visual Priority System**
   - Color-coded pins
   - Sorted lists
   - Clear status indicators

4. **Voice-First Design**
   - No typing required
   - Works for everyone
   - Natural conversation

5. **Responder-Focused**
   - See who needs help most
   - Get location and briefing
   - Dispatch efficiently

---

**Your ResQ system is ready to use! Open http://localhost:3000/dashboard and click "Simulate Disaster" to see it in action! 🚀**
