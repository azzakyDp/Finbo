-- Skema Finbo --

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text unique not null,
  name text,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('pemasukan', 'pengeluaran')),
  amount numeric not null,
  note text,
  category text,
  created_at timestamptz default now()
);

create index if not exists idx_tx_user_date on transactions(user_id, date);
create index if not exists idx_tx_type on transactions(type);

create table if not exists planning_items (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete cascade,
  type text not null check (type in ('wishlist', 'goal')),
  title text not null,
  target_amount numeric,
  saved_amount numeric default 0,
  deadline date,
  is_done boolean default false,
  created_at timestamptz default now()
);

create table if not exists category_budgets (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete cascade,
  category text not null,
  monthly_limit numeric not null,
  updated_at timestamptz default now()
);

-- sessions: token dashboard hasil login Telegram WebApp
create table if not exists sessions (
  token text primary key,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_expires on sessions(expires_at);
