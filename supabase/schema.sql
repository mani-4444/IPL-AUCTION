-- supabase/schema.sql
-- Run this in the Supabase SQL Editor to create all tables

-- Players table (static seed data from Excel)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text check (role in ('Batsman','Wicketkeeper','Bowler','All-Rounder')),
  rating integer check (rating between 1 and 100),
  base_price numeric(5,2) not null,
  nationality text check (nationality in ('Indian','Overseas')),
  ipl_team text,
  image_url text,
  created_at timestamptz default now()
);

-- Rooms table (one per game session)
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  host_name text not null,
  status text default 'waiting' check (status in ('waiting','auction','team-setup','results')),
  current_round integer default 1,
  auction_config jsonb not null,
  created_at timestamptz default now()
);

-- Teams table (one per user per room)
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  team_name text not null,
  budget_remaining numeric(6,2) default 100,
  players jsonb default '[]',
  playing_xi jsonb default '[]',
  bench jsonb default '[]',
  captain text,
  vice_captain text,
  final_score jsonb,
  created_at timestamptz default now()
);

-- Auction log (immutable record of each sale)
create table if not exists auction_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  player_id uuid references players(id),
  round integer,
  winning_team_id uuid references teams(id),
  sold_price numeric(5,2),
  is_sold boolean default false,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_teams_room_id on teams(room_id);
create index if not exists idx_auction_log_room_id on auction_log(room_id);
create index if not exists idx_rooms_code on rooms(code);
