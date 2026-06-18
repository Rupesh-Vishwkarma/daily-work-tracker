-- Run this in your Supabase SQL Editor (Project → SQL Editor → New Query)

-- Employees table
create table if not exists employees (
  id text primary key,
  username text unique not null,
  name text not null,
  password text not null,
  role text not null default 'employee',
  created_at timestamptz default now()
);

-- Entries table
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(id) on delete cascade,
  employee_name text not null,
  date date not null,
  work text not null,
  blockers text default '',
  workload text not null check (workload in ('light','medium','heavy')),
  timestamp timestamptz default now()
);

-- Index for fast date queries
create index if not exists entries_date_idx on entries(date);
create index if not exists entries_employee_idx on entries(employee_id);

-- Seed initial employees (passwords same as the original HTML)
insert into employees (id, username, name, password, role) values
  ('rupesh',  'rupesh',  'Rupesh Vishwkarma',  'Rupesh@123', 'employee'),
  ('dev',     'dev',     'Dev Desai',           'Dev@123',    'employee'),
  ('rahul',   'rahul',   'Rahul Mehta',         'Work@123',   'employee'),
  ('sneha',   'sneha',   'Sneha Joshi',         'Work@123',   'employee'),
  ('vikram',  'vikram',  'Vikram Singh',        'Work@123',   'employee'),
  ('divya',   'divya',   'Divya Nair',          'Work@123',   'employee'),
  ('ankit',   'ankit',   'Ankit Gupta',         'Work@123',   'employee'),
  ('kavya',   'kavya',   'Kavya Reddy',         'Work@123',   'employee'),
  ('suresh',  'suresh',  'Suresh Kumar',        'Work@123',   'employee'),
  ('meera',   'meera',   'Meera Iyer',          'Work@123',   'employee'),
  ('ravi',    'ravi',    'Ravi Verma',          'Work@123',   'employee'),
  ('pooja',   'pooja',   'Pooja Malhotra',      'Work@123',   'employee'),
  ('nikhil',  'nikhil',  'Nikhil Rao',          'Work@123',   'employee'),
  ('swati',   'swati',   'Swati Desai',         'Work@123',   'employee'),
  ('manish',  'manish',  'Manish Tiwari',       'Work@123',   'employee')
on conflict (id) do nothing;

-- Disable Row Level Security (API routes use service_role key which bypasses RLS anyway)
alter table employees disable row level security;
alter table entries disable row level security;
