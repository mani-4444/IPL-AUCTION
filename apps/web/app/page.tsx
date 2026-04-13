'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { saveSession } from '@/lib/session';
import { supabase, getOrCreateUser, signInWithEmail, signUpWithEmail, signOutUser } from '@/lib/supabase';
import type { Room } from '@/types';

// ─── Auth screen ──────────────────────────────────────────────────────────────

function AuthCard({ onAuth }: { onAuth: (userId: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const userId = mode === 'signup'
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      if (mode === 'signup') {
        setSuccess('Account created! You are now logged in.');
      }
      onAuth(userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-bright rounded-2xl p-8 w-full max-w-md orange-glow animate-slide-up"
      style={{ animationDelay: '0.08s' }}>

      {/* Mode switcher */}
      <div className="flex rounded-xl overflow-hidden mb-8 p-1"
        style={{ background: 'rgba(10,10,15,0.8)', border: '1px solid rgba(42,42,58,0.8)' }}>
        {(['signin', 'signup'] as const).map((m) => (
          <button key={m}
            onClick={() => { setMode(m); setError(''); setSuccess(''); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-widest uppercase transition-all duration-200"
            style={{
              background: mode === m ? '#FF6B00' : 'transparent',
              color: mode === m ? '#fff' : 'rgba(232,232,240,0.45)',
              cursor: 'pointer',
            }}
            aria-pressed={mode === m}>
            {m === 'signin' ? 'Log In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <InputField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        <InputField label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', color: '#4ADE80' }}>
          {success}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-6 w-full py-4 rounded-xl text-xl tracking-widest uppercase transition-all duration-200"
        style={{
          fontFamily: 'var(--font-bebas)',
          background: loading ? 'rgba(255,107,0,0.4)' : 'linear-gradient(135deg, #FF6B00, #FF8C33)',
          color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 4px 24px rgba(255,107,0,0.4)',
        }}
        aria-busy={loading}>
        {loading
          ? <Spinner />
          : mode === 'signin' ? 'Log In' : 'Create Account'}
      </button>
    </div>
  );
}

// ─── Room screen ──────────────────────────────────────────────────────────────

// Modal form shown when Create or Join button is clicked
function RoomFormModal({
  mode,
  onClose,
  onRoom,
}: {
  mode: 'create' | 'join';
  onClose: () => void;
  onRoom: (room: Room) => void;
}) {
  const [userName, setUserName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function handleRoom(room: Room) { onRoom(room); }
    function handleError(msg: string) { setError(msg); setLoading(false); }
    const socket = connectSocket();
    socket.on('room:updated', handleRoom);
    socket.on('error', handleError);
    return () => {
      socket.off('room:updated', handleRoom);
      socket.off('error', handleError);
    };
  }, [onRoom]);

  async function handleSubmit() {
    if (!userName.trim() || !teamName.trim()) {
      setError('Please enter your name and team name.');
      return;
    }
    if (mode === 'join') {
      if (!roomCode.trim()) { setError('Room code is required.'); return; }
      if (roomCode.trim().length !== 6) { setError('Room code must be 6 characters.'); return; }
    }
    setError('');
    setLoading(true);
    const socket = connectSocket();
    if (mode === 'create') {
      socket.emit('room:create', { userName: userName.trim(), teamName: teamName.trim() });
    } else {
      socket.emit('room:join', {
        code: roomCode.trim().toUpperCase(),
        userName: userName.trim(),
        teamName: teamName.trim(),
      });
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Sheet */}
      <div className="glass-bright rounded-2xl p-7 w-full max-w-sm orange-glow animate-slide-up"
        style={{ animationDelay: '0s' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: '1.6rem', color: '#FFD700', letterSpacing: '0.08em' }}>
            {mode === 'create' ? '+ Create Room' : '→ Join Room'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: 'rgba(232,232,240,0.08)', color: 'rgba(232,232,240,0.45)', cursor: 'pointer' }}
            aria-label="Close">
            ✕
          </button>
        </div>

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

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-5 w-full py-4 rounded-xl text-xl tracking-widest uppercase transition-all duration-200"
          style={{
            fontFamily: 'var(--font-bebas)',
            background: loading ? 'rgba(255,107,0,0.4)' : 'linear-gradient(135deg, #FF6B00, #FF8C33)',
            color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 24px rgba(255,107,0,0.4)',
          }}
          aria-busy={loading}>
          {loading
            ? <Spinner label={mode === 'create' ? 'Creating...' : 'Joining...'} />
            : mode === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}

// Action buttons shown when authenticated — two big buttons + sign out
function RoomActions({
  userId,
  onMode,
  onSignOut,
}: {
  userId: string;
  onMode: (mode: 'create' | 'join') => void;
  onSignOut: () => void;
}) {
  // Keep socket connected so room:rejoin response is received
  useEffect(() => {
    const socket = initSocket(userId);
    if (!socket.connected) socket.connect();
  }, [userId]);

  return (
    <div className="w-full max-w-md animate-slide-up" style={{ animationDelay: '0.08s' }}>
      <div className="flex gap-3">
        <button
          onClick={() => onMode('create')}
          className="flex-1 py-4 rounded-2xl text-lg tracking-widest uppercase transition-all duration-200 active:scale-95"
          style={{
            fontFamily: 'var(--font-bebas)',
            background: 'linear-gradient(135deg, #FF6B00, #FF8C33)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(255,107,0,0.35)',
          }}>
          + Create
        </button>
        <button
          onClick={() => onMode('join')}
          className="flex-1 py-4 rounded-2xl text-lg tracking-widest uppercase transition-all duration-200 active:scale-95"
          style={{
            fontFamily: 'var(--font-bebas)',
            background: 'transparent',
            color: '#FF8C33',
            cursor: 'pointer',
            border: '2px solid rgba(255,107,0,0.5)',
          }}>
          → Join
        </button>
      </div>
      <button
        onClick={onSignOut}
        className="mt-3 w-full py-2 rounded-xl text-xs tracking-widest uppercase transition-all duration-200"
        style={{
          background: 'transparent',
          color: 'rgba(232,232,240,0.2)',
          cursor: 'pointer',
          border: '1px solid rgba(42,42,58,0.4)',
        }}>
        Sign Out
      </button>
    </div>
  );
}

// ─── My Auctions ─────────────────────────────────────────────────────────────

interface MyRoom {
  roomId: string;
  teamName: string;
  code: string;
  status: string;
  currentRound: number;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    waiting:    { label: 'Waiting',    color: 'rgba(100,116,139,0.8)' },
    auction:    { label: 'Live',       color: 'rgba(34,197,94,0.8)' },
    'team-setup': { label: 'Setup',   color: 'rgba(234,179,8,0.8)' },
    results:    { label: 'Finished',   color: 'rgba(139,92,246,0.8)' },
  };
  const b = map[status] ?? { label: status, color: 'rgba(100,116,139,0.8)' };
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold tracking-wider uppercase"
      style={{ background: b.color, color: '#fff' }}>
      {b.label}
    </span>
  );
}

function RoomHistoryCard({ room, onAction }: { room: MyRoom; onAction: () => void }) {
  const isActive = room.status === 'auction' || room.status === 'team-setup';
  const isResults = room.status === 'results';
  const date = room.createdAt
    ? new Date(room.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    : '';

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ background: 'rgba(10,10,15,0.7)', border: '1px solid rgba(42,42,58,0.7)' }}>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-widest" style={{ color: '#FF6B00' }}>{room.code}</span>
          {statusBadge(room.status)}
        </div>
        <span className="text-xs truncate" style={{ color: 'rgba(232,232,240,0.45)' }}>
          {room.teamName} · Round {room.currentRound} · {date}
        </span>
      </div>
      {(isActive || isResults) && (
        <button
          onClick={onAction}
          className="ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase shrink-0 transition-all duration-150 active:scale-95"
          style={{
            background: isResults ? 'rgba(139,92,246,0.2)' : 'rgba(255,107,0,0.2)',
            border: `1px solid ${isResults ? 'rgba(139,92,246,0.5)' : 'rgba(255,107,0,0.5)'}`,
            color: isResults ? '#c4b5fd' : '#FF8C33',
            cursor: 'pointer',
          }}>
          {isResults ? 'Results' : 'Rejoin'}
        </button>
      )}
    </div>
  );
}

function MyAuctions({ userId, onAction }: { userId: string; onAction: (roomId: string, status: string) => void }) {
  const [rooms, setRooms] = useState<MyRoom[]>([]);

  useEffect(() => {
    supabase
      .from('teams')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('room_id, team_name, rooms(id, code, status, current_round, created_at)')
      .eq('user_id', userId)
      .order('created_at', { referencedTable: 'rooms', ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (!data) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          roomId: row.room_id as string,
          teamName: row.team_name as string,
          code: (row.rooms?.code ?? '') as string,
          status: (row.rooms?.status ?? '') as string,
          currentRound: (row.rooms?.current_round ?? 1) as number,
          createdAt: (row.rooms?.created_at ?? '') as string,
        })).filter((r) => r.code);
        setRooms(mapped);
      });
  }, [userId]);

  if (rooms.length === 0) return null;

  return (
    <div className="w-full max-w-md mt-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: 'rgba(232,232,240,0.35)' }}>
        My Auctions
      </p>
      <div className="space-y-2">
        {rooms.map((room) => (
          <RoomHistoryCard key={room.roomId} room={room} onAction={() => onAction(room.roomId, room.status)} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'checking' | 'landing' | 'unauthenticated' | 'authenticated';

export default function LandingPage() {
  const router = useRouter();
  const { setRoom, setMyUser } = useRoomStore();

  const [pageState, setPageState] = useState<PageState>('checking');
  const [userId, setUserId] = useState<string | null>(null);
  const [roomMode, setRoomMode] = useState<'create' | 'join' | null>(null);

  // Check for existing Supabase session on mount
  useEffect(() => {
    getOrCreateUser().then((uid) => {
      if (uid) {
        setUserId(uid);
        setPageState('authenticated');
      } else {
        setPageState('landing');
      }
    });

    // Keep in sync if user signs in/out in another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setPageState('authenticated');
      } else {
        setUserId(null);
        setPageState('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleAuth(uid: string) {
    setUserId(uid);
    setPageState('authenticated');
  }

  async function handleSignOut() {
    await signOutUser();
    setUserId(null);
    setPageState('unauthenticated');
  }

  function handleRoom(room: Room) {
    if (!userId) return;
    setRoom(room);
    const myTeam = room.teams.find((t) => t.userId === userId);
    if (myTeam) {
      setMyUser(userId, myTeam.id);
      saveSession({ roomId: room.id, userId, roomStatus: room.status });
    }
    router.push(`/room/${room.id}`);
  }

  function handleRejoin(roomId: string, status: string) {
    if (!userId) return;
    if (status === 'results') {
      router.push(`/results/${roomId}`);
      return;
    }
    saveSession({ roomId, userId, roomStatus: status as Room['status'] });
    const socket = connectSocket();
    socket.emit('room:rejoin', { roomId, userId });
    // room:updated fired by server → RoomCard's listener → handleRoom → navigates
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Drifting background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B00, transparent)', opacity: 0.06, animation: 'orbDrift1 12s ease-in-out infinite' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)', opacity: 0.05, animation: 'orbDrift2 15s ease-in-out infinite' }} />
      <div className="absolute top-[40%] right-[5%] w-[300px] h-[300px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B00, transparent)', opacity: 0.03, animation: 'orbDrift1 18s ease-in-out infinite reverse' }} />


      {/* Logo */}
      <div className="mb-12 text-center animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-px" style={{ width: '3rem', background: 'linear-gradient(90deg, transparent, #FF6B00)', animation: 'linePulse 2.5s ease-in-out infinite' }} />
          <span className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#FF6B00' }}>IPL 2026</span>
          <div className="h-px" style={{ width: '3rem', background: 'linear-gradient(90deg, #FF6B00, transparent)', animation: 'linePulse 2.5s ease-in-out infinite' }} />
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
        <p className="mt-2 text-sm tracking-widest uppercase"
          style={{ color: 'rgba(232,232,240,0.55)', animation: 'fadeIn 1s ease forwards', animationDelay: '0.3s', opacity: 0 }}>
          Build Your Dream Team
        </p>
      </div>

      {/* Card area */}
      {pageState === 'checking' && (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      )}

      {pageState === 'landing' && (
        <div className="flex flex-col items-center gap-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Pulse rings + button */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ animation: 'pulseRing 2s ease-out infinite', background: 'rgba(255,107,0,0.2)' }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ animation: 'pulseRing 2s ease-out infinite', animationDelay: '0.7s', background: 'rgba(255,107,0,0.12)' }} />
            <button
              onClick={() => setPageState('unauthenticated')}
              className="relative px-16 py-5 rounded-2xl text-2xl tracking-widest uppercase transition-all duration-200 active:scale-95"
              style={{
                fontFamily: 'var(--font-bebas)',
                background: 'linear-gradient(135deg, #FF6B00, #FF8C33)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 0 40px rgba(255,107,0,0.5), 0 8px 32px rgba(255,107,0,0.3)',
                letterSpacing: '0.1em',
              }}>
              🏏 Let's Play
            </button>
          </div>
          <p className="text-sm tracking-wider" style={{ color: 'rgba(232,232,240,0.6)' }}>
            Sign in or create an account to continue
          </p>
        </div>
      )}

      {pageState === 'unauthenticated' && (
        <AuthCard onAuth={handleAuth} />
      )}

      {pageState === 'authenticated' && userId && (
        <>
          <RoomActions userId={userId} onMode={setRoomMode} onSignOut={handleSignOut} />
          <MyAuctions userId={userId} onAction={handleRejoin} />
          {roomMode && (
            <RoomFormModal mode={roomMode} onClose={() => setRoomMode(null)} onRoom={handleRoom} />
          )}
        </>
      )}

      <p className="mt-8 text-xs tracking-wider uppercase animate-slide-up"
        style={{ color: 'rgba(232,232,240,1)', animationDelay: '0.16s' }}>
        Max 10 teams · 100 Cr budget · 5 rounds
      </p>

      <p className="mt-3 text-xl tracking-widest uppercase"
        style={{
          fontFamily: 'var(--font-bebas)',
          color: 'rgba(232,232,240,1)',
          animation: 'fadeIn 1.6s ease forwards',
          animationDelay: '0.6s',
          opacity: 0,
        }}>
        Created by Mani
      </p>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.75; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes orbDrift1 {
          0%, 100% { transform: translate(0px,   0px)  scale(1);    }
          33%      { transform: translate(40px, -30px) scale(1.06); }
          66%      { transform: translate(-25px, 20px) scale(0.94); }
        }
        @keyframes orbDrift2 {
          0%, 100% { transform: translate(0px,   0px)   scale(1);    }
          33%      { transform: translate(-35px,  25px)  scale(1.04); }
          66%      { transform: translate(20px,  -20px)  scale(0.96); }
        }
        @keyframes linePulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1;   }
        }
      `}</style>
    </main>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Spinner({ label }: { label?: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      {label}
    </span>
  );
}

function InputField({
  label, value, onChange, placeholder, maxLength, mono, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; maxLength?: number; mono?: boolean; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold tracking-widest uppercase mb-1.5"
        style={{ color: 'rgba(232,232,240,0.45)' }}>
        {label}
      </label>
      <input
        type={type}
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
