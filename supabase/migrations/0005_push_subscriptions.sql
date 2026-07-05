-- Web Push subscriptions for kids' phones (Chrome/Android etc.).
-- Managed only by the server (service role); no client policies.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid references members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member on push_subscriptions (member_id);

alter table push_subscriptions enable row level security;
