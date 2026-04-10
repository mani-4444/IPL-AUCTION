'use client';
import type { AuctionRound } from '@/types';
import { ROUND_ROLES } from '@/types';

const ROUND_ICONS: Record<number, string> = { 1: '🏏', 2: '🧤', 3: '🎯', 4: '⚡', 5: '🔄' };

interface RoundIndicatorProps {
  currentRound: AuctionRound;
  roundCounts?: Record<number, { total: number; remaining: number }>;
}

export function RoundIndicator({ currentRound, roundCounts }: RoundIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {([1, 2, 3, 4, 5] as AuctionRound[]).map((round) => {
        const isDone = round < currentRound;
        const isCurrent = round === currentRound;
        const role = ROUND_ROLES[round];
        const counts = roundCounts?.[round];
        const remaining = counts?.remaining ?? null;
        const total = counts?.total ?? null;

        return (
          <div key={round} className="flex flex-col items-center gap-0.5 flex-1" title={`Round ${round}: ${role}`}>
            <div className="w-full h-1 rounded-full transition-all duration-300"
              style={{
                background: isDone ? '#22C55E' : isCurrent ? '#FF6B00' : 'rgba(42,42,58,0.8)',
              }} />
            <span className="text-xs" style={{
              color: isDone ? '#22C55E' : isCurrent ? '#FF6B00' : 'rgba(232,232,240,0.25)',
              fontWeight: isCurrent ? '700' : '400',
            }}>
              {ROUND_ICONS[round]}
            </span>
            {total !== null && total > 0 && (
              <span
                className="text-[9px] leading-none font-semibold"
                style={{
                  color: isDone
                    ? 'rgba(34,197,94,0.5)'
                    : isCurrent
                      ? remaining === 0 ? 'rgba(255,107,0,0.4)' : '#FF6B00'
                      : 'rgba(232,232,240,0.2)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {isDone ? '✓' : `${remaining}/${total}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
