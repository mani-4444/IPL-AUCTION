# IPL Auction Web App — Claude Code Context

## Project Overview

A **real-time multiplayer IPL Auction Web App** where users create/join rooms, bid on cricket players across 5 rounds, build their squad, and compete on a final leaderboard based on a scoring formula.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (dark IPL theme) |
| State Management | Zustand |
| Real-time | Socket.io (client) |
| Backend | Node.js + Express + Socket.io |
| Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (magic link / email) |
| Deployment | Vercel (frontend) + Railway or Render (backend) |

---

## Monorepo Structure

```
ipl-auction/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/              # App Router pages
│   │   │   ├── page.tsx             # Landing / Join-Create room
│   │   │   ├── room/[roomId]/       # Room lobby
│   │   │   ├── auction/[roomId]/    # Live auction screen
│   │   │   ├── team-setup/[roomId]/ # Post-auction XI selection
│   │   │   └── results/[roomId]/    # Final leaderboard
│   │   ├── components/
│   │   │   ├── auction/      # BidPanel, PlayerCard, Timer, BidHistory
│   │   │   ├── room/         # RoomLobby, TeamCard, WaitingScreen
│   │   │   ├── team/         # XI selector, Captain picker, BenchView
│   │   │   ├── leaderboard/  # ScoreTable, ScoreBreakdown
│   │   │   └── ui/           # Shared UI primitives
│   │   ├── lib/
│   │   │   ├── socket.ts     # Socket.io client singleton
│   │   │   ├── supabase.ts   # Supabase client
│   │   │   └── utils.ts
│   │   ├── store/            # Zustand stores
│   │   │   ├── auctionStore.ts
│   │   │   ├── roomStore.ts
│   │   │   └── teamStore.ts
│   │   └── types/            # Shared TypeScript types
│   │       └── index.ts
│   └── server/               # Express + Socket.io backend
│       ├── src/
│       │   ├── index.ts             # Entry point
│       │   ├── socket/
│       │   │   ├── index.ts         # Socket.io setup
│       │   │   ├── roomHandlers.ts  # create/join/leave room events
│       │   │   ├── auctionHandlers.ts # bid, timer, round events
│       │   │   └── teamHandlers.ts  # XI submission events
│       │   ├── services/
│       │   │   ├── auctionService.ts  # Auction state machine
│       │   │   ├── scoringService.ts  # Final score calculation
│       │   │   └── playerService.ts   # Player pool management
│       │   ├── db/
│       │   │   └── supabase.ts       # Supabase admin client
│       │   └── types/
│       │       └── index.ts
│       └── package.json
├── packages/
│   └── shared/               # Shared types between web & server
│       └── types.ts
├── supabase/
│   ├── schema.sql            # Full DB schema
│   ├── seed.sql              # Player seed data (from Excel)
│   └── migrations/
├── scripts/
│   └── import-players.ts     # Excel → Supabase player import script
├── package.json              # Workspace root
└── CLAUDE.md                 # This file
```

---

## Environment Variables

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Backend (`apps/server/.env`)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
CLIENT_URL=http://localhost:3000
```

---

## Core Data Models (TypeScript)

```ts
// packages/shared/types.ts

export type PlayerRole = 'Batsman' | 'Wicketkeeper' | 'Bowler' | 'All-Rounder';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  rating: number;        // 1–100
  basePrice: number;     // in Cr (e.g. 0.5, 1, 2)
  nationality: 'Indian' | 'Overseas';
  team: string;          // IPL franchise (for display)
  imageUrl?: string;
  soldPrice?: number;
  soldTo?: string;       // teamId
  isSold: boolean;
}

export interface TeamPlayer extends Player {
  soldPrice: number;
}

export type AuctionRound = 1 | 2 | 3 | 4 | 5;
export const ROUND_ROLES: Record<AuctionRound, PlayerRole | 'Unsold'> = {
  1: 'Batsman',
  2: 'Wicketkeeper',
  3: 'Bowler',
  4: 'All-Rounder',
  5: 'Unsold',
};

