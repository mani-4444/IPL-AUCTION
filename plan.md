# IPL Auction Web App — Implementation Plan

## Overview

Build a **real-time multiplayer IPL Auction Web App** using Next.js 14, Node.js + Socket.io, and Supabase. The app supports 2–10 teams per room, 5 auction rounds, team setup (Playing XI + Captain/VC), and a final scored leaderboard.

---

## Phase 0 — Project Setup

**Goal:** Get the monorepo, tooling, and dependencies ready before writing any feature code.

### Step 0.1 — Monorepo Initialization

```bash
mkdir ipl-auction && cd ipl-auction
npm init -y
```

Create `package.json` at root with workspaces:

```json
{
  "name": "ipl-auction",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=apps/web\" \"npm run dev --workspace=apps/server\"",
    "build": "npm run build --workspace=apps/web && npm run build --workspace=apps/server"
  }
}
```

Create directories:

```
apps/web/       → Next.js frontend
apps/server/    → Express + Socket.io backend
packages/shared/ → Shared TypeScript types
supabase/       → SQL schema & migrations
scripts/        → Player import script
```

### Step 0.2 — Frontend Bootstrap

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npm install socket.io-client zustand @supabase/supabase-js
npm install -D @types/node
```

### Step 0.3 — Backend Bootstrap

```bash
cd apps/server
npm init -y
npm install express socket.io @supabase/supabase-js cors dotenv
npm install -D typescript ts-node @types/express @types/node nodemon
npx tsc --init
```

### Step 0.4 — Shared Types Package

```bash
cd packages/shared
npm init -y
```

Create `packages/shared/types.ts` — full TypeScript interface definitions for Player, Team, Room, Bid, FinalScore, and Socket event maps (see CLAUDE.md).

### Step 0.5 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → open your project
2. Go to **SQL Editor** → run `supabase/schema.sql` (creates players, rooms, teams, auction_log tables)
3. Copy your **Project URL** and **anon key** → paste into `apps/web/.env.local`
4. Copy your **service role key** → paste into `apps/server/.env`

### Step 0.6 — Player Import Script

Create `scripts/import-players.ts`:
- Uses `xlsx` npm package to parse the uploaded Excel file
- Maps columns: Name, Role, Rating, BasePrice, Nationality, IPLTeam
- Inserts into Supabase `players` table in batches

```bash
npm install xlsx --workspace=scripts   # or run from root
npx ts-node scripts/import-players.ts --file=players.xlsx
```

---

## Phase 1 — Core Data Layer & Types

**Goal:** Solid foundation before any UI work.

### Step 1.1 — Supabase Database Schema

File: `supabase/schema.sql`

Tables:
- `players` — static player pool (seeded from Excel)
- `rooms` — one per game session
- `teams` — one per user per room
- `auction_log` — immutable record of each sale

Enable **Row Level Security** on rooms/teams if using Supabase Auth, otherwise keep open for MVP.

### Step 1.2 — Shared TypeScript Types

File: `packages/shared/types.ts`

Define all interfaces:
- `Player`, `TeamPlayer`, `PlayerRole`
- `Team`, `Room`, `AuctionConfig`, `Bid`
- `FinalScore`, `ScoreBreakdown`
- `AuctionRound` (1–5) with `ROUND_ROLES` map
- `ServerToClientEvents`, `ClientToServerEvents` (Socket.io typed events)

### Step 1.3 — Supabase Clients

- `apps/web/lib/supabase.ts` — browser client with anon key
- `apps/server/src/db/supabase.ts` — server client with service role key

---

## Phase 2 — Backend: Room & Auction Engine

**Goal:** Full real-time game logic running on the server.

### Step 2.1 — Express Server Entry Point

File: `apps/server/src/index.ts`

- Create Express app with CORS (allow frontend origin)
- Attach Socket.io server
- Import and register all socket handler modules
- Health check route `GET /health`
- Start on `PORT` from `.env`

### Step 2.2 — In-Memory Room Store

File: `apps/server/src/services/roomStore.ts`

```ts
const rooms = new Map<string, Room>();
const roomTimers = new Map<string, NodeJS.Timeout>();
```

Functions:
- `createRoom(hostId, hostName, teamName) → Room`
- `joinRoom(code, userId, userName, teamName) → Room | Error`
- `getRoom(roomId) → Room | undefined`
- `persistRoom(room) → void` — async write to Supabase

### Step 2.3 — Socket Room Handlers

File: `apps/server/src/socket/roomHandlers.ts`

Events handled:
- `room:create` → generate 6-char code, create room, join socket to room channel, emit `room:updated`
- `room:join` → validate code, check team cap (max 10), add team, emit `room:updated` to all
- `room:leave` → remove team from room, if host leaves reassign or close room
- `disconnect` → same as room:leave

### Step 2.4 — Auction State Machine

File: `apps/server/src/services/auctionService.ts`

The core game engine. Manages:

```
startAuction(roomId)
  → load players by round role from Supabase
  → begin Round 1 (Batsmen)
  → call nextPlayer()

