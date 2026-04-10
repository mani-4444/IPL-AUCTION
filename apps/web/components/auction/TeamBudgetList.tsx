'use client';
import { useState } from 'react';
import type { Team, TeamPlayer } from '@/types';

const ROLES = ['Batsman', 'Wicketkeeper', 'Bowler', 'All-Rounder'] as const;
const ROLE_ABBR: Record<string, string> = {
  Batsman: 'BAT',
  Wicketkeeper: 'WK',
  Bowler: 'BOWL',
  'All-Rounder': 'AR',
};
const ROLE_COLOR: Record<string, string> = {
  Batsman: '#3B82F6',
  Wicketkeeper: '#A855F7',
  Bowler: '#22C55E',
  'All-Rounder': '#F97316',
};

function budgetColor(remaining: number) {
  const pct = remaining / 100;
  if (pct > 0.5) return '#22C55E';
  if (pct > 0.25) return '#F97316';
  return '#DC2626';
}

function RoleGroup({ role, players }: { role: string; players: TeamPlayer[] }) {
  if (players.length === 0) return null;
  const color = ROLE_COLOR[role];
  const abbr = ROLE_ABBR[role];

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: `${color}22`, color, border: `1px solid ${color}44`, letterSpacing: '0.08em' }}
        >
          {abbr}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(232,232,240,0.3)' }}>
          {players.length}
        </span>
      </div>
      <div className="space-y-0.5 pl-1">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="text-[11px] truncate"
                style={{ color: p.nationality === 'Overseas' ? '#38BDF8' : 'rgba(232,232,240,0.75)', maxWidth: '120px' }}
              >
                {p.name}
              </span>
              {p.nationality === 'Overseas' && (
                <span
                  className="text-[8px] font-bold flex-shrink-0 px-1 py-0.5 rounded"
                  style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}
                >
                  OS
                </span>
              )}
            </div>
            <span
              className="text-[10px] flex-shrink-0"
              style={{ color: 'rgba(232,232,240,0.35)', fontFamily: 'var(--font-mono)' }}
            >
              ₹{p.soldPrice.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamCard({ team, isMe, defaultOpen }: { team: Team; isMe: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = budgetColor(team.budgetRemaining);
  const pct = (team.budgetRemaining / 100) * 100;

  const byRole: Record<string, TeamPlayer[]> = { Batsman: [], Wicketkeeper: [], Bowler: [], 'All-Rounder': [] };
  for (const p of team.players) {
    byRole[p.role]?.push(p);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: isMe ? 'rgba(255,107,0,0.07)' : 'rgba(10,10,15,0.6)',
        border: `1px solid ${isMe ? 'rgba(255,107,0,0.25)' : 'rgba(42,42,58,0.5)'}`,
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 text-left"
        style={{ cursor: 'pointer', background: 'transparent' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isMe ? '#FF8C33' : '#E8E8F0' }}
            >
              {team.teamName}
            </span>
            {isMe && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                style={{ background: 'rgba(255,107,0,0.2)', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.3)' }}
              >
                YOU
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs font-bold"
              style={{ color, fontFamily: 'var(--font-mono)' }}
            >
              ₹{team.budgetRemaining.toFixed(1)}
            </span>
            <span style={{ color: 'rgba(232,232,240,0.3)', fontSize: '0.65rem' }}>
              {open ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Budget bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(42,42,58,0.8)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        {/* Players bought + role summary */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            {ROLES.map((role) => {
              const count = byRole[role].length;
              if (count === 0) return null;
              return (
                <span key={role} className="text-[9px] font-semibold" style={{ color: ROLE_COLOR[role] }}>
                  {ROLE_ABBR[role]} {count}
                </span>
              );
            })}
            {team.players.length === 0 && (
              <span className="text-[10px]" style={{ color: 'rgba(232,232,240,0.25)' }}>No players yet</span>
            )}
          </div>
          <span
            className="text-[10px] font-semibold flex-shrink-0"
            style={{ color: team.players.length >= 15 ? '#4ADE80' : 'rgba(232,232,240,0.4)', fontFamily: 'var(--font-mono)' }}
          >
            {team.players.length}/15
          </span>
        </div>
      </button>

      {/* Expanded squad */}
      {open && team.players.length > 0 && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: '1px solid rgba(42,42,58,0.5)' }}
        >
          <div className="pt-2.5">
            {ROLES.map((role) => (
              <RoleGroup key={role} role={role} players={byRole[role]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamBudgetList({ teams, myUserId }: { teams: Team[]; myUserId: string | null }) {
  const sorted = [...teams].sort((a, b) => {
    // My team first, then by budget descending
    if (a.userId === myUserId) return -1;
    if (b.userId === myUserId) return 1;
    return b.budgetRemaining - a.budgetRemaining;
  });

  return (
    <div className="space-y-2">
      {sorted.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          isMe={team.userId === myUserId}
          defaultOpen={team.userId === myUserId}
        />
      ))}
    </div>
  );
}
