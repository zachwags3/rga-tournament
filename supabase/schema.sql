-- RGA Tournament Database Schema
-- Run this in your Supabase SQL editor

-- Teams table
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  captain_name text not null,
  color text not null default '#1a4731',
  created_at timestamp with time zone default now()
);

-- Players table
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  team_id uuid references teams(id) on delete cascade,
  pick_number int, -- null = not yet drafted, 0 = captain, 1-5 = draft pick
  is_captain boolean default false,
  created_at timestamp with time zone default now()
);

-- Rounds table
create table if not exists rounds (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  format text not null check (format in ('scramble', 'shamble', 'singles')),
  holes int not null,
  points_available int not null,
  sort_order int not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'complete')),
  created_at timestamp with time zone default now()
);

-- Matches table
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references rounds(id) on delete cascade,
  match_number int not null,
  team1_player_names text[] not null default '{}',
  team2_player_names text[] not null default '{}',
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'complete')),
  result text check (result in ('team1_win', 'team2_win', 'halved')),
  rga_points_team1 decimal(3,1) default 0,
  rga_points_team2 decimal(3,1) default 0,
  created_at timestamp with time zone default now()
);

-- Hole scores table
create table if not exists hole_scores (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  team1_score int check (team1_score > 0),
  team2_score int check (team2_score > 0),
  winner text check (winner in ('team1', 'team2', 'halved')),
  created_at timestamp with time zone default now(),
  unique (match_id, hole_number)
);

-- Enable real-time for all tables
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table hole_scores;

-- Seed the three rounds
insert into rounds (name, format, holes, points_available, sort_order, status) values
  ('Saturday AM — 2v2 Scramble', 'scramble', 18, 3, 1, 'pending'),
  ('Saturday PM — Shamble', 'shamble', 9, 3, 2, 'pending'),
  ('Sunday — 1v1 Singles', 'singles', 18, 6, 3, 'pending')
on conflict do nothing;

-- Enable row-level security (open read, open write — no auth)
alter table teams enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table matches enable row level security;
alter table hole_scores enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public write teams" on teams for all using (true);

create policy "public read players" on players for select using (true);
create policy "public write players" on players for all using (true);

create policy "public read rounds" on rounds for select using (true);
create policy "public write rounds" on rounds for all using (true);

create policy "public read matches" on matches for select using (true);
create policy "public write matches" on matches for all using (true);

create policy "public read hole_scores" on hole_scores for select using (true);
create policy "public write hole_scores" on hole_scores for all using (true);
