'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEVICE_OPTIONS = [
  'Ventilator',
  'Oxygen Concentrator',
  'Oxygen Tank',
  'Power Wheelchair',
  'Dialysis Machine',
  'Insulin Refrigeration',
  'CPAP / BiPAP',
  'Feeding Pump',
  'Stair Lift',
];

const CONDITION_OPTIONS = [
  'Mobility impairment',
  'Visual impairment',
  'Hearing impairment',
  'Cognitive / developmental disability',
  'Respiratory condition (COPD, asthma)',
  'Cardiac condition',
  'Diabetes (insulin dependent)',
  'Kidney failure / dialysis',
  'Spinal cord injury',
  'Elderly / frail',
];

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    emergency_contact: '',
    medical_conditions: [] as string[],
    required_devices: [] as string[],
    notes: '',
    consent: false,
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const toggle = (field: 'medical_conditions' | 'required_devices', value: string) => {
    setForm((f) => {
      const has = f[field].includes(value);
      return { ...f, [field]: has ? f[field].filter((v) => v !== value) : [...f[field], value] };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) {
      setError('You must consent to be contacted in an emergency.');
      return;
    }
    setStatus('saving');
    setError(null);
    const { error: err } = await supabase.from('patients').insert({
      name: form.name,
      phone: form.phone,
      address: form.address,
      emergency_contact: form.emergency_contact,
      medical_conditions: form.medical_conditions.join(', '),
      required_devices: form.required_devices.join(', '),
      notes: form.notes,
      status: 'Safe',
      priority: 0,
      needs_evacuation: false,
    });
    if (err) {
      setStatus('error');
      setError(err.message);
    } else {
      setStatus('ok');
      setForm({
        name: '', phone: '', address: '', emergency_contact: '',
        medical_conditions: [], required_devices: [], notes: '', consent: false,
      });
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-2xl">🚑</a>
          <div>
            <h1 className="text-xl font-bold text-red-600">ResQ Registry</h1>
            <p className="text-xs text-gray-500">Vulnerable Needs Registration · used only during active emergencies</p>
          </div>
        </div>
        <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">View Dashboard →</a>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Register for Emergency Outreach</h2>
          <p className="text-gray-600 text-sm mb-6">
            When a disaster alert is issued for your area, ResQ will proactively call you to make sure
            you have power, equipment, and a way out. Information is shared with first responders only
            during active emergencies.
          </p>

          {status === 'ok' && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
              ✓ Registered. You will be contacted automatically if an alert affects your area.
            </div>
          )}
          {status === 'error' && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
              ✗ {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Phone (we'll call this number)" required>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input"
                  placeholder="+1 555 123 4567"
                />
              </Field>
            </div>

            <Field label="Address" required>
              <input
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input"
                placeholder="123 Main St, Apt 4, San Francisco CA"
              />
            </Field>

            <Field label="Emergency contact (name + phone)">
              <input
                value={form.emergency_contact}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                className="input"
                placeholder="Sister · +1 555 987 1111"
              />
            </Field>

            <Field label="Conditions (select all that apply)">
              <div className="flex flex-wrap gap-2">
                {CONDITION_OPTIONS.map((c) => (
                  <Chip
                    key={c}
                    active={form.medical_conditions.includes(c)}
                    onClick={() => toggle('medical_conditions', c)}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Life-sustaining or assistive equipment">
              <div className="flex flex-wrap gap-2">
                {DEVICE_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    active={form.required_devices.includes(d)}
                    onClick={() => toggle('required_devices', d)}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Notes for responders (access codes, pets, mobility specifics)">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input min-h-[80px]"
                placeholder="Lock box code 1234. Service dog Bailey. Bedroom is on second floor."
              />
            </Field>

            <label className="flex items-start gap-3 text-sm text-gray-700 bg-gray-50 border rounded p-3">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-1"
              />
              <span>
                I consent to ResQ contacting me by automated voice call during an active emergency
                affecting my area, and to sharing my equipment and location data with first responders
                during that emergency.
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={status === 'saving'}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {status === 'saving' ? 'Saving…' : 'Register'}
              </button>
              <a
                href="/"
                className="px-5 py-2 rounded-lg font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 14px;
          background: white;
        }
        .input:focus { outline: 2px solid #fca5a5; border-color: #ef4444; }
      `}</style>
    </main>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-red-600 text-white border-red-600'
          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  );
}
