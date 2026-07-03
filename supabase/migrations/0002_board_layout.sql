-- Customizable board layout (card order, sizes, hidden cards).
-- Run in the Supabase SQL editor if you created your project before this file existed.

alter table families add column if not exists board_layout jsonb;
