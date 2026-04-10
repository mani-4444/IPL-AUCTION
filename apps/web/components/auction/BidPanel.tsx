'use client';
import { useRef, useEffect, useState } from 'react';
import type { Bid, Player } from '@/types';
import { BidTimer } from './BidTimer';

const BID_INCREMENTS = [
  { label: '+25L', cr: 0.25 },
  { label: '+50L', cr: 0.5 },
  { label: '+1Cr', cr: 1.0 },
] as const;

interface BidPanelProps {
  player: Player;
  currentBid: Bid | null;
  timerSeconds: number;
  myBudget: number;
  myTeamId: string;
  isPaused: boolean;
  biddingStarted: boolean;
  skipVotes: number;
  totalTeams: number;
  withdrawVotes: number;
  withdrawEligible: number;
  squadFull: boolean;
  squadSize: number;
  hasWithdrawn: boolean;
  isHighestBidder: boolean;
  canSkip: boolean;
  canWithdraw: boolean;
  onBid: (amount: number) => void;
  onSkip: () => void;
  onWithdraw: () => void;
}

export function BidPanel({
  player,
  currentBid,
  timerSeconds,
  myBudget,
  myTeamId,
  isPaused,
  squadFull,
  squadSize,
  biddingStarted,
  skipVotes,
  totalTeams,
  withdrawVotes,
  withdrawEligible,
  hasWithdrawn,
  isHighestBidder,
  canSkip,
  canWithdraw,
  onBid,
  onSkip,
  onWithdraw,
}: BidPanelProps) {
  const [flashKey, setFlashKey] = useState(0);
  const [lastBidding, setLastBidding] = useState<number | null>(null);
  const prevBidRef = useRef<number | null>(null);

  useEffect(() => {
    const newAmount = currentBid?.amount ?? null;
    if (newAmount !== null && newAmount !== prevBidRef.current) {
      setFlashKey((key) => key + 1);
      prevBidRef.current = newAmount;
    }
  }, [currentBid?.amount]);

  const isLeading = currentBid?.teamId === myTeamId;
  const timerActive = timerSeconds > 0 && !isPaused;
  const floor = currentBid ? currentBid.amount : player.basePrice;

  function handleBid(cr: number) {
    const amount = +(floor + cr).toFixed(2);
    if (lastBidding === amount) return;
    setLastBidding(amount);
    onBid(amount);
    setTimeout(() => setLastBidding(null), 800);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <BidTimer seconds={timerSeconds} total={10} />

      <div className="text-center w-full">
        {currentBid ? (
          <>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'rgba(232,232,240,0.4)' }}
            >
              Current Bid
            </p>
            <div key={flashKey} className="animate-bid-flash">
              <span
                style={{
                  fontFamily: 'var(--font-bebas)',
                  fontSize: '3.5rem',
                  lineHeight: 1,
                  color: isLeading ? '#22C55E' : '#FFD700',
                  textShadow: isLeading
                    ? '0 0 30px rgba(34,197,94,0.5)'
                    : '0 0 30px rgba(255,215,0,0.4)',
                }}
              >
                Rs {currentBid.amount} Cr
              </span>
            </div>
            <p
              className="text-sm mt-1 font-semibold"
              style={{ color: isLeading ? '#4ADE80' : 'rgba(232,232,240,0.5)' }}
            >
              {isLeading ? 'You are leading!' : `${currentBid.teamName} is leading`}
            </p>
          </>
        ) : (
          <>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'rgba(232,232,240,0.4)' }}
            >
              Base Price
            </p>
            <span
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '3.5rem',
                lineHeight: 1,
                color: '#FF6B00',
              }}
            >
              Rs {player.basePrice} Cr
            </span>
            <p className="text-sm mt-1" style={{ color: 'rgba(232,232,240,0.4)' }}>
              No bids yet
            </p>
          </>
        )}
      </div>

      {isPaused && (
        <div
          className="w-full py-4 rounded-xl text-center font-semibold tracking-widest uppercase"
          style={{
            background: 'rgba(42,42,58,0.6)',
            color: 'rgba(232,232,240,0.3)',
            border: '1px solid rgba(42,42,58,0.8)',
          }}
        >
          Auction Paused
        </div>
      )}

      {!isPaused && squadFull && (
        <div
          className="w-full py-4 rounded-xl text-center text-sm font-semibold tracking-wide"
          style={{
            background: 'rgba(22,163,74,0.1)',
            border: '1px solid rgba(22,163,74,0.3)',
            color: '#4ADE80',
          }}
        >
          Squad full ({squadSize}/{squadSize}) · Watching only
        </div>
      )}

      {!isPaused && !squadFull && (
        <div className="w-full space-y-3">
          {/* Bid buttons — always visible so the first bid can be placed */}
          <div className="grid grid-cols-3 gap-2">
            {BID_INCREMENTS.map(({ label, cr }) => {
              const amount = +(floor + cr).toFixed(2);
              const canAfford = myBudget >= amount;
              const active = timerActive && canAfford && !isLeading;
              const isSubmitting = lastBidding === amount;

              return (
                <button
                  key={label}
                  onClick={() => active && handleBid(cr)}
                  disabled={!active || isSubmitting}
                  aria-label={`Bid Rs ${amount} Cr`}
                  className="py-3 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-150"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #FF6B00, #FF8C33)'
                      : 'rgba(255,107,0,0.08)',
                    border: `1px solid ${active ? 'rgba(255,107,0,0.6)' : 'rgba(42,42,58,0.6)'}`,
                    cursor: active ? 'pointer' : 'not-allowed',
                    opacity: isSubmitting ? 0.6 : 1,
                    boxShadow: active ? '0 4px 16px rgba(255,107,0,0.35)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-bebas)',
                      fontSize: '1.15rem',
                      color: active ? '#fff' : 'rgba(232,232,240,0.25)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: active ? 'rgba(255,255,255,0.75)' : 'rgba(232,232,240,0.2)',
                    }}
                  >
                    Rs {amount}
                  </span>
                </button>
              );
            })}
          </div>

          {isLeading && timerActive && (
            <p className="text-xs text-center" style={{ color: '#4ADE80' }}>
              You're leading. Others must outbid you.
            </p>
          )}

          {/* Before first bid: Skip option */}
          {!biddingStarted && (
            <div className="pt-1" style={{ borderTop: '1px solid rgba(42,42,58,0.5)' }}>
              <button
                onClick={onSkip}
                disabled={!canSkip}
                className="w-full py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-150"
                style={{
                  background: canSkip ? 'rgba(220,38,38,0.12)' : 'rgba(42,42,58,0.4)',
                  border: `1px solid ${canSkip ? 'rgba(220,38,38,0.35)' : 'rgba(42,42,58,0.5)'}`,
                  color: canSkip ? '#F87171' : 'rgba(232,232,240,0.3)',
                  cursor: canSkip ? 'pointer' : 'not-allowed',
                }}
              >
                Skip Player
              </button>
              {skipVotes > 0 && (
                <p className="text-center text-[10px] mt-1.5" style={{ color: 'rgba(232,232,240,0.35)' }}>
                  {skipVotes}/{totalTeams} teams voted to skip
                </p>
              )}
            </div>
          )}

          {/* After first bid: Withdraw option (hidden for highest bidder) */}
          {biddingStarted && !isHighestBidder && (
            <div className="pt-1" style={{ borderTop: '1px solid rgba(42,42,58,0.5)' }}>
              <button
                onClick={() => canWithdraw && onWithdraw()}
                disabled={!canWithdraw}
                className="w-full py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-150"
                style={{
                  background: hasWithdrawn ? 'rgba(42,42,58,0.4)' : 'rgba(220,38,38,0.12)',
                  border: `1px solid ${hasWithdrawn ? 'rgba(42,42,58,0.5)' : 'rgba(220,38,38,0.35)'}`,
                  color: hasWithdrawn ? 'rgba(232,232,240,0.3)' : '#F87171',
                  cursor: canWithdraw ? 'pointer' : 'not-allowed',
                }}
              >
                {hasWithdrawn ? 'Withdrawn' : 'Withdraw'}
              </button>
              {withdrawVotes > 0 && (
                <p className="text-center text-[10px] mt-1.5" style={{ color: 'rgba(232,232,240,0.35)' }}>
                  {withdrawVotes}/{withdrawEligible} teams withdrew
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'rgba(232,232,240,0.3)' }}>
        Budget{' '}
        <span style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
          Rs {myBudget.toFixed(2)} Cr
        </span>
      </p>
    </div>
  );
}
