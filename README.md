# Akosile

Personal life desk for money, health, schedule and reminders — as a web app and installable PWA, with offline support and Supabase sync.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- IndexedDB via Dexie (local-first)
- Outbox sync to Supabase (Auth + Postgres + RLS)
- PWA via `@ducanh2912/next-pwa`

## Quick start

```bash
cd ~/projects/personal/akosile
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase credentials the app runs **local-only** (data stays in the browser). That is enough to try Today, quick-add, money, tasks and health.

## Enable cloud sync

1. Create a project at [supabase.com](https://supabase.com).
2. Put the URL and publishable key in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
3. Run the SQL in `supabase/migrations/` in order (`001`, `002`, `003`) in the Supabase SQL editor.
4. Enable Email auth (magic link) in Supabase Auth settings.
5. Sign in from **More → Sign in to sync**.

## MVP features

- Onboarding (name, base currency, modules)
- Today dashboard (overdue/due tasks, money snapshot, water/sleep)
- Persistent quick-add (task, spent, received, health)
- Schedule list with recurrence (daily/weekly/monthly/yearly)
- Accounts, transactions, manual FX rates, cross-currency aware totals
- Categories with defaults, archive, inline create
- Missed reminders list
- Export JSON/CSV; delete local data
- Offline badge + outbox sync when online

## Admin

No admin UI in MVP. Profiles include a `role` field (`user` | `admin`) for a future admin console. RLS keeps each user on their own rows.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
