import type { Player, PlayerRole, AuctionRound } from '../types';
import { ROUND_ROLES } from '../types';
import { supabase } from '../db/supabase';

// Player pools keyed by roomId
const playerPools = new Map<string, Map<AuctionRound, Player[]>>();
const unsoldPlayers = new Map<string, Player[]>();
const currentIndex = new Map<string, number>(); // roomId → index within current round

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function mapDbPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as PlayerRole,
    rating: row.rating as number,
    basePrice: row.base_price as number,
    nationality: (row.nationality as string) === 'Indian' ? 'Indian' : 'Overseas',
    team: row.ipl_team as string,
    imageUrl: row.image_url as string | undefined,
    isSold: false,
  };
}

export async function loadPlayersForRoom(roomId: string): Promise<void> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('rating', { ascending: false });

  if (error || !data) {
    throw new Error(`Failed to load players: ${error?.message}`);
  }

  const poolMap = new Map<AuctionRound, Player[]>();
  const roleToRound = new Map<string, AuctionRound>();

  // Build reverse map: role → round number
  for (const [round, role] of Object.entries(ROUND_ROLES)) {
    if (role !== 'Unsold') {
      roleToRound.set(role, Number(round) as AuctionRound);
    }
  }

  // Initialize pools for rounds 1-4
  for (let r = 1; r <= 4; r++) {
    poolMap.set(r as AuctionRound, []);
  }
  poolMap.set(5, []); // unsold round starts empty

  // Distribute players into round pools by role
  for (const row of data) {
    const player = mapDbPlayer(row);
    const round = roleToRound.get(player.role);
    if (round) {
      poolMap.get(round)!.push(player);
    }
  }

  // Shuffle each round's pool for random player ordering
  for (let r = 1; r <= 4; r++) {
    shuffleInPlace(poolMap.get(r as AuctionRound)!);
  }

  playerPools.set(roomId, poolMap);
  unsoldPlayers.set(roomId, []);
  currentIndex.set(roomId, 0);

  const counts = Array.from(poolMap.entries())
    .map(([r, p]) => `Round ${r}: ${p.length}`)
    .join(', ');
  console.log(`Loaded players for room ${roomId}: ${counts}`);
}

export function getNextPlayer(roomId: string, round: AuctionRound): Player | null {
  const pools = playerPools.get(roomId);
  if (!pools) return null;

  const pool = pools.get(round);
  if (!pool) return null;

  const idx = currentIndex.get(roomId) ?? 0;
  if (idx >= pool.length) return null;

  currentIndex.set(roomId, idx + 1);
  return pool[idx];
}

export function resetRoundIndex(roomId: string): void {
  currentIndex.set(roomId, 0);
}

export function markPlayerUnsold(roomId: string, player: Player): void {
  const unsold = unsoldPlayers.get(roomId) ?? [];
  unsold.push(player);
  unsoldPlayers.set(roomId, unsold);
}

export function markPlayerSold(player: Player, teamId: string, soldPrice: number): void {
  player.isSold = true;
  player.soldTo = teamId;
  player.soldPrice = soldPrice;
}

export function getUnsoldPlayers(roomId: string): Player[] {
  return unsoldPlayers.get(roomId) ?? [];
}

export function loadUnsoldRound(roomId: string): void {
  const pools = playerPools.get(roomId);
  if (!pools) return;

  const unsold = unsoldPlayers.get(roomId) ?? [];
  const shuffled = [...unsold];
  shuffleInPlace(shuffled);
  pools.set(5, shuffled);
  currentIndex.set(roomId, 0);

  console.log(`Unsold round loaded for room ${roomId}: ${unsold.length} players`);
}

export interface RoundCount {
  total: number;
  remaining: number;
}

export function getRoundCounts(
  roomId: string,
  currentRound: AuctionRound
): Record<number, RoundCount> {
  const pools = playerPools.get(roomId);
  if (!pools) return {};

  const idx = currentIndex.get(roomId) ?? 0;
  const result: Record<number, RoundCount> = {};

  for (let r = 1; r <= 5; r++) {
    const pool = pools.get(r as AuctionRound) ?? [];
    let remaining: number;
    if (r < currentRound) remaining = 0;
    else if (r === currentRound) remaining = Math.max(0, pool.length - idx);
    else remaining = pool.length;
    result[r] = { total: pool.length, remaining };
  }

  return result;
}

// Returns all players for a round WITHOUT advancing the index (for preview)
export function getPlayersForRound(roomId: string, round: AuctionRound): Player[] {
  const pools = playerPools.get(roomId);
  if (!pools) return [];
  return pools.get(round) ?? [];
}

// Returns all players not yet auctioned in the round and fast-forwards the index to the end
export function skipRemainingInRound(roomId: string, round: AuctionRound): Player[] {
  const pools = playerPools.get(roomId);
  if (!pools) return [];

  const pool = pools.get(round) ?? [];
  const idx = currentIndex.get(roomId) ?? 0;
  const remaining = pool.slice(idx);
  currentIndex.set(roomId, pool.length); // advance to end
  return remaining;
}

/**
 * Remove players NOT in allowedPlayerIds from the round pool.
 * Returns the excluded players so caller can mark them unsold.
 * Does NOT apply to round 5.
 */
export function filterRoundPlayers(
  roomId: string,
  round: AuctionRound,
  allowedPlayerIds: Set<string>
): Player[] {
  const pools = playerPools.get(roomId);
  if (!pools || round === 5) return [];

  const pool = pools.get(round) ?? [];
  const allowed: Player[] = [];
  const excluded: Player[] = [];

  for (const p of pool) {
    if (allowedPlayerIds.has(p.id)) {
      allowed.push(p);
    } else {
      excluded.push(p);
    }
  }

  pools.set(round, allowed);
  return excluded;
}

export function cleanupRoom(roomId: string): void {
  playerPools.delete(roomId);
  unsoldPlayers.delete(roomId);
  currentIndex.delete(roomId);
}
