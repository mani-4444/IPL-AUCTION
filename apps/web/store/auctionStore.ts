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
  setCurrentPlayer: (player: Player, round: AuctionRound) => void;
  setCurrentBid: (bid: Bid) => void;
  setTimer: (seconds: number) => void;
  setPlayerSold: (player: Player, bid: Bid) => void;
  setPlayerUnsold: (player: Player) => void;
  setPaused: (paused: boolean) => void;
  clearAuction: () => void;
}

export const useAuctionStore = create<AuctionState>((set, get) => ({
  currentPlayer: null,
  currentBid: null,
  currentRound: 1,
  timerSeconds: 10,
  bidHistory: [],
  lastSoldPlayer: null,
  lastUnsoldPlayer: null,
  isPaused: false,

  setCurrentPlayer: (player, round) =>
    set({ currentPlayer: player, currentRound: round, currentBid: null, timerSeconds: 10, lastSoldPlayer: null, lastUnsoldPlayer: null }),

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

  clearAuction: () =>
    set({
      currentPlayer: null,
      currentBid: null,
      timerSeconds: 10,
      bidHistory: [],
      lastSoldPlayer: null,
      lastUnsoldPlayer: null,
      isPaused: false,
    }),
}));
