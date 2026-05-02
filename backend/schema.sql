-- ResQ Supabase schema
-- Run once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists patients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone              text,
  address            text,
  emergency_contact  text,
  medical_conditions text,
  required_devices   text,
  notes              text,
  status             text default 'Safe',     -- Safe | Calling… | Monitored | Urgent | Critical
  priority           int  default 0,          -- 0..10
  briefing           text,
  needs_evacuation   boolean default false,
  lat                double precision,
  lng                double precision,
  created_at         timestamptz default now()
);

create table if not exists calls (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references patients(id) on delete cascade,
  transcript  text,
  priority    int,
  briefing    text,
  created_at  timestamptz default now()
);

-- Realtime: enable in the Supabase dashboard for the `patients` table so the
-- responder dashboard updates without a refresh.

-- Optional: minimal seed data for the demo.
insert into patients (name, phone, address, medical_conditions, required_devices, status, lat, lng)
values
  ('Maria Chen',     '+15551110001', '482 Oak St, San Francisco CA',  'COPD',                 'Oxygen Concentrator',     'Safe', 37.7849, -122.4094),
  ('Robert Hayes',   '+15551110002', '1180 Mission St, San Francisco', 'ALS',                  'Ventilator',              'Safe', 37.7780, -122.4150),
  ('Aiyana Begay',   '+15551110003', '90 24th Ave, San Francisco CA',  'Type 1 Diabetes',      'Insulin Refrigeration',   'Safe', 37.7836, -122.4810),
  ('Daniel Park',    '+15551110004', '2200 Fillmore, San Francisco',   'Spinal cord injury',   'Power Wheelchair',        'Safe', 37.7906, -122.4346),
  ('Evelyn Walker',  '+15551110005', '350 Sanchez St, San Francisco',  'Kidney failure',       'Dialysis Machine',        'Safe', 37.7642, -122.4317),
  ('Marcus Greene',  '+15551110006', '700 Larkin St, San Francisco',   'Mobility / blind',     'Stair Lift',              'Safe', 37.7826, -122.4178),
  ('Linh Tran',      '+15551110007', '1500 Sloat Blvd, San Francisco', 'Cardiac',              'CPAP / BiPAP',            'Safe', 37.7350, -122.4940)
on conflict do nothing;
