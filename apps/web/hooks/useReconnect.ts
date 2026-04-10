'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket } from '@/lib/socket';
import { loadSession, saveSession } from '@/lib/session';
import { useRoomStore } from '@/store/roomStore';
import { getOrCreateUser } from '@/lib/supabase';
import type { Room } from '@/types';

/**
 * Handles socket reconnection and page-refresh recovery.
 * Uses the stable Supabase userId (not socket.id) so all tabs behave identically.
 * Place this hook in every game page (room, auction, team-setup, results).
 */
export function useReconnect() {
  const router = useRouter();
  const { setRoom, setMyUser } = useRoomStore();

  useEffect(() => {
    let mounted = true;
    // Cleanup fns registered after the async userId resolves
    const offFns: Array<() => void> = [];

    getOrCreateUser()
      .then((userId) => {
        if (!mounted) return;
        if (!userId) {
          router.push('/');
          return;
        }
        const stableUserId: string = userId;

        const socket = initSocket(stableUserId);

        function handleRoomUpdated(room: Room) {
          if (!mounted) return;
          setRoom(room);
          const myTeam = room.teams.find((t) => t.userId === stableUserId);
          if (myTeam) {
            setMyUser(stableUserId, myTeam.id);
            saveSession({ roomId: room.id, userId: stableUserId, roomStatus: room.status });
          }
          switch (room.status) {
            case 'auction':    router.push(`/auction/${room.id}`);    break;
            case 'team-setup': router.push(`/team-setup/${room.id}`); break;
            case 'results':    router.push(`/results/${room.id}`);    break;
            default: break;
          }
        }

        function handleReconnect() {
          const session = loadSession();
          if (session) {
            socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
            socket.emit('sync_state');
          }
        }

        socket.on('room:updated', handleRoomUpdated);
        socket.on('reconnect', handleReconnect);
        offFns.push(
          () => socket.off('room:updated', handleRoomUpdated),
          () => socket.off('reconnect', handleReconnect),
        );

        if (socket.connected) {
          const session = loadSession();
          if (session) {
            socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
            socket.emit('sync_state');
          }
        } else {
          socket.once('connect', () => {
            const session = loadSession();
            if (session) {
              socket.emit('room:rejoin', { roomId: session.roomId, userId: session.userId });
              socket.emit('sync_state');
            }
          });
          socket.connect();
        }
      })
      .catch(console.error);

    return () => {
      mounted = false;
      offFns.forEach((fn) => fn());
    };
  }, [router, setRoom, setMyUser]);
}