nextPlayer(roomId)
  → pick next unprocessed player from current round pool
  → if pool empty → endRound()
  → else → emit 'auction:player-up'
  → start 10s server-side timer

onBid(roomId, teamId, amount)
  → validate: amount > currentBid, team has budget, overseas check
  → update currentBid
  → reset timer to 10s
  → emit 'auction:bid-placed'

onTimerExpire(roomId)
  → if currentBid exists → sell player (deduct budget, update team)
  → else → mark unsold, add to unsold pool
  → emit 'auction:player-sold' or 'auction:player-unsold'
  → call nextPlayer()

endRound(roomId)
  → emit 'auction:round-complete'
  → if round < 4 → increment round, start next role round
  → if round === 4 → startUnsoldRound()
  → emit 'auction:round-complete'

startUnsoldRound(roomId)
  → collect all unsold players across rounds 1–4
  → show to teams (emit list)
  → teams click "I want this player" (first-come-first-served)
  → if none claimed in 30s → skip player
  → when all processed or no takers → endAuction()

endAuction(roomId)
  → update room status to 'team-setup'
  → emit 'auction:complete'
```

### Step 2.5 — Auction Socket Handlers

File: `apps/server/src/socket/auctionHandlers.ts`

Events handled (with auth checks — host-only where noted):
- `auction:start` (host only) → call `auctionService.startAuction()`
- `auction:bid` → call `auctionService.onBid()` with validation
- `auction:next-player` (host only) → force advance
- `auction:pause` (host only) → pause current timer
- `auction:resume` (host only) → resume timer

### Step 2.6 — Scoring Service

File: `apps/server/src/services/scoringService.ts`

Implements the full scoring formula:

```
calculateFinalScore(team, allTeams) → FinalScore
  1. XI Score = (9 normal + 2×captain + 2×vc) / 13 × 10
  2. Bench Score = avg(bench[4]) × 2
  3. ROI = (totalRating / totalSpent) × 20, capped at 20
  4. Penalties: -10 per rule violation (WK, bowling depth, overseas)
  5. Role Royalty Bonus: +2.5 each for best batter/bowler/AR/WK in XI across all teams
  6. Final = XI + Bench + ROI + Bonus - Penalties
