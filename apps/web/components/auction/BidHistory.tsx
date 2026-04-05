'use client';
import type { Bid } from '@/types';

export function BidHistory({ bids, myTeamId }: { bids: Bid[]; myTeamId: string }) {
  if (bids.length === 0) {
    return (
      <div className="text-center py-6" style={{ color: 'rgba(232,232,240,0.25)' }}>
        <p className="text-sm">No bids yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {bids.slice(0, 8).map((bid, i) => (
        <div
          key={bid.timestamp}
          className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200"
          style={{
            background: bid.teamId === myTeamId
              ? 'rgba(255,107,0,0.1)'
              : 'rgba(10,10,15,0.6)',
            border: `1px solid ${bid.teamId === myTeamId ? 'rgba(255,107,0,0.25)' : 'rgba(42,42,58,0.5)'}`,
            opacity: 1 - i * 0.08,
          }}
        >
          <span className="text-sm font-semibold truncate max-w-[60%]"
            style={{ color: bid.teamId === myTeamId ? '#FF8C33' : '#E8E8F0' }}>
            {bid.teamId === myTeamId ? '▶ You' : bid.teamName}
          </span>
          <span className="text-sm font-bold flex-shrink-0"
            style={{ fontFamily: 'var(--font-mono)', color: i === 0 ? '#FFD700' : 'rgba(232,232,240,0.5)' }}>
            ₹{bid.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
