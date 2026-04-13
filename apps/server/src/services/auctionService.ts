import type { IOServer } from '../types';
import type { Room, Player, Bid, AuctionRound, Team, TeamPlayer } from '../types';
import {
  getRoom,
  setRoomTimer,
  clearRoomTimer,
  persistRoom,
  closePlayer,
  isPlayerClosed,
  clearClosedPlayers,
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
  skipRemainingInRound,
  getRoundCounts,
  filterRoundPlayers,
} from './playerService';
import { supabase } from '../db/supabase';

const pausedRooms = new Set<string>();
const skipVotes = new Map<string, Set<string>>();
const withdrawVotes = new Map<string, Set<string>>();
const biddingStarted = new Map<string, boolean>();
const bidTimerEndsAt = new Map<string, number>();
const previewReadyVotes = new Map<string, Set<string>>();
// teamId → Set of playerIds they want to bid on (submitted with Ready vote)
const playerInterestVotes = new Map<string, Map<string, Set<string>>>();

interface PreviewState {
  players: Player[];
  round: AuctionRound;
  endsAt: number;
}

const activePreview = new Map<string, PreviewState>();

const ROUND_PREVIEW_MS = 60_000;
const BETWEEN_PLAYERS_MS = 2_000;
const PLAYER_BROADCAST_DELAY_MS = 1_500;
const STARTUP_DELAY_MS = 2_000;

export interface WithdrawVoteState {
  votes: string[];
  highestBidder: string | null;
  eligible: string[];
}

export interface PlayerClosedPayload {
  playerId: string;
  playerName: string;
  result: 'sold' | 'unsold';
  soldPrice: number | null;
  buyer: string | null;
}

export interface SyncStatePayload {
  currentPlayer: Player | null;
  currentBid: Bid | null;
  currentRound: AuctionRound;
  biddingStarted: boolean;
  highestBidder: string | null;
  skipVotes: number;
  withdrawVotes: WithdrawVoteState;
  isPlayerClosed: boolean;
  isPaused: boolean;
  timerSeconds: number;
  roundCounts: Record<number, { total: number; remaining: number }>;
}

