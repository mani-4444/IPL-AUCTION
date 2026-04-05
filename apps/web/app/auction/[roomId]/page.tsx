'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useRoomStore } from '@/store/roomStore';
import { useAuctionStore } from '@/store/auctionStore';
import { PlayerCard } from '@/components/auction/PlayerCard';
import { BidPanel } from '@/components/auction/BidPanel';
import { BidHistory } from '@/components/auction/BidHistory';
import { TeamBudgetList } from '@/components/auction/TeamBudgetList';
import { RoundIndicator } from '@/components/auction/RoundIndicator';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { Room, Player, Bid, AuctionRound } from '@/types';
import { ROUND_ROLES } from '@/types';

export default function AuctionPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const {
    currentPlayer, currentBid, currentRound, timerSeconds, bidHistory,
    lastSoldPlayer, lastUnsoldPlayer, isPaused,
    setCurrentPlayer, setCurrentBid, setTimer, setPlayerSold, setPlayerUnsold, setPaused,
  } = useAuctionStore();

  const [showSoldBanner, setShowSoldBanner] = useState(false);
  const [showUnsoldBanner, setShowUnsoldBanner] = useState(false);

  const myTeam = room?.teams.find((t) => t.userId === myUserId) ?? null;
  const isHost = myUserId === room?.hostId;

  useEffect(() => {
    const socket = connectSocket();

    socket.on('room:updated', (r: Room) => {
      setRoom(r);
      if (r.status === 'team-setup') router.push(`/team-setup/${r.id}`);
      if (r.status === 'results') router.push(`/results/${r.id}`);
    });

    socket.on('auction:player-up', (player: Player, round: AuctionRound) => {
      setCurrentPlayer(player, round);
      setShowSoldBanner(false);
      setShowUnsoldBanner(false);
    });

    socket.on('auction:bid-placed', (bid: Bid) => setCurrentBid(bid));
    socket.on('auction:timer-tick', (s: number) => setTimer(s));

    socket.on('auction:player-sold', (player: Player, bid: Bid) => {
      setPlayerSold(player, bid);
      setShowSoldBanner(true);
      setTimeout(() => setShowSoldBanner(false), 2500);
    });

    socket.on('auction:player-unsold', (player: Player) => {
      setPlayerUnsold(player);
      setShowUnsoldBanner(true);
      setTimeout(() => setShowUnsoldBanner(false), 2500);
    });

    socket.on('auction:complete', () => router.push(`/team-setup/${roomId}`));

    return () => {
      socket.off('room:updated');
      socket.off('auction:player-up');
      socket.off('auction:bid-placed');
      socket.off('auction:timer-tick');
      socket.off('auction:player-sold');
      socket.off('auction:player-unsold');
      socket.off('auction:complete');
    };
  }, [roomId, router, setRoom, setCurrentPlayer, setCurrentBid, setTimer, setPlayerSold, setPlayerUnsold]);

  function handleBid(amount: number) {
    connectSocket().emit('auction:bid', amount);
  }

  function handleNextPlayer() {
    connectSocket().emit('auction:next-player');
  }

  function handlePause() {
    const socket = connectSocket();
    if (isPaused) {
      socket.emit('auction:resume');
      setPaused(false);
    } else {
      socket.emit('auction:pause');
      setPaused(true);
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-pulse" style={{ fontFamily: 'var(--font-bebas)', color: '#FF6B00' }}>
          Loading Auction...
        </div>
      </div>
    );
  }

  const roundLabel = ROUND_ROLES[currentRound] === 'Unsold' ? 'Unsold Round' : `${ROUND_ROLES[currentRound]}s`;

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* SOLD banner */}
      {showSoldBanner && lastSoldPlayer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-sold px-12 py-6 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(22,163,74,0.95), rgba(16,120,55,0.98))',
              boxShadow: '0 0 80px rgba(22,163,74,0.6)',
              border: '2px solid rgba(74,222,128,0.5)',
            }}>
            <div className="text-6xl mb-1" style={{ fontFamily: 'var(--font-bebas)', color: '#fff', letterSpacing: '0.1em' }}>
              SOLD!
            </div>
            <div className="text-xl font-bold text-white">{lastSoldPlayer.player.name}</div>
            <div className="text-lg mt-1" style={{ color: '#4ADE80' }}>
              → {lastSoldPlayer.bid.teamName} · ₹{lastSoldPlayer.bid.amount} Cr
            </div>
          </div>
        </div>
      )}

      {/* UNSOLD banner */}
      {showUnsoldBanner && lastUnsoldPlayer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-sold px-12 py-6 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(55,55,70,0.95), rgba(30,30,42,0.98))',
              boxShadow: '0 0 60px rgba(100,100,120,0.4)',
              border: '2px solid rgba(100,100,120,0.4)',
            }}>
            <div className="text-6xl mb-1" style={{ fontFamily: 'var(--font-bebas)', color: '#9CA3AF', letterSpacing: '0.1em' }}>
              UNSOLD
            </div>
            <div className="text-xl font-bold" style={{ color: '#6B7280' }}>{lastUnsoldPlayer.name}</div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(42,42,58,0.6)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div>
          <span className="text-xs tracking-widest uppercase" style={{ color: '#FF6B00' }}>Round {currentRound}</span>
          <h1 className="text-lg leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0' }}>
            {roundLabel}
          </h1>
        </div>
        <div className="flex-1 max-w-48 mx-4">
          <RoundIndicator currentRound={currentRound} />
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <>
              <button onClick={handlePause}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: isPaused ? 'rgba(22,163,74,0.2)' : 'rgba(255,107,0,0.15)',
                  border: `1px solid ${isPaused ? 'rgba(22,163,74,0.4)' : 'rgba(255,107,0,0.3)'}`,
                  color: isPaused ? '#4ADE80' : '#FF6B00',
                  cursor: 'pointer',
                }}>
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button onClick={handleNextPlayer}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: 'rgba(42,42,58,0.6)',
                  border: '1px solid rgba(42,42,58,0.8)',
                  color: 'rgba(232,232,240,0.6)',
                  cursor: 'pointer',
                }}>
                Skip →
              </button>
            </>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs" style={{ color: 'rgba(232,232,240,0.4)' }}>Your Budget</p>
            <p className="text-sm font-bold" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
              ₹{myTeam?.budgetRemaining.toFixed(1) ?? '—'} Cr
            </p>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="grid lg:grid-cols-[1fr_320px_1fr] gap-4 p-4 max-w-7xl mx-auto">

        {/* Left: Player Card */}
        <div className="flex flex-col gap-4">
          {currentPlayer ? (
            <PlayerCard player={currentPlayer} />
          ) : (
            <div className="glass-bright rounded-2xl p-8 flex items-center justify-center min-h-[280px]">
              <div className="text-center">
                <div className="text-5xl mb-3 animate-float">🏏</div>
                <p style={{ color: 'rgba(232,232,240,0.3)' }}>Waiting for next player...</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Bidding */}
        <div className="glass-bright rounded-2xl p-6">
          {currentPlayer && myTeam ? (
            <BidPanel
              player={currentPlayer}
              currentBid={currentBid}
              timerSeconds={timerSeconds}
              bidIncrement={room.auctionConfig.bidIncrementCr}
              myBudget={myTeam.budgetRemaining}
              myTeamId={myTeam.id}
              isPaused={isPaused}
              onBid={handleBid}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <p style={{ color: 'rgba(232,232,240,0.25)' }}>Between players...</p>
            </div>
          )}

          {/* Bid History */}
          {bidHistory.length > 0 && (
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(42,42,58,0.6)' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(232,232,240,0.35)' }}>
                Bid History
              </p>
              <BidHistory bids={bidHistory} myTeamId={myTeam?.id ?? ''} />
            </div>
          )}
        </div>

        {/* Right: Teams Dashboard */}
        <div className="glass-bright rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'rgba(232,232,240,0.35)' }}>
            All Teams
          </p>
          <TeamBudgetList teams={room.teams} myUserId={myUserId} />
        </div>
      </div>
    </main>
  );
}