export interface Team {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  teamName: string;
  budgetRemaining: number;  // starts at 100 Cr
  players: TeamPlayer[];
  playingXI: string[];      // player ids (11)
  bench: string[];          // player ids (4)
  captain?: string;         // player id
  viceCaptain?: string;     // player id
  finalScore?: FinalScore;
}

export interface FinalScore {
  xiScore: number;       // max 100
  benchScore: number;    // max 20
  roi: number;           // max 20
  roleBonus: number;     // max 10
  penalties: number;     // negative
  total: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  hasWicketkeeper: boolean;
  bowlingDepth: number;       // count of bowlers + allrounders in XI
  overseasCount: number;
  bestBatter?: string;        // player id
  bestBowler?: string;
  bestAllRounder?: string;
  bestWicketkeeper?: string;
}

export interface Room {
  id: string;
  code: string;           // 6-char join code
  hostId: string;
  hostName: string;
  status: 'waiting' | 'auction' | 'team-setup' | 'results';
  teams: Team[];
  currentRound: AuctionRound;
  currentPlayer?: Player;
  currentBid?: Bid;
  auctionConfig: AuctionConfig;
}

export interface AuctionConfig {
  maxTeams: number;          // 10
  budgetCr: number;          // 100
  squadSize: number;         // 15
  bidTimerSeconds: number;   // 10
  bidIncrementCr: number;    // 0.25 default
}

export interface Bid {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
}

// Socket.io Events
export interface ServerToClientEvents {
  'room:updated': (room: Room) => void;
  'auction:player-up': (player: Player, round: AuctionRound) => void;
  'auction:bid-placed': (bid: Bid) => void;
  'auction:timer-tick': (secondsLeft: number) => void;
  'auction:player-sold': (player: Player, winner: Bid) => void;
  'auction:player-unsold': (player: Player) => void;
  'auction:round-complete': (round: AuctionRound) => void;
  'auction:complete': () => void;
  'team:xi-submitted': (teamId: string) => void;
  'results:ready': (teams: Team[]) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (data: { userName: string; teamName: string }) => void;
  'room:join': (data: { code: string; userName: string; teamName: string }) => void;
  'room:leave': () => void;
  'auction:start': () => void;
  'auction:bid': (amount: number) => void;
  'auction:next-player': () => void;       // host only
  'auction:pause': () => void;             // host only
  'auction:resume': () => void;            // host only
  'team:submit-xi': (data: {
    playingXI: string[];
    captain: string;
    viceCaptain: string;
  }) => void;
}
```

---

## Supabase Schema

```sql
-- supabase/schema.sql

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text check (role in ('Batsman','Wicketkeeper','Bowler','All-Rounder')),
  rating integer check (rating between 1 and 100),
  base_price numeric(5,2) not null,  -- in Crores
  nationality text check (nationality in ('Indian','Overseas')),
  ipl_team text,
  image_url text,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  host_name text not null,
  status text default 'waiting' check (status in ('waiting','auction','team-setup','results')),
  current_round integer default 1,
  auction_config jsonb not null,
  created_at timestamptz default now()
);

create table teams (
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

create table auction_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  player_id uuid references players(id),
  round integer,
  winning_team_id uuid references teams(id),
  sold_price numeric(5,2),
  is_sold boolean default false,
  created_at timestamptz default now()
);
```

---

## Auction State Machine

The backend maintains auction state in memory (Redis-like via a Map) keyed by `roomId`, backed by Supabase for persistence.

```
STATES:
  waiting → auction-running → auction-paused → team-setup → results

AUCTION PHASES:
  per-player cycle:
    [player-up] → [bidding-open (10s timer)] → [bid received → reset timer]
                → [timer expires → sold/unsold] → [next player]
```

---

## Scoring Implementation Notes

```ts
// services/scoringService.ts

