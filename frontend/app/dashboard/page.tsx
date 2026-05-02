'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

// Import Map dynamically to avoid SSR issues with Leaflet
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0F0F0F',
      color: '#666',
    }}>
      Loading map...
    </div>
  ),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface Patient {
  id: string;
  name: string;
  address: string;
  phone: string;
  medical_conditions: string;
  required_devices: string;
  priority: number;
  needs_evacuation: boolean;
  briefing: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [time, setTime] = useState('');

  // Update time
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // Load patients
  useEffect(() => {
    loadPatients();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('patients-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        (payload) => {
          console.log('Realtime update:', payload);
          loadPatients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadPatients() {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      setPatients(data || []);
    } catch (err) {
      console.error('Error loading patients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function simulateDisaster() {
    setSimulating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/simulate-disaster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'Wildfire', area: 'Demo County' }),
      });
      const data = await response.json();
      console.log('Simulation result:', data);
      alert(`Simulated disaster: ${data.contacted} residents contacted, ${data.triaged?.length || 0} triaged`);
      loadPatients();
    } catch (err) {
      console.error('Simulation error:', err);
      alert('Simulation failed - check console');
    } finally {
      setSimulating(false);
    }
  }

  function getPriorityColor(priority: number) {
    if (priority >= 8) return '#EF4444'; // Red - Critical
    if (priority >= 6) return '#F97316'; // Orange - Urgent
    if (priority >= 4) return '#EAB308'; // Yellow - Moderate
    return '#22C55E'; // Green - Safe
  }

  function getPriorityLabel(priority: number) {
    if (priority >= 8) return 'CRITICAL';
    if (priority >= 6) return 'URGENT';
    if (priority >= 4) return 'MODERATE';
    return 'SAFE';
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderBottom: '1px solid #1A1A1A',
        background: '#000',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#EF4444',
            boxShadow: '0 0 12px #EF4444',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: 20, fontWeight: 700 }}>ResQ</span>
          <span style={{ fontSize: 11, color: '#555', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Responder Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: '#555', fontSize: 13, fontFamily: 'monospace' }}>{time}</span>
          <button
            onClick={simulateDisaster}
            disabled={simulating}
            style={{
              background: simulating ? '#555' : '#EF4444',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: simulating ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            {simulating ? '⏳ Simulating...' : '🚨 Simulate Disaster'}
          </button>
          <a href="/" style={{
            color: '#888',
            fontSize: 13,
            textDecoration: 'none',
            padding: '8px 16px',
            border: '1px solid #333',
            borderRadius: 4,
          }}>
            ← Home
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
        {/* Map Area */}
        <div style={{
          flex: 1,
          background: '#0F0F0F',
          position: 'relative',
          borderRight: '1px solid #1A1A1A',
        }}>
          <Map 
            patients={patients}
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
          />
        </div>

        {/* Sidebar - Priority List */}
        <div style={{
          width: 450,
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: 20,
            borderBottom: '1px solid #1A1A1A',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>
              Priority List
            </h2>
            <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
              {loading ? 'Loading...' : `${patients.length} active cases`}
            </p>
          </div>

          {/* Patient List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}>
            {patients.length === 0 && !loading && (
              <div style={{
                textAlign: 'center',
                padding: 40,
                color: '#666',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>No active cases</div>
                <div style={{ fontSize: 12, color: '#444' }}>
                  Click "Simulate Disaster" to test the system
                </div>
              </div>
            )}

            {patients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                style={{
                  background: selectedPatient?.id === patient.id ? '#1A1A1A' : '#0A0A0A',
                  border: `2px solid ${selectedPatient?.id === patient.id ? getPriorityColor(patient.priority) : '#1A1A1A'}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                      {patient.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      📍 {patient.address}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: getPriorityColor(patient.priority),
                    minWidth: 40,
                    textAlign: 'right',
                  }}>
                    {patient.priority}
                  </div>
                </div>

                {/* Priority Badge */}
                <div style={{
                  display: 'inline-block',
                  fontSize: 9,
                  fontWeight: 700,
                  color: getPriorityColor(patient.priority),
                  background: `${getPriorityColor(patient.priority)}22`,
                  padding: '4px 10px',
                  borderRadius: 12,
                  letterSpacing: '0.5px',
                  marginBottom: 8,
                }}>
                  {getPriorityLabel(patient.priority)}
                  {patient.needs_evacuation && ' • EVACUATE'}
                </div>

                {/* Briefing */}
                {patient.briefing && (
                  <div style={{
                    fontSize: 12,
                    color: '#aaa',
                    lineHeight: 1.5,
                    marginTop: 8,
                    padding: 8,
                    background: '#0F0F0F',
                    borderRadius: 4,
                    borderLeft: `3px solid ${getPriorityColor(patient.priority)}`,
                  }}>
                    {patient.briefing}
                  </div>
                )}

                {/* Medical Info */}
                {(patient.medical_conditions || patient.required_devices) && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                    {patient.medical_conditions && (
                      <div>🏥 {patient.medical_conditions}</div>
                    )}
                    {patient.required_devices && (
                      <div>⚡ {patient.required_devices}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
      `}</style>
    </main>
  );
}
