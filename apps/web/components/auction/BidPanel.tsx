'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Bid, Player } from '@/types';
import { BidTimer } from './BidTimer';

interface BidPanelProps {
  player: Player;
  currentBid: Bid | null;
  timerSeconds: number;
  bidIncrement: number;
  myBudget: number;
  myTeamId: string;
  isPaused: boolean;
  onBid: (amount: number) => void;
}

export function BidPanel({
  player, currentBid, timerSeconds, bidIncrement,
  myBudget, myTeamId, isPaused, onBid,
}: BidPanelProps) {
  const [bidding, setBidding] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const prevBidRef = useRef<number | null>(null);

  // Flash the bid amount when a new bid lands
  useEffect(() => {
    const newAmount = currentBid?.amount ?? null;
    if (newAmount !== null && newAmount !== prevBidRef.current) {
      setFlashKey((k) => k + 1);
      prevBidRef.current = newAmount;
    }
  }, [currentBid?.amount]);

  const nextBid = currentBid
    ? +(currentBid.amount + bidIncrement).toFixed(2)
    : player.basePrice;

  const canBid = !isPaused
    && myBudget >= nextBid
    && currentBid?.teamId !== myTeamId
    && timerSeconds > 0;

  const handleBid = useCallback(() => {
    if (!canBid || bidding) return;
    setBidding(true);
    onBid(nextBid);
    setTimeout(() => setBidding(false), 800);
  }, [canBid, bidding, nextBid, onBid]);

  const isLeading = currentBid?.teamId === myTeamId;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Timer */}
      <BidTimer seconds={timerSeconds} total={10} />

      {/* Current Bid Display */}
      <div className="text-center w-full">
        {currentBid ? (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'rgba(232,232,240,0.4)' }}>
              Current Bid
            </p>
            <div key={flashKey} className="bid-flip animate-bid-flash">
              <span style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '3.5rem',
                lineHeight: 1,
                color: isLeading ? '#22C55E' : '#FFD700',
                textShadow: isLeading ? '0 0 30px rgba(34,197,94,0.5)' : '0 0 30px rgba(255,215,0,0.4)',
              }}>
                ₹{currentBid.amount} Cr
              </span>
            </div>
            <p className="text-sm mt-1 font-semibold" style={{ color: isLeading ? '#4ADE80' : 'rgba(232,232,240,0.5)' }}>
              {isLeading ? '🏆 You are leading!' : `${currentBid.teamName} is leading`}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'rgba(232,232,240,0.4)' }}>
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

      {/* Bid Button */}
      {isPaused ? (
        <div className="w-full py-4 rounded-xl text-center font-semibold tracking-widest uppercase"
          style={{ background: 'rgba(42,42,58,0.6)', color: 'rgba(232,232,240,0.3)', border: '1px solid rgba(42,42,58,0.8)' }}>
          ⏸ Auction Paused
        </div>
      ) : (
        <button
          onClick={handleBid}
          disabled={!canBid || bidding}
          className="w-full py-4 rounded-xl transition-all duration-200 relative overflow-hidden"
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '1.4rem',
            letterSpacing: '0.1em',
            background: canBid
              ? 'linear-gradient(135deg, #FF6B00, #FF8C33)'
              : 'rgba(255,107,0,0.12)',
            color: canBid ? '#fff' : 'rgba(255,255,255,0.25)',
            cursor: canBid ? 'pointer' : 'not-allowed',
            boxShadow: canBid ? '0 4px 24px rgba(255,107,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
            animation: canBid ? 'pulse-orange 2s ease-in-out infinite' : 'none',
          }}
          aria-label={`Place bid of ₹${nextBid} Cr`}
          aria-disabled={!canBid}
        >
          {isLeading
            ? `✓ Leading — Raise to ₹${nextBid} Cr`
            : canBid
              ? `BID ₹${nextBid} Cr`
              : myBudget < nextBid
                ? `Insufficient Budget`
                : `BID ₹${nextBid} Cr`}
        </button>
      )}

      <p className="text-xs" style={{ color: 'rgba(232,232,240,0.3)' }}>
        Your budget: <span style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>₹{myBudget.toFixed(2)} Cr</span>
      </p>
    </div>
  );
}