function calculateFinalScore(team: Team, allTeams: Team[]): FinalScore {
  const xi = team.playingXI.map(id => getPlayer(team, id));
  const bench = team.bench.map(id => getPlayer(team, id));
  const captain = getPlayer(team, team.captain!);
  const vc = getPlayer(team, team.viceCaptain!);

  // XI Score (max 100)
  const normalPlayers = xi.filter(p => p.id !== captain.id && p.id !== vc.id);
  const xiSum = normalPlayers.reduce((s, p) => s + p.rating, 0)
    + captain.rating * 2
    + vc.rating * 2;
  const xiScore = (xiSum / 13) * 10;

  // Bench Score (max 20)
  const benchAvg = bench.reduce((s, p) => s + p.rating, 0) / 4;
  const benchScore = benchAvg * 2;

  // ROI (max 20, capped)
  const totalRating = [...xi, ...bench].reduce((s, p) => s + p.rating, 0);
  const totalSpent = 100 - team.budgetRemaining;
  const roi = Math.min((totalRating / totalSpent) * 20, 20);

  // Penalties
  const hasWK = xi.some(p => p.role === 'Wicketkeeper');
  const bowlingCount = xi.filter(p => p.role === 'Bowler' || p.role === 'All-Rounder').length;
  const overseasCount = xi.filter(p => p.nationality === 'Overseas').length;
  let penalties = 0;
  if (!hasWK) penalties -= 10;
  if (bowlingCount < 5) penalties -= 10;
  if (overseasCount > 4) penalties -= 10 * (overseasCount - 4);

  // Role Royalty Bonus (max 10, +2.5 each)
  const roleBonus = calculateRoleBonus(xi, allTeams);

  return {
    xiScore, benchScore, roi, roleBonus, penalties,
    total: xiScore + benchScore + roi + roleBonus + penalties,
    breakdown: { hasWicketkeeper: hasWK, bowlingDepth: bowlingCount, overseasCount }
  };
}
```

---

## Key Implementation Guidelines

1. **Real-time first**: All state mutations happen on the server via Socket.io events. The frontend is a pure view layer that reacts to server broadcasts.

2. **Reconnection handling**: On reconnect, server emits full `room:updated` event with current state so client can re-sync.

3. **Timer on server**: The 10-second bid timer runs on the server (using `setInterval`), not the client. Client shows a countdown synced via `auction:timer-tick`.

4. **Unsold round (Round 5)**: Collect all unsold players. Each team is shown the list and can claim players (no bidding war — first-come-first-served or host assigns). If no team wants a player, skip it.

5. **Player import**: Run `scripts/import-players.ts` to parse the user's Excel file and seed `players` table in Supabase.

6. **Overseas limit**: Max 4 overseas players per squad of 15 (IPL rule). Enforce during auction — prevent bid if it would cause team to exceed 4 overseas.

7. **Budget enforcement**: Minimum bid = player's base price. After winning, deduct immediately and broadcast updated budgets.

---

## Development Commands

```bash
# Install all dependencies
npm install

# Run frontend (port 3000)
npm run dev --workspace=apps/web

# Run backend (port 4000)
npm run dev --workspace=apps/server

# Import players from Excel
npx ts-node scripts/import-players.ts --file=players.xlsx

# Run both concurrently (from root)
npm run dev
```

---

## Player Excel Format Expected

Your Excel file should have these columns (exact names or mapped in import script):

| Column | Description |
|---|---|
| Name | Player full name |
| Role | Batsman / Wicketkeeper / Bowler / All-Rounder |
| Rating | 1–100 integer |
| BasePrice | In Crores (e.g. 0.5, 1.0, 2.0) |
| Nationality | Indian / Overseas |
| IPLTeam | Current IPL franchise |

---

## Important Constraints to Enforce

- Max 10 teams per room
- Budget: 100 Cr per team
- Squad: exactly 15 players (11 XI + 4 bench)
- Max 4 overseas players per squad
- Minimum bid = player's base price
- Bid increment: 0.25 Cr minimum
- Team must have ≥1 WK, ≥5 bowling options to avoid penalties
- Captain & VC must be in Playing XI

---

## File Naming Conventions

- Components: PascalCase (`PlayerCard.tsx`)
- Hooks: camelCase with `use` prefix (`useAuctionStore.ts`)
- Utilities: camelCase (`formatCurrency.ts`)
- Socket handlers: camelCase (`auctionHandlers.ts`)
- Types: PascalCase interfaces, camelCase for primitive types
