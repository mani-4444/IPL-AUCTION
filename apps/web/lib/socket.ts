import { io, Socket } from 'socket.io-client';
import { getCachedUserId } from './supabase';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;

/**
 * Must be called before any socket usage. Creates the Socket.IO instance with
 * the stable Supabase userId in the auth handshake so the server can identify
 * the user independently of socket.id.
 *
 * Safe to call multiple times — subsequent calls update auth for the next
 * reconnect but do not create a new socket.
 */
export function initSocket(userId: string): Socket {
  if (socket) {
    // Update auth so reconnect picks up the correct userId
    (socket as Socket & { auth: Record<string, string> }).auth = { userId };
    return socket;
  }
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { userId },
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function getSocket(): Socket {
  if (!socket) throw new Error('[socket] Call initSocket(userId) before using getSocket()');
  return socket;
}

export function connectSocket(): Socket {
  // On page reload the module is fresh — auto-init from sessionStorage cache
  if (!socket) {
    const userId = getCachedUserId();
    if (!userId) throw new Error('[socket] No cached userId. User must log in first.');
    initSocket(userId);
  }
  const s = socket!;
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
