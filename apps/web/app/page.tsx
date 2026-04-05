'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { saveSession } from '@/lib/session';
import type { Room } from '@/types';

export default function LandingPage() {
  const router = useRouter();
  const { setRoom, setMyUser } = useRoomStore();

  const [userName, setUserName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = connectSocket();

    socket.on('room:updated', (room: Room) => {
      setRoom(room);
      const myTeam = room.teams.find((t) => t.userId === socket.id);
      if (myTeam) {
        setMyUser(socket.id!, myTeam.id);
        saveSession({ roomId: room.id, userId: socket.id!, roomStatus: room.status });
      }
      router.push(`/room/${room.id}`);
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      setLoading(false);
    });

    return () => {
      socket.off('room:updated');
      socket.off('error');
    };
  }, [router, setRoom, setMyUser]);

  function handleCreate() {
    if (!userName.trim() || !teamName.trim()) {
      setError('Please enter your name and team name.');
      return;
    }
    setError('');
    setLoading(true);
    const socket = connectSocket();
    socket.emit('room:create', { userName: userName.trim(), teamName: teamName.trim() });
  }

  function handleJoin() {
    if (!userName.trim() || !teamName.trim() || !roomCode.trim()) {
      setError('All fields are required to join a room.');
      return;
    }
    if (roomCode.trim().length !== 6) {
      setError('Room code must be 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    const socket = connectSocket();
    socket.emit('room:join', {
      code: roomCode.trim().toUpperCase(),
      userName: userName.trim(),
      teamName: teamName.trim(),
    });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B00, transparent)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.03] blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />

      {/* Logo */}
      <div className="mb-12 text-center animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, #FF6B00)' }} />
          <span className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#FF6B00' }}>
            IPL 2026
          </span>
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #FF6B00, transparent)' }} />
        </div>
        <h1 className="leading-none"
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 'clamp(5rem, 15vw, 9rem)',
            color: '#FFD700',
            textShadow: '0 0 60px rgba(255,215,0,0.3), 0 4px 0 rgba(255,107,0,0.5)',
          }}>
          AUCTION
        </h1>
        <p className="mt-2 text-sm tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.45)' }}>
          Build Your Dream Team
        </p>
      </div>

      {/* Card */}
      <div className="glass-bright rounded-2xl p-8 w-full max-w-md orange-glow animate-slide-up"
        style={{ animationDelay: '0.08s' }}>

        {/* Mode Switcher */}
        <div className="flex rounded-xl overflow-hidden mb-8 p-1"
          style={{ background: 'rgba(10,10,15,0.8)', border: '1px solid rgba(42,42,58,0.8)' }}>
          {(['create', 'join'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-widest uppercase transition-all duration-200"
              style={{
                background: mode === m ? '#FF6B00' : 'transparent',
                color: mode === m ? '#fff' : 'rgba(232,232,240,0.45)',
                cursor: 'pointer',
              }}
              aria-pressed={mode === m}
            >
              {m === 'create' ? '+ Create' : '→ Join'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <InputField label="Your Name" value={userName} onChange={setUserName} placeholder="e.g. Rohit Sharma" />
          <InputField label="Team Name" value={teamName} onChange={setTeamName} placeholder="e.g. Mumbai Mavericks" />
          {mode === 'join' && (
            <InputField
              label="Room Code"
              value={roomCode}
              onChange={(v) => setRoomCode(v.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              mono
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171' }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="mt-6 w-full py-4 rounded-xl text-xl tracking-widest uppercase transition-all duration-200"
          style={{
            fontFamily: 'var(--font-bebas)',
            background: loading ? 'rgba(255,107,0,0.4)' : 'linear-gradient(135deg, #FF6B00, #FF8C33)',
            color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 24px rgba(255,107,0,0.4)',
          }}
          aria-busy={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              {mode === 'create' ? 'Creating...' : 'Joining...'}
            </span>
          ) : (
            mode === 'create' ? 'Create Room' : 'Join Room'
          )}
        </button>
      </div>

      <p className="mt-8 text-xs tracking-wider uppercase animate-slide-up"
        style={{ color: 'rgba(232,232,240,0.2)', animationDelay: '0.16s' }}>
        Max 10 teams · 100 Cr budget · 5 rounds
      </p>
    </main>
  );
}

function InputField({
  label, value, onChange, placeholder, maxLength, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; maxLength?: number; mono?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold tracking-widest uppercase mb-1.5"
        style={{ color: 'rgba(232,232,240,0.45)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200"
        style={{
          background: 'rgba(10,10,15,0.8)',
          border: `1px solid ${focused ? '#FF6B00' : 'rgba(42,42,58,0.8)'}`,
          color: '#E8E8F0',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          letterSpacing: mono ? '0.25em' : 'inherit',
          outline: 'none',
          boxShadow: focused ? '0 0 0 3px rgba(255,107,0,0.15)' : 'none',
        }}
        aria-label={label}
      />
    </div>
  );
}
