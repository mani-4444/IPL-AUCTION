import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ServerToClientEvents, ClientToServerEvents, SocketData } from './types';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerAuctionHandlers } from './socket/auctionHandlers';
import { registerTeamHandlers } from './socket/teamHandlers';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 4000;

// Support comma-separated origins for multi-env deploys, e.g.:
//   CLIENT_URL=https://ipl-auction.vercel.app,http://localhost:3000
const rawOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
const corsOrigin = rawOrigins.length === 1 ? rawOrigins[0] : rawOrigins;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow WebSocket with polling fallback — required for some cloud providers
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Socket middleware — reads stable Supabase userId from handshake auth.
// This runs before every event handler so socket.data.userId is always set.
io.use((socket, next) => {
  const userId = (socket.handshake.auth as Record<string, string>)?.userId;
  if (!userId) {
    return next(new Error('Missing userId in socket auth. Refresh the page.'));
  }
  (socket.data as unknown as SocketData).userId = userId;
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Keep-alive ping (hit this before starting a game to wake Render free tier)
app.get('/ping', (_req, res) => {
  res.json({ alive: true });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerAuctionHandlers(io, socket);
  registerTeamHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
