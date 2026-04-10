'use client';
import { create } from 'zustand';
import type { Player, Bid, AuctionRound, WithdrawVoteState, SyncStatePayload } from '../types';

interface AuctionState {
  currentPlayer: Player | null;
  currentBid: Bid | null;
  currentRound: AuctionRound;
  timerSeconds: number;
  bidHistory: Bid[];
  lastSoldPlayer: { player: Player; bid: Bid } | null;
  lastUnsoldPlayer: Player | null;
  isPaused: boolean;

  // Issue 3: round preview
  roundPreviewPlayers: Player[];
  roundPreviewRound: AuctionRound | null;
  roundPreviewSeconds: number;

  // Skip votes (pre-bid mode)
  skipVotes: number;
  totalTeams: number;
  roundCounts: Record<number, { total: number; remaining: number }>;

  // Withdraw votes (post-first-bid mode)
  biddingStarted: boolean;
  withdrawVotes: number;
  withdrawEligible: number;
  withdrawVoteTeamIds: string[];
  highestBidder: string | null;
  isPlayerClosed: boolean;

  setCurrentPlayer: (player: Player, round: AuctionRound) => void;
  setCurrentBid: (bid: Bid) => void;
  setTimer: (seconds: number) => void;
  setPlayerSold: (player: Player, bid: Bid) => void;
  setPlayerUnsold: (player: Player) => void;
  setPaused: (paused: boolean) => void;
  setRoundPreview: (players: Player[], round: AuctionRound, seconds: number) => void;
  clearRoundPreview: () => void;
  setRoundCounts: (counts: Record<number, { total: number; remaining: number }>) => void;
  setSkipVotes: (votes: number, total: number) => void;
  setBiddingStarted: (bid: Bid, withdrawState: WithdrawVoteState) => void;
  setWithdrawVotes: (withdrawState: WithdrawVoteState) => void;
  syncState: (state: SyncStatePayload) => void;
  clearAuction: () => void;
}

export const useAuctionStore = create<AuctionState>((set) => ({
  currentPlayer: null,
  currentBid: null,
  currentRound: 1,
  timerSeconds: 10,
  bidHistory: [],
  lastSoldPlayer: null,
  lastUnsoldPlayer: null,
  isPaused: false,
  roundPreviewPlayers: [],
  roundPreviewRound: null,
  roundPreviewSeconds: 0,
  skipVotes: 0,
  totalTeams: 0,
  roundCounts: {},
  biddingStarted: false,
  withdrawVotes: 0,
  withdrawEligible: 0,
  withdrawVoteTeamIds: [],
  highestBidder: null,
  isPlayerClosed: false,

  setCurrentPlayer: (player, round) =>
    set({
      currentPlayer: player,
      currentRound: round,
      currentBid: null,
      timerSeconds: 10,
      lastSoldPlayer: null,
      lastUnsoldPlayer: null,
      roundPreviewPlayers: [],
      roundPreviewRound: null,
      // Reset all per-player vote state
      skipVotes: 0,
      biddingStarted: false,
      withdrawVotes: 0,
      withdrawEligible: 0,
      withdrawVoteTeamIds: [],
      highestBidder: null,
      isPlayerClosed: false,
    }),

  setCurrentBid: (bid) =>
    set((state) => ({
      currentBid: bid,
      bidHistory: [bid, ...state.bidHistory].slice(0, 20),
      timerSeconds: 10,
      highestBidder: bid.teamId,
    })),

  setTimer: (seconds) => set({ timerSeconds: seconds }),

  setPlayerSold: (player, bid) =>
    set({ lastSoldPlayer: { player, bid }, currentPlayer: null, currentBid: null, isPlayerClosed: true }),

  setPlayerUnsold: (player) =>
    set({ lastUnsoldPlayer: player, currentPlayer: null, currentBid: null, isPlayerClosed: true }),

  setPaused: (paused) => set({ isPaused: paused }),

  setRoundPreview: (players, round, seconds) =>
    set({ roundPreviewPlayers: players, roundPreviewRound: round, roundPreviewSeconds: seconds }),

  clearRoundPreview: () =>
    set({ roundPreviewPlayers: [], roundPreviewRound: null, roundPreviewSeconds: 0 }),

  setRoundCounts: (counts) => set({ roundCounts: counts }),

  setSkipVotes: (votes, total) => set({ skipVotes: votes, totalTeams: total }),

  setBiddingStarted: (bid, withdrawState) =>
    set({
      biddingStarted: true,
      skipVotes: 0,
      currentBid: bid,
      withdrawVotes: withdrawState.votes.length,
      withdrawEligible: withdrawState.eligible.length,
      withdrawVoteTeamIds: withdrawState.votes,
      highestBidder: withdrawState.highestBidder,
    }),

  setWithdrawVotes: (withdrawState) =>
    set({
      withdrawVotes: withdrawState.votes.length,
      withdrawEligible: withdrawState.eligible.length,
      withdrawVoteTeamIds: withdrawState.votes,
      highestBidder: withdrawState.highestBidder,
    }),

  syncState: (state) =>
    set({
      currentPlayer: state.currentPlayer,
      currentBid: state.currentBid,
      currentRound: state.currentRound,
      biddingStarted: state.biddingStarted,
      highestBidder: state.highestBidder,
      skipVotes: state.skipVotes,
      withdrawVotes: state.withdrawVotes.votes.length,
      withdrawEligible: state.withdrawVotes.eligible.length,
      withdrawVoteTeamIds: state.withdrawVotes.votes,
      isPlayerClosed: state.isPlayerClosed,
      timerSeconds: state.timerSeconds,
      roundCounts: state.roundCounts,
    }),

  clearAuction: () =>
    set({
      currentPlayer: null,
      currentBid: null,
      timerSeconds: 10,
      bidHistory: [],
      lastSoldPlayer: null,
      lastUnsoldPlayer: null,
      isPaused: false,
      roundPreviewPlayers: [],
      roundPreviewRound: null,
      roundPreviewSeconds: 0,
      skipVotes: 0,
      totalTeams: 0,
      biddingStarted: false,
      withdrawVotes: 0,
      withdrawEligible: 0,
      withdrawVoteTeamIds: [],
      highestBidder: null,
      isPlayerClosed: false,
    }),
}));
