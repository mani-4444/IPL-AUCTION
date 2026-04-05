'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { useTeamStore } from '@/store/teamStore';
import { useReconnect } from '@/hooks/useReconnect';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { Room, TeamPlayer } from '@/types';

export default function TeamSetupPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const {
    playingXI, captain, viceCaptain, submittedTeamIds,
    togglePlayerInXI, setCaptain, setViceCaptain, markTeamSubmitted, setPlayingXI, setBench,
  } = useTeamStore();

  useReconnect();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const myTeam = room?.teams.find((t) => t.userId === myUserId);
  const myPlayers: TeamPlayer[] = (myTeam?.players ?? []) as TeamPlayer[];

  // Validation
  const hasWK = playingXI.some((id) => myPlayers.find((p) => p.id === id)?.role === 'Wicketkeeper');
  const bowlingCount = playingXI.filter((id) => {
    const r = myPlayers.find((p) => p.id === id)?.role;
    return r === 'Bowler' || r === 'All-Rounder';
  }).length;
  const overseasInXI = playingXI.filter((id) => myPlayers.find((p) => p.id === id)?.nationality === 'Overseas').length;

  useEffect(() => {
    const socket = connectSocket();
    socket.on('room:updated', (r: Room) => {
      setRoom(r);
      if (r.status === 'results') router.push(`/results/${r.id}`);
    });
    socket.on('team:xi-submitted', (teamId: string) => markTeamSubmitted(teamId));

    return () => {
      socket.off('room:updated');
      socket.off('team:xi-submitted');
    };
  }, [router, setRoom, markTeamSubmitted]);

  // Auto-populate XI with best-rated players
  useEffect(() => {
    if (myPlayers.length > 0 && playingXI.length === 0) {
      const sorted = [...myPlayers].sort((a, b) => b.rating - a.rating);
      const xi = sorted.slice(0, Math.min(11, sorted.length)).map((p) => p.id);
      const bench = sorted.slice(11).map((p) => p.id);
      setPlayingXI(xi);
      setBench(bench);
      if (xi.length > 0) setCaptain(xi[0]);
      if (xi.length > 1) setViceCaptain(xi[1]);
    }
  }, [myPlayers.length]);

  function handleSubmit() {
    if (playingXI.length !== 11) { setError('Select exactly 11 players for your Playing XI.'); return; }
    if (!captain) { setError('Select a captain.'); return; }
    if (!viceCaptain) { setError('Select a vice-captain.'); return; }
    if (captain === viceCaptain) { setError('Captain and vice-captain must be different.'); return; }
    setError('');
    connectSocket().emit('team:submit-xi', { playingXI, captain, viceCaptain });
    setSubmitted(true);
  }

  if (!room || !myTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse" style={{ fontFamily: 'var(--font-bebas)', fontSize: '2rem', color: '#FF6B00' }}>
          Loading...
        </p>
      </div>
    );
  }

  const submittedCount = submittedTeamIds.length;
  const totalTeams = room.teams.length;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-slide-up">
          <div className="text-8xl mb-4" style={{ fontFamily: 'var(--font-bebas)', color: '#22C55E' }}>✓ DONE</div>
          <p className="text-xl font-semibold mb-2" style={{ color: '#E8E8F0' }}>Team submitted!</p>
          <div className="glass-bright rounded-xl px-6 py-4 mt-6">
            <p className="text-sm mb-3" style={{ color: 'rgba(232,232,240,0.5)' }}>
              Waiting for other teams...
            </p>
            <div className="flex gap-2 justify-center">
              {room.teams.map((t) => (
                <div key={t.id} className="w-3 h-3 rounded-full transition-all duration-300"
                  style={{ background: submittedTeamIds.includes(t.id) || t.id === myTeam.id ? '#22C55E' : 'rgba(42,42,58,0.8)' }} />
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'rgba(232,232,240,0.3)' }}>
              {submittedCount + 1}/{totalTeams} teams submitted
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 animate-slide-up">
        <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: '#FF6B00' }}>Auction Complete</p>
        <h1 className="text-5xl leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0' }}>
          BUILD YOUR XI
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(232,232,240,0.45)' }}>
          {myTeam.players.length} players · ₹{myTeam.budgetRemaining.toFixed(2)} Cr remaining
        </p>
      </div>

      {/* Validation Hints */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {[
          { label: 'Wicketkeeper', ok: hasWK, warn: !hasWK },
          { label: `Bowling (${bowlingCount}/5)`, ok: bowlingCount >= 5, warn: bowlingCount < 5 },
          { label: `Overseas (${overseasInXI}/4)`, ok: overseasInXI <= 4, warn: overseasInXI > 4 },
        ].map(({ label, ok, warn }) => (
          <div key={label} className="px-3 py-2 rounded-lg text-center text-xs font-semibold"
            style={{
              background: ok ? 'rgba(22,163,74,0.12)' : warn ? 'rgba(220,38,38,0.12)' : 'rgba(42,42,58,0.4)',
              border: `1px solid ${ok ? 'rgba(22,163,74,0.3)' : warn ? 'rgba(220,38,38,0.3)' : 'rgba(42,42,58,0.6)'}`,
              color: ok ? '#4ADE80' : warn ? '#F87171' : 'rgba(232,232,240,0.4)',
            }}>
            {ok ? '✓' : (warn ? '✗' : '–')} {label}
          </div>
        ))}
      </div>

      {/* XI Count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'rgba(232,232,240,0.6)' }}>
          Playing XI: <span style={{ color: playingXI.length === 11 ? '#22C55E' : '#FF6B00' }}>
            {playingXI.length}/11
          </span>
        </p>
        <p className="text-xs" style={{ color: 'rgba(232,232,240,0.35)' }}>
          Click to add/remove • C/VC badge to set role
        </p>
      </div>

      {/* Player Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {myPlayers.map((player) => {
          const inXI = playingXI.includes(player.id);
          const isC = captain === player.id;
          const isVC = viceCaptain === player.id;

          return (
            <div key={player.id}
              className="relative px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 card-hover"
              style={{
                background: inXI ? 'rgba(255,107,0,0.1)' : 'rgba(10,10,15,0.7)',
                border: `1px solid ${inXI ? 'rgba(255,107,0,0.35)' : 'rgba(42,42,58,0.6)'}`,
                opacity: !inXI && playingXI.length >= 11 ? 0.4 : 1,
              }}
              onClick={() => togglePlayerInXI(player, myPlayers)}
              role="button"
              aria-label={`${inXI ? 'Remove' : 'Add'} ${player.name} to Playing XI`}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && togglePlayerInXI(player, myPlayers)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200`}
                    style={{
                      background: inXI ? '#FF6B00' : 'rgba(42,42,58,0.6)',
                      border: `1px solid ${inXI ? '#FF6B00' : 'rgba(42,42,58,0.8)'}`,
                    }}>
                    {inXI && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#E8E8F0' }}>{player.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RoleBadge role={player.role} size="xs" />
                      <span className="text-xs" style={{ color: 'rgba(232,232,240,0.4)' }}>
                        {player.rating}★
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(232,232,240,0.3)', fontFamily: 'var(--font-mono)' }}>
                        ₹{player.soldPrice}
                      </span>
                    </div>
                  </div>
                </div>

                {/* C/VC Buttons */}
                {inXI && (
                  <div className="flex gap-1 ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => isC ? setCaptain(null) : setCaptain(player.id)}
                      className="w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150"
                      style={{
                        background: isC ? '#FFD700' : 'rgba(255,215,0,0.12)',
                        color: isC ? '#000' : '#FFD700',
                        border: `1px solid ${isC ? '#FFD700' : 'rgba(255,215,0,0.25)'}`,
                        cursor: 'pointer',
                      }}
                      aria-label={`Set ${player.name} as captain`}
                      title="Captain"
                    >C</button>
                    <button
                      onClick={() => isVC ? setViceCaptain(null) : setViceCaptain(player.id)}
                      className="w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150"
                      style={{
                        background: isVC ? '#C0C0C0' : 'rgba(192,192,192,0.12)',
                        color: isVC ? '#000' : '#9CA3AF',
                        border: `1px solid ${isVC ? '#C0C0C0' : 'rgba(192,192,192,0.2)'}`,
                        cursor: 'pointer',
                      }}
                      aria-label={`Set ${player.name} as vice-captain`}
                      title="Vice Captain"
                    >V</button>
                  </div>
                )}
              </div>

              {/* C/VC badge overlay */}
              {(isC || isVC) && (
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: isC ? '#FFD700' : '#9CA3AF',
                      color: '#000',
                    }}>
                    {isC ? 'C' : 'VC'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171' }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={playingXI.length !== 11}
        className="w-full py-4 rounded-xl text-xl tracking-widest uppercase transition-all duration-200"
        style={{
          fontFamily: 'var(--font-bebas)',
          background: playingXI.length === 11
            ? 'linear-gradient(135deg, #FF6B00, #FF8C33)'
            : 'rgba(255,107,0,0.2)',
          color: playingXI.length === 11 ? '#fff' : 'rgba(255,255,255,0.3)',
          cursor: playingXI.length === 11 ? 'pointer' : 'not-allowed',
          boxShadow: playingXI.length === 11 ? '0 4px 24px rgba(255,107,0,0.4)' : 'none',
        }}
      >
        Submit My XI ({playingXI.length}/11)
      </button>
    </main>
  );
}
