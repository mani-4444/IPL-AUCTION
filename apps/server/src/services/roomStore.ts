import type { Room, Team, AuctionConfig } from '../types';
import { supabase } from '../db/supabase';
import { randomBytes } from 'crypto';

// In-memory store — primary source of truth during gameplay
const rooms = new Map<string, Room>();
const roomTimers = new Map<string, NodeJS.Timeout>();

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

export function joinRoom(
  code: string,
  userId: string,
  userName: string,
  teamName: string
): { room: Room; team: Team } | { error: string } {
  const roomId = codeToRoomId.get(code.toUpperCase());
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
  clearRoomTimer(roomId);
  roomTimers.set(roomId, timer);
}

export function clearRoomTimer(roomId: string): void {
  const existing = roomTimers.get(roomId);
  if (existing) {
    clearInterval(existing);
    roomTimers.delete(roomId);
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
