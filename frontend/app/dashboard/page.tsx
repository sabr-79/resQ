'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      color: 'white',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 48px',
        borderBottom: '1px solid #1A1A1A',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#EF4444',
            boxShadow: '0 0 12px #EF4444',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>ResQ</span>
          <span style={{ fontSize: 11, color: '#555', letterSpacing: '3px', textTransform: 'uppercase' }}>Emergency AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ color: '#555', fontSize: 13, fontFamily: 'monospace' }}>{time}</span>
          <a href="/dashboard" style={{
            color: '#888', fontSize: 13, textDecoration: 'none',
            letterSpacing: '1px', padding: '8px 16px',
            border: '1px solid #222', borderRadius: 4,
          }}>Responder Dashboard →</a>
        </div>
      </nav>

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column',
        textAlign: 'center', padding: '80px 48px', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-block',
          background: 'rgba(239,68,68,0.1)', color: '#EF4444',
          fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase',
          padding: '8px 20px', borderRadius: 100, marginBottom: 40,
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          AI-Powered Emergency Response
        </div>

        <h1 style={{
          fontSize: 72, fontWeight: 400, lineHeight: 1.05,
          marginBottom: 24, letterSpacing: '-3px', maxWidth: 700,
        }}>
          Emergency help,<br />
          <em style={{ color: '#EF4444' }}>one click</em> away.
        </h1>

        <p style={{
          fontSize: 18, color: '#666', lineHeight: 1.7,
          marginBottom: 64, maxWidth: 480,
        }}>
          During a disaster, click the button below. Our AI dispatcher answers immediately, assesses your situation, and alerts first responders.
        </p>

        {/* Centered ElevenLabs widget — this IS the call button */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}>
          <elevenlabs-convai agent-id="agent_1801kqkw46cbf23sqy34vvcyem9w"></elevenlabs-convai>
          <p style={{ fontSize: 12, color: '#333', letterSpacing: '0.5px' }}>
            AI-assisted · All cases reviewed by human responders
          </p>
        </div>
      </div>

      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </main>
  );
}