'use client';

import Script from 'next/script';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-red-50 text-gray-900">
      {/* Top nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚑</span>
          <span className="text-xl font-bold text-red-600">ResQ</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a href="/register" className="px-3 py-2 text-gray-700 hover:text-red-600">Register</a>
          <a
            href="/dashboard"
            className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
          >
            Responder Dashboard →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-20 text-center">
        <div className="inline-block bg-red-100 text-red-700 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full mb-4">
          Inclusive Disaster Response · AI-Powered
        </div>
        <h1 className="text-5xl sm:text-7xl font-extrabold text-gray-900 leading-tight">
          When the alert goes out, <span className="text-red-600">we call them first.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
          During a natural disaster, individuals with disabilities face a <b>double crisis</b> —
          they aren&apos;t just fleeing the disaster, they&apos;re fleeing a clock ticking on their
          ventilator, oxygen tank, or power chair. ResQ turns search-and-rescue into{' '}
          <b>precision rescue</b>.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <a
            href="/dashboard"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg shadow-sm"
          >
            🚨 Open Live Responder Dashboard
          </a>
          <a
            href="/register"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-lg"
          >
            Add yourself to the registry
          </a>
        </div>
      </section>

      {/* Three-column pillar section */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid sm:grid-cols-3 gap-6">
        <Pillar
          icon="📡"
          title="Proactive, not reactive"
          body="ResQ monitors federal NWS disaster feeds. The moment a threat is detected in a registered area, we don't wait for a 911 call — we call out."
        />
        <Pillar
          icon="🗣️"
          title="Voice-first, by design"
          body="ElevenLabs Conversational AI speaks with the resident — no app, no website, no panic-typing. Inclusive for the blind, mobility-impaired, and elderly."
        />
        <Pillar
          icon="🧠"
          title="Claude does the triage"
          body="Every transcript is analyzed by Claude. Each resident gets a priority score and a single-sentence briefing — so responders see who needs them most."
        />
      </section>

      {/* How it works */}
      <section className="bg-gray-900 text-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">From alert to dispatch in under 60 seconds</h2>
          <div className="grid sm:grid-cols-4 gap-6">
            <Step n="1" title="Alert detected" body="NWS issues a wildfire / flood / hurricane warning for a ZIP code." />
            <Step n="2" title="Outbound call" body="ResQ pulls every registered resident in the polygon and dials them via Twilio + ElevenLabs." />
            <Step n="3" title="AI conversation" body="The agent confirms safety, equipment status, mobility, and battery levels." />
            <Step n="4" title="Triaged dashboard" body="Claude scores each call. Pins go red on the responder map. Crews go to the highest-priority addresses first." />
          </div>
        </div>
      </section>

      {/* Talk to the agent live */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Try the agent live</h2>
        <p className="text-gray-600 mt-2 mb-6">
          Click below to talk to the same conversational agent ResQ uses during an event.
        </p>
        <div className="inline-block">
          <elevenlabs-convai agent-id="agent_1801kqkw46cbf23sqy34vvcyem9w"></elevenlabs-convai>
        </div>
        <Script
          src="https://unpkg.com/@elevenlabs/convai-widget-embed"
          strategy="afterInteractive"
        />
        <p className="text-gray-400 text-xs mt-6">
          AI-assisted system. All responses reviewed by human responders during real events.
        </p>
      </section>

      <footer className="border-t bg-white py-8 text-center text-sm text-gray-500">
        ResQ · Precision Triage for the Vulnerable · Inclusive by design
      </footer>
    </main>
  );
}

function Pillar({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="text-3xl">{icon}</div>
      <h3 className="text-lg font-bold mt-3 text-gray-900">{title}</h3>
      <p className="text-gray-600 mt-2 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="text-red-400 font-bold text-sm">STEP {n}</div>
      <div className="font-bold text-lg mt-1">{title}</div>
      <p className="text-gray-300 text-sm mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
