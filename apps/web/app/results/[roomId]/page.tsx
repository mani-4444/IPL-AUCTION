'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { useReconnect } from '@/hooks/useReconnect';
import { clearSession } from '@/lib/session';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { Team, Room } from '@/types';

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];


function TeamScoreCard({ team, rank, isMe }: { team: Team; rank: number; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const score = team.finalScore;
  if (!score) return null;

  const medal = MEDALS[rank] ?? `#${rank + 1}`;
  const podiumColor = PODIUM_COLORS[rank] ?? '#6B7280';

  return (
    <div className="glass-bright rounded-2xl overflow-hidden transition-all duration-200 animate-slide-up"
      style={{
        border: `1px solid ${isMe ? 'rgba(255,107,0,0.35)' : rank === 0 ? 'rgba(255,215,0,0.25)' : 'rgba(42,42,58,0.6)'}`,
        boxShadow: isMe ? '0 0 20px rgba(255,107,0,0.1)' : rank === 0 ? '0 0 30px rgba(255,215,0,0.08)' : 'none',
        animationDelay: `${rank * 0.08}s`,
      }}>
      {/* Rank bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${podiumColor}, transparent)` }} />

      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">{medal}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base" style={{ color: '#E8E8F0' }}>{team.teamName}</h3>
                {isMe && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: 'rgba(255,107,0,0.2)', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.3)' }}>
                    YOU
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'rgba(232,232,240,0.4)' }}>{team.userName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="leading-none" style={{ fontFamily: 'var(--font-bebas)', fontSize: '2rem', color: podiumColor }}>
              {score.total.toFixed(1)}
            </div>
            <p className="text-[10px] tracking-wider uppercase" style={{ color: 'rgba(232,232,240,0.35)' }}>pts</p>
          </div>
        </div>

        {/* Score breakdown chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Playing XI', value: score.xiScore, color: '#3B82F6' },
            { label: 'Bench', value: score.benchScore, color: '#8B5CF6' },
            { label: 'ROI', value: score.roi, color: '#22C55E' },
            { label: 'Bonus', value: score.roleBonus, color: '#FFD700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
              <span className="text-[10px] tracking-wider uppercase" style={{ color: `${color}99` }}>{label}</span>
              <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>
                {value.toFixed(1)} pts
              </span>
            </div>
          ))}
          {score.penalties < 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <span className="text-[10px] tracking-wider uppercase" style={{ color: 'rgba(248,113,113,0.7)' }}>Penalty</span>
              <span className="text-xs font-bold" style={{ color: '#F87171', fontFamily: 'var(--font-mono)' }}>
                {score.penalties} pts
              </span>
            </div>
          )}
        </div>

        {/* Expand for details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 w-full text-xs py-1.5 rounded-lg transition-all duration-200"
          style={{
            background: 'rgba(42,42,58,0.4)',
            color: 'rgba(232,232,240,0.4)',
            border: '1px solid rgba(42,42,58,0.6)',
            cursor: 'pointer',
          }}>
          {expanded ? '▲ Less' : '▼ Squad Details'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-1.5 animate-slide-up">
            {[...team.players]
              .sort((a, b) => {
                const aXI = team.playingXI.includes(a.id) ? 0 : 1;
                const bXI = team.playingXI.includes(b.id) ? 0 : 1;
                return aXI - bXI;
              })
              .map((player) => {
                const inXI = team.playingXI.includes(player.id);
                const isC = team.captain === player.id;
                const isVC = team.viceCaptain === player.id;
                return (
                  <div key={player.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: inXI ? 'rgba(255,107,0,0.07)' : 'rgba(10,10,15,0.4)',
                      border: `1px solid ${inXI ? 'rgba(255,107,0,0.15)' : 'rgba(42,42,58,0.4)'}`,
                    }}>
                    <RoleBadge role={player.role} size="xs" />
                    <span className="flex-1 font-medium truncate" style={{ color: inXI ? '#E8E8F0' : 'rgba(232,232,240,0.45)' }}>
                      {player.name}
                    </span>
                    {isC && <span className="text-[10px] font-bold px-1 rounded" style={{ background: '#FFD700', color: '#000' }}>C</span>}
                    {isVC && <span className="text-[10px] font-bold px-1 rounded" style={{ background: '#9CA3AF', color: '#000' }}>V</span>}
                    <span style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
                      ₹{player.soldPrice}
                    </span>
                    {!inXI && <span className="text-[10px]" style={{ color: 'rgba(232,232,240,0.25)' }}>BENCH</span>}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const [results, setResults] = useState<Team[]>([]);
  useReconnect();

  useEffect(() => {
    const socket = connectSocket();
    socket.on('room:updated', (r: Room) => setRoom(r));
    socket.on('results:ready', (teams: Team[]) => setResults(teams));

    // If we already have results
    if (room?.status === 'results' && room.teams.some((t) => t.finalScore)) {
      const sorted = [...room.teams].sort((a, b) => (b.finalScore?.total ?? 0) - (a.finalScore?.total ?? 0));
      setResults(sorted);
    }

    return () => {
      socket.off('room:updated');
      socket.off('results:ready');
    };
  }, [room, setRoom]);

  if (results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse" style={{ fontFamily: 'var(--font-bebas)', fontSize: '2rem', color: '#FF6B00' }}>
          Calculating scores...
        </p>
      </div>
    );
  }

  const winner = results[0];

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="text-7xl mb-3 animate-float">🏆</div>
        <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(3rem, 10vw, 5rem)', color: '#FFD700',
          textShadow: '0 0 40px rgba(255,215,0,0.4)' }}>
          {winner.teamName}
        </h1>
        <p className="text-lg font-semibold" style={{ color: 'rgba(232,232,240,0.6)' }}>
          wins with {winner.finalScore?.total.toFixed(1)} points!
        </p>
      </div>

      {/* Leaderboard */}
      <div className="space-y-4 mb-10">
        {results.map((team, i) => (
          <TeamScoreCard key={team.id} team={team} rank={i} isMe={team.userId === myUserId} />
        ))}
      </div>

      {/* Play Again */}
      <button
        onClick={() => { clearSession(); router.push('/'); }}
        className="w-full py-4 rounded-xl text-xl tracking-widest uppercase transition-all duration-200"
        style={{
          fontFamily: 'var(--font-bebas)',
          background: 'linear-gradient(135deg, #FF6B00, #FF8C33)',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(255,107,0,0.4)',
        }}>
        Play Again
      </button>
    </main>
  );
}
