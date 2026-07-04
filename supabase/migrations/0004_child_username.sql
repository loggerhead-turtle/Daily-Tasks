-- Optional username for child logins (shown to parents; the underlying auth
-- email may be a synthetic username@kids.familyboard.local address).
alter table profiles add column if not exists username text;
