'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { loadSession } from '@/lib/session';
import { useRoomStore } from '@/store/roomStore';
import { useAuctionStore } from '@/store/auctionStore';
import { PlayerCard } from '@/components/auction/PlayerCard';
import { BidPanel } from '@/components/auction/BidPanel';
import { MobileBidBar } from '@/components/auction/MobileBidBar';
import { BidHistory } from '@/components/auction/BidHistory';
import { TeamBudgetList } from '@/components/auction/TeamBudgetList';
import { RoundIndicator } from '@/components/auction/RoundIndicator';
import { BidTimer } from '@/components/auction/BidTimer';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { Confetti } from '@/components/ui/Confetti';
import { PlayerCardSkeleton } from '@/components/ui/Skeleton';
import { useReconnect } from '@/hooks/useReconnect';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Room, Player, Bid, AuctionRound, WithdrawVoteState, SyncStatePayload } from '@/types';
import { ROUND_ROLES } from '@/types';

export default function AuctionPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom, myUserId } = useRoomStore();
  const {
    currentPlayer, currentBid, currentRound, timerSeconds, bidHistory,
    lastSoldPlayer, lastUnsoldPlayer, isPaused,
    roundPreviewPlayers, roundPreviewRound, roundPreviewSeconds,
    skipVotes, totalTeams, roundCounts,
    biddingStarted, withdrawVotes, withdrawEligible, withdrawVoteTeamIds, highestBidder, isPlayerClosed,
    setCurrentPlayer, setCurrentBid, setTimer, setPlayerSold, setPlayerUnsold,
    setPaused, setRoundPreview, clearRoundPreview, setSkipVotes, setRoundCounts,
    setBiddingStarted, setWithdrawVotes, syncState,
  } = useAuctionStore();

  useReconnect();
  const { toasts, showToast, dismissToast } = useToast();
  const [showSoldBanner, setShowSoldBanner] = useState(false);
  const [showUnsoldBanner, setShowUnsoldBanner] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState(0);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  const effectiveUserId = myUserId ?? loadSession()?.userId ?? null;
  const myTeam = room?.teams.find((t) => t.userId === effectiveUserId) ?? null;
  const isHost = effectiveUserId === room?.hostId;

  useEffect(() => {
    const socket = connectSocket();

    socket.on('room:updated', (r: Room) => {
      setRoom(r);
      if (r.status === 'team-setup') router.push(`/team-setup/${r.id}`);
      if (r.status === 'results') router.push(`/results/${r.id}`);
    });
    socket.on('auction:player-up', (player: Player, round: AuctionRound) => {
      setCurrentPlayer(player, round);
      clearRoundPreview();
      setPreviewCountdown(0);
      setShowSoldBanner(false);
      setShowUnsoldBanner(false);
      setConfettiActive(false);
    });
    socket.on('auction:round-preview', (players: Player[], round: AuctionRound, seconds: number) => {
      setRoundPreview(players, round, seconds);
      setPreviewCountdown(seconds);
    });
    socket.on('auction:preview-tick', (timeLeft: number) => setPreviewCountdown(timeLeft));
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
    socket.on('auction:paused', () => setPaused(true));
    socket.on('auction:resumed', () => setPaused(false));
    socket.on('auction:skip-votes', (votes: number, total: number) => setSkipVotes(votes, total));
    socket.on('auction:round-counts', (counts) => setRoundCounts(counts));
    socket.on('auction:bidding-started', (bid: Bid, withdrawState: WithdrawVoteState) => setBiddingStarted(bid, withdrawState));
    socket.on('auction:withdraw-votes', (withdrawState: WithdrawVoteState) => setWithdrawVotes(withdrawState));
    socket.on('sync:state', (state: SyncStatePayload) => syncState(state));
    socket.on('auction:complete', () => router.push(`/team-setup/${roomId}`));
    socket.on('error', (msg: string) => showToast(msg));

    return () => {
      socket.off('room:updated'); socket.off('auction:player-up');
      socket.off('auction:round-preview'); socket.off('auction:preview-tick');
      socket.off('auction:bid-placed'); socket.off('auction:timer-tick');
      socket.off('auction:player-sold'); socket.off('auction:player-unsold');
      socket.off('auction:paused'); socket.off('auction:resumed');
      socket.off('auction:skip-votes'); socket.off('auction:round-counts');
      socket.off('auction:bidding-started'); socket.off('auction:withdraw-votes');
      socket.off('sync:state'); socket.off('auction:complete'); socket.off('error');
    };
  }, [roomId, router, setRoom, setCurrentPlayer, setCurrentBid, setTimer,
      setPlayerSold, setPlayerUnsold, setRoundPreview, clearRoundPreview,
      setSkipVotes, setRoundCounts, setBiddingStarted, setWithdrawVotes, syncState, showToast]);

  function handleBid(amount: number) { connectSocket().emit('auction:bid', amount); }
  function handleSkip() { connectSocket().emit('auction:skip'); }
  function handleWithdraw() { connectSocket().emit('auction:withdraw'); }
  function handleNextPlayer() { connectSocket().emit('auction:next-player'); }
  function handlePause() {
    const socket = connectSocket();
    if (isPaused) { socket.emit('auction:resume'); setPaused(false); }
    else { socket.emit('auction:pause'); setPaused(true); }
  }
  function handleSkipRound() {
    if (!confirm(`Skip all remaining players in Round ${currentRound} and move to next round?`)) return;
    connectSocket().emit('auction:skip-round');
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
  const squadSize = room.auctionConfig.squadSize;
  const squadFull = (myTeam?.players.length ?? 0) >= squadSize;
  const hasWithdrawn = myTeam ? withdrawVoteTeamIds.includes(myTeam.id) : false;
  const isHighestBidder = myTeam ? highestBidder === myTeam.id : false;
  const canSkip = Boolean(currentPlayer) && !biddingStarted && !isPlayerClosed;
  const canWithdraw = Boolean(currentPlayer) && biddingStarted && !isHighestBidder && !hasWithdrawn && !isPlayerClosed;

  // ── Round preview screens ──────────────────────────────────────────────────
  if (roundPreviewPlayers.length > 0 && roundPreviewRound !== null) {
    const previewRoleLabel = ROUND_ROLES[roundPreviewRound] === 'Unsold'
      ? 'Unsold Players' : `${ROUND_ROLES[roundPreviewRound]}s`;

    if (previewCountdown === 0) {
      return (
        <main className="min-h-screen flex items-center justify-center">
          <p className="animate-pulse" style={{ fontFamily: 'var(--font-bebas)', fontSize: '2.5rem', color: '#FF6B00', textShadow: '0 0 30px rgba(255,107,0,0.5)' }}>
            Auction Starting...
          </p>
        </main>
      );
    }

    if (previewCountdown <= 5) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-6 relative overflow-hidden">
          <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.4)' }}>
            Round {roundPreviewRound} · {previewRoleLabel} · Starting in
          </p>
          <div key={previewCountdown} className="animate-countdown-pop" style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 'clamp(8rem, 30vw, 14rem)',
            lineHeight: 1,
            color: previewCountdown <= 3 ? '#FF6B00' : '#FFD700',
            textShadow: previewCountdown <= 3 ? '0 0 60px rgba(255,107,0,0.7)' : '0 0 60px rgba(255,215,0,0.5)',
          }}>
            {previewCountdown}
          </div>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.3)' }}>Get ready to bid!</p>
        </main>
      );
    }

    return (
      <main className="min-h-screen flex flex-col relative overflow-hidden">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(42,42,58,0.6)', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(16px)' }}>
          <div>
            <span className="text-[10px] tracking-widest uppercase" style={{ color: '#FF6B00' }}>Round {roundPreviewRound}</span>
            <h1 className="text-base leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0' }}>{previewRoleLabel}</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px]" style={{ color: 'rgba(232,232,240,0.4)' }}>Starts in</p>
            <p className="text-2xl leading-none" style={{ fontFamily: 'var(--font-bebas)', color: '#FFD700' }}>{previewCountdown}s</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full">
          <p className="text-sm text-center mb-4" style={{ color: 'rgba(232,232,240,0.5)' }}>
            {roundPreviewPlayers.length} players up for auction
          </p>
          <div className="space-y-2">
            {roundPreviewPlayers.map((p, i) => (
              <div key={p.id} className="glass-bright rounded-xl px-4 py-3 flex items-center gap-3 animate-slide-up"
                style={{ animationDelay: `${i * 0.03}s` }}>
                <span className="text-xs w-5 text-right" style={{ color: 'rgba(232,232,240,0.3)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                <RoleBadge role={p.role} size="sm" />
                <span className="flex-1 font-semibold text-sm truncate" style={{ color: '#E8E8F0' }}>{p.name}</span>
                {p.nationality === 'Overseas' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}>OS</span>
                )}
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>₹{p.basePrice}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-1 w-full" style={{ background: 'rgba(42,42,58,0.6)' }}>
          <div className="h-full transition-all duration-1000"
            style={{ width: `${(previewCountdown / roundPreviewSeconds) * 100}%`, background: 'linear-gradient(90deg, #FF6B00, #FFD700)' }} />
        </div>
      </main>
    );
  }

  // ── Sold / Unsold overlays ─────────────────────────────────────────────────
  const SoldBanner = showSoldBanner && lastSoldPlayer ? (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-6">
      <div className="animate-sold px-8 py-6 rounded-2xl text-center w-full max-w-sm"
        style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.97),rgba(16,120,55,0.99))', boxShadow: '0 0 80px rgba(22,163,74,0.7)', border: '2px solid rgba(74,222,128,0.6)' }}>
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(3.5rem,15vw,5rem)', color: '#fff', letterSpacing: '0.1em', lineHeight: 1 }}>SOLD!</div>
        <div className="text-lg font-bold text-white mt-1">{lastSoldPlayer.player.name}</div>
        <div className="text-base mt-1 font-semibold" style={{ color: '#4ADE80' }}>{lastSoldPlayer.bid.teamName} · ₹{lastSoldPlayer.bid.amount} Cr</div>
      </div>
    </div>
  ) : null;

  const UnsoldBanner = showUnsoldBanner && lastUnsoldPlayer ? (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-6">
      <div className="animate-sold px-8 py-6 rounded-2xl text-center w-full max-w-sm"
        style={{ background: 'linear-gradient(135deg,rgba(40,40,55,0.97),rgba(25,25,35,0.99))', boxShadow: '0 0 60px rgba(80,80,100,0.4)', border: '2px solid rgba(80,80,100,0.5)' }}>
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(3.5rem,15vw,5rem)', color: '#6B7280', letterSpacing: '0.1em', lineHeight: 1 }}>UNSOLD</div>
        <div className="text-lg font-bold mt-1" style={{ color: '#4B5563' }}>{lastUnsoldPlayer.name}</div>
      </div>
    </div>
  ) : null;

  // ── Shared top bar ─────────────────────────────────────────────────────────
  const Header = (
    <header className="sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between gap-2"
      style={{ borderBottom: '1px solid rgba(42,42,58,0.6)', background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="flex-shrink-0">
        <span className="text-[10px] tracking-widest uppercase" style={{ color: '#FF6B00' }}>R{currentRound}</span>
        <h1 className="text-sm leading-none font-semibold" style={{ fontFamily: 'var(--font-bebas)', color: '#E8E8F0', letterSpacing: '0.05em' }}>
          {roundLabel}
        </h1>
      </div>

      <div className="flex-1 max-w-40 hidden sm:block">
        <RoundIndicator currentRound={currentRound} roundCounts={roundCounts} />
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isHost && (
          <>
            <button onClick={handlePause} aria-label={isPaused ? 'Resume' : 'Pause'}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all active:scale-90"
              style={{ background: isPaused ? 'rgba(22,163,74,0.2)' : 'rgba(255,107,0,0.15)', border: `1px solid ${isPaused ? 'rgba(22,163,74,0.4)' : 'rgba(255,107,0,0.3)'}`, color: isPaused ? '#4ADE80' : '#FF6B00', cursor: 'pointer' }}>
              {isPaused ? '▶' : '⏸'}
            </button>
            {!biddingStarted && (
              <button onClick={handleNextPlayer} aria-label="Next player"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all active:scale-90"
                style={{ background: 'rgba(42,42,58,0.6)', border: '1px solid rgba(42,42,58,0.8)', color: 'rgba(232,232,240,0.5)', cursor: 'pointer' }}>
                ⏭
              </button>
            )}
            {currentRound < 5 && (
              <button onClick={handleSkipRound} aria-label="Next round"
                className="h-9 px-2.5 rounded-lg text-xs font-semibold transition-all active:scale-90 hidden sm:flex items-center"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#A78BFA', cursor: 'pointer' }}>
                Next Rd
              </button>
            )}
          </>
        )}
        <div className="text-right pl-1" style={{ borderLeft: '1px solid rgba(42,42,58,0.5)' }}>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(232,232,240,0.3)' }}>Budget</p>
          <p className="text-sm font-bold leading-none" style={{ color: '#FF6B00', fontFamily: 'var(--font-mono)' }}>
            ₹{myTeam?.budgetRemaining.toFixed(1) ?? '—'}
          </p>
        </div>
      </div>
    </header>
  );

  // ── Current bid display (mobile inline) ───────────────────────────────────
  const isLeadingInline = isHighestBidder;
  const MobileBidStatus = (
    <div className="rounded-2xl px-4 py-3 text-center"
      style={{ background: 'rgba(14,14,20,0.8)', border: '1px solid rgba(42,42,58,0.6)' }}>
      {currentBid ? (
        <>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(232,232,240,0.35)' }}>Current Bid</p>
          <p style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(2.5rem,10vw,3.5rem)', lineHeight: 1, color: isLeadingInline ? '#22C55E' : '#FFD700', textShadow: isLeadingInline ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(255,215,0,0.4)' }}>
            ₹{currentBid.amount} Cr
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: isLeadingInline ? '#4ADE80' : 'rgba(232,232,240,0.55)' }}>
            {isLeadingInline ? '🏆 You are leading!' : `${currentBid.teamName} is leading`}
          </p>
        </>
      ) : (
        <>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(232,232,240,0.35)' }}>Base Price</p>
          <p style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(2.5rem,10vw,3.5rem)', lineHeight: 1, color: '#FF6B00' }}>
            ₹{currentPlayer?.basePrice ?? '—'} Cr
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(232,232,240,0.3)' }}>No bids yet — be first!</p>
        </>
      )}
    </div>
  );

  // Mobile timer bar (horizontal)
  const MobileTimer = (
    <div className="flex items-center gap-3 px-1">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(42,42,58,0.8)' }}>
        <div
          className="h-full rounded-full transition-all duration-900"
          style={{
            width: `${(timerSeconds / 10) * 100}%`,
            background: timerSeconds <= 3 ? '#DC2626' : timerSeconds <= 6 ? '#FF6B00' : '#22C55E',
            boxShadow: timerSeconds <= 3 ? '0 0 8px #DC2626' : 'none',
          }}
        />
      </div>
      <span style={{
        fontFamily: 'var(--font-bebas)',
        fontSize: timerSeconds <= 3 ? '2rem' : '1.5rem',
        color: timerSeconds <= 3 ? '#DC2626' : timerSeconds <= 6 ? '#FF6B00' : '#22C55E',
        lineHeight: 1,
        minWidth: 28,
        textAlign: 'right',
        textShadow: timerSeconds <= 3 ? '0 0 12px #DC262688' : 'none',
        transition: 'color 0.3s',
      }}>
        {timerSeconds}
      </span>
    </div>
  );

  // ── MOBILE LAYOUT (hidden on lg+) ──────────────────────────────────────────
  const MobileLayout = (
    <div className="lg:hidden flex flex-col" style={{ minHeight: '100dvh' }}>
      {Header}

      {/* Scrollable content — bottom padding accounts for fixed bid bar */}
      <div className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}>
        <div className="px-3 py-3 space-y-3">

          {/* Timer */}
          {currentPlayer && MobileTimer}

          {/* Player card (compact) */}
          {currentPlayer
            ? <PlayerCard player={currentPlayer} compact />
            : <div className="flex items-center justify-center py-8">
                <p className="text-sm animate-pulse" style={{ color: 'rgba(232,232,240,0.25)' }}>
                  {isPaused ? '⏸ Auction paused' : '⏳ Between players...'}
                </p>
              </div>
          }

          {/* Bid status */}
          {currentPlayer && MobileBidStatus}

          {/* Bid history (compact) */}
          {bidHistory.length > 0 && currentPlayer && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(14,14,20,0.6)', border: '1px solid rgba(42,42,58,0.5)' }}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'rgba(232,232,240,0.3)' }}>Bid History</p>
              <BidHistory bids={bidHistory.slice(0, 5)} myTeamId={myTeam?.id ?? ''} />
            </div>
          )}

          {/* Teams — collapsible */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(42,42,58,0.5)' }}>
            <button
              onClick={() => setTeamsExpanded(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(14,14,20,0.8)', cursor: 'pointer' }}>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,232,240,0.4)' }}>
                All Teams · {room.teams.length}
              </span>
              <span style={{ color: 'rgba(232,232,240,0.3)', fontSize: '0.7rem' }}>{teamsExpanded ? '▲' : '▼'}</span>
            </button>
            {teamsExpanded && (
              <div className="px-3 pb-3 pt-1" style={{ background: 'rgba(10,10,15,0.6)' }}>
                <TeamBudgetList teams={room.teams} myUserId={effectiveUserId} />
              </div>
            )}
          </div>

          {/* Host: next round button (mobile) */}
          {isHost && currentRound < 5 && (
            <button onClick={handleSkipRound}
              className="w-full py-2.5 rounded-xl text-xs font-semibold tracking-widest uppercase active:scale-95 transition-all"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', cursor: 'pointer' }}>
              Skip to Next Round
            </button>
          )}
        </div>
      </div>

      {/* Fixed bottom bid bar */}
      {myTeam && (
        <MobileBidBar
          player={currentPlayer}
          currentBid={currentBid}
          myBudget={myTeam.budgetRemaining}
          myTeamId={myTeam.id}
          myPlayerCount={myTeam.players.length}
          squadSize={squadSize}
          timerSeconds={timerSeconds}
          isPaused={isPaused}
          biddingStarted={biddingStarted}
          isHighestBidder={isHighestBidder}
          squadFull={squadFull}
          canSkip={canSkip}
          canWithdraw={canWithdraw}
          hasWithdrawn={hasWithdrawn}
          skipVotes={skipVotes}
          totalTeams={totalTeams || room.teams.length}
          withdrawVotes={withdrawVotes}
          withdrawEligible={withdrawEligible}
          isPlayerClosed={isPlayerClosed}
          onBid={handleBid}
          onSkip={handleSkip}
          onWithdraw={handleWithdraw}
        />
      )}
    </div>
  );

  // ── DESKTOP LAYOUT (hidden below lg) ──────────────────────────────────────
  const DesktopLayout = (
    <div className="hidden lg:flex flex-col" style={{ minHeight: '100dvh' }}>
      {Header}
      <div className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-[1fr_320px_1fr] gap-4 h-full">

          {/* Left: Player card */}
          <div className="flex flex-col gap-4">
            {currentPlayer ? <PlayerCard player={currentPlayer} /> : <PlayerCardSkeleton />}
          </div>

          {/* Center: Bid panel + history */}
          <div className="flex flex-col gap-0 glass-bright rounded-2xl overflow-hidden">
            <div className="p-5 flex-1">
              {currentPlayer && myTeam ? (
                <BidPanel
                  player={currentPlayer}
                  currentBid={currentBid}
                  timerSeconds={timerSeconds}
                  myBudget={myTeam.budgetRemaining}
                  myTeamId={myTeam.id}
                  isPaused={isPaused}
                  biddingStarted={biddingStarted}
                  skipVotes={skipVotes}
                  totalTeams={totalTeams || room.teams.length}
                  withdrawVotes={withdrawVotes}
                  withdrawEligible={withdrawEligible}
                  isPlayerClosed={isPlayerClosed}
                  hasWithdrawn={hasWithdrawn}
                  squadFull={squadFull}
                  squadSize={squadSize}
                  isHighestBidder={isHighestBidder}
                  canSkip={canSkip}
                  canWithdraw={canWithdraw}
                  onBid={handleBid}
                  onSkip={handleSkip}
                  onWithdraw={handleWithdraw}
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
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2.5" style={{ color: 'rgba(232,232,240,0.3)' }}>Bid History</p>
                <BidHistory bids={bidHistory} myTeamId={myTeam?.id ?? ''} />
              </div>
            )}
          </div>

          {/* Right: Teams */}
          <div className="glass-bright rounded-2xl p-4 overflow-y-auto">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(232,232,240,0.3)' }}>
              All Teams · {room.teams.length}
            </p>
            <TeamBudgetList teams={room.teams} myUserId={effectiveUserId} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Confetti active={confettiActive} />
      {SoldBanner}
      {UnsoldBanner}
      {MobileLayout}
      {DesktopLayout}
    </>
  );
}