export async function startAuction(io: IOServer, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'auction';
  room.currentRound = 1;
  clearClosedPlayers(roomId);

  await loadPlayersForRoom(roomId);
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction started in room ${room.code}`);

  const delay = setTimeout(() => startRoundWithPreview(io, roomId), STARTUP_DELAY_MS);
  setRoomTimer(roomId, delay as unknown as NodeJS.Timeout);
}

export function nextPlayer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.status !== 'auction') return;

  clearRoomTimer(roomId);
  bidTimerEndsAt.delete(roomId);

  skipVotes.delete(roomId);
  withdrawVotes.delete(roomId);
  biddingStarted.set(roomId, false);

  const player = getNextPlayer(roomId, room.currentRound);

  if (!player) {
    endRound(io, roomId);
    return;
  }

  room.currentPlayer = player;
  room.currentBid = undefined;

  io.to(roomId).emit('auction:player-up', player, room.currentRound);
  io.to(roomId).emit('auction:round-counts', getRoundCounts(roomId, room.currentRound));
  io.to(roomId).emit('room:updated', room);

  // Auto-add skip votes for teams with full squads (they can't bid anyway)
  const fullTeamIds = room.teams
    .filter((t) => t.players.length >= room.auctionConfig.squadSize)
    .map((t) => t.id);

  if (fullTeamIds.length > 0) {
    if (!skipVotes.has(roomId)) skipVotes.set(roomId, new Set());
    const votes = skipVotes.get(roomId)!;
    for (const id of fullTeamIds) votes.add(id);

    if (votes.size >= room.teams.length) {
      // Every team is full — skip this player automatically after broadcast delay
      const delay = setTimeout(() => finalizePlayer(io, roomId, 'unsold'), PLAYER_BROADCAST_DELAY_MS);
      setRoomTimer(roomId, delay as unknown as NodeJS.Timeout);
      return;
    }
    io.to(roomId).emit('auction:skip-votes', votes.size, room.teams.length);
  }

  const delay = setTimeout(() => startBidTimer(io, roomId), PLAYER_BROADCAST_DELAY_MS);
  setRoomTimer(roomId, delay as unknown as NodeJS.Timeout);
}

export function onBid(
  io: IOServer,
  roomId: string,
  userId: string,
  amount: number,
  socketId: string
): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;
  if (isPlayerClosed(roomId, room.currentPlayer.id)) return;

  const player = room.currentPlayer;
  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  const emitError = (message: string) => io.to(socketId).emit('error', message);

  if (room.currentBid?.teamId === team.id) {
    emitError('You are already the highest bidder.');
    return;
  }

  const minBid = room.currentBid
    ? +(room.currentBid.amount + room.auctionConfig.bidIncrementCr).toFixed(2)
    : player.basePrice;

  if (amount < minBid) {
    emitError(`Minimum bid is Rs ${minBid} Cr.`);
    return;
  }

  if (room.currentBid && amount === room.currentBid.amount && room.currentBid.teamId !== team.id) {
    emitError('Bid already placed at this amount.');
    return;
  }

  if (team.budgetRemaining < amount) {
    emitError('Insufficient budget.');
    return;
  }

  if (team.players.length >= room.auctionConfig.squadSize) {
    emitError('Your squad is full (15 players).');
    return;
  }

  if (player.nationality === 'Overseas') {
    const overseasCount = team.players.filter((p) => p.nationality === 'Overseas').length;
    if (overseasCount >= 6 && team.players.find((p) => p.id === player.id) === undefined) {
      emitError('Max 6 overseas players per squad.');
      return;
    }
  }

  const bid: Bid = {
    teamId: team.id,
    teamName: team.teamName,
    amount,
    timestamp: Date.now(),
  };

  const isFirstBid = !biddingStarted.get(roomId);

  room.currentBid = bid;
  io.to(roomId).emit('auction:bid-placed', bid);

  if (isFirstBid) {
    biddingStarted.set(roomId, true);
    skipVotes.delete(roomId);
    withdrawVotes.set(roomId, new Set());
    io.to(roomId).emit('auction:bidding-started', bid, getWithdrawVoteState(room));
    console.log(`Bidding started in room ${room.code} for ${player.name}`);
  }

  clearRoomTimer(roomId);
  bidTimerEndsAt.delete(roomId);
  startBidTimer(io, roomId);

  console.log(`Bid: ${team.teamName} -> Rs ${amount} Cr for ${player.name}`);
}

export function onSkip(io: IOServer, roomId: string, userId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;
  if (isPlayerClosed(roomId, room.currentPlayer.id)) return;
  if (biddingStarted.get(roomId)) return;

  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  if (!skipVotes.has(roomId)) skipVotes.set(roomId, new Set());
  const voteSet = skipVotes.get(roomId)!;
  voteSet.add(team.id);

  // Also auto-include any team whose squad is already full
  for (const t of room.teams) {
    if (t.players.length >= room.auctionConfig.squadSize) voteSet.add(t.id);
  }

  const votes = voteSet.size;
  const total = room.teams.length;
  io.to(roomId).emit('auction:skip-votes', votes, total);
  console.log(`Skip vote in ${room.code}: ${votes}/${total} (${team.teamName})`);

  if (votes >= total) {
    const playerName = room.currentPlayer.name;
    finalizePlayer(io, roomId, 'unsold');
    console.log(`${playerName} skipped by unanimous vote in room ${room.code}`);
  }
}

export function onWithdraw(io: IOServer, roomId: string, userId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;
  if (isPlayerClosed(roomId, room.currentPlayer.id)) return;
  if (!biddingStarted.get(roomId)) return;

  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  if (room.currentBid?.teamId === team.id) return;

  if (!withdrawVotes.has(roomId)) withdrawVotes.set(roomId, new Set());
  const votes = withdrawVotes.get(roomId)!;

  if (votes.has(team.id)) return;
  votes.add(team.id);

  const withdrawState = getWithdrawVoteState(room);
  io.to(roomId).emit('auction:withdraw-votes', withdrawState);
  console.log(
    `Withdraw in ${room.code}: ${votes.size}/${withdrawState.eligible.length} (${team.teamName})`
  );

  if (votes.size >= withdrawState.eligible.length) {
    const playerName = room.currentPlayer.name;
    const winnerName = room.currentBid?.teamName ?? 'Unknown';
    const amount = room.currentBid?.amount ?? 0;
    finalizePlayer(io, roomId, 'sold');
    console.log(`AUTO-SOLD (all withdrew): ${playerName} -> ${winnerName} Rs ${amount} Cr`);
  }
}

export function pauseAuction(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);
  bidTimerEndsAt.delete(roomId);
  pausedRooms.add(roomId);
  io.to(roomId).emit('auction:paused');
  console.log(`Auction paused in room ${room.code}`);
}

export function skipRound(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.status !== 'auction') return;

  // Finalize any player currently on the block as unsold
  if (room.currentPlayer && !isPlayerClosed(roomId, room.currentPlayer.id)) {
    closePlayer(roomId, room.currentPlayer.id);
    clearRoomTimer(roomId);
    bidTimerEndsAt.delete(roomId);
    markPlayerUnsold(roomId, room.currentPlayer);
    io.to(roomId).emit('auction:player-unsold', room.currentPlayer);
    room.currentPlayer = undefined;
    room.currentBid = undefined;
  }

  // Mark all remaining players in this round as unsold
  const remaining = skipRemainingInRound(roomId, room.currentRound);
  for (const player of remaining) {
    markPlayerUnsold(roomId, player);
  }

  skipVotes.delete(roomId);
  withdrawVotes.delete(roomId);
  biddingStarted.set(roomId, false);

  console.log(`Round ${room.currentRound} skipped in room ${room.code} (${remaining.length} players marked unsold)`);

  endRound(io, roomId);
}

export function resumeAuction(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  pausedRooms.delete(roomId);
  io.to(roomId).emit('auction:resumed');

  if (room.status === 'auction' && room.currentPlayer && !isPlayerClosed(roomId, room.currentPlayer.id)) {
    startBidTimer(io, roomId);
  }

  console.log(`Auction resumed in room ${room.code}`);
}

export function getSyncState(roomId: string): SyncStatePayload | null {
  const room = getRoom(roomId);
  if (!room) return null;

  return {
    currentPlayer: room.currentPlayer ?? null,
    currentBid: room.currentBid ?? null,
    currentRound: room.currentRound,
    biddingStarted: biddingStarted.get(roomId) ?? false,
    highestBidder: room.currentBid?.teamId ?? null,
    skipVotes: skipVotes.get(roomId)?.size ?? 0,
    withdrawVotes: getWithdrawVoteState(room),
    isPlayerClosed: room.currentPlayer ? isPlayerClosed(roomId, room.currentPlayer.id) : false,
    isPaused: pausedRooms.has(roomId),
    timerSeconds: getBidTimerSeconds(roomId, room.auctionConfig.bidTimerSeconds),
    roundCounts: getRoundCounts(roomId, room.currentRound),
  };
}

export function onPreviewReady(io: IOServer, roomId: string, userId: string, playerIds: string[]): void {
  const room = getRoom(roomId);
  if (!room || !activePreview.has(roomId)) return;

  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  // Store this team's interest votes
  if (!playerInterestVotes.has(roomId)) playerInterestVotes.set(roomId, new Map());
  playerInterestVotes.get(roomId)!.set(team.id, new Set(playerIds));

  if (!previewReadyVotes.has(roomId)) previewReadyVotes.set(roomId, new Set());
  previewReadyVotes.get(roomId)!.add(team.id);

  const count = previewReadyVotes.get(roomId)!.size;
  const total = room.teams.length;
  io.to(roomId).emit('auction:preview-ready-votes', count, total);
  console.log(`Preview ready in ${room.code}: ${count}/${total} (${team.teamName}) — ${playerIds.length} players selected`);

  if (count >= total) {
    // All teams ready — jump to 5-second countdown
    clearRoomTimer(roomId);
    activePreview.delete(roomId);
    previewReadyVotes.delete(roomId);

    let timeLeft = 5;
    io.to(roomId).emit('auction:preview-tick', timeLeft);

    const timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('auction:preview-tick', timeLeft);
      if (timeLeft <= 0) {
        clearInterval(timer);
        const currentRoom = getRoom(roomId);
        if (!currentRoom || currentRoom.status !== 'auction') return;
        applyInterestFilter(io, roomId);
        nextPlayer(io, roomId);
      }
    }, 1000);

    setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
  }
}

/**
 * Build the union of all submitted interest votes for the current round.
 * Players not in the union are removed from the pool and added to the unsold
 * list (so they appear in round 5). Round 5 itself is never filtered.
 */
function applyInterestFilter(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.currentRound === 5) return;

  const votes = playerInterestVotes.get(roomId);
  playerInterestVotes.delete(roomId);

  if (!votes || votes.size === 0) return; // no one submitted → auction everything

  // Union of all checked player IDs across all teams that voted
  const interested = new Set<string>();
  for (const ids of votes.values()) {
    for (const id of ids) interested.add(id);
  }

  if (interested.size === 0) return; // safety: everyone unchecked all → no filter

  const excluded = filterRoundPlayers(roomId, room.currentRound, interested);
  if (excluded.length === 0) return;

  for (const p of excluded) markPlayerUnsold(roomId, p);

  io.to(roomId).emit('auction:round-counts', getRoundCounts(roomId, room.currentRound));
  console.log(`Interest filter (round ${room.currentRound}, room ${room.code}): ${excluded.length} players skipped → added to round 5`);
}

function startRoundWithPreview(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  if (room.currentRound === 5) {
    const timer = setTimeout(() => nextPlayer(io, roomId), BETWEEN_PLAYERS_MS);
    setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
    return;
  }

  const players = getPlayersForRound(roomId, room.currentRound);
  const totalSeconds = ROUND_PREVIEW_MS / 1000;

  previewReadyVotes.delete(roomId);    // reset ready votes for new round
  playerInterestVotes.delete(roomId);  // reset interest votes for new round

  activePreview.set(roomId, {
    players,
    round: room.currentRound,
    endsAt: Date.now() + ROUND_PREVIEW_MS,
  });

  io.to(roomId).emit('auction:round-preview', players, room.currentRound, totalSeconds);
  console.log(`Round ${room.currentRound} preview started in room ${room.code} (${players.length} players)`);

  let timeLeft = totalSeconds;

  const timer = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('auction:preview-tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timer);
      activePreview.delete(roomId);
      previewReadyVotes.delete(roomId);
      const currentRoom = getRoom(roomId);
      if (!currentRoom || currentRoom.status !== 'auction') return;
      applyInterestFilter(io, roomId);
      nextPlayer(io, roomId);
    }
  }, 1000);

  setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
}

function startBidTimer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || pausedRooms.has(roomId)) return;

  let secondsLeft = room.auctionConfig.bidTimerSeconds;
  bidTimerEndsAt.set(roomId, Date.now() + secondsLeft * 1000);
  io.to(roomId).emit('auction:timer-tick', secondsLeft);

  const timer = setInterval(() => {
    if (pausedRooms.has(roomId)) return;

    secondsLeft--;
    bidTimerEndsAt.set(roomId, Date.now() + Math.max(secondsLeft, 0) * 1000);
    io.to(roomId).emit('auction:timer-tick', secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(timer);
      bidTimerEndsAt.delete(roomId);
      onTimerExpire(io, roomId);
    }
  }, 1000);

  setRoomTimer(roomId, timer as unknown as NodeJS.Timeout);
}

function onTimerExpire(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer) return;
  if (isPlayerClosed(roomId, room.currentPlayer.id)) return;

  finalizePlayer(io, roomId, room.currentBid ? 'sold' : 'unsold');
}

function finalizePlayer(io: IOServer, roomId: string, result: 'sold' | 'unsold'): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer) return;
  if (isPlayerClosed(roomId, room.currentPlayer.id)) return;

  const player = room.currentPlayer;
  const bid = room.currentBid;

  closePlayer(roomId, player.id);
  clearRoomTimer(roomId);
  bidTimerEndsAt.delete(roomId);

  let playerClosedPayload: PlayerClosedPayload;

  if (result === 'sold' && bid) {
    const winnerTeam = room.teams.find((t) => t.id === bid.teamId);
    if (!winnerTeam) return;

    winnerTeam.budgetRemaining = +(winnerTeam.budgetRemaining - bid.amount).toFixed(2);
    const teamPlayer: TeamPlayer = { ...player, soldPrice: bid.amount, isSold: true };
    winnerTeam.players.push(teamPlayer);
    markPlayerSold(player, bid.teamId, bid.amount);
    void logAuctionSale(roomId, player, winnerTeam, bid.amount, room.currentRound);

    io.to(roomId).emit('auction:player-sold', player, bid);
    playerClosedPayload = {
      playerId: player.id,
      playerName: player.name,
      result: 'sold',
      soldPrice: bid.amount,
      buyer: bid.teamName,
    };

    console.log(`SOLD: ${player.name} -> ${bid.teamName} for Rs ${bid.amount} Cr`);
  } else {
    markPlayerUnsold(roomId, player);
    io.to(roomId).emit('auction:player-unsold', player);
    playerClosedPayload = {
      playerId: player.id,
      playerName: player.name,
      result: 'unsold',
      soldPrice: null,
      buyer: null,
    };

    console.log(`UNSOLD: ${player.name}`);
  }

  skipVotes.delete(roomId);
  withdrawVotes.delete(roomId);
  biddingStarted.set(roomId, false);

  room.currentPlayer = undefined;
  room.currentBid = undefined;

  io.to(roomId).emit('auction:player_closed', playerClosedPayload);
  io.to(roomId).emit('room:updated', room);

  // If every team has a full squad, end the auction immediately
  const allSquadsFull = room.teams.every(
    (t) => t.players.length >= room.auctionConfig.squadSize
  );
  if (allSquadsFull) {
    console.log(`All squads full in room ${room.code} — ending auction early`);
    setTimeout(() => endAuction(io, roomId), BETWEEN_PLAYERS_MS);
    return;
  }

  setTimeout(() => nextPlayer(io, roomId), BETWEEN_PLAYERS_MS);
}

function getWithdrawVoteState(room: Room): WithdrawVoteState {
  const roomVotes = withdrawVotes.get(room.id);
  const highestBidder = room.currentBid?.teamId ?? null;

  return {
    votes: roomVotes ? Array.from(roomVotes) : [],
    highestBidder,
    eligible: room.teams.filter((team) => team.id !== highestBidder).map((team) => team.id),
  };
}

function getBidTimerSeconds(roomId: string, fallback: number): number {
  const endsAt = bidTimerEndsAt.get(roomId);
  if (!endsAt) return fallback;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
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
    startRoundWithPreview(io, roomId);
  } else if (completedRound === 4) {
    const unsold = getUnsoldPlayers(roomId);
    if (unsold.length === 0) {
      void endAuction(io, roomId);
    } else {
      room.currentRound = 5;
      clearClosedPlayers(roomId); // unblock previously-unsold players for round 5
      loadUnsoldRound(roomId);
      resetRoundIndex(roomId);
      io.to(roomId).emit('room:updated', room);
      startRoundWithPreview(io, roomId);
    }
  } else {
    void endAuction(io, roomId);
  }

  void persistRoom(room);
}

async function endAuction(io: IOServer, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'team-setup';
  room.currentPlayer = undefined;
  room.currentBid = undefined;
  clearRoomTimer(roomId);
  bidTimerEndsAt.delete(roomId);
  skipVotes.delete(roomId);
  withdrawVotes.delete(roomId);
  biddingStarted.delete(roomId);
  pausedRooms.delete(roomId);

  io.to(roomId).emit('auction:complete');
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction complete in room ${room.code} -> moving to team setup`);
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

export function reEmitPreviewIfActive(io: IOServer, roomId: string): void {
  const preview = activePreview.get(roomId);
  if (preview) {
    const secondsLeft = Math.max(0, Math.ceil((preview.endsAt - Date.now()) / 1000));
    io.to(roomId).emit('auction:round-preview', preview.players, preview.round, secondsLeft);
    io.to(roomId).emit('auction:preview-tick', secondsLeft);
  }
}

export function restoreAuctionTimer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.status !== 'auction') return;
  if (bidTimerEndsAt.has(roomId)) return; // timer already running — do nothing

  if (room.currentPlayer && !isPlayerClosed(roomId, room.currentPlayer.id)) {
    pausedRooms.delete(roomId); // clear stale paused state from before restart
    startBidTimer(io, roomId);
  }
}
