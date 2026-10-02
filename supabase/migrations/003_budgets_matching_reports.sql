-- Budgets, expense↔money matching constraints, profile/sync fixes, report views.

-- Profiles: email (optional) + household module default
alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  alter column modules set default '{"schedule":true,"money":true,"health":true,"household":true}'::jsonb;

-- Allow client upsert of the signed-in user's profile (rebase / first push)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Transactions: origin of the row + status check
alter table public.transactions
  add column if not exists source text not null default 'manual';

alter table public.transactions
  drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'expense'));

alter table public.transactions
  drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('cleared', 'upcoming'));

alter table public.tasks
  drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending', 'completed', 'cancelled'));

-- Household items: optional due date + one-to-one money link
alter table public.household_items
  add column if not exists due_date date;

create unique index if not exists uq_household_items_transaction
  on public.household_items (transaction_id)
  where transaction_id is not null;

create index if not exists idx_household_items_transaction
  on public.household_items (transaction_id)
  where transaction_id is not null;

create index if not exists idx_transfers_user_date
  on public.transfers (user_id, date desc);

-- Monthly category budgets (base currency minor units)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  period_start date not null,
  amount_base_minor bigint not null check (amount_base_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, period_start)
);

create index if not exists idx_budgets_user_period
  on public.budgets (user_id, period_start);

drop trigger if exists trg_budgets_updated on public.budgets;
create trigger trg_budgets_updated
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Offline reports still compute in the client. These views are for later admin / SQL.
create or replace view public.v_monthly_spend_by_category as
select
  t.user_id,
  date_trunc('month', t.date)::date as period_start,
  t.category_id,
  sum(t.amount_base_minor) filter (
    where t.type = 'expense' and t.status = 'cleared'
  ) as spent_base_minor
from public.transactions t
group by t.user_id, date_trunc('month', t.date)::date, t.category_id;

create or replace view public.v_budget_vs_actual as
select
  b.user_id,
  b.period_start,
  b.category_id,
  b.amount_base_minor as budgeted_base_minor,
  coalesce(s.spent_base_minor, 0) as spent_base_minor
from public.budgets b
left join public.v_monthly_spend_by_category s
  on s.user_id = b.user_id
  and s.period_start = b.period_start
  and s.category_id is not distinct from b.category_id;

alter view public.v_monthly_spend_by_category set (security_invoker = true);
alter view public.v_budget_vs_actual set (security_invoker = true);

grant select on public.v_monthly_spend_by_category to authenticated;
grant select on public.v_budget_vs_actual to authenticated;
