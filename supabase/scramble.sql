-- Kickoff Classic (one-off 4-team scramble) — single table, isolated from the Cup schema.
-- Run this once in the Supabase SQL editor. To remove after the event: drop table scramble_scores;

create table if not exists scramble_scores (
  id uuid default gen_random_uuid() primary key,
  team_slug text not null,
  hole_number int not null check (hole_number between 1 and 18),
  strokes int check (strokes > 0),
  created_at timestamp with time zone default now(),
  unique (team_slug, hole_number)
);

alter table scramble_scores enable row level security;
create policy "public read scramble_scores"  on scramble_scores for select using (true);
create policy "public write scramble_scores" on scramble_scores for all    using (true);

alter publication supabase_realtime add table scramble_scores;
