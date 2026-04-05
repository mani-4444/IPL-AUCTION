// Server-side types — mirrors packages/shared/types.ts to avoid rootDir issues.
// Keep in sync with packages/shared/types.ts.

import type { Server, Socket } from 'socket.io';

export type PlayerRole = 'Batsman' | 'Wicketkeeper' | 'Bowler' | 'All-Rounder';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  rating: number;
  basePrice: number;
  nationality: 'Indian' | 'Overseas';
  team: string;
  imageUrl?: string;
  soldPrice?: number;
  soldTo?: string;
  isSold: boolean;
}

export interface TeamPlayer extends Player {
  soldPrice: number;
}

export type AuctionRound = 1 | 2 | 3 | 4 | 5;

export const ROUND_ROLES: Record<AuctionRound, PlayerRole | 'Unsold'> = {
  1: 'Batsman',
  2: 'Wicketkeeper',
  3: 'Bowler',
  4: 'All-Rounder',
  5: 'Unsold',
};

export interface Team {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  teamName: string;
  budgetRemaining: number;
  players: TeamPlayer[];
  playingXI: string[];
  bench: string[];
  captain?: string;
  viceCaptain?: string;
  finalScore?: FinalScore;
}

export interface FinalScore {
  xiScore: number;
  benchScore: number;
  roi: number;
  roleBonus: number;
  penalties: number;
  total: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  hasWicketkeeper: boolean;
  bowlingDepth: number;
  overseasCount: number;
  bestBatter?: string;
  bestBowler?: string;
  bestAllRounder?: string;
  bestWicketkeeper?: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  status: 'waiting' | 'auction' | 'team-setup' | 'results';
  teams: Team[];
  currentRound: AuctionRound;
  currentPlayer?: Player;
  currentBid?: Bid;
  auctionConfig: AuctionConfig;
}

export interface AuctionConfig {
  maxTeams: number;
  budgetCr: number;
  squadSize: number;
  bidTimerSeconds: number;
  bidIncrementCr: number;
}

export interface Bid {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
}

export interface ServerToClientEvents {
  'room:updated': (room: Room) => void;
  'auction:player-up': (player: Player, round: AuctionRound) => void;
  'auction:bid-placed': (bid: Bid) => void;
  'auction:timer-tick': (secondsLeft: number) => void;
  'auction:player-sold': (player: Player, winner: Bid) => void;
  'auction:player-unsold': (player: Player) => void;
  'auction:round-complete': (round: AuctionRound) => void;
  'auction:complete': () => void;
  'team:xi-submitted': (teamId: string) => void;
  'results:ready': (teams: Team[]) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (data: { userName: string; teamName: string }) => void;
  'room:join': (data: { code: string; userName: string; teamName: string }) => void;
  'room:leave': () => void;
  'room:rejoin': (data: { roomId: string; userId: string }) => void;
  'auction:start': () => void;
  'auction:bid': (amount: number) => void;
  'auction:next-player': () => void;
  'auction:pause': () => void;
  'auction:resume': () => void;
  'team:submit-xi': (data: {
    playingXI: string[];
    captain: string;
    viceCaptain: string;
  }) => void;
}

export type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface SocketData {
  userId: string;
  userName: string;
  teamName: string;
  roomId: string;
  teamId: string;
}
