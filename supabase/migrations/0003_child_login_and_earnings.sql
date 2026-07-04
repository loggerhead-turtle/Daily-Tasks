-- Child logins + dollar earnings
-- Run in the Supabase SQL editor if you created your project before this file.

-- ── Child logins ───────────────────────────────────────────────────────────
-- A child gets their own auth account (email + password), mirrored by a
-- profile row that is role='child' and points at their member row. Crucially
-- a child profile has family_id = NULL, so my_family_id() returns NULL for them
-- and every existing family-scoped RLS policy denies direct table access. All
-- child data is served through /api/child/* using the service role instead.
alter table profiles add column if not exists role text not null default 'parent'
  check (role in ('parent', 'child'));
alter table profiles add column if not exists member_id uuid references members (id) on delete cascade;

-- ── Dollar value per chore (stored in cents to avoid floating point) ─────────
alter table chores add column if not exists cents int not null default 0;

-- ── Real-money earnings ledger (separate from the fun points_ledger) ─────────
-- Positive cents = money earned by finishing a chore; negative = a payout the
-- parent has cashed out. The child's unpaid balance is the running sum.
create table if not exists earnings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  cents int not null,
  reason text not null,
  kind text not null default 'chore' check (kind in ('chore', 'payout', 'adjustment')),
  chore_instance_id uuid references chore_instances (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists earnings_member on earnings (member_id);

alter table earnings enable row level security;
-- Parents (family_id set) manage their family's earnings directly; children
-- (family_id NULL) are denied here and read theirs via the server API.
drop policy if exists "earnings all" on earnings;
create policy "earnings all" on earnings
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
