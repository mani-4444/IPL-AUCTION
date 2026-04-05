import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ServerToClientEvents, ClientToServerEvents } from './types';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerAuctionHandlers } from './socket/auctionHandlers';
import { registerTeamHandlers } from './socket/teamHandlers';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
