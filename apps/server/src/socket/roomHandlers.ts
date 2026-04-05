import type { IOServer, IOSocket, SocketData } from '../types';
import {
  createRoom,
  joinRoom,
  getRoom,
  removeTeamFromRoom,
  persistRoom,
} from '../services/roomStore';
import { calculateAllScores } from '../services/scoringService';

// Grace period before removing a disconnected player (30s)
const DISCONNECT_GRACE_MS = 30_000;
const pendingLeaves = new Map<string, NodeJS.Timeout>();

export function registerRoomHandlers(io: IOServer, socket: IOSocket): void {
  const data = socket.data as unknown as SocketData;

  socket.on('room:create', async ({ userName, teamName }) => {
    if (!userName?.trim() || !teamName?.trim()) {
      socket.emit('error', 'Name and team name are required.');
      return;
    }

    const userId = socket.id;
    const room = createRoom(userId, userName.trim(), teamName.trim());
    const team = room.teams[0];

    // Store connection metadata
    data.userId = userId;
    data.userName = userName.trim();
    data.teamName = teamName.trim();
    data.roomId = room.id;
    data.teamId = team.id;

    // Join socket room
    socket.join(room.id);
    io.to(room.id).emit('room:updated', room);

    // Persist to Supabase
    await persistRoom(room);

    console.log(`Room created: ${room.code} by ${userName} (${teamName})`);
  });

  socket.on('room:join', async ({ code, userName, teamName }) => {
    if (!code?.trim() || !userName?.trim() || !teamName?.trim()) {
      socket.emit('error', 'Room code, name, and team name are required.');
      return;
    }

    const userId = socket.id;
    const result = joinRoom(code.trim(), userId, userName.trim(), teamName.trim());

    if ('error' in result) {
      socket.emit('error', result.error);
      return;
    }

    const { room, team } = result;

    // Store connection metadata
    data.userId = userId;
    data.userName = userName.trim();
    data.teamName = teamName.trim();
    data.roomId = room.id;
    data.teamId = team.id;

    // Join socket room
    socket.join(room.id);
    io.to(room.id).emit('room:updated', room);

    await persistRoom(room);

    console.log(`${userName} (${teamName}) joined room ${room.code}`);
  });

  socket.on('room:leave', () => {
    cancelPendingLeave(data.userId);
    handleLeave(io, socket, data);
  });

  socket.on('room:rejoin', ({ roomId, userId }) => {
    // Cancel any pending disconnect for this user
    cancelPendingLeave(userId);

    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', 'Room no longer exists.');
      return;
    }

    const team = room.teams.find((t) => t.userId === userId);
    if (!team) {
      socket.emit('error', 'You are not part of this room.');
      return;
    }

    // Restore connection metadata
    data.userId = userId;
    data.userName = team.userName;
    data.teamName = team.teamName;
    data.roomId = room.id;
    data.teamId = team.id;

    // Re-join socket room and send current state
    socket.join(room.id);
    socket.emit('room:updated', room);

    console.log(`${team.userName} rejoined room ${room.code}`);
  });

  socket.on('disconnect', () => {
    if (!data.userId || !data.roomId) return;

    const userId = data.userId;
    const roomId = data.roomId;
    const userName = data.userName;

    console.log(`${userName} disconnected — grace period started (${DISCONNECT_GRACE_MS / 1000}s)`);

    const timer = setTimeout(async () => {
      pendingLeaves.delete(userId);
      const room = getRoom(roomId);
      if (!room) return;

      // During team-setup: auto-submit XI instead of removing the team
      if (room.status === 'team-setup') {
        const team = room.teams.find((t) => t.userId === userId);
        if (team && team.playingXI.length < 11 && team.players.length >= 11) {
          const sorted = [...team.players].sort((a, b) => b.rating - a.rating);
          team.playingXI = sorted.slice(0, 11).map((p) => p.id);
          team.bench = sorted.slice(11).map((p) => p.id);
          // No captain/VC assigned — scoring will skip the 2× bonus but won't crash
          io.to(roomId).emit('team:xi-submitted', team.id);
          console.log(`Auto-submitted XI for ${userName} (disconnected during team-setup)`);

          const allSubmitted = room.teams.every((t) => t.playingXI.length === 11);
          if (allSubmitted) {
            calculateAllScores(room.teams);
            room.status = 'results';
            io.to(roomId).emit('results:ready', room.teams);
            io.to(roomId).emit('room:updated', room);
            await persistRoom(room);
            console.log(`All teams submitted (auto) — results ready for room ${room.code}`);
          }
        }
        return; // Don't remove team from room during/after auction
      }

      // During waiting: remove the team normally
      const updatedRoom = removeTeamFromRoom(roomId, userId);
      if (updatedRoom) {
        io.to(updatedRoom.id).emit('room:updated', updatedRoom);
        console.log(`${userName} removed after grace period from room ${updatedRoom.code}`);
      } else {
        console.log(`Room closed after grace period (${userName} was last player)`);
      }
    }, DISCONNECT_GRACE_MS);

    pendingLeaves.set(userId, timer);
  });
}

function cancelPendingLeave(userId: string): void {
  const timer = pendingLeaves.get(userId);
  if (timer) {
    clearTimeout(timer);
    pendingLeaves.delete(userId);
  }
}

function handleLeave(io: IOServer, socket: IOSocket, data: SocketData): void {
  if (!data.roomId) return;

  const room = removeTeamFromRoom(data.roomId, data.userId);
  socket.leave(data.roomId);

  if (room) {
    // Room still exists — notify remaining teams
    io.to(room.id).emit('room:updated', room);
    console.log(`${data.userName} left room ${room.code}`);
  } else {
    console.log(`Room closed (last player left)`);
  }

  // Clear connection metadata
  data.roomId = '';
  data.userId = '';
}
