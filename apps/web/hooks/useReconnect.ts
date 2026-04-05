'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { loadSession, saveSession, clearSession } from '@/lib/session';
import { useRoomStore } from '@/store/roomStore';
import type { Room } from '@/types';

/**
 * Handles socket reconnection and page-refresh recovery.
 * Place this hook in every game page (room, auction, team-setup, results).
 */
export function useReconnect() {
  const router = useRouter();
  const { setRoom, setMyUser } = useRoomStore();

  useEffect(() => {
    const socket = connectSocket();

    // On reconnect: re-join the room using persisted session
    function handleReconnect() {
      const session = loadSession();
      if (!session) return;
      console.log('[reconnect] Rejoining room', session.roomId);
      socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
    }

    // Sync room state and persist session on every update
    function handleRoomUpdated(room: Room) {
      setRoom(room);
      const myUserId = socket.id;
      if (!myUserId) return;

      const myTeam = room.teams.find((t) => t.userId === myUserId);
      if (myTeam) {
        setMyUser(myUserId, myTeam.id);
        saveSession({ roomId: room.id, userId: myUserId, roomStatus: room.status });
      }

      // Navigate to correct page if status changed while disconnected
      switch (room.status) {
        case 'auction':    router.push(`/auction/${room.id}`); break;
        case 'team-setup': router.push(`/team-setup/${room.id}`); break;
        case 'results':    router.push(`/results/${room.id}`); break;
        default: break;
      }
    }

    socket.on('reconnect', handleReconnect);
    socket.on('room:updated', handleRoomUpdated);

    // If socket just connected and we have a session, rejoin immediately
    if (socket.connected) {
      const session = loadSession();
      if (session) {
        socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
      }
    } else {
      socket.once('connect', () => {
        const session = loadSession();
        if (session) {
          socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
        }
      });
    }

    return () => {
      socket.off('reconnect', handleReconnect);
      socket.off('room:updated', handleRoomUpdated);
    };
  }, [router, setRoom, setMyUser]);
}
