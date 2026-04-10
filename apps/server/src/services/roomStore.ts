import type { Room, Team, AuctionConfig } from '../types';
import { supabase } from '../db/supabase';
import { randomBytes } from 'crypto';

// In-memory store — primary source of truth during gameplay
const rooms = new Map<string, Room>();
const roomTimers = new Map<string, NodeJS.Timeout>();
const closedPlayers = new Map<string, Set<string>>();

// Lookup room by join code
const codeToRoomId = new Map<string, string>();

function generateCode(): string {
  // 6-char uppercase alphanumeric
  return randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

const DEFAULT_CONFIG: AuctionConfig = {
  maxTeams: 10,
  budgetCr: 100,
  squadSize: 15,
  bidTimerSeconds: 10,
  bidIncrementCr: 0.25,
};

export function createRoom(hostId: string, hostName: string, teamName: string): Room {
  const roomId = generateId();
  let code = generateCode();

  // Ensure code uniqueness
  while (codeToRoomId.has(code)) {
    code = generateCode();
  }

  const hostTeam: Team = {
    id: generateId(),
    userId: hostId,
    userName: hostName,
    roomId,
    teamName,
    budgetRemaining: DEFAULT_CONFIG.budgetCr,
    players: [],
    playingXI: [],
    bench: [],
  };

  const room: Room = {
    id: roomId,
    code,
    hostId,
    hostName,
    status: 'waiting',
    teams: [hostTeam],
    currentRound: 1,
    auctionConfig: { ...DEFAULT_CONFIG },
  };

  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);

  return room;
}

