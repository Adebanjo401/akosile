-- Akosile initial schema
-- Run in Supabase SQL editor or via supabase CLI

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  timezone text not null default 'Africa/Lagos',
  locale text not null default 'en-NG',
  base_currency text not null default 'NGN',
  first_day_of_week smallint not null default 1,
  role text not null default 'user' check (role in ('user', 'admin')),
  modules jsonb not null default '{"schedule":true,"money":true,"health":true}'::jsonb,
  quiet_hours_start text,
  quiet_hours_end text,
  theme text not null default 'system',
  water_unit text not null default 'cups',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  module text not null,
  parent_id uuid references public.categories (id) on delete set null,
  color text not null default '#2D6A4F',
  icon text not null default 'circle',
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null,
  currency text not null,
  opening_balance_minor bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  account_id uuid not null references public.accounts (id) on delete restrict,
  amount_minor bigint not null,
  currency text not null,
  rate_to_base numeric(24, 12) not null,
  amount_base_minor bigint not null,
  category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  date date not null,
  note text,
  recurring_id uuid,
  status text not null default 'cleared',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amount_positive check (amount_minor > 0)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete restrict,
  to_account_id uuid not null references public.accounts (id) on delete restrict,
  from_amount_minor bigint not null,
  to_amount_minor bigint not null,
  from_currency text not null,
  to_currency text not null,
  rate numeric(24, 12) not null,
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency text not null,
  rate_to_base numeric(24, 12) not null,
  source text not null check (source in ('manual', 'automatic')),
  as_of timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category_id uuid references public.categories (id) on delete set null,
  due_at timestamptz,
  recurrence jsonb not null default '{"frequency":"none","interval":1}'::jsonb,
  series_id uuid,
  status text not null default 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  fire_at timestamptz not null,
  offset_minutes int,
  channel text not null default 'in_app',
  status text not null default 'pending',
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  value numeric not null,
  unit text not null,
  logged_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_accounts_user on public.accounts (user_id);
create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists idx_tasks_user_due on public.tasks (user_id, due_at);
create index if not exists idx_reminders_user_fire on public.reminders (user_id, fire_at);
create index if not exists idx_health_logs_user_type on public.health_logs (user_id, type, logged_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','categories','accounts','transactions','transfers',
    'exchange_rates','tasks','reminders','health_logs'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%s_updated on public.%I; create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.health_logs enable row level security;

-- Profiles: users manage own row; role is not client-writable to admin escalation
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Generic owner policies
create policy "categories_all_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transfers_all_own" on public.transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exchange_rates_all_own" on public.exchange_rates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminders_all_own" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "health_logs_all_own" on public.health_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
