'use client';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg shimmer ${className ?? ''}`}
      style={{ background: 'rgba(42,42,58,0.6)', ...style }}
      aria-hidden="true"
    />
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="glass-bright rounded-2xl overflow-hidden" aria-label="Loading player...">
      <div className="h-1 shimmer" style={{ background: 'rgba(42,42,58,0.8)' }} />
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton style={{ height: 20, width: 60 }} />
            <Skeleton style={{ height: 28, width: '70%' }} />
            <Skeleton style={{ height: 16, width: '45%' }} />
          </div>
          <Skeleton style={{ width: 64, height: 64, borderRadius: 12 }} />
        </div>
        <div className="space-y-2">
          <Skeleton style={{ height: 48, width: '40%' }} />
          <Skeleton style={{ height: 4, borderRadius: 4 }} />
        </div>
        <div className="flex justify-between pt-4" style={{ borderTop: '1px solid rgba(42,42,58,0.4)' }}>
          <Skeleton style={{ height: 14, width: 60 }} />
          <Skeleton style={{ height: 14, width: 80 }} />
        </div>
      </div>
    </div>
  );
}
