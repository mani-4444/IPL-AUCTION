import type { IOServer, IOSocket, SocketData } from '../types';
import { getRoom, persistRoom } from '../services/roomStore';
import { calculateAllScores } from '../services/scoringService';

export function registerTeamHandlers(io: IOServer, socket: IOSocket): void {
  const data = socket.data as unknown as SocketData;

  socket.on('team:submit-xi', async ({ playingXI, captain, viceCaptain }) => {
    const room = getRoom(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    if (room.status !== 'team-setup') {
      socket.emit('error', 'Not in team setup phase.');
      return;
    }

    const team = room.teams.find((t) => t.userId === data.userId);
    if (!team) {
      socket.emit('error', 'Team not found.');
      return;
    }

    // --- Validate Playing XI ---
    if (!Array.isArray(playingXI) || playingXI.length !== 11) {
      socket.emit('error', 'Playing XI must have exactly 11 players.');
      return;
    }

    // Verify all players belong to this team
    const teamPlayerIds = new Set(team.players.map((p) => p.id));
    for (const id of playingXI) {
      if (!teamPlayerIds.has(id)) {
        socket.emit('error', `Player ${id} is not in your squad.`);
        return;
      }
    }

    // Verify no duplicates
    if (new Set(playingXI).size !== 11) {
      socket.emit('error', 'Duplicate players in Playing XI.');
      return;
    }

    // Verify captain and VC are in the XI
    if (!playingXI.includes(captain)) {
      socket.emit('error', 'Captain must be in the Playing XI.');
      return;
    }
    if (!playingXI.includes(viceCaptain)) {
      socket.emit('error', 'Vice-Captain must be in the Playing XI.');
      return;
    }
    if (captain === viceCaptain) {
      socket.emit('error', 'Captain and Vice-Captain must be different players.');
      return;
    }

    // Set the XI — bench is the remaining players
    team.playingXI = playingXI;
    team.bench = team.players
      .filter((p) => !playingXI.includes(p.id))
      .map((p) => p.id);
    team.captain = captain;
    team.viceCaptain = viceCaptain;

    io.to(room.id).emit('team:xi-submitted', team.id);
    console.log(`${team.teamName} submitted XI in room ${room.code}`);

    // Check if all teams have submitted
    const allSubmitted = room.teams.every((t) => t.playingXI.length === 11);
    if (allSubmitted) {
      // Calculate scores
      calculateAllScores(room.teams);
      room.status = 'results';

      io.to(room.id).emit('results:ready', room.teams);
      io.to(room.id).emit('room:updated', room);
      await persistRoom(room);

      console.log(`All teams submitted — results ready for room ${room.code}`);
    }
  });
}
