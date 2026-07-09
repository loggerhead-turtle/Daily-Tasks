-- Kids can propose a bounty (a chore they think should exist) with a suggested
-- price; a parent accepts (optionally adjusting the price) or declines.
create table if not exists bounty_proposals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade, -- who proposed
  title text not null,
  emoji text not null default '💪',
  cents int not null default 0, -- suggested price
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists bounty_proposals_pending on bounty_proposals (family_id) where status = 'pending';

alter table bounty_proposals enable row level security;
-- Parents manage their family's proposals directly; kids post/read via the
-- server API (their profiles have family_id NULL, so this denies them).
drop policy if exists "bounty_proposals all" on bounty_proposals;
create policy "bounty_proposals all" on bounty_proposals
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
