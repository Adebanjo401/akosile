-- Household lists + extra health log fields

alter table public.health_logs
  add column if not exists title text,
  add column if not exists meal text;

create table if not exists public.household_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('grocery', 'repair', 'other')),
  status text not null default 'needed' check (status in ('needed', 'done', 'cancelled')),
  estimated_amount_minor bigint,
  currency text,
  category_id uuid references public.categories (id) on delete set null,
  note text,
  transaction_id uuid references public.transactions (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_household_items_user_status
  on public.household_items (user_id, status);

drop trigger if exists trg_household_items_updated on public.household_items;
create trigger trg_household_items_updated
  before update on public.household_items
  for each row execute function public.set_updated_at();

alter table public.household_items enable row level security;

create policy "household_items_all_own" on public.household_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
