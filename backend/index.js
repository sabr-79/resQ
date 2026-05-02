// ResQ — Precision Triage for the Vulnerable
// Backend: emergency outreach orchestrator
//
// Responsibilities:
//   1. Ingest federal disaster alerts (NWS CAP feed) and surface them to the dashboard.
//   2. PROACTIVELY trigger outbound AI voice calls (Twilio + ElevenLabs) to every
//      vulnerable resident inside an alert's affected area.
//   3. Hand transcripts to Claude for live medical triage and write the resulting
//      priority + briefing back to Supabase so the responder dashboard updates in real time.
//   4. Continue to receive inbound Twilio calls for residents who reach out themselves.

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const twilio = require('twilio');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// AI Provider setup - supports both Anthropic and Featherless
const AI_PROVIDER = process.env.AI_PROVIDER || 'featherless';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Featherless uses OpenAI-compatible API
const featherlessApiKey = process.env.FEATHERLESS_API_KEY;
const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

// Only initialize Twilio if we have real credentials (not placeholders)
const hasTwilioCreds = 
  process.env.TWILIO_ACCOUNT_SID && 
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
  !process.env.TWILIO_ACCOUNT_SID.includes('your_');

const twilioClient = hasTwilioCreds
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const ELEVENLABS_AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID || 'agent_1801kqkw46cbf23sqy34vvcyem9w';

// -----------------------------------------------------------------------------
// Geocoding helper - convert address to lat/lng
// -----------------------------------------------------------------------------
async function geocodeAddress(address) {
  if (!address || address === 'Location not provided') {
    // Default to Minneapolis if no address
    return {
      lat: 44.9778 + (Math.random() - 0.5) * 0.05,
      lng: -93.2650 + (Math.random() - 0.5) * 0.05,
    };
  }

  try {
    // Use Nominatim (OpenStreetMap) - free, no API key needed
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'ResQ Emergency Response System',
        },
      }
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error('[geocode] Error:', error.message);
  }

  // Fallback to random Minneapolis location if geocoding fails
  return {
    lat: 44.9778 + (Math.random() - 0.5) * 0.05,
    lng: -93.2650 + (Math.random() - 0.5) * 0.05,
  };
}

// -----------------------------------------------------------------------------
// Health + sanity
// -----------------------------------------------------------------------------
app.get('/', (_req, res) => {
  const aiProvider = AI_PROVIDER === 'anthropic' && anthropic ? 'anthropic' 
    : AI_PROVIDER === 'featherless' && featherlessApiKey ? 'featherless'
    : 'heuristic';
  
  res.json({
    service: 'ResQ backend',
    status: 'ok',
    capabilities: {
      ai_provider: aiProvider,
      anthropic: !!anthropic,
      featherless: !!featherlessApiKey,
      twilio: !!twilioClient,
      supabase: !!process.env.SUPABASE_URL,
    },
  });
});

app.get('/test-db', async (_req, res) => {
  const { data, error } = await supabase.from('calls').select('*').limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

app.get('/test-patients', async (_req, res) => {
  const { data, error } = await supabase.from('patients').select('*').limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: data?.length || 0, data });
});

