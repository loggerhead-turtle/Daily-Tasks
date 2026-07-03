-- Family Board — initial schema
-- Run in the Supabase SQL editor (or via supabase db push).

create extension if not exists pgcrypto;

-- ── Core family ──────────────────────────────────────────────────────────

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 8)),
  parent_pin_hash text,
  weather_lat double precision,
  weather_lon double precision,
  weather_location text,
  screensaver_minutes int not null default 10,
  created_at timestamptz not null default now()
);

-- Parent login accounts (rows mirror auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid references families (id) on delete set null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Everyone who appears on the board (parents and children)
create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  role text not null default 'child' check (role in ('parent', 'child')),
  color text not null default '#f59e0b',
  emoji text not null default '🙂',
  avatar_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Google Calendar ──────────────────────────────────────────────────────

create table google_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  google_email text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, google_email)
);

create table calendar_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  connection_id uuid not null references google_connections (id) on delete cascade,
  google_calendar_id text not null,
  label text not null,
  member_id uuid references members (id) on delete set null,
  color text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (connection_id, google_calendar_id)
);

-- ── Chores ───────────────────────────────────────────────────────────────

create table chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  title text not null,
  description text,
  emoji text not null default '🧹',
  points int not null default 10,
  -- fixed: always the same child; rotation: rotates weekly through
  -- rotation_member_ids; grab: unassigned bonus chore, first tap claims it
  assign_type text not null default 'fixed' check (assign_type in ('fixed', 'rotation', 'grab')),
  member_id uuid references members (id) on delete cascade,
  rotation_member_ids uuid[] not null default '{}',
  recurrence text not null default 'daily' check (recurrence in ('daily', 'weekly', 'once')),
  days_of_week int[] not null default '{}', -- 0 = Sunday … 6 = Saturday
  once_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table chore_instances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  chore_id uuid not null references chores (id) on delete cascade,
  date date not null,
  member_id uuid references members (id) on delete cascade, -- null until a grab chore is claimed
  status text not null default 'todo' check (status in ('todo', 'pending', 'approved', 'rejected')),
  completed_at timestamptz,
  reviewed_at timestamptz,
  points_awarded int,
  unique (chore_id, date)
);

create index chore_instances_family_date on chore_instances (family_id, date);
create index chore_instances_pending on chore_instances (family_id) where status = 'pending';

-- ── Rewards ──────────────────────────────────────────────────────────────

create table rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  title text not null,
  emoji text not null default '🎁',
  cost int not null default 50,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  reward_id uuid not null references rewards (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  cost int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index redemptions_pending on redemptions (family_id) where status = 'pending';

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index points_ledger_member on points_ledger (member_id);

-- ── Board content ────────────────────────────────────────────────────────

create table meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  date date not null,
  title text not null,
  emoji text not null default '🍽️',
  unique (family_id, date)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  message text not null,
  emoji text not null default '📣',
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

-- ── Board devices ────────────────────────────────────────────────────────

create table boards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null default 'Kitchen board',
  token uuid not null unique default gen_random_uuid(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table pairing_codes (
  code text primary key,
  family_id uuid not null references families (id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

-- ── Row Level Security ───────────────────────────────────────────────────
-- Parents (authenticated users) may only touch rows in their own family.
-- The kitchen board never talks to Postgres directly: it goes through
-- /api/board/* routes that authenticate with a device token and use the
-- service-role key.

create or replace function my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from profiles where id = auth.uid()
$$;

alter table families enable row level security;
alter table profiles enable row level security;
alter table members enable row level security;
alter table google_connections enable row level security;
alter table calendar_links enable row level security;
alter table chores enable row level security;
alter table chore_instances enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;
alter table points_ledger enable row level security;
alter table meals enable row level security;
alter table announcements enable row level security;
alter table photos enable row level security;
alter table boards enable row level security;
alter table pairing_codes enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "family read" on families
  for select using (id = my_family_id());
create policy "family update" on families
  for update using (id = my_family_id());

create policy "members all" on members
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "calendar_links all" on calendar_links
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "chores all" on chores
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "chore_instances all" on chore_instances
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "rewards all" on rewards
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "redemptions all" on redemptions
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "points_ledger all" on points_ledger
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "meals all" on meals
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "announcements all" on announcements
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "photos all" on photos
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "boards all" on boards
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
create policy "pairing_codes all" on pairing_codes
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());

-- Google refresh tokens are secrets: parents can see that a connection
-- exists (select) and remove it (delete), but tokens are only written and
-- read by server-side code using the service role.
create policy "google_connections read" on google_connections
  for select using (family_id = my_family_id());
create policy "google_connections delete" on google_connections
  for delete using (family_id = my_family_id());

-- ── Storage buckets ──────────────────────────────────────────────────────
-- Public-read buckets for member avatars and screensaver photos.

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id in ('avatars', 'photos'));
create policy "family uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'photos') and (storage.foldername(name))[1] = my_family_id()::text);
create policy "family deletes" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'photos') and (storage.foldername(name))[1] = my_family_id()::text);