export async function joinRoom(
  code: string,
  userId: string,
  userName: string,
  teamName: string
): Promise<{ room: Room; team: Team } | { error: string }> {
  let roomId = codeToRoomId.get(code.toUpperCase());

  // DB fallback: server may have restarted and lost in-memory state
  if (!roomId) {
    const recovered = await loadRoomByCodeFromDB(code.toUpperCase());
    if (recovered) roomId = recovered.id;
  }

  if (!roomId) return { error: 'Room not found. Check the code and try again.' };

  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found.' };

  if (room.status !== 'waiting') return { error: 'Auction already in progress. Cannot join.' };

  if (room.teams.length >= room.auctionConfig.maxTeams) {
    return { error: `Room is full (max ${room.auctionConfig.maxTeams} teams).` };
  }

  // Check if user already in room
  const existing = room.teams.find((t) => t.userId === userId);
  if (existing) {
    return { room, team: existing };
  }

  const team: Team = {
    id: generateId(),
    userId,
    userName,
    roomId: room.id,
    teamName,
    budgetRemaining: room.auctionConfig.budgetCr,
    players: [],
    playingXI: [],
    bench: [],
  };

  room.teams.push(team);
  return { room, team };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomByCode(code: string): Room | undefined {
  const roomId = codeToRoomId.get(code.toUpperCase());
  return roomId ? rooms.get(roomId) : undefined;
}

export function removeTeamFromRoom(roomId: string, userId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;

  room.teams = room.teams.filter((t) => t.userId !== userId);

  // If room is empty, clean it up
  if (room.teams.length === 0) {
    codeToRoomId.delete(room.code);
    rooms.delete(roomId);
    clearRoomTimer(roomId);
    closedPlayers.delete(roomId);
    return undefined;
  }

  // If host left, promote next user
  if (room.hostId === userId && room.teams.length > 0) {
    room.hostId = room.teams[0].userId;
    room.hostName = room.teams[0].userName;
  }

  return room;
}

export function getTeamByUserId(roomId: string, userId: string): Team | undefined {
  const room = rooms.get(roomId);
  return room?.teams.find((t) => t.userId === userId);
}

// Timer management
export function setRoomTimer(roomId: string, timer: NodeJS.Timeout): void {
  const existing = roomTimers.get(roomId);
  if (existing) {
    console.warn(`Timer overwritten for room ${roomId} - possible race condition`);
    clearInterval(existing);
  }
  roomTimers.set(roomId, timer);
}

export function clearRoomTimer(roomId: string): void {
  const existing = roomTimers.get(roomId);
  if (existing) {
    clearInterval(existing);
    roomTimers.delete(roomId);
  }
}

export function isPlayerClosed(roomId: string, playerId: string): boolean {
  return closedPlayers.get(roomId)?.has(playerId) ?? false;
}

export function closePlayer(roomId: string, playerId: string): void {
  if (!closedPlayers.has(roomId)) {
    closedPlayers.set(roomId, new Set());
  }

  closedPlayers.get(roomId)!.add(playerId);
}

export function clearClosedPlayers(roomId: string): void {
  closedPlayers.delete(roomId);
}

// Upsert a room_participants row (DB-level uniqueness per user per room)
export async function upsertRoomParticipant(
  roomId: string,
  userId: string,
  teamId: string
): Promise<void> {
  try {
    const { error } = await supabase.from('room_participants').upsert(
      { room_id: roomId, user_id: userId, team_id: teamId },
      { onConflict: 'room_id,user_id' }
    );
    if (error) console.error('Failed to upsert room_participant:', error.message);
  } catch (err) {
    console.error('upsertRoomParticipant error:', err);
  }
}

// Load room by join code from DB (used when in-memory codeToRoomId map is empty)
async function loadRoomByCodeFromDB(code: string): Promise<Room | undefined> {
  try {
    const { data: roomRow, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code)
      .single();

    if (error || !roomRow) return undefined;
    return loadRoomFromDB(roomRow.id);
  } catch (err) {
    console.error('loadRoomByCodeFromDB error:', err);
    return undefined;
  }
}

// Reconstruct full room state from DB (used after server restart for rejoin recovery)
export async function loadRoomFromDB(roomId: string): Promise<Room | undefined> {
  try {
    const { data: roomRow, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomErr || !roomRow) return undefined;

    const { data: teamRows, error: teamsErr } = await supabase
      .from('teams')
      .select('*')
      .eq('room_id', roomId);

    if (teamsErr || !teamRows) return undefined;

    const teams: Team[] = teamRows.map((t) => ({
      id: t.id,
      userId: t.user_id,
      userName: t.user_name,
      roomId: t.room_id,
      teamName: t.team_name,
      budgetRemaining: t.budget_remaining,
      players: t.players ?? [],
      playingXI: t.playing_xi ?? [],
      bench: t.bench ?? [],
      captain: t.captain ?? undefined,
      viceCaptain: t.vice_captain ?? undefined,
      finalScore: t.final_score ?? undefined,
    }));

    const room: Room = {
      id: roomRow.id,
      code: roomRow.code,
      hostId: roomRow.host_id,
      hostName: roomRow.host_name,
      status: roomRow.status,
      teams,
      currentRound: roomRow.current_round,
      auctionConfig: roomRow.auction_config,
    };

    // Restore in-memory maps so subsequent requests are served from memory
    rooms.set(room.id, room);
    codeToRoomId.set(room.code, room.id);

    console.log(`Room ${room.code} recovered from DB (${teams.length} teams)`);
    return room;
  } catch (err) {
    console.error('loadRoomFromDB error:', err);
    return undefined;
  }
}

// Persist room state to Supabase (called at key moments, not every tick)
export async function persistRoom(room: Room): Promise<void> {
  try {
    const { error } = await supabase.from('rooms').upsert({
      id: room.id,
      code: room.code,
      host_id: room.hostId,
      host_name: room.hostName,
      status: room.status,
      current_round: room.currentRound,
      auction_config: room.auctionConfig,
    });
    if (error) console.error('Failed to persist room:', error.message);

    // Persist teams
    for (const team of room.teams) {
      const { error: teamError } = await supabase.from('teams').upsert({
        id: team.id,
        room_id: room.id,
        user_id: team.userId,
        user_name: team.userName,
        team_name: team.teamName,
        budget_remaining: team.budgetRemaining,
        players: team.players,
        playing_xi: team.playingXI,
        bench: team.bench,
        captain: team.captain,
        vice_captain: team.viceCaptain,
        final_score: team.finalScore,
      });
      if (teamError) console.error('Failed to persist team:', teamError.message);
    }
  } catch (err) {
    console.error('Persist error:', err);
  }
}
