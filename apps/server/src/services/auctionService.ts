import type { IOServer } from '../types';
import type { Room, Player, Bid, AuctionRound, Team, TeamPlayer } from '../types';
import {
  getRoom,
  setRoomTimer,
  clearRoomTimer,
  persistRoom,
} from './roomStore';
import {
  loadPlayersForRoom,
  getNextPlayer,
  getPlayersForRound,
  resetRoundIndex,
  markPlayerSold,
  markPlayerUnsold,
  getUnsoldPlayers,
  loadUnsoldRound,
} from './playerService';
import { supabase } from '../db/supabase';

// Paused rooms
const pausedRooms = new Set<string>();
const pausedSecondsLeft = new Map<string, number>();

// Skip votes: roomId → Set of teamIds that voted to skip current player
const skipVotes = new Map<string, Set<string>>();

// How long to show the player list before each round starts (ms)
const ROUND_PREVIEW_MS = 60_000;

// How long to wait between players so clients can see sold/unsold banner (ms)
const BETWEEN_PLAYERS_MS = 2_000;

// How long to wait after emitting player-up before starting the bid timer (ms)
// Gives clients time to receive + render the player before the clock starts.
const PLAYER_BROADCAST_DELAY_MS = 1_500;

// ── Public API ───────────────────────────────────────────────────────────────

