'use client';
import type { Player } from '@/types';
import { RoleBadge } from '@/components/ui/RoleBadge';

const ROLE_COLORS: Record<string, string> = {
  'Batsman':      '#3B82F6',
  'Wicketkeeper': '#8B5CF6',
  'Bowler':       '#F97316',
  'All-Rounder':  '#22C55E',
};

interface PlayerCardProps {
  player: Player;
  compact?: boolean; // mobile inline variant
}

export function PlayerCard({ player, compact = false }: PlayerCardProps) {
  const color = ROLE_COLORS[player.role] ?? '#FF6B00';

  if (compact) {
    return (
      <div
        className="rounded-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'rgba(14,14,20,0.95)',
          border: `1px solid ${color}30`,
          boxShadow: `0 0 20px ${color}10`,
        }}
      >
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Role icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}28` }}
          >
            🏏
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <RoleBadge role={player.role} size="sm" />
              {player.nationality === 'Overseas' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}>
                  OS
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight truncate" style={{ color: '#E8E8F0' }}>
              {player.name}
            </h2>
            <p className="text-xs truncate" style={{ color: 'rgba(232,232,240,0.4)' }}>
              {player.team}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.35)' }}>Base</p>
            <p className="font-bold text-base" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
              ₹{player.basePrice}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: `linear-gradient(135deg, rgba(18,18,26,0.95), rgba(10,10,15,0.98))`,
        border: `1px solid ${color}33`,
        boxShadow: `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`,
      }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="p-6">
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
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 animate-float"
            style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            🏏
          </div>
        </div>
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