// -----------------------------------------------------------------------------
// Inbound Twilio voice — resident calls ResQ
// -----------------------------------------------------------------------------
app.post('/incoming-call', (_req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    You've reached ResQ. This is an emergency assistance line for people with
    disabilities during natural disasters. Please stay on the line — a responder
    will see your information immediately.
  </Say>
  <Gather input="speech" action="/gather-name" timeout="5" speechTimeout="auto">
    <Say voice="alice">First, please tell me your full name.</Say>
  </Gather>
</Response>`;
  res.type('text/xml').send(twiml);
});

// -----------------------------------------------------------------------------
// PROACTIVE outbound call — ResQ calls the resident
// -----------------------------------------------------------------------------
// POST /trigger-outbound  { patient_id }     -> places a single call
// POST /trigger-outbound  { patient_ids: [] } -> places a batch
//
// The call is bridged to the ElevenLabs Conversational AI agent that runs the
// triage script. When the agent finishes, ElevenLabs posts the transcript to
// /triage which then updates the patient's priority on the dashboard.
app.post('/trigger-outbound', async (req, res) => {
  const ids = req.body.patient_ids || (req.body.patient_id ? [req.body.patient_id] : []);
  if (!ids.length) {
    return res.status(400).json({ error: 'patient_id or patient_ids required' });
  }

  const { data: patients, error } = await supabase
    .from('patients')
    .select('*')
    .in('id', ids);
  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const p of patients || []) {
    try {
      if (!twilioClient) {
        // Demo mode — pretend the call went out so the rest of the pipeline runs.
        results.push({ patient_id: p.id, status: 'simulated', sid: null });
        await supabase
          .from('patients')
          .update({ status: 'Calling…' })
          .eq('id', p.id);
        continue;
      }

      const call = await twilioClient.calls.create({
        to: p.phone,
        from: process.env.TWILIO_PHONE_NUMBER,
        url: `${PUBLIC_BASE_URL}/outbound-twiml?patient_id=${encodeURIComponent(p.id)}`,
        statusCallback: `${PUBLIC_BASE_URL}/call-status`,
        statusCallbackEvent: ['initiated', 'answered', 'completed'],
      });

      await supabase
        .from('patients')
        .update({ status: 'Calling…' })
        .eq('id', p.id);

      results.push({ patient_id: p.id, status: 'dialed', sid: call.sid });
    } catch (err) {
      results.push({ patient_id: p.id, status: 'failed', error: err.message });
    }
  }

  res.json({ ok: true, count: results.length, results });
});

// TwiML returned to Twilio when the call connects — bridges to ElevenLabs.
app.post('/outbound-twiml', (req, res) => {
  const patientId = req.query.patient_id || '';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    This is ResQ, an automated emergency check-in. There is an active disaster
    alert for your area. I'll connect you with our assistant to make sure you
    have the help you need.
  </Say>
  <Connect>
    <ConversationRelay url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}&amp;patient_id=${encodeURIComponent(patientId)}" />
  </Connect>
</Response>`;
  res.type('text/xml').send(twiml);
});

app.post('/call-status', async (req, res) => {
  // Twilio status webhook — useful for tracking dialing/answered/completed.
  const { CallSid, CallStatus, To } = req.body;
  console.log(`[call-status] ${CallSid} → ${CallStatus} (${To})`);
  res.sendStatus(200);
});

// -----------------------------------------------------------------------------
// Claude triage — turn a transcript into a priority + briefing
// -----------------------------------------------------------------------------
// POST /triage { patient_id?, name?, location?, reason?, transcript }
//   -> { priority, needs_evacuation, briefing, status }

