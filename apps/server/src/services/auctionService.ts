import type { IOServer } from '../types';
import type { Room, Player, Bid, AuctionRound, Team, TeamPlayer } from '../types';
import {
  getRoom,
  setRoomTimer,
  clearRoomTimer,
  persistRoom,
  getTeamByUserId,
} from './roomStore';
import {
  loadPlayersForRoom,
  getNextPlayer,
  resetRoundIndex,
  markPlayerSold,
  markPlayerUnsold,
  getUnsoldPlayers,
  loadUnsoldRound,
} from './playerService';
import { supabase } from '../db/supabase';

// Track paused state per room
const pausedRooms = new Set<string>();
const pausedSecondsLeft = new Map<string, number>();

export async function startAuction(io: IOServer, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'auction';
  room.currentRound = 1;

  await loadPlayersForRoom(roomId);
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction started in room ${room.code}`);
  nextPlayer(io, roomId);
}

export function nextPlayer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room || room.status !== 'auction') return;

  clearRoomTimer(roomId);

  const player = getNextPlayer(roomId, room.currentRound);

  if (!player) {
    // No more players in this round
    endRound(io, roomId);
    return;
  }

  room.currentPlayer = player;
  room.currentBid = undefined;

  io.to(roomId).emit('auction:player-up', player, room.currentRound);
  io.to(roomId).emit('room:updated', room);

  startBidTimer(io, roomId);
}

function startBidTimer(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  let secondsLeft = room.auctionConfig.bidTimerSeconds;

  const timer = setInterval(() => {
    if (pausedRooms.has(roomId)) return; // Skip ticks while paused

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
      // Deduct budget and add player to team
      team.budgetRemaining -= bid.amount;
      const teamPlayer: TeamPlayer = { ...player, soldPrice: bid.amount, isSold: true };
      team.players.push(teamPlayer);
      markPlayerSold(player, bid.teamId, bid.amount);

      // Log to auction_log
      logAuctionSale(roomId, player, team, bid.amount, room.currentRound);
    }

    io.to(roomId).emit('auction:player-sold', player, bid);
    console.log(`SOLD: ${player.name} → ${bid.teamName} for ${bid.amount} Cr`);
  } else {
    // UNSOLD
    markPlayerUnsold(roomId, player);
    io.to(roomId).emit('auction:player-unsold', player);
    console.log(`UNSOLD: ${player.name}`);
  }

  room.currentPlayer = undefined;
  room.currentBid = undefined;
  io.to(roomId).emit('room:updated', room);

  // Small delay before next player so clients can see sold/unsold animation
  setTimeout(() => nextPlayer(io, roomId), 2000);
}

export function onBid(
  io: IOServer,
  roomId: string,
  userId: string,
  amount: number
): void {
  const room = getRoom(roomId);
  if (!room || !room.currentPlayer || room.status !== 'auction') return;
  if (pausedRooms.has(roomId)) return;

  const player = room.currentPlayer;
  const team = room.teams.find((t) => t.userId === userId);
  if (!team) return;

  // Validate bid amount
  const minBid = room.currentBid
    ? room.currentBid.amount + room.auctionConfig.bidIncrementCr
    : player.basePrice;

  if (amount < minBid) {
    io.to(room.id).emit('error', `Bid must be at least ${minBid} Cr.`);
    return;
  }

  // Budget check
  if (team.budgetRemaining < amount) {
    io.to(room.id).emit('error', 'Insufficient budget.');
    return;
  }

  // Squad size check
  if (team.players.length >= room.auctionConfig.squadSize) {
    io.to(room.id).emit('error', 'Squad is full (15 players).');
    return;
  }

  // Overseas limit check
  if (player.nationality === 'Overseas') {
    const overseasCount = team.players.filter((p) => p.nationality === 'Overseas').length;
    if (overseasCount >= 4) {
      io.to(room.id).emit('error', 'Max 4 overseas players per squad.');
      return;
    }
  }

  // Valid bid — update state
  const bid: Bid = {
    teamId: team.id,
    teamName: team.teamName,
    amount,
    timestamp: Date.now(),
  };

  room.currentBid = bid;
  io.to(roomId).emit('auction:bid-placed', bid);
  io.to(roomId).emit('room:updated', room);

  // Reset timer
  clearRoomTimer(roomId);
  startBidTimer(io, roomId);

  console.log(`Bid: ${team.teamName} → ${amount} Cr for ${player.name}`);
}

function endRound(io: IOServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  const completedRound = room.currentRound;
  io.to(roomId).emit('auction:round-complete', completedRound);
  console.log(`Round ${completedRound} complete in room ${room.code}`);

  if (completedRound < 4) {
    // Move to next role round
    room.currentRound = (completedRound + 1) as AuctionRound;
    resetRoundIndex(roomId);
    io.to(roomId).emit('room:updated', room);

    setTimeout(() => nextPlayer(io, roomId), 2000);
  } else if (completedRound === 4) {
    // Start unsold round
    const unsold = getUnsoldPlayers(roomId);
    if (unsold.length === 0) {
      endAuction(io, roomId);
    } else {
      room.currentRound = 5;
      loadUnsoldRound(roomId);
      resetRoundIndex(roomId);
      io.to(roomId).emit('room:updated', room);

      setTimeout(() => nextPlayer(io, roomId), 2000);
    }
  } else {
    // Round 5 (unsold) complete
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

  io.to(roomId).emit('auction:complete');
  io.to(roomId).emit('room:updated', room);
  await persistRoom(room);

  console.log(`Auction complete in room ${room.code} — moving to team setup`);
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
