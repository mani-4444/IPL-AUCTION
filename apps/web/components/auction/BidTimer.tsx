'use client';

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BidTimer({ seconds, total = 10 }: { seconds: number; total?: number }) {
  const progress = Math.max(0, seconds / total);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isUrgent = seconds <= 3;
  const color = isUrgent ? '#DC2626' : seconds <= 6 ? '#FF6B00' : '#22C55E';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      {/* Track */}
      <svg width="110" height="110" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r={RADIUS} fill="none" stroke="rgba(42,42,58,0.8)" strokeWidth="6" />
        <circle
          cx="55" cy="55" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease',
            filter: isUrgent ? `drop-shadow(0 0 8px ${color})` : `drop-shadow(0 0 4px ${color})`,
          }}
          className={isUrgent ? 'animate-timer-pulse' : ''}
        />
      </svg>
      {/* Number */}
      <span
        key={seconds}
        className="animate-flip relative z-10"
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '2.5rem',
          color,
          lineHeight: 1,
          textShadow: isUrgent ? `0 0 20px ${color}` : 'none',
        }}
      >
        {seconds}
      </span>
    </div>
  );
}