async function callFeatherlessAPI(messages, systemPrompt) {
  const response = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${featherlessApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Featherless API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function runAITriage({ patient, transcript, name, location, reason }) {
  // Build patient context - handle both registered patients and new callers
  const patientName = name || patient?.name || 'Unknown caller';
  const patientLocation = location || patient?.address || 'Location not provided';
  const medicalConditions = patient?.medical_conditions || reason || 'Not specified';
  const equipment = patient?.required_devices || 'Unknown';

  // Heuristic fallback if no AI provider is available
  if (AI_PROVIDER === 'anthropic' && !anthropic && !featherlessApiKey) {
    return runHeuristicTriage({ transcript, reason, equipment });
  }
  if (AI_PROVIDER === 'featherless' && !featherlessApiKey && !anthropic) {
    return runHeuristicTriage({ transcript, reason, equipment });
  }

  const system = `You are ResQ, an emergency medical triage AI assistant. You analyze calls from people in disaster situations and produce structured triage assessments for emergency responders.

Your job is to:
1. Assess the immediate danger level based on medical conditions, equipment needs, and current situation
2. Determine if immediate evacuation is needed
3. Create a brief, actionable summary for first responders in a specific format

Output ONLY valid JSON with this exact shape:
{
  "priority": <integer 0-10>,
  "needs_evacuation": <boolean>,
  "briefing": "<emoji> <concise summary with key medical info>"
}

Briefing format rules:
- Start with relevant emoji: 🏥 (medical), ⚡ (power issue), 🔥 (fire/smoke), 💧 (water/flood), ♿ (mobility), 🚨 (critical)
- Keep under 100 characters total
- Include: age if mentioned, key condition, critical equipment, immediate threat
- Examples:
  * "🏥 80-year-old, bedridden, oxygen dependent, power outage"
  * "⚡ Wheelchair user, insulin needs refrigeration, no power"
  * "🏥 Ventilator dependent, battery 2 hours remaining"
  * "♿ Dialysis patient, trapped upstairs, smoke present"

Priority guidance:
  10 = Immediate life threat (no oxygen, ventilator failing, severe injury, imminent danger)
   8-9 = Critical - life-sustaining equipment failing or will fail within 1-2 hours
   6-7 = Urgent - medical equipment needed within 4-6 hours, mobility issues in dangerous area
   4-5 = Moderate - has medical needs but currently stable, may need assistance
   2-3 = Low priority - safe location, has supplies, can shelter in place
   0-1 = Safe - no immediate needs, well-sheltered

Consider:
- Power outages affecting medical equipment (ventilators, oxygen concentrators, dialysis)
- Battery life remaining on critical equipment
- Mobility limitations (wheelchair users, bedridden)
- Environmental hazards (smoke, flooding, no escape route)
- Medical conditions that require immediate attention
- Access to medications and supplies`;

  const userContent = `Caller Information:
Name: ${patientName}
Location: ${patientLocation}
Medical Conditions/Reason for Call: ${medicalConditions}
Medical Equipment: ${equipment}

Call Transcript:
"""
${transcript || reason || 'No transcript available'}
"""

Analyze this emergency call and return ONLY the JSON object with priority, needs_evacuation, and briefing.`;

  try {
    let responseText;

    if (AI_PROVIDER === 'featherless' && featherlessApiKey) {
      responseText = await callFeatherlessAPI(
        [{ role: 'user', content: userContent }],
        system
      );
    } else if (anthropic) {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: userContent }],
      });
      responseText = msg.content?.[0]?.text || '{}';
    } else {
      return runHeuristicTriage({ transcript, reason, equipment });
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    
    return {
      priority: Math.max(0, Math.min(10, Number(parsed.priority) || 0)),
      needs_evacuation: !!parsed.needs_evacuation,
      briefing: String(parsed.briefing || 'Awaiting assessment').slice(0, 240),
    };
  } catch (err) {
    console.error('[AI triage] failed:', err);
    return runHeuristicTriage({ transcript, reason, equipment });
  }
}

