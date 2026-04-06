import type { IOServer, IOSocket, SocketData } from '../types';
import { getRoom } from '../services/roomStore';
import {
  startAuction,
  nextPlayer,
  onBid,
  onSkip,
  pauseAuction,
  resumeAuction,
} from '../services/auctionService';

export function registerAuctionHandlers(io: IOServer, socket: IOSocket): void {
  const data = socket.data as unknown as SocketData;

  socket.on('auction:start', async () => {
    const room = getRoom(data.roomId);
    if (!room) { socket.emit('error', 'Room not found.'); return; }
    if (data.userId !== room.hostId) { socket.emit('error', 'Only the host can start the auction.'); return; }
    if (room.status !== 'waiting') { socket.emit('error', 'Auction already started.'); return; }
    if (room.teams.length < 2) { socket.emit('error', 'Need at least 2 teams to start.'); return; }

    await startAuction(io, room.id);
  });

  socket.on('auction:bid', (amount: number) => {
    if (!data.roomId || !data.userId) { socket.emit('error', 'Not in a room.'); return; }
    if (typeof amount !== 'number' || amount <= 0) { socket.emit('error', 'Invalid bid amount.'); return; }

    // Pass socket.id so errors are sent only to this bidder (Issue 2 fix)
    onBid(io, data.roomId, data.userId, amount, socket.id);
  });

  // Issue 5: skip player (unanimous vote triggers unsold)
  socket.on('auction:skip', () => {
    if (!data.roomId || !data.userId) return;
    onSkip(io, data.roomId, data.userId);
  });

  socket.on('auction:next-player', () => {
    const room = getRoom(data.roomId);
    if (!room) return;
    if (data.userId !== room.hostId) { socket.emit('error', 'Only the host can advance to next player.'); return; }
    nextPlayer(io, room.id);
  });

  socket.on('auction:pause', () => {
    const room = getRoom(data.roomId);
    if (!room) return;
    if (data.userId !== room.hostId) { socket.emit('error', 'Only the host can pause.'); return; }
    pauseAuction(io, room.id);
  });

  socket.on('auction:resume', () => {
    const room = getRoom(data.roomId);
    if (!room) return;
    if (data.userId !== room.hostId) { socket.emit('error', 'Only the host can resume.'); return; }
    resumeAuction(io, room.id);
  });
}