export async function startAuction(io: IOServer, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'auction';
  room.currentRound = 1;

  await loadPlayersForRoom(roomId);
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction started in room ${room.code}`);
  startRoundWithPreview(io, roomId);
}

export function nextPlayer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.status !== 'auction') return;

  clearRoomTimer(roomId);

  // Reset skip votes for this new player
  skipVotes.delete(roomId);

  const player = getNextPlayer(roomId, room.currentRound);

  if (!player) {
    endRound(io, roomId);
    return;
  }

  room.currentPlayer = player;
  room.currentBid = undefined;

  // Issue 1 fix: emit player FIRST, start timer only after broadcast delay
  io.to(roomId).emit('auction:player-up', player, room.currentRound);
  io.to(roomId).emit('room:updated', room);

  const delay = setTimeout(() => startBidTimer(io, roomId), PLAYER_BROADCAST_DELAY_MS);
  setRoomTimer(roomId, delay as unknown as NodeJS.Timeout);
}

export function onBid(
  io: IOServer,
  roomId: string,
  userId: string,
  amount: number,
  socketId: string  // Issue 2 fix: errors go only to the bidder's socket
): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;

  const player = room.currentPlayer;
  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  const emitError = (msg: string) => io.to(socketId).emit('error', msg);

  // Validate: amount must be at least minBid
  const minBid = room.currentBid
    ? +(room.currentBid.amount + room.auctionConfig.bidIncrementCr).toFixed(2)
    : player.basePrice;

  if (amount < minBid) {
    emitError(`Minimum bid is ₹${minBid} Cr.`);
    return;
  }

  // Prevent duplicate / same-timestamp bids
  if (room.currentBid && amount === room.currentBid.amount) {
    emitError('Bid already placed at this amount.');
    return;
  }

  // Budget check
  if (team.budgetRemaining < amount) {
    emitError('Insufficient budget.');
    return;
  }

  // Squad size check
  if (team.players.length >= room.auctionConfig.squadSize) {
    emitError('Your squad is full (15 players).');
    return;
  }

  // Overseas limit check
  if (player.nationality === 'Overseas') {
    const overseasCount = team.players.filter((p) => p.nationality === 'Overseas').length;
    if (overseasCount >= 4) {
      emitError('Max 4 overseas players per squad.');
      return;
    }
  }

  // Issue 2 fix: open bidding — any team can bid (no turn logic)
  const bid: Bid = {
    teamId: team.id,
    teamName: team.teamName,
    amount,
    timestamp: Date.now(),
  };

  room.currentBid = bid;
  io.to(roomId).emit('auction:bid-placed', bid);

  // Reset timer on each valid bid
  clearRoomTimer(roomId);
  startBidTimer(io, roomId);

  console.log(`Bid: ${team.teamName} → ₹${amount} Cr for ${player.name}`);
}

export function onSkip(io: IOServer, roomId: string, userId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;

  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  // Record vote (Set deduplicates — team can only vote once per player)
  if (!skipVotes.has(roomId)) skipVotes.set(roomId, new Set());
  skipVotes.get(roomId)!.add(team.id);

  const votes = skipVotes.get(roomId)!.size;
  const total = room.teams.length;
  io.to(roomId).emit('auction:skip-votes', votes, total);
  console.log(`Skip vote in ${room.code}: ${votes}/${total} (${team.teamName})`);

  // All teams voted → skip player immediately
  if (votes >= total) {
    skipVotes.delete(roomId);
    clearRoomTimer(roomId);

    const player = room.currentPlayer;
    markPlayerUnsold(roomId, player);
    room.currentPlayer = undefined;
    room.currentBid = undefined;

    io.to(roomId).emit('auction:player-unsold', player);
    io.to(roomId).emit('room:updated', room);
    console.log(`${player.name} skipped by unanimous vote in room ${room.code}`);

    setTimeout(() => nextPlayer(io, roomId), BETWEEN_PLAYERS_MS);
  }
}

export function pauseAuction(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  pausedRooms.add(roomId);
  console.log(`Auction paused in room ${room.code}`);
}

export function resumeAuction(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  pausedRooms.delete(roomId);
  pausedSecondsLeft.delete(roomId);
  console.log(`Auction resumed in room ${room.code}`);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

// Issue 3: emit round preview, wait ROUND_PREVIEW_MS, then start bidding
function startRoundWithPreview(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  // Round 5 (unsold) has no preview — players were already seen
  if (room.currentRound === 5) {
    const timer = setTimeout(() => nextPlayer(io, roomId), BETWEEN_PLAYERS_MS);
    setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
    return;
  }

  const players = getPlayersForRound(roomId, room.currentRound);
  io.to(roomId).emit('auction:round-preview', players, room.currentRound, ROUND_PREVIEW_MS / 1000);
  console.log(`Round ${room.currentRound} preview started in room ${room.code} (${players.length} players)`);

  const timer = setTimeout(() => {
    const r = getRoom(roomId);
    if (!r || r.status !== 'auction') return;
    nextPlayer(io, roomId);
  }, ROUND_PREVIEW_MS);

  setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
}

function startBidTimer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  let secondsLeft = room.auctionConfig.bidTimerSeconds;

  const timer = setInterval(() => {
    if (pausedRooms.has(roomId)) return;

    secondsLeft--;
    io.to(roomId).emit('auction:timer-tick', secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(timer);
      onTimerExpire(io, roomId);
    }
  }, 1000);

  setRoomTimer(roomId, timer);
}

function onTimerExpire(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer) return;

  const player = room.currentPlayer;

  if (room.currentBid) {
    // SOLD
    const bid = room.currentBid;
    const team = room.teams.find((t) => t.id === bid.teamId);

    if (team) {
      team.budgetRemaining = +(team.budgetRemaining - bid.amount).toFixed(2);
      const teamPlayer: TeamPlayer = { ...player, soldPrice: bid.amount, isSold: true };
      team.players.push(teamPlayer);
      markPlayerSold(player, bid.teamId, bid.amount);
      logAuctionSale(roomId, player, team, bid.amount, room.currentRound);
    }

    io.to(roomId).emit('auction:player-sold', player, bid);
    console.log(`SOLD: ${player.name} → ${bid.teamName} for ₹${bid.amount} Cr`);
  } else {
    // UNSOLD — no bids at all
    markPlayerUnsold(roomId, player);
    io.to(roomId).emit('auction:player-unsold', player);
    console.log(`UNSOLD: ${player.name}`);
  }

  room.currentPlayer = undefined;
  room.currentBid = undefined;
  io.to(roomId).emit('room:updated', room);

  setTimeout(() => nextPlayer(io, roomId), BETWEEN_PLAYERS_MS);
}

function endRound(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  const completedRound = room.currentRound;
  io.to(roomId).emit('auction:round-complete', completedRound);
  console.log(`Round ${completedRound} complete in room ${room.code}`);

  if (completedRound < 4) {
    room.currentRound = (completedRound + 1) as AuctionRound;
    resetRoundIndex(roomId);
    io.to(roomId).emit('room:updated', room);
    startRoundWithPreview(io, roomId);   // Issue 3: show preview for next round
  } else if (completedRound === 4) {
    const unsold = getUnsoldPlayers(roomId);
    if (unsold.length === 0) {
      endAuction(io, roomId);
    } else {
      room.currentRound = 5;
      loadUnsoldRound(roomId);
      resetRoundIndex(roomId);
      io.to(roomId).emit('room:updated', room);
      startRoundWithPreview(io, roomId);
    }
  } else {
    endAuction(io, roomId);
  }

  persistRoom(room);
}

async function endAuction(io: IOServer, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'team-setup';
  room.currentPlayer = undefined;
  room.currentBid = undefined;
  clearRoomTimer(roomId);
  skipVotes.delete(roomId);

  io.to(roomId).emit('auction:complete');
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction complete in room ${room.code} — moving to team setup`);
}

async function logAuctionSale(
  roomId: string,
  player: Player,
  team: Team,
  soldPrice: number,
  round: AuctionRound
): Promise<void> {
  try {
    await supabase.from('auction_log').insert({
      room_id: roomId,
      player_id: player.id,
      round,
      winning_team_id: team.id,
      sold_price: soldPrice,
      is_sold: true,
    });
  } catch (err) {
    console.error('Failed to log auction sale:', err);
  }
}
