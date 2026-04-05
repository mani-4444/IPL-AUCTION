'use client';
import type { Player } from '@/types';
import { RoleBadge } from '@/components/ui/RoleBadge';

const ROLE_COLORS: Record<string, string> = {
  'Batsman':      '#3B82F6',
  'Wicketkeeper': '#8B5CF6',
  'Bowler':       '#F97316',
  'All-Rounder':  '#22C55E',
};

function RatingBar({ rating }: { rating: number }) {
  const segments = 10;
  const filled = Math.round(rating / 10);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{ background: i < filled ? '#FFD700' : 'rgba(42,42,58,0.8)' }} />
      ))}
    </div>
  );
}

export function PlayerCard({ player }: { player: Player }) {
  const color = ROLE_COLORS[player.role] ?? '#FF6B00';

  return (
    <div className="relative rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: `linear-gradient(135deg, rgba(18,18,26,0.95), rgba(10,10,15,0.98))`,
        border: `1px solid ${color}33`,
        boxShadow: `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`,
      }}>
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <RoleBadge role={player.role} size="sm" />
            <h2 className="mt-2 text-2xl font-bold leading-tight" style={{ color: '#E8E8F0' }}>
              {player.name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(232,232,240,0.45)' }}>
              {player.team} · {player.nationality}
            </p>
          </div>
          {/* Avatar silhouette */}
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 animate-float"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}30`,
            }}>
            🏏
          </div>
        </div>

        {/* Rating */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#FFD700' }}>
              {player.rating}
            </span>
            <span className="text-sm" style={{ color: 'rgba(232,232,240,0.4)' }}>/100</span>
          </div>
          <RatingBar rating={player.rating} />
        </div>

        {/* Base Price */}
        <div className="flex items-center justify-between pt-4"
          style={{ borderTop: '1px solid rgba(42,42,58,0.6)' }}>
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.4)' }}>
            Base Price
          </span>
          <span className="font-bold" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
            ₹{player.basePrice} Cr
          </span>
        </div>
      </div>
    </div>
  );
}
