'use client';
import { useRef, useState } from 'react';
import type { Bid, Player } from '@/types';

const BID_INCREMENTS = [
  { label: '+25L', cr: 0.25 },
  { label: '+50L', cr: 0.5 },
  { label: '+1Cr', cr: 1.0 },
] as const;

interface MobileBidBarProps {
  player: Player | null;
  currentBid: Bid | null;
  myBudget: number;
  myTeamId: string;
  myPlayerCount: number;
  squadSize: number;
  timerSeconds: number;
  isPaused: boolean;
  biddingStarted: boolean;
  isHighestBidder: boolean;
  squadFull: boolean;
  canSkip: boolean;
  canWithdraw: boolean;
  hasWithdrawn: boolean;
  skipVotes: number;
  totalTeams: number;
  withdrawVotes: number;
  withdrawEligible: number;
  isPlayerClosed: boolean;
  onBid: (amount: number) => void;
  onSkip: () => void;
  onWithdraw: () => void;
}

export function MobileBidBar({
  player,
  currentBid,
  myBudget,
  myTeamId,
  myPlayerCount,
  squadSize,
  timerSeconds,
  isPaused,
  biddingStarted,
  isHighestBidder,
  squadFull,
  canSkip,
  canWithdraw,
  hasWithdrawn,
  skipVotes,
  totalTeams,
  withdrawVotes,
  withdrawEligible,
  isPlayerClosed,
  onBid,
  onSkip,
  onWithdraw,
}: MobileBidBarProps) {
  const [lastBidding, setLastBidding] = useState<number | null>(null);
  const lastBidRef = useRef<number | null>(null);

  if (!player) return null;

  const floor = currentBid ? currentBid.amount : player.basePrice;
  const timerActive = timerSeconds > 0 && !isPaused && !isPlayerClosed;

  function handleBid(cr: number) {
    const amount = +(floor + cr).toFixed(2);
    if (lastBidRef.current === amount) return;
    lastBidRef.current = amount;
    setLastBidding(amount);
    onBid(amount);
    setTimeout(() => { lastBidRef.current = null; setLastBidding(null); }, 800);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]"
      style={{ background: 'rgba(8,8,12,0.97)', borderTop: '1px solid rgba(42,42,58,0.8)', backdropFilter: 'blur(20px)' }}
    >
      {/* Squad full */}
      {squadFull && (
        <div className="py-3 rounded-xl text-center text-sm font-semibold"
          style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)', color: '#4ADE80' }}>
          Squad full ({squadSize}/{squadSize}) · Watching
        </div>
      )}

      {/* Paused */}
      {!squadFull && isPaused && (
        <div className="py-3 rounded-xl text-center text-sm font-semibold tracking-widest uppercase"
          style={{ background: 'rgba(42,42,58,0.5)', color: 'rgba(232,232,240,0.3)' }}>
          Auction Paused
        </div>
      )}

      {/* Active bid area */}
      {!squadFull && !isPaused && (
        <>
          {/* Bid increment buttons */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {BID_INCREMENTS.map(({ label, cr }) => {
              const amount = +(floor + cr).toFixed(2);
              const canAfford = myBudget >= amount;
              const active = timerActive && canAfford && !isHighestBidder;
              const isSubmitting = lastBidding === amount;

              return (
                <button
                  key={label}
                  onPointerDown={() => active && !isSubmitting && handleBid(cr)}
                  disabled={!active || isSubmitting}
                  aria-label={`Bid ₹${amount} Cr`}
                  className="flex flex-col items-center justify-center rounded-xl transition-all duration-100 active:scale-95"
                  style={{
                    height: 56,
                    background: active
                      ? isSubmitting ? 'rgba(255,107,0,0.6)' : 'linear-gradient(135deg, #FF6B00, #FF8C33)'
                      : 'rgba(255,107,0,0.06)',
                    border: `1px solid ${active ? 'rgba(255,107,0,0.7)' : 'rgba(42,42,58,0.6)'}`,
                    cursor: active ? 'pointer' : 'not-allowed',
                    boxShadow: active ? '0 4px 20px rgba(255,107,0,0.4)' : 'none',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '1.25rem', color: active ? '#fff' : 'rgba(232,232,240,0.2)', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: active ? 'rgba(255,255,255,0.7)' : 'rgba(232,232,240,0.15)', lineHeight: 1.2 }}>
                    ₹{amount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Skip (pre-bid) / Withdraw (post-bid) */}
          {!biddingStarted && (
            <div>
              <button
                onPointerDown={() => canSkip && onSkip()}
                disabled={!canSkip}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-100 active:scale-95"
                style={{
                  background: canSkip ? 'rgba(220,38,38,0.12)' : 'rgba(42,42,58,0.3)',
                  border: `1px solid ${canSkip ? 'rgba(220,38,38,0.35)' : 'rgba(42,42,58,0.4)'}`,
                  color: canSkip ? '#F87171' : 'rgba(232,232,240,0.2)',
                  cursor: canSkip ? 'pointer' : 'not-allowed',
                }}
              >
                Skip Player {skipVotes > 0 ? `(${skipVotes}/${totalTeams})` : ''}
              </button>
            </div>
          )}

          {biddingStarted && !isHighestBidder && (
            <div>
              <button
                onPointerDown={() => canWithdraw && onWithdraw()}
                disabled={!canWithdraw}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-100 active:scale-95"
                style={{
                  background: hasWithdrawn ? 'rgba(42,42,58,0.3)' : 'rgba(220,38,38,0.12)',
                  border: `1px solid ${hasWithdrawn ? 'rgba(42,42,58,0.4)' : 'rgba(220,38,38,0.35)'}`,
                  color: hasWithdrawn ? 'rgba(232,232,240,0.2)' : '#F87171',
                  cursor: canWithdraw ? 'pointer' : 'not-allowed',
                }}
              >
                {hasWithdrawn ? `Withdrawn (${withdrawVotes}/${withdrawEligible})` : 'Withdraw'}
              </button>
            </div>
          )}

          {biddingStarted && isHighestBidder && timerActive && (
            <div className="py-2 text-center text-sm font-semibold" style={{ color: '#4ADE80' }}>
              You're leading — hold on!
            </div>
          )}
        </>
      )}

      {/* Budget + squad footer */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[11px]" style={{ color: 'rgba(232,232,240,0.3)' }}>
          Squad <span style={{ color: 'rgba(232,232,240,0.5)', fontFamily: 'var(--font-mono)' }}>{myPlayerCount}/{squadSize}</span>
        </span>
        <span className="text-[11px]" style={{ color: 'rgba(232,232,240,0.3)' }}>
          Budget <span style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>₹{myBudget.toFixed(1)} Cr</span>
        </span>
      </div>
    </div>
  );
}