```

Called after all teams submit their XI.

### Step 2.7 — Team Setup Handlers

File: `apps/server/src/socket/teamHandlers.ts`

Events handled:
- `team:submit-xi` → validate XI (11 players, valid C/VC), save to Supabase
- When all teams submitted → trigger `scoringService.calculateAll(room)` → emit `results:ready`

---

## Phase 3 — Frontend: Pages & Components

**Goal:** Build the full UI, wired to the Socket.io backend.

### Step 3.1 — Global Setup

- `apps/web/lib/socket.ts` — Socket.io client singleton (lazy init, reconnect logic)
- `apps/web/app/layout.tsx` — Root layout with dark IPL theme (Tailwind dark classes, gradient bg)
- `apps/web/store/roomStore.ts` — Zustand store for room state
- `apps/web/store/auctionStore.ts` — Zustand store for live auction
- `apps/web/store/teamStore.ts` — Zustand store for team/XI state

### Step 3.2 — Page: Landing (`app/page.tsx`)

UI Elements:
- IPL Auction logo / banner (dark orange gradient)
- Input: Your Name
- Input: Team Name
- Button: **Create Room** → emits `room:create`, redirects to `/room/[roomId]`
- Input: Room Code (6 chars)
- Button: **Join Room** → emits `room:join`, redirects to `/room/[roomId]`

### Step 3.3 — Page: Room Lobby (`app/room/[roomId]/page.tsx`)

UI Elements:
- Room code displayed prominently (copy button)
- List of joined teams (avatar + team name + "Host" badge)
- "Waiting for host to start..." message for non-hosts
- **Start Auction** button (host only, enabled when ≥2 teams)
- Real-time: updates on `room:updated` event

### Step 3.4 — Page: Live Auction (`app/auction/[roomId]/page.tsx`)

Layout: 3-column dark dashboard

**Left Panel — Player Card:**
- Player photo placeholder / silhouette
- Name, Role badge (colored by role), Rating stars
- IPL team logo
- Base price

**Center Panel — Bidding Arena:**
- Round indicator: "Round 1 — Batsmen 🏏"
- Current bid amount (large, animated)
- Current highest bidder team name
- Countdown timer ring (10s, red when <3s)
- **Place Bid** button (shows next increment amount)
- Bid history feed (last 5 bids)
- Host controls: Next Player / Pause / Resume buttons

**Right Panel — Dashboard:**
- All teams listed with:
  - Budget remaining (color: green→yellow→red as it drops)
  - Players bought count / 15
- Round progress: Rounds 1–5 with status icons

Components to build:
- `PlayerCard.tsx` — animated entrance, role color coding
- `BidTimer.tsx` — circular countdown with pulse animation
- `BidPanel.tsx` — bid button + current bid display
- `BidHistory.tsx` — scrollable recent bids feed
- `TeamBudgetBar.tsx` — progress bar per team
- `RoundIndicator.tsx` — 5-round progress tracker

### Step 3.5 — Page: Team Setup (`app/team-setup/[roomId]/page.tsx`)

UI Elements:
- Your 15 bought players shown as draggable cards
- **Playing XI zone** (drop 11 players) vs **Bench zone** (remaining 4 auto-fill)
- **Captain picker** — click C badge on any XI player
- **Vice-Captain picker** — click VC badge on any XI player (different from C)
- Validation: show errors in real-time (no WK warning, bowling count, overseas count)
- **Submit Team** button → emits `team:submit-xi`
- "Waiting for other teams..." state after submission

### Step 3.6 — Page: Results (`app/results/[roomId]/page.tsx`)

UI Elements:
- Podium display: 1st, 2nd, 3rd place teams (animated reveal)
- Full leaderboard table:
  - Rank, Team Name, XI Score, Bench, ROI, Bonus, Penalties, **Total**
- Expandable score breakdown per team
- Trophy icons for category winners (Best XI, Best Budget, etc.)
- "Play Again" → back to landing

---

## Phase 4 — Styling & Theme

**Goal:** Consistent dark IPL theme across all pages.

### Color Palette

```css
/* tailwind.config.ts custom colors */
--ipl-orange: #FF6B00
--ipl-gold: #FFD700
--ipl-dark: #0A0A0F
--ipl-surface: #12121A
--ipl-border: #2A2A3A
--ipl-blue: #1E40AF
--ipl-green: #16A34A
--ipl-red: #DC2626
```

### Role Color Coding

| Role | Color |
|---|---|
| Batsman | Blue (`#3B82F6`) |
| Wicketkeeper | Purple (`#8B5CF6`) |
| Bowler | Orange (`#F97316`) |
| All-Rounder | Green (`#22C55E`) |

### Animation Guidelines

- Player card entrance: slide-up + fade-in (200ms)
- Bid placed: pulse flash on bid amount
- Timer <3s: timer ring turns red + pulse
- Player sold: confetti burst + "SOLD!" banner
- Player unsold: grey overlay + "UNSOLD" stamp
- Budget bar: smooth transition as credits deduct

---

## Phase 5 — Real-Time Sync & Edge Cases

**Goal:** Handle all edge cases for a smooth multiplayer experience.

### Step 5.1 — Reconnection Flow

On `connect` / `reconnect` event:
- Client emits `room:rejoin` with stored `{ roomId, userId }`
- Server restores client to room channel
- Server emits full `room:updated` with current state
- Client re-renders from state (no stale data)

### Step 5.2 — Disconnection Handling

- If a **non-host** disconnects mid-auction: their team stays, they can rejoin
- If the **host** disconnects: 30s grace period, then promote next-joined user to host, emit `room:updated`
- If a team disconnects during **team-setup**: their XI auto-submits with first 11 players (no C/VC = no bonus, but no crash)

### Step 5.3 — Budget Validation (Server-Side)

Before accepting a bid:
```ts
if (amount <= currentBid.amount) → reject
if (team.budgetRemaining < amount) → reject
if (wouldExceedOverseasLimit(team, player)) → reject
if (team.players.length >= 15) → reject  // squad full
```

