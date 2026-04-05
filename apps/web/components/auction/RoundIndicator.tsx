'use client';
import type { AuctionRound } from '@/types';
import { ROUND_ROLES } from '@/types';

const ROUND_ICONS: Record<number, string> = { 1: '🏏', 2: '🧤', 3: '🎯', 4: '⚡', 5: '🔄' };

export function RoundIndicator({ currentRound }: { currentRound: AuctionRound }) {
  return (
    <div className="flex items-center gap-2">
      {([1, 2, 3, 4, 5] as AuctionRound[]).map((round) => {
        const isDone = round < currentRound;
        const isCurrent = round === currentRound;
        const role = ROUND_ROLES[round];

        return (
          <div key={round} className="flex flex-col items-center gap-1 flex-1" title={`Round ${round}: ${role}`}>
            <div className="w-full h-1 rounded-full transition-all duration-300"
              style={{
                background: isDone
                  ? '#22C55E'
                  : isCurrent
                    ? '#FF6B00'
                    : 'rgba(42,42,58,0.8)',
              }} />
            <span className="text-xs" style={{
              color: isDone ? '#22C55E' : isCurrent ? '#FF6B00' : 'rgba(232,232,240,0.25)',
              fontWeight: isCurrent ? '700' : '400',
            }}>
              {ROUND_ICONS[round]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
