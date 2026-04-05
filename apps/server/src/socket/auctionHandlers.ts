import type { IOServer, IOSocket, SocketData } from '../types';
import { getRoom } from '../services/roomStore';
import {
  startAuction,
  nextPlayer,
  onBid,
  pauseAuction,
  resumeAuction,
} from '../services/auctionService';

export function registerAuctionHandlers(io: IOServer, socket: IOSocket): void {
  const data = socket.data as unknown as SocketData;

  socket.on('auction:start', async () => {
    const room = getRoom(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    // Host-only check
    if (data.userId !== room.hostId) {
      socket.emit('error', 'Only the host can start the auction.');
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', 'Auction already started.');
      return;
    }

    if (room.teams.length < 2) {
      socket.emit('error', 'Need at least 2 teams to start.');
      return;
    }

    await startAuction(io, room.id);
  });

  socket.on('auction:bid', (amount: number) => {
    if (!data.roomId || !data.userId) {
      socket.emit('error', 'Not in a room.');
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      socket.emit('error', 'Invalid bid amount.');
      return;
    }

    onBid(io, data.roomId, data.userId, amount);
  });

  socket.on('auction:next-player', () => {
    const room = getRoom(data.roomId);
    if (!room) return;

    if (data.userId !== room.hostId) {
      socket.emit('error', 'Only the host can advance to next player.');
      return;
    }

    nextPlayer(io, room.id);
  });

  socket.on('auction:pause', () => {
    const room = getRoom(data.roomId);
    if (!room) return;

    if (data.userId !== room.hostId) {
      socket.emit('error', 'Only the host can pause the auction.');
      return;
    }

    pauseAuction(io, room.id);
  });

  socket.on('auction:resume', () => {
    const room = getRoom(data.roomId);
    if (!room) return;

    if (data.userId !== room.hostId) {
      socket.emit('error', 'Only the host can resume the auction.');
      return;
    }

    resumeAuction(io, room.id);
  });
}
