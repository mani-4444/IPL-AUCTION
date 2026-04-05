'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { useReconnect } from '@/hooks/useReconnect';
import type { Room } from '@/types';

export default function RoomLobbyPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const [copied, setCopied] = useState(false);
  useReconnect();

  useEffect(() => {
    const socket = connectSocket();

    socket.on('room:updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'auction') {
        router.push(`/auction/${updatedRoom.id}`);
      }
    });

    socket.on('error', (msg: string) => console.error('Socket error:', msg));

    // Rejoin if reconnecting
    if (!room && roomId && socket.id) {
      const savedUserId = socket.id;
      socket.emit('room:rejoin', { roomId, userId: savedUserId });
    }

    return () => {
      socket.off('room:updated');
      socket.off('error');
    };
  }, [room, roomId, router, setRoom]);

  function copyCode() {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function startAuction() {
    const socket = connectSocket();
    socket.emit('auction:start');
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4" style={{ fontFamily: 'var(--font-bebas)', color: '#FF6B00' }}>
            LOADING
          </div>
          <p style={{ color: 'rgba(232,232,240,0.4)' }}>Connecting to room...</p>
        </div>
      </div>
    );
  }

  const isHost = myUserId === room.hostId;
  const canStart = isHost && room.teams.length >= 2;

  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-slide-up">
        <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: '#FF6B00' }}>
          Waiting Room
        </p>
        <h1 className="text-5xl leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0' }}>
          ROOM LOBBY
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Room Code */}
        <div className="glass-bright rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(232,232,240,0.45)' }}>
            Share This Code
          </p>
          <div className="flex items-center gap-3">
            <span className="text-5xl tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-mono)', color: '#FFD700' }}>
              {room.code}
            </span>
            <button
              onClick={copyCode}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                background: copied ? 'rgba(22,163,74,0.2)' : 'rgba(255,107,0,0.15)',
                border: `1px solid ${copied ? 'rgba(22,163,74,0.4)' : 'rgba(255,107,0,0.3)'}`,
                color: copied ? '#4ADE80' : '#FF6B00',
                cursor: 'pointer',
              }}
              aria-label="Copy room code"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-3 text-xs" style={{ color: 'rgba(232,232,240,0.3)' }}>
            Share this code with your friends to invite them
          </p>
        </div>

        {/* Host Controls */}
        <div className="glass-bright rounded-2xl p-6 flex flex-col justify-between animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'rgba(232,232,240,0.45)' }}>
              {isHost ? 'Host Controls' : 'Status'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'rgba(232,232,240,0.6)' }}>
              {isHost
                ? room.teams.length < 2
                  ? 'Waiting for at least 1 more player...'
                  : `${room.teams.length} teams ready. Start when everyone's in!`
                : 'Waiting for host to start the auction...'}
            </p>
          </div>

          {isHost ? (
            <button
              onClick={startAuction}
              disabled={!canStart}
              className="w-full py-3.5 rounded-xl font-semibold tracking-widest uppercase transition-all duration-200"
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '1.25rem',
                background: canStart
                  ? 'linear-gradient(135deg, #FF6B00, #FF8C33)'
                  : 'rgba(255,107,0,0.2)',
                color: canStart ? '#fff' : 'rgba(255,255,255,0.3)',
                cursor: canStart ? 'pointer' : 'not-allowed',
                boxShadow: canStart ? '0 4px 24px rgba(255,107,0,0.4)' : 'none',
              }}
              aria-disabled={!canStart}
            >
              {canStart ? '🏏 Start Auction' : 'Waiting for Players...'}
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FFD700' }} />
              <span className="text-sm" style={{ color: '#FFD700' }}>
                Waiting for {room.hostName} to start...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Teams List */}
      <div className="mt-6 glass-bright rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.45)' }}>
            Teams ({room.teams.length}/{room.auctionConfig.maxTeams})
          </p>
          <div className="flex gap-1">
            {Array.from({ length: room.auctionConfig.maxTeams }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
                style={{ background: i < room.teams.length ? '#FF6B00' : 'rgba(42,42,58,0.8)' }} />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {room.teams.map((team, idx) => (
            <div key={team.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
              style={{
                background: team.userId === myUserId
                  ? 'rgba(255,107,0,0.1)'
                  : 'rgba(10,10,15,0.6)',
                border: `1px solid ${team.userId === myUserId ? 'rgba(255,107,0,0.3)' : 'rgba(42,42,58,0.6)'}`,
                animationDelay: `${0.05 * idx}s`,
              }}>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: `hsl(${(idx * 47) % 360}, 70%, 25%)`,
                  border: `1px solid hsl(${(idx * 47) % 360}, 70%, 40%)`,
                  color: `hsl(${(idx * 47) % 360}, 70%, 75%)`,
                }}>
                {team.teamName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#E8E8F0' }}>
                  {team.teamName}
                </p>
                <p className="text-xs truncate" style={{ color: 'rgba(232,232,240,0.45)' }}>
                  {team.userName}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                {team.userId === room.hostId && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
                    HOST
                  </span>
                )}
                {team.userId === myUserId && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,107,0,0.15)', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.3)' }}>
                    YOU
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
