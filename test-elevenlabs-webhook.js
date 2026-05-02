// Test script to simulate ElevenLabs webhook with real data
const fetch = require('node-fetch');

const webhookData = {
  "type": "post_call_transcription",
  "event_timestamp": 1777745465,
  "data": {
    "agent_id": "agent_4701kqmvd6jgfjyv7422v805en9y",
    "agent_name": "resQ",
    "status": "done",
    "transcript": [
      {
        "role": "agent",
        "message": "Hello, this is ResQ emergency assistance. I'm here to help you. Can you tell me your full name?\n"
      },
      {
        "role": "user",
        "message": "Katherine Earnshaw."
      },
      {
        "role": "agent",
        "message": "Thank you, Katherine. What is your exact address or current location?"
      },
      {
        "role": "user",
        "message": "300 Washington Avenue Southeast, Minneapolis, Minnesota, 55455."
      },
      {
        "role": "agent",
        "message": "Thank you. Now, what's your emergency? Are you injured, trapped, or do you need medical help? Do you have medical equipment that needs power?"
      },
      {
        "role": "user",
        "message": "I am currently bedridden, and there's a power outage due to a hurricane, so, um, I cannot recharge my, um, oxygen mask."
      },
      {
        "role": "agent",
        "message": "[calm] Thank you for providing that information, Katherine. So, to confirm, your name is Katherine Earnshaw, you are located at three hundred Washington Avenue Southeast, Minneapolis, Minnesota, five five four five five, and you are bedridden with an oxygen mask that needs power due to an outage. Help is on the way."
      }
    ],
    "analysis": {
      "transcript_summary": "An emergency assistance agent received a call from Katherine Earnshaw, who reported being bedridden at 300 Washington Avenue SE, Minneapolis, MN, 55455. She was unable to recharge her oxygen mask due to a hurricane-induced power outage."
    }
  }
};

async function testWebhook() {
  try {
    console.log('Sending webhook to http://localhost:3001/elevenlabs-webhook...\n');
    
    const response = await fetch('http://localhost:3001/elevenlabs-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    const result = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));
    
    if (result.ok) {
      console.log('\n✅ SUCCESS!');
      console.log(`Patient ID: ${result.patient_id}`);
      console.log(`Priority: ${result.priority}`);
      console.log(`Briefing: ${result.briefing}`);
      console.log(`Status: ${result.status}`);
      console.log(`Needs Evacuation: ${result.needs_evacuation}`);
    } else {
      console.log('\n❌ FAILED');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWebhook();
