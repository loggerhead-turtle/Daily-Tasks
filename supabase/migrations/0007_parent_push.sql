-- Parent push subscriptions.
-- Kids' phones register against their member_id (0005); parents authenticate as
-- a profile (auth.users) and may not have a member row, so their phone's
-- subscription is keyed by profile_id instead. Additive + idempotent: the app
-- keeps working before this runs (parent push simply stays dormant).
alter table push_subscriptions
  add column if not exists profile_id uuid references profiles (id) on delete cascade;

create index if not exists push_subscriptions_profile on push_subscriptions (profile_id);
