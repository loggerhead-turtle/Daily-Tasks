-- Family Board — demo seed data
-- Run AFTER 0001_init.sql. Creates "The Demo Family" so every screen has
-- something beautiful to show before you add your own family.
--
--   • Parent web app: sign up with invite code  DEMO2026  to manage it
--   • Kitchen board:  pair with code            DEMO1234
--   • Board parent PIN:                         1234

do $$
declare
  fam uuid;
  mom uuid; dad uuid; ava uuid; leo uuid; mia uuid;
  c_dog uuid; c_dishes uuid;
begin
  insert into families (name, invite_code, parent_pin_hash, weather_lat, weather_lon, weather_location)
  values ('The Demo Family', 'DEMO2026', '$2a$10$GGJpbJ5h08Fwo1CwPPXMZuFzgECbOnGLpkc4S8Jh8L/.VAsW.F7LW', 39.7392, -104.9903, 'Denver, CO')
  returning id into fam;

  insert into members (family_id, name, role, color, emoji, sort_order) values
    (fam, 'Mom', 'parent', '#8b5cf6', '🦋', 0) returning id into mom;
  insert into members (family_id, name, role, color, emoji, sort_order) values
    (fam, 'Dad', 'parent', '#0ea5e9', '🦅', 1) returning id into dad;
  insert into members (family_id, name, role, color, emoji, sort_order) values
    (fam, 'Ava', 'child', '#ec4899', '🦄', 2) returning id into ava;
  insert into members (family_id, name, role, color, emoji, sort_order) values
    (fam, 'Leo', 'child', '#22c55e', '🦖', 3) returning id into leo;
  insert into members (family_id, name, role, color, emoji, sort_order) values
    (fam, 'Mia', 'child', '#f59e0b', '🐱', 4) returning id into mia;

  -- Chores: recurring, rotation, and up-for-grabs bonuses
  insert into chores (family_id, title, emoji, points, assign_type, member_id, recurrence) values
    (fam, 'Feed the dog',        '🐶', 10, 'fixed', ava, 'daily'),
    (fam, 'Make your bed',       '🛏️', 5,  'fixed', leo, 'daily'),
    (fam, 'Water the plants',    '🪴', 10, 'fixed', mia, 'daily');

  insert into chores (family_id, title, emoji, points, assign_type, member_id, recurrence, days_of_week) values
    (fam, 'Take out the trash',  '🗑️', 15, 'fixed', leo, 'weekly', '{2,5}'),
    (fam, 'Clean your room',     '🧸', 20, 'fixed', ava, 'weekly', '{6}'),
    (fam, 'Sort the laundry',    '🧺', 15, 'fixed', mia, 'weekly', '{3}');

  insert into chores (family_id, title, emoji, points, assign_type, rotation_member_ids, recurrence)
  values (fam, 'Dishes after dinner', '🍽️', 15, 'rotation', array[ava, leo, mia], 'daily')
  returning id into c_dishes;

  insert into chores (family_id, title, emoji, points, assign_type, recurrence, days_of_week) values
    (fam, 'Bonus: sweep the porch', '🧹', 25, 'grab', 'weekly', '{6,0}'),
    (fam, 'Bonus: help with dinner', '👩‍🍳', 20, 'grab', 'daily', '{}');

  -- Rewards catalog
  insert into rewards (family_id, title, emoji, cost) values
    (fam, '30 min extra screen time', '📱', 50),
    (fam, 'Pick the movie night film', '🍿', 75),
    (fam, 'Ice cream trip',            '🍦', 100),
    (fam, 'Stay up 30 min later',      '🌙', 80),
    (fam, 'One-on-one park trip',      '🛝', 150),
    (fam, '$5 allowance bonus',        '💵', 200);

  -- A little points history so balances look alive
  insert into points_ledger (family_id, member_id, delta, reason) values
    (fam, ava, 45, 'Chores this week'),
    (fam, leo, 60, 'Chores this week'),
    (fam, mia, 30, 'Chores this week');

  -- This week's dinners
  insert into meals (family_id, date, title, emoji) values
    (fam, current_date,     'Taco night',        '🌮'),
    (fam, current_date + 1, 'Spaghetti',         '🍝'),
    (fam, current_date + 2, 'Homemade pizza',    '🍕'),
    (fam, current_date + 3, 'Chicken stir fry',  '🥡'),
    (fam, current_date + 4, 'Burgers & fries',   '🍔');

  insert into announcements (family_id, message, emoji, starts_on, ends_on) values
    (fam, 'Grandma arrives Saturday!', '👵', current_date, current_date + 7),
    (fam, 'Soccer practice moved to 5pm this week', '⚽', current_date, current_date + 5);

  -- Kitchen board pairing code (long-lived, for the demo)
  insert into pairing_codes (code, family_id, expires_at)
  values ('DEMO1234', fam, now() + interval '10 years');
end $$;
