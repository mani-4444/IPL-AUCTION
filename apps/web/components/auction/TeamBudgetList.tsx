'use client';
import type { Team } from '@/types';

function budgetColor(remaining: number, total = 100) {
  const pct = remaining / total;
  if (pct > 0.5) return '#22C55E';
  if (pct > 0.25) return '#F97316';
  return '#DC2626';
}

export function TeamBudgetList({ teams, myUserId }: { teams: Team[]; myUserId: string | null }) {
  const sorted = [...teams].sort((a, b) => b.budgetRemaining - a.budgetRemaining);

  return (
    <div className="space-y-2">
      {sorted.map((team) => {
        const color = budgetColor(team.budgetRemaining);
        const pct = (team.budgetRemaining / 100) * 100;
        const isMe = team.userId === myUserId;

        return (
          <div key={team.id} className="px-3 py-2.5 rounded-xl"
            style={{
              background: isMe ? 'rgba(255,107,0,0.08)' : 'rgba(10,10,15,0.6)',
              border: `1px solid ${isMe ? 'rgba(255,107,0,0.2)' : 'rgba(42,42,58,0.5)'}`,
            }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate"
                  style={{ color: isMe ? '#FF8C33' : '#E8E8F0' }}>
                  {team.teamName}
                </span>
                {isMe && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,107,0,0.2)', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.3)' }}>
                    YOU
                  </span>
                )}
              </div>
              <span className="text-xs font-bold flex-shrink-0 ml-2"
                style={{ color, fontFamily: 'var(--font-mono)' }}>
                ₹{team.budgetRemaining.toFixed(1)}
              </span>
            </div>
            {/* Budget Bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(42,42,58,0.8)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'rgba(232,232,240,0.3)' }}>
                {team.players.length}/15 players
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
