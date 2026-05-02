'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Patient {
  id: string;
  name: string;
  address: string;
  priority: number;
  status: string;
  briefing: string;
  lat?: number;
  lng?: number;
  medical_conditions?: string;
  required_devices?: string;
}

interface MapProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient) => void;
}

// Fix Leaflet default icon issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function getPriorityColor(priority: number): string {
  if (priority >= 8) return '#EF4444'; // Red - Critical
  if (priority >= 6) return '#F97316'; // Orange - Urgent
  if (priority >= 4) return '#EAB308'; // Yellow - Moderate
  return '#22C55E'; // Green - Safe
}

// Custom marker icon based on priority
function createCustomIcon(priority: number, isSelected: boolean) {
  const color = getPriorityColor(priority);
  const size = isSelected ? 40 : 30;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 ${isSelected ? '20px' : '10px'} ${color}88;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.5}px;
        animation: ${priority >= 8 ? 'pulse 2s infinite' : 'none'};
      ">
        📍
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Component to handle map centering when patient is selected
function MapController({ selectedPatient }: { selectedPatient: Patient | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedPatient && selectedPatient.lat && selectedPatient.lng) {
      map.flyTo([selectedPatient.lat, selectedPatient.lng], 14, {
        duration: 1,
      });
    }
  }, [selectedPatient, map]);
  
  return null;
}

export default function Map({ patients, selectedPatient, onSelectPatient }: MapProps) {
  // Default center: San Francisco
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const defaultZoom = 13;

  // Filter patients with valid coordinates
  const patientsWithCoords = patients.filter(p => p.lat && p.lng);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController selectedPatient={selectedPatient} />
        
        {patientsWithCoords.map((patient) => (
          <Marker
            key={patient.id}
            position={[patient.lat!, patient.lng!]}
            icon={createCustomIcon(patient.priority, selectedPatient?.id === patient.id)}
            eventHandlers={{
              click: () => onSelectPatient(patient),
            }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: getPriorityColor(patient.priority),
                }}>
                  {patient.name}
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  📍 {patient.address}
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: getPriorityColor(patient.priority),
                  background: `${getPriorityColor(patient.priority)}22`,
                  padding: '4px 8px',
                  borderRadius: 4,
                  display: 'inline-block',
                  marginBottom: 8,
                }}>
                  Priority: {patient.priority}/10
                </div>
                {patient.briefing && (
                  <div style={{
                    fontSize: 11,
                    color: '#666',
                    marginTop: 8,
                    padding: 8,
                    background: '#f5f5f5',
                    borderRadius: 4,
                    borderLeft: `3px solid ${getPriorityColor(patient.priority)}`,
                  }}>
                    {patient.briefing}
                  </div>
                )}
                {patient.medical_conditions && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    🏥 {patient.medical_conditions}
                  </div>
                )}
                {patient.required_devices && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                    ⚡ {patient.required_devices}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Stats Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,0,0.85)',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #333',
        color: 'white',
        zIndex: 1000,
      }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>
          ACTIVE CASES
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#EF4444' }}>
          {patients.length}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          {patients.filter(p => p.priority >= 8).length} Critical
        </div>
      </div>

      {/* Legend Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(0,0,0,0.85)',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #333',
        color: 'white',
        zIndex: 1000,
      }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>
          PRIORITY LEVELS
        </div>
        {[
          { label: 'Critical (8-10)', color: '#EF4444' },
          { label: 'Urgent (6-7)', color: '#F97316' },
          { label: 'Moderate (4-5)', color: '#EAB308' },
          { label: 'Safe (0-3)', color: '#22C55E' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: color,
            }} />
            <span style={{ fontSize: 11, color: '#aaa' }}>{label}</span>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
