-- Kids can propose a bounty (a chore they think should exist) with a suggested
-- price; a parent accepts (optionally adjusting the price) or declines.
create table if not exists bounty_proposals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  title text not null,
  emoji text,
  cents int not null default 0,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table bounty_proposals enable row level security;

drop policy if exists "bounty_proposals all" on bounty_proposals;
create policy "bounty_proposals all" on bounty_proposals
  for all using (family_id = my_family_id()) with check (family_id = my_family_id());
