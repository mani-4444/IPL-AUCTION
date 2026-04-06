'use client';
import { useRef, useEffect, useState } from 'react';
import type { Bid, Player } from '@/types';
import { BidTimer } from './BidTimer';

// Issue 4: fixed increment buttons (+25L, +50L, +1Cr)
const BID_INCREMENTS = [
  { label: '+25L', cr: 0.25 },
  { label: '+50L', cr: 0.50 },
  { label: '+1Cr', cr: 1.00 },
] as const;

interface BidPanelProps {
  player: Player;
  currentBid: Bid | null;
  timerSeconds: number;
  myBudget: number;
  myTeamId: string;
  isPaused: boolean;
  skipVotes: number;
  totalTeams: number;
  onBid: (amount: number) => void;
  onSkip: () => void;
}

export function BidPanel({
  player, currentBid, timerSeconds,
  myBudget, myTeamId, isPaused,
  skipVotes, totalTeams,
  onBid, onSkip,
}: BidPanelProps) {
  const [flashKey, setFlashKey] = useState(0);
  const [lastBidding, setLastBidding] = useState<number | null>(null);
  const prevBidRef = useRef<number | null>(null);

  // Flash animation when a new bid lands
  useEffect(() => {
    const newAmount = currentBid?.amount ?? null;
    if (newAmount !== null && newAmount !== prevBidRef.current) {
      setFlashKey((k) => k + 1);
      prevBidRef.current = newAmount;
    }
  }, [currentBid?.amount]);

  const isLeading = currentBid?.teamId === myTeamId;
  const timerActive = timerSeconds > 0 && !isPaused;

  // Floor for increment calculation
  const floor = currentBid ? currentBid.amount : player.basePrice;

  function handleBid(cr: number) {
    const amount = +(floor + cr).toFixed(2);
    if (lastBidding === amount) return; // debounce same amount
    setLastBidding(amount);
    onBid(amount);
    setTimeout(() => setLastBidding(null), 800);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Timer */}
      <BidTimer seconds={timerSeconds} total={10} />

      {/* Current Bid Display */}
      <div className="text-center w-full">
        {currentBid ? (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'rgba(232,232,240,0.4)' }}>
              Current Bid
            </p>
            <div key={flashKey} className="animate-bid-flash">
              <span style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '3.5rem',
                lineHeight: 1,
                color: isLeading ? '#22C55E' : '#FFD700',
                textShadow: isLeading
                  ? '0 0 30px rgba(34,197,94,0.5)'
                  : '0 0 30px rgba(255,215,0,0.4)',
              }}>
                ₹{currentBid.amount} Cr
              </span>
            </div>
            <p className="text-sm mt-1 font-semibold"
              style={{ color: isLeading ? '#4ADE80' : 'rgba(232,232,240,0.5)' }}>
              {isLeading ? '🏆 You are leading!' : `${currentBid.teamName} is leading`}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'rgba(232,232,240,0.4)' }}>
              Base Price
            </p>
            <span style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: '3.5rem',
              lineHeight: 1,
              color: '#FF6B00',
            }}>
              ₹{player.basePrice} Cr
            </span>
            <p className="text-sm mt-1" style={{ color: 'rgba(232,232,240,0.4)' }}>
              No bids yet — be the first!
            </p>
          </>
        )}
      </div>

      {/* Issue 4: 3 fixed increment bid buttons */}
      {isPaused ? (
        <div className="w-full py-4 rounded-xl text-center font-semibold tracking-widest uppercase"
          style={{
            background: 'rgba(42,42,58,0.6)',
            color: 'rgba(232,232,240,0.3)',
            border: '1px solid rgba(42,42,58,0.8)',
          }}>
          ⏸ Auction Paused
        </div>
      ) : (
        <div className="w-full grid grid-cols-3 gap-2">
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
                aria-label={`Bid ₹${amount} Cr`}
                className="py-3 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-150"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, #FF6B00, #FF8C33)'
                    : 'rgba(255,107,0,0.08)',
                  border: `1px solid ${active ? 'rgba(255,107,0,0.6)' : 'rgba(42,42,58,0.6)'}`,
                  cursor: active ? 'pointer' : 'not-allowed',
                  opacity: isSubmitting ? 0.6 : 1,
                  boxShadow: active ? '0 4px 16px rgba(255,107,0,0.35)' : 'none',
                }}>
                <span style={{
                  fontFamily: 'var(--font-bebas)',
                  fontSize: '1.15rem',
                  color: active ? '#fff' : 'rgba(232,232,240,0.25)',
                  letterSpacing: '0.05em',
                }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: active ? 'rgba(255,255,255,0.75)' : 'rgba(232,232,240,0.2)',
                }}>
                  ₹{amount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Leading team — can raise own bid */}
      {isLeading && timerActive && (
        <p className="text-xs text-center" style={{ color: '#4ADE80' }}>
          You're leading — others must outbid you
        </p>
      )}

      <p className="text-xs" style={{ color: 'rgba(232,232,240,0.3)' }}>
        Budget: <span style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
          ₹{myBudget.toFixed(2)} Cr
        </span>
      </p>

      {/* Issue 5: Skip player vote */}
      <div className="w-full pt-2" style={{ borderTop: '1px solid rgba(42,42,58,0.5)' }}>
        <button
          onClick={onSkip}
          disabled={!timerActive}
          className="w-full py-2 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all duration-150"
          style={{
            background: 'rgba(42,42,58,0.5)',
            border: '1px solid rgba(42,42,58,0.8)',
            color: timerActive ? 'rgba(232,232,240,0.5)' : 'rgba(232,232,240,0.2)',
            cursor: timerActive ? 'pointer' : 'not-allowed',
          }}>
          Skip Player
        </button>
        {skipVotes > 0 && (
          <p className="text-center text-[10px] mt-1.5"
            style={{ color: 'rgba(232,232,240,0.35)' }}>
            {skipVotes}/{totalTeams} teams voted to skip
          </p>
        )}
      </div>
    </div>
  );
}
