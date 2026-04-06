'use client';
import { create } from 'zustand';
import type { Player, Bid, AuctionRound } from '../types';

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

  // Issue 5: skip votes
  skipVotes: number;
  totalTeams: number;

  setCurrentPlayer: (player: Player, round: AuctionRound) => void;
  setCurrentBid: (bid: Bid) => void;
  setTimer: (seconds: number) => void;
  setPlayerSold: (player: Player, bid: Bid) => void;
  setPlayerUnsold: (player: Player) => void;
  setPaused: (paused: boolean) => void;
  setRoundPreview: (players: Player[], round: AuctionRound, seconds: number) => void;
  clearRoundPreview: () => void;
  setSkipVotes: (votes: number, total: number) => void;
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

  setCurrentPlayer: (player, round) =>
    set({
      currentPlayer: player,
      currentRound: round,
      currentBid: null,
      timerSeconds: 10,
      lastSoldPlayer: null,
      lastUnsoldPlayer: null,
      // Clear preview when first player arrives
      roundPreviewPlayers: [],
      roundPreviewRound: null,
      skipVotes: 0,
    }),

  setCurrentBid: (bid) =>
    set((state) => ({
      currentBid: bid,
      bidHistory: [bid, ...state.bidHistory].slice(0, 20),
      timerSeconds: 10,
    })),

  setTimer: (seconds) => set({ timerSeconds: seconds }),

  setPlayerSold: (player, bid) =>
    set({ lastSoldPlayer: { player, bid }, currentPlayer: null, currentBid: null }),

  setPlayerUnsold: (player) =>
    set({ lastUnsoldPlayer: player, currentPlayer: null, currentBid: null }),

  setPaused: (paused) => set({ isPaused: paused }),

  setRoundPreview: (players, round, seconds) =>
    set({ roundPreviewPlayers: players, roundPreviewRound: round, roundPreviewSeconds: seconds }),

  clearRoundPreview: () =>
    set({ roundPreviewPlayers: [], roundPreviewRound: null, roundPreviewSeconds: 0 }),

  setSkipVotes: (votes, total) => set({ skipVotes: votes, totalTeams: total }),

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
    }),
}));