function runHeuristicTriage({ transcript, reason, equipment }) {
  const text = `${transcript || ''} ${reason || ''}`.toLowerCase();
  const equip = (equipment || '').toLowerCase();
  
  let priority = 3;
  let briefingParts = [];
  let emoji = '🏥';
  
  // Extract age if mentioned
  const ageMatch = text.match(/(\d{2,3}).?year.?old/);
  const age = ageMatch ? ageMatch[1] : null;
  
  // Critical equipment
  if (/ventilator/.test(equip) || /ventilator/.test(text)) {
    priority = 9;
    briefingParts.push('ventilator dependent');
    emoji = '🚨';
  }
  if (/oxygen|concentrator/.test(equip) || /oxygen/.test(text)) {
    priority = Math.max(priority, 8);
    briefingParts.push('oxygen dependent');
    emoji = '🏥';
  }
  if (/dialysis/.test(equip) || /dialysis/.test(text)) {
    priority = Math.max(priority, 7);
    briefingParts.push('dialysis patient');
  }
  if (/insulin/.test(text)) {
    priority = Math.max(priority, 7);
    briefingParts.push('insulin dependent');
  }
  
  // Power/battery issues
  if (/no power|power out|power.{0,10}out|power outage/.test(text)) {
    priority += 2;
    briefingParts.push('power outage');
    emoji = '⚡';
  }
  if (/battery.{0,20}(dead|dying|low|fail)/.test(text)) {
    priority += 2;
    briefingParts.push('battery failing');
  }
  if (/battery.{0,20}(hour|minute)/.test(text)) {
    priority += 1;
    const batteryMatch = text.match(/(\d+).?(hour|minute)/);
    if (batteryMatch) {
      briefingParts.push(`battery ${batteryMatch[1]}${batteryMatch[2][0]}`);
    }
  }
  if (/cannot.{0,20}refrigerate|can'?t.{0,20}refrigerate/.test(text)) {
    priority += 2;
    briefingParts.push('cannot refrigerate meds');
  }
  
  // Medical emergencies
  if (/can'?t breathe|trouble breathing|chest pain|heart/.test(text)) {
    priority = 10;
    emoji = '🚨';
  }
  if (/bleeding|injured|fell|broken/.test(text)) {
    priority = Math.max(priority, 8);
    emoji = '🚨';
  }
  if (/trapped|stuck|can'?t (move|get out|escape)/.test(text)) {
    priority = Math.max(priority, 8);
    briefingParts.push('trapped');
  }
  
  // Environmental hazards
  if (/smoke|fire/.test(text)) {
    priority = Math.max(priority, 9);
    briefingParts.push('smoke/fire');
    emoji = '🔥';
  }
  if (/flood|water rising|hurricane/.test(text)) {
    priority = Math.max(priority, 7);
    briefingParts.push('flooding');
    emoji = '💧';
  }
  
  // Vulnerability
  if (/alone|by myself/.test(text)) {
    priority += 1;
    briefingParts.push('alone');
  }
  if (/wheelchair|can'?t walk|bedridden|immobile/.test(text)) {
    priority += 1;
    briefingParts.push('mobility limited');
    if (emoji === '🏥') emoji = '♿';
  }
  
  // Positive indicators
  if (/safe|okay|fine|sheltered/.test(text)) priority = Math.max(2, priority - 2);
  if (/power.{0,10}(on|working|back)/.test(text)) priority = Math.max(2, priority - 1);
  
  priority = Math.max(0, Math.min(10, priority));
  
  // Build briefing
  let briefing = emoji + ' ';
  if (age) briefing += `${age}yo, `;
  briefing += briefingParts.slice(0, 3).join(', ');
  
  if (!briefingParts.length) {
    briefing = `${emoji} Priority ${priority} - needs assessment`;
  }
  
  return {
    priority,
    needs_evacuation: priority >= 7,
    briefing: briefing.slice(0, 100),
  };
}