Always validate on server — never trust client.

### Step 5.4 — Unsold Round Logic

```
Round 5 — Unsold Players:
  1. Collect all players from rounds 1–4 with isSold=false
  2. If list is empty → skip round, go straight to results
  3. Show list to all teams
  4. Each team can "claim" a player (first-come) at base price
  5. Rules: team still needs budget ≥ basePrice, squad not full
  6. 30s window per player (or host can advance)
  7. If no team claims → player marked permanently unsold
  8. After all unsold players processed → end auction
```

---

## Phase 6 — Testing & Polish

### Step 6.1 — Manual Test Scenarios

Test in browser with 2–3 tabs (simulating different users):

- [ ] Create room → share code → join from another tab
- [ ] Host starts auction → bidding works across tabs
- [ ] Timer expires → player sold correctly
- [ ] Timer expires with no bids → player unsold
- [ ] All 5 rounds complete → team setup unlocks
- [ ] XI submission → score calculates correctly
- [ ] All teams submit → results page shows with correct rankings
- [ ] Reconnect mid-auction → state restored correctly
- [ ] Host disconnects → promotion works

### Step 6.2 — Scoring Formula Verification

Write a test script `scripts/test-scoring.ts` that:
- Creates mock teams with known ratings
- Runs `calculateFinalScore()`
- Prints breakdown and asserts expected totals

### Step 6.3 — Performance

- Debounce bid button (prevent double-clicks)
- Socket events are lightweight (no full room state on every bid — only delta events)
- `room:updated` only sent on structural changes (player joins, round changes)
- Use `socket.to(roomId).emit()` not `socket.broadcast.emit()` (room scoped)

---

## Phase 7 — Deployment

### Frontend → Vercel

```bash
cd apps/web
vercel deploy
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SOCKET_URL` → your backend URL

### Backend → Railway (recommended for Socket.io)

```bash
# railway.toml in apps/server/
[build]
  command = "npm run build"
[deploy]
  startCommand = "npm start"
```

Set env vars in Railway dashboard.

> **Note:** Vercel serverless functions don't support WebSockets. The backend **must** run on a persistent server (Railway, Render, Fly.io, or VPS).

---

## Build Order Summary

Follow this exact order to avoid blocked dependencies:

```
Phase 0: Project setup & tooling
  ↓
Phase 1: Types + Supabase schema + player import
  ↓
Phase 2.1–2.3: Server entry + room store + room socket handlers
  ↓
Phase 3.1–3.3: Frontend socket setup + Landing + Lobby pages
  ↓
  ← Test: create room, join, see lobby ←
  ↓
Phase 2.4–2.5: Auction state machine + auction handlers
  ↓
Phase 3.4: Live auction page
  ↓
  ← Test: full 5-round auction ←
  ↓
Phase 2.6–2.7: Scoring service + team submit handlers
  ↓
Phase 3.5–3.6: Team setup + Results pages
  ↓
  ← Test: full end-to-end game ←
  ↓
Phase 4: Theming polish
  ↓
Phase 5: Edge cases & reconnection
  ↓
Phase 6: Testing & verification
  ↓
Phase 7: Deployment
```

---

## Estimated File Count

| Area | Files |
|---|---|
| Shared types | 1 |
| Supabase SQL | 2 (schema + seed) |
| Backend services | 4 |
| Backend socket handlers | 3 |
| Frontend pages | 5 |
| Frontend components | ~15 |
| Frontend stores | 3 |
| Frontend lib | 3 |
| Scripts | 2 |
| **Total** | **~38 files** |

---

## Key Decisions & Rationale

**Why not Supabase Realtime instead of Socket.io?**
Supabase Realtime is great for DB-level changes but Socket.io gives finer control over the auction state machine, timer resets, and bid validation logic that must run server-side.

**Why in-memory room store on server?**
Auction state changes 5–10 times per second during bidding (timer ticks, bids). Writing every tick to Supabase would be slow. Instead, in-memory is primary, Supabase is for persistence (on round end, auction end).

**Why Next.js App Router?**
Gives us Server Components for the results/leaderboard page (SEO-friendly, fast initial load) and Client Components for real-time auction pages.

**Why Zustand over Redux?**
Simpler boilerplate, better DX for game state that changes frequently. No need for Redux's complexity here.
