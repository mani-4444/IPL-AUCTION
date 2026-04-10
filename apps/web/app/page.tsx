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

function RoomCard({
  userId,
  onRoom,
  onSignOut,
}: {
  userId: string;
  onRoom: (room: Room) => void;
  onSignOut: () => void;
}) {
  const [userName, setUserName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = initSocket(userId);
    if (!socket.connected) socket.connect();

    function handleRoom(room: Room) { onRoom(room); }
    function handleError(msg: string) { setError(msg); setLoading(false); }

    socket.on('room:updated', handleRoom);
    socket.on('error', handleError);
    return () => {
      socket.off('room:updated', handleRoom);
      socket.off('error', handleError);
    };
  }, [userId, onRoom]);

  async function handleCreate() {
    if (!userName.trim() || !teamName.trim()) {
      setError('Please enter your name and team name.');
      return;
    }
    setError('');
    setLoading(true);
    const socket = connectSocket();
    socket.emit('room:create', { userName: userName.trim(), teamName: teamName.trim() });
  }

  async function handleJoin() {
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
    <div className="glass-bright rounded-2xl p-8 w-full max-w-md orange-glow animate-slide-up"
      style={{ animationDelay: '0.08s' }}>

      {/* Mode switcher */}
      <div className="flex rounded-xl overflow-hidden mb-8 p-1"
        style={{ background: 'rgba(10,10,15,0.8)', border: '1px solid rgba(42,42,58,0.8)' }}>
        {(['create', 'join'] as const).map((m) => (
          <button key={m}
            onClick={() => { setMode(m); setError(''); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-widest uppercase transition-all duration-200"
            style={{
              background: mode === m ? '#FF6B00' : 'transparent',
              color: mode === m ? '#fff' : 'rgba(232,232,240,0.45)',
              cursor: 'pointer',
            }}
            aria-pressed={mode === m}>
            {m === 'create' ? '+ Create' : '→ Join'}
          </button>
        ))}
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
        aria-busy={loading}>
        {loading
          ? <Spinner label={mode === 'create' ? 'Creating...' : 'Joining...'} />
          : mode === 'create' ? 'Create Room' : 'Join Room'}
      </button>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className="mt-4 w-full py-2 rounded-xl text-xs tracking-widest uppercase transition-all duration-200"
        style={{
          background: 'transparent',
          color: 'rgba(232,232,240,0.25)',
          cursor: 'pointer',
          border: '1px solid rgba(42,42,58,0.5)',
        }}>
        Sign Out
      </button>
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B00, transparent)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.03] blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />

      {/* Logo */}
      <div className="mb-12 text-center animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, #FF6B00)' }} />
          <span className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#FF6B00' }}>IPL 2026</span>
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

      {/* Card area */}
      {pageState === 'checking' && (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      )}

      {pageState === 'landing' && (
        <div className="flex flex-col items-center gap-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <button
            onClick={() => setPageState('unauthenticated')}
            className="px-16 py-5 rounded-2xl text-2xl tracking-widest uppercase transition-all duration-200 active:scale-95"
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
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.25)' }}>
            Sign in or create an account to continue
          </p>
        </div>
      )}

      {pageState === 'unauthenticated' && (
        <AuthCard onAuth={handleAuth} />
      )}

      {pageState === 'authenticated' && userId && (
        <RoomCard userId={userId} onRoom={handleRoom} onSignOut={handleSignOut} />
      )}

      <p className="mt-8 text-xs tracking-wider uppercase animate-slide-up"
        style={{ color: 'rgba(232,232,240,0.2)', animationDelay: '0.16s' }}>
        Max 10 teams · 100 Cr budget · 5 rounds
      </p>
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