app.post('/triage', async (req, res) => {
  let { patient_id } = req.body;
  const { transcript, name, location, reason } = req.body;
  
  // Support both registered patients and new callers
  let patient = null;
  
  if (patient_id) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patient_id)
      .single();
    if (error) {
      return res.status(404).json({ error: 'patient not found' });
    }
    patient = data;
  } else if (!name && !location && !reason) {
    return res.status(400).json({ 
      error: 'Either patient_id or (name, location, reason) required' 
    });
  }

  try {
    const result = await runAITriage({ 
      patient, 
      transcript, 
      name, 
      location, 
      reason 
    });
    
    const status =
      result.priority >= 8 ? 'Critical'
      : result.priority >= 5 ? 'Urgent'
      : result.priority >= 3 ? 'Monitored'
      : 'Safe';

    // If this is a registered patient, update their record
    if (patient_id) {
      await supabase
        .from('patients')
        .update({
          priority: result.priority,
          needs_evacuation: result.needs_evacuation,
          briefing: result.briefing,
          status,
        })
        .eq('id', patient_id);
    } else {
      // For new callers, create a patient record
      const { data: newPatient } = await supabase
        .from('patients')
        .insert({
          name: name || 'Unknown Caller',
          address: location || 'Location not provided',
          phone: 'N/A',
          medical_conditions: reason || 'Emergency call',
          required_devices: '',
          priority: result.priority,
          needs_evacuation: result.needs_evacuation,
          briefing: result.briefing,
          status,
        })
        .select()
        .single();
      
      if (newPatient) {
        patient_id = newPatient.id;
      }
    }

    // Log the call
    await supabase.from('calls').insert({
      patient_id: patient_id || null,
      transcript: transcript || `Name: ${name}, Location: ${location}, Reason: ${reason}`,
      priority: result.priority,
      briefing: result.briefing,
      created_at: new Date().toISOString(),
    });

    res.json({ 
      ok: true, 
      ...result, 
      status,
      patient_id,
      ai_provider: AI_PROVIDER 
    });
  } catch (err) {
    console.error('[triage] failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Manual call entry - for testing without ElevenLabs webhook
// -----------------------------------------------------------------------------
// POST /add-call { name, location, reason }
app.post('/add-call', async (req, res) => {
  const { name, location, reason } = req.body;
  
  if (!name || !location || !reason) {
    return res.status(400).json({ 
      error: 'name, location, and reason are required' 
    });
  }

  try {
    // Run triage
    const triageResult = await runAITriage({
      patient: null,
      transcript: `Caller: ${name}, Location: ${location}, Reason: ${reason}`,
      name,
      location,
      reason,
    });
    
    const status =
      triageResult.priority >= 8 ? 'Critical'
      : triageResult.priority >= 5 ? 'Urgent'
      : triageResult.priority >= 3 ? 'Monitored'
      : 'Safe';
    
    // Geocode the address
    const coords = await geocodeAddress(location);
    
    // Create patient record
    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({
        name: name,
        address: location,
        medical_conditions: reason,
        required_devices: '',
        priority: triageResult.priority,
        needs_evacuation: triageResult.needs_evacuation,
        briefing: triageResult.briefing,
        status,
        lat: coords.lat,
        lng: coords.lng,
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Log the call
    await supabase.from('calls').insert({
      patient_id: newPatient.id,
      transcript: `Name: ${name}, Location: ${location}, Reason: ${reason}`,
      priority: triageResult.priority,
      briefing: triageResult.briefing,
      created_at: new Date().toISOString(),
    });
    
    console.log(`[add-call] Created patient: ${name} (Priority: ${triageResult.priority})`);
    
    res.json({ 
      ok: true, 
      patient_id: newPatient.id,
      patient: newPatient,
      ...triageResult,
      status,
      ai_provider: AI_PROVIDER 
    });
  } catch (err) {
    console.error('[add-call] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ElevenLabs webhook — receives structured data from conversational AI
// -----------------------------------------------------------------------------
// POST /elevenlabs-webhook { name, location, reason, transcript }
app.post('/elevenlabs-webhook', async (req, res) => {
  console.log('[elevenlabs-webhook] received:', JSON.stringify(req.body, null, 2));
  
  // ElevenLabs sends data in a nested structure
  let name, location, reason, transcript, fullTranscriptText = '';
  
  // Check if it's the ElevenLabs post_call_transcription format
  if (req.body.type === 'post_call_transcription' && req.body.data) {
    const data = req.body.data;
    transcript = data.transcript;
    
    // Build full transcript text for AI analysis
    if (Array.isArray(transcript)) {
      fullTranscriptText = transcript
        .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
        .join('\n');
    }
    
    // PRIORITY 1: Look for structured data in agent's final message (name:, location:, reason:)
    const agentMessages = transcript.filter(t => t.role === 'agent');
    const lastAgentMessage = agentMessages[agentMessages.length - 1];
    
    if (lastAgentMessage && lastAgentMessage.message) {
      const msg = lastAgentMessage.message;
      
      // Check if the agent provided structured output
      const nameMatch = msg.match(/\bname:\s*(.+?)(?:\n|$)/i);
      const locationMatch = msg.match(/\blocation:\s*(.+?)(?:\n|$)/i);
      const reasonMatch = msg.match(/\breason:\s*(.+?)(?:\n|$)/i);
      
      if (nameMatch) name = nameMatch[1].trim();
      if (locationMatch) location = locationMatch[1].trim();
      if (reasonMatch) reason = reasonMatch[1].trim();
    }
    
    // PRIORITY 2: Extract from user messages in order (if structured data not found)
    if (!name || !location || !reason) {
      const userMessages = transcript.filter(t => t.role === 'user').map(t => t.message);
      
      if (!name && userMessages.length >= 1) {
        name = userMessages[0].trim();
      }
      
      if (!location && userMessages.length >= 2) {
        location = userMessages[1].trim();
      }
      
      if (!reason && userMessages.length >= 3) {
        // Combine all remaining messages as the reason
        reason = userMessages.slice(2).join(' ').trim();
      }
    }
    
    // PRIORITY 3: Try to extract from agent confirmation message
    if (!name || !location || !reason) {
      for (const agentMsg of agentMessages) {
        const msg = agentMsg.message;
        
        // Look for confirmation pattern: "your name is X, you are located at Y, and you are Z"
        if (msg.includes('to confirm') || msg.includes('your name is')) {
          if (!name) {
            const nameMatch = msg.match(/(?:name is|called)\s+([^,\.]+?)(?:,|\.|you are|and)/i);
            if (nameMatch) name = nameMatch[1].trim();
          }
          
          if (!location) {
            const locMatch = msg.match(/(?:located at|you are at)\s+([^,\.]+?(?:Avenue|Street|Road|Drive|Boulevard|Lane|Court|Way|Place)[^,\.]*?)(?:,|\.|and|you are)/i);
            if (locMatch) location = locMatch[1].trim();
          }
          
          if (!reason) {
            const reasonMatch = msg.match(/(?:you are|and you)\s+([^\.]+?)(?:\.|help is on the way)/i);
            if (reasonMatch) reason = reasonMatch[1].trim();
          }
        }
      }
    }
    
    // PRIORITY 4: Last fallback - use transcript summary
    if (!name || !location || !reason) {
      const summary = data.analysis?.transcript_summary || '';
      
      if (!name) {
        const summaryNameMatch = summary.match(/(?:from|called|user,?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
        name = summaryNameMatch ? summaryNameMatch[1].trim() : 'Unknown Caller';
      }
      
      if (!location) {
        const locationMatch = summary.match(/(?:at|from)\s+(\d+\s+[^,\.]+?(?:Avenue|Street|Road|Drive|Boulevard|Lane|Court|Way|Place)[^,\.]*?(?:,\s*[A-Z][a-z]+(?:,\s*[A-Z]{2})?))/i);
        location = locationMatch ? locationMatch[1].trim() : 'Location not provided';
      }
      
      if (!reason) {
        reason = summary;
      }
    }
  } else {
    // Original format (direct fields)
    ({ name, location, reason, transcript } = req.body);
    fullTranscriptText = transcript || `Name: ${name}, Location: ${location}, Reason: ${reason}`;
  }
  
  const { patient_id } = req.body;
  
  if (!name && !location && !reason) {
    console.error('[elevenlabs-webhook] No data extracted from webhook');
    return res.status(400).json({ error: 'Could not extract caller information' });
  }
  
  console.log('[elevenlabs-webhook] Extracted:', { name, location, reason: reason?.substring(0, 100) });
  
  try {
    // Run triage on the collected information
    const triageResult = await runAITriage({
      patient: patient_id ? await supabase.from('patients').select('*').eq('id', patient_id).single().then(r => r.data) : null,
      transcript: fullTranscriptText || `Caller: ${name}, Location: ${location}, Reason: ${reason}`,
      name,
      location,
      reason,
    });
    
    const status =
      triageResult.priority >= 8 ? 'Critical'
      : triageResult.priority >= 5 ? 'Urgent'
      : triageResult.priority >= 3 ? 'Monitored'
      : 'Safe';
    
    // Create or update patient record
    let finalPatientId = patient_id;
    
    if (patient_id) {
      await supabase
        .from('patients')
        .update({
          priority: triageResult.priority,
          needs_evacuation: triageResult.needs_evacuation,
          briefing: triageResult.briefing,
          status,
        })
        .eq('id', patient_id);
    } else {
      // Geocode the address
      const coords = await geocodeAddress(location);
      
      const { data: newPatient, error: insertError } = await supabase
        .from('patients')
        .insert({
          name: name || 'Unknown Caller',
          address: location || 'Location not provided',
          medical_conditions: reason || 'Emergency call',
          required_devices: '',
          priority: triageResult.priority,
          needs_evacuation: triageResult.needs_evacuation,
          briefing: triageResult.briefing,
          status,
          lat: coords.lat,
          lng: coords.lng,
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[elevenlabs-webhook] Insert error:', insertError);
        throw insertError;
      }
      
      if (newPatient) {
        finalPatientId = newPatient.id;
        console.log('[elevenlabs-webhook] Created patient:', newPatient.id, newPatient.name);
      }
    }
    
    // Log the call
    await supabase.from('calls').insert({
      patient_id: finalPatientId || null,
      transcript: fullTranscriptText || `Name: ${name}, Location: ${location}, Reason: ${reason}`,
      priority: triageResult.priority,
      briefing: triageResult.briefing,
      created_at: new Date().toISOString(),
    });
    
    res.json({ 
      ok: true, 
      patient_id: finalPatientId,
      ...triageResult,
      status,
      message: 'Emergency call processed successfully'
    });
  } catch (err) {
    console.error('[elevenlabs-webhook] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Federal disaster alert feed (NWS CAP)
// -----------------------------------------------------------------------------
// GET /alerts/active?area=CA  -> proxy to api.weather.gov
app.get('/alerts/active', async (req, res) => {
  const area = req.query.area || 'CA';
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?area=${encodeURIComponent(area)}`,
      { headers: { 'User-Agent': 'ResQ/1.0 (hackathon demo)' } }
    );
    const data = await r.json();
    const alerts = (data.features || []).slice(0, 20).map((f) => ({
      id: f.id,
      event: f.properties?.event,
      severity: f.properties?.severity,
      headline: f.properties?.headline,
      area: f.properties?.areaDesc,
      effective: f.properties?.effective,
      expires: f.properties?.expires,
    }));
    res.json({ ok: true, count: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// One-shot demo flow — judges press one button, the whole pipeline runs.
// POST /simulate-disaster { event?: "Wildfire", area?: "CA" }
//   1. Logs a synthetic alert.
//   2. Picks every patient with life-sustaining equipment.
//   3. Marks them "Triage Pending", then runs Claude triage with a mock transcript.
// -----------------------------------------------------------------------------
const MOCK_TRANSCRIPTS = [
  "I can hear you. The power went out about an hour ago and my oxygen concentrator is running on battery. I think I have maybe two hours left. I can't move on my own.",
  "Yes, I'm here. I'm on a ventilator. The backup battery beeped but it's still running. My caregiver isn't here today.",
  "I'm okay for now. I have my medications and the lights are still on. My wheelchair is charged.",
  "I'm scared. The smoke is getting bad and I can't get down the stairs by myself. I'm a dialysis patient, I had treatment yesterday.",
  "Hello? Yes, I'm at home. I have insulin in the fridge and the power just flickered. I can shelter in place if it stays on.",
];

app.post('/simulate-disaster', async (req, res) => {
  const event = req.body.event || 'Wildfire Evacuation Warning';
  const area = req.body.area || 'Demo County';

  // Pick patients to call — anyone with critical equipment.
  const { data: patients, error } = await supabase
    .from('patients')
    .select('*');
  if (error) return res.status(500).json({ error: error.message });

  const targeted = (patients || []).filter((p) =>
    /ventilator|oxygen|dialysis|insulin|power chair/i.test(
      `${p.required_devices || ''} ${p.medical_conditions || ''}`
    )
  );

  // Mark them as being contacted.
  if (targeted.length) {
    await supabase
      .from('patients')
      .update({ status: 'Calling…' })
      .in('id', targeted.map((p) => p.id));
  }

  // Run the triage pipeline against each one with a mock transcript.
  const triaged = [];
  for (let i = 0; i < targeted.length; i++) {
    const p = targeted[i];
    const transcript = MOCK_TRANSCRIPTS[i % MOCK_TRANSCRIPTS.length];
    try {
      const result = await runAITriage({ patient: p, transcript });
      const status =
        result.priority >= 8 ? 'Critical'
        : result.priority >= 5 ? 'Urgent'
        : result.priority >= 3 ? 'Monitored'
        : 'Safe';
      await supabase
        .from('patients')
        .update({
          priority: result.priority,
          needs_evacuation: result.needs_evacuation,
          briefing: result.briefing,
          status,
        })
        .eq('id', p.id);
      triaged.push({ id: p.id, name: p.name, ...result, status });
    } catch (err) {
      triaged.push({ id: p.id, name: p.name, error: err.message });
    }
  }

  res.json({
    ok: true,
    alert: { event, area, time: new Date().toISOString() },
    contacted: targeted.length,
    triaged,
 });
});

// Duplicate endpoint removed - using the comprehensive one above

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ResQ backend running on port ${PORT}`);
});