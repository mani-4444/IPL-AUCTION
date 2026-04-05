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
import { Confetti } from '@/components/ui/Confetti';
import { PlayerCardSkeleton } from '@/components/ui/Skeleton';
import { useReconnect } from '@/hooks/useReconnect';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Room, Player, Bid, AuctionRound } from '@/types';
import { ROUND_ROLES } from '@/types';

type MobileTab = 'player' | 'bid' | 'teams';

export default function AuctionPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const {
    currentPlayer, currentBid, currentRound, timerSeconds, bidHistory,
    lastSoldPlayer, lastUnsoldPlayer, isPaused,
    setCurrentPlayer, setCurrentBid, setTimer, setPlayerSold, setPlayerUnsold, setPaused,
  } = useAuctionStore();

  useReconnect();
  const { toasts, showToast, dismissToast } = useToast();
  const [showSoldBanner, setShowSoldBanner] = useState(false);
  const [showUnsoldBanner, setShowUnsoldBanner] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('bid');

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
      setConfettiActive(false);
    });

    socket.on('auction:bid-placed', (bid: Bid) => setCurrentBid(bid));
    socket.on('auction:timer-tick', (s: number) => setTimer(s));

    socket.on('auction:player-sold', (player: Player, bid: Bid) => {
      setPlayerSold(player, bid);
      setShowSoldBanner(true);
      setConfettiActive(true);
      setTimeout(() => { setShowSoldBanner(false); setConfettiActive(false); }, 3000);
    });

    socket.on('auction:player-unsold', (player: Player) => {
      setPlayerUnsold(player);
      setShowUnsoldBanner(true);
      setTimeout(() => setShowUnsoldBanner(false), 2500);
    });

    socket.on('auction:complete', () => router.push(`/team-setup/${roomId}`));
    socket.on('error', (msg: string) => showToast(msg));

    return () => {
      socket.off('room:updated');
      socket.off('auction:player-up');
      socket.off('auction:bid-placed');
      socket.off('auction:timer-tick');
      socket.off('auction:player-sold');
      socket.off('auction:player-unsold');
      socket.off('auction:complete');
      socket.off('error');
    };
  }, [roomId, router, setRoom, setCurrentPlayer, setCurrentBid, setTimer, setPlayerSold, setPlayerUnsold, showToast]);

  function handleBid(amount: number) {
    connectSocket().emit('auction:bid', amount);
  }

  function handleNextPlayer() {
    connectSocket().emit('auction:next-player');
  }

  function handlePause() {
    const socket = connectSocket();
    if (isPaused) { socket.emit('auction:resume'); setPaused(false); }
    else { socket.emit('auction:pause'); setPaused(true); }
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
    <main className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Confetti canvas */}
      <Confetti active={confettiActive} />

      {/* SOLD banner */}
      {showSoldBanner && lastSoldPlayer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-sold px-10 py-6 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(22,163,74,0.97), rgba(16,120,55,0.99))',
              boxShadow: '0 0 80px rgba(22,163,74,0.7), 0 0 160px rgba(22,163,74,0.3)',
              border: '2px solid rgba(74,222,128,0.6)',
            }}>
            <div className="mb-1" style={{ fontFamily: 'var(--font-bebas)', fontSize: '5rem', color: '#fff', letterSpacing: '0.1em', lineHeight: 1 }}>
              SOLD!
            </div>
            <div className="text-xl font-bold text-white">{lastSoldPlayer.player.name}</div>
            <div className="text-lg mt-1.5 font-semibold" style={{ color: '#4ADE80' }}>
              {lastSoldPlayer.bid.teamName} · ₹{lastSoldPlayer.bid.amount} Cr
            </div>
          </div>
        </div>
      )}

      {/* UNSOLD banner */}
      {showUnsoldBanner && lastUnsoldPlayer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-sold px-10 py-6 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(40,40,55,0.97), rgba(25,25,35,0.99))',
              boxShadow: '0 0 60px rgba(80,80,100,0.4)',
              border: '2px solid rgba(80,80,100,0.5)',
            }}>
            <div className="mb-1" style={{ fontFamily: 'var(--font-bebas)', fontSize: '5rem', color: '#6B7280', letterSpacing: '0.1em', lineHeight: 1 }}>
              UNSOLD
            </div>
            <div className="text-xl font-bold" style={{ color: '#4B5563' }}>{lastUnsoldPlayer.name}</div>
          </div>
        </div>
      )}

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid rgba(42,42,58,0.6)', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="flex-shrink-0">
          <span className="text-[10px] tracking-widest uppercase" style={{ color: '#FF6B00' }}>Round {currentRound}</span>
          <h1 className="text-base leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0' }}>
            {roundLabel}
          </h1>
        </div>

        {/* Round tracker — hidden on very small screens */}
        <div className="flex-1 max-w-36 hidden sm:block">
          <RoundIndicator currentRound={currentRound} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isHost && (
            <>
              <button onClick={handlePause} aria-label={isPaused ? 'Resume auction' : 'Pause auction'}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: isPaused ? 'rgba(22,163,74,0.2)' : 'rgba(255,107,0,0.15)',
                  border: `1px solid ${isPaused ? 'rgba(22,163,74,0.4)' : 'rgba(255,107,0,0.3)'}`,
                  color: isPaused ? '#4ADE80' : '#FF6B00',
                  cursor: 'pointer',
                }}>
                {isPaused ? '▶' : '⏸'}
              </button>
              <button onClick={handleNextPlayer} aria-label="Skip to next player"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{ background: 'rgba(42,42,58,0.6)', border: '1px solid rgba(42,42,58,0.8)', color: 'rgba(232,232,240,0.5)', cursor: 'pointer' }}>
                ⏭
              </button>
            </>
          )}
          <div className="text-right">
            <p className="text-[10px]" style={{ color: 'rgba(232,232,240,0.4)' }}>Budget</p>
            <p className="text-sm font-bold leading-none" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
              ₹{myTeam?.budgetRemaining.toFixed(1) ?? '—'}
            </p>
          </div>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden flex border-b" style={{ borderColor: 'rgba(42,42,58,0.6)', background: 'rgba(10,10,15,0.8)' }}>
        {([
          { id: 'player', label: '🏏 Player' },
          { id: 'bid',    label: '💰 Bid' },
          { id: 'teams',  label: '👥 Teams' },
        ] as { id: MobileTab; label: string }[]).map((tab) => (
          <button key={tab.id} onClick={() => setMobileTab(tab.id)}
            className="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200"
            style={{
              color: mobileTab === tab.id ? '#FF6B00' : 'rgba(232,232,240,0.4)',
              borderBottom: mobileTab === tab.id ? '2px solid #FF6B00' : '2px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
            }}
            aria-pressed={mobileTab === tab.id}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: 3-column | Mobile: tabbed */}
      <div className="flex-1 p-3 md:p-4 max-w-7xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-[1fr_300px_1fr] lg:gap-4 lg:h-full">

          {/* Player Card */}
          <div className={`${mobileTab !== 'player' ? 'hidden lg:flex' : 'flex'} flex-col gap-4`}>
            {currentPlayer
              ? <PlayerCard player={currentPlayer} />
              : <PlayerCardSkeleton />}
          </div>

          {/* Bid Panel + History */}
          <div className={`${mobileTab !== 'bid' ? 'hidden lg:flex' : 'flex'} flex-col gap-0 glass-bright rounded-2xl overflow-hidden`}>
            <div className="p-5 flex-1">
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
                <div className="flex items-center justify-center min-h-[280px]">
                  <div className="text-center">
                    <div className="text-4xl mb-3 animate-float">⏳</div>
                    <p className="text-sm" style={{ color: 'rgba(232,232,240,0.25)' }}>
                      {isPaused ? 'Auction paused' : 'Between players...'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {bidHistory.length > 0 && (
              <div className="px-5 pb-5 pt-3" style={{ borderTop: '1px solid rgba(42,42,58,0.6)' }}>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2.5" style={{ color: 'rgba(232,232,240,0.3)' }}>
                  Bid History
                </p>
                <BidHistory bids={bidHistory} myTeamId={myTeam?.id ?? ''} />
              </div>
            )}
          </div>

          {/* Teams */}
          <div className={`${mobileTab !== 'teams' ? 'hidden lg:block' : 'block'} glass-bright rounded-2xl p-4`}>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(232,232,240,0.3)' }}>
              All Teams · {room.teams.length}
            </p>
            <TeamBudgetList teams={room.teams} myUserId={myUserId} />
          </div>
        </div>
      </div>
    </main>
  );
}
