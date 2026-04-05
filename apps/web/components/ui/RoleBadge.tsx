'use client';
import type { PlayerRole } from '@/types';

const ROLE_CONFIG: Record<PlayerRole, { label: string; className: string }> = {
  'Batsman':      { label: 'BAT',  className: 'role-batsman' },
  'Wicketkeeper': { label: 'WK',   className: 'role-keeper' },
  'Bowler':       { label: 'BOWL', className: 'role-bowler' },
  'All-Rounder':  { label: 'AR',   className: 'role-allrounder' },
};

export function RoleBadge({ role, size = 'sm' }: { role: PlayerRole; size?: 'xs' | 'sm' | 'md' }) {
  const config = ROLE_CONFIG[role];
  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`${sizeClass} ${config.className} rounded border font-bold tracking-wider`}>
      {config.label}
    </span>
  );
}
