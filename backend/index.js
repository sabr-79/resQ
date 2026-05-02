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

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const ELEVENLABS_AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID || 'agent_1801kqkw46cbf23sqy34vvcyem9w';

// -----------------------------------------------------------------------------
// Health + sanity
// -----------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({
    service: 'ResQ backend',
    status: 'ok',
    capabilities: {
      anthropic: !!anthropic,
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
// POST /triage { patient_id, transcript }
//   -> { priority, needs_evacuation, briefing, status }
async function runClaudeTriage({ patient, transcript }) {
  if (!anthropic) {
    // Heuristic fallback so the demo still works without an API key.
    const t = (transcript || '').toLowerCase();
    const equip = (patient.required_devices || '').toLowerCase();
    let priority = 3;
    if (/ventilator|oxygen|dialysis/.test(equip)) priority = 8;
    if (/no power|power out|battery (dead|dying|low)/.test(t)) priority += 1;
    if (/can'?t breathe|trouble breathing|chest pain/.test(t)) priority = 10;
    if (priority > 10) priority = 10;
    return {
      priority,
      needs_evacuation: priority >= 7,
      briefing: `Auto-triage: ${patient.required_devices || 'no equipment listed'} · status pending human review.`,
    };
  }

  const system = `You are ResQ, a disaster medical triage assistant. You read a transcript of a
phone call between a resident with disabilities and an automated check-in system,
and you produce a structured triage assessment for emergency responders.

Output ONLY valid JSON with this exact shape:
{
  "priority": <integer 0-10>,
  "needs_evacuation": <boolean>,
  "briefing": "<single sentence, <=140 chars, written for a first responder>"
}

Priority guidance:
  10 = life threatened in minutes (no oxygen, no ventilator, severe symptoms)
   8-9 = critical, life-sustaining equipment failing or about to fail
   5-7 = urgent, mobility/medication need within hours
   3-4 = monitored, no immediate life threat
   0-2 = safe, sheltered`;

  const user = `Patient profile:
  Name: ${patient.name}
  Address: ${patient.address}
  Conditions: ${patient.medical_conditions || 'unknown'}
  Equipment: ${patient.required_devices || 'none listed'}

Call transcript:
"""
${transcript}
"""

Return ONLY the JSON object.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = msg.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
  return {
    priority: Math.max(0, Math.min(10, Number(parsed.priority) || 0)),
    needs_evacuation: !!parsed.needs_evacuation,
    briefing: String(parsed.briefing || '').slice(0, 240),
  };
}

app.post('/triage', async (req, res) => {
  const { patient_id, transcript } = req.body;
  if (!patient_id || !transcript) {
    return res.status(400).json({ error: 'patient_id and transcript required' });
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patient_id)
    .single();
  if (error || !patient) {
    return res.status(404).json({ error: 'patient not found' });
  }

  try {
    const result = await runClaudeTriage({ patient, transcript });
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
      .eq('id', patient_id);

    // Append to calls log if the table exists.
    await supabase.from('calls').insert({
      patient_id,
      transcript,
      priority: result.priority,
      briefing: result.briefing,
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, ...result, status });
  } catch (err) {
    console.error('[triage] failed:', err);
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
      const result = await runClaudeTriage({ patient: p, transcript });
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

// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ResQ backend running on port ${PORT}`);
  console.log(`  Anthropic: ${anthropic ? 'enabled' : 'fallback (no key)'}`);
  console.log(`  Twilio:    ${twilioClient ? 'enabled' : 'simulated (no creds)'}`);
});
