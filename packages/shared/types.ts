// packages/shared/types.ts
// Shared TypeScript types between web & server

export type PlayerRole = 'Batsman' | 'Wicketkeeper' | 'Bowler' | 'All-Rounder';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  rating: number;        // 1–100
  basePrice: number;     // in Cr (e.g. 0.5, 1, 2)
  nationality: 'Indian' | 'Overseas';
  team: string;          // IPL franchise (for display)
  imageUrl?: string;
  soldPrice?: number;
  soldTo?: string;       // teamId
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
  budgetRemaining: number;  // starts at 100 Cr
  players: TeamPlayer[];
  playingXI: string[];      // player ids (11)
  bench: string[];          // player ids (4)
  captain?: string;         // player id
  viceCaptain?: string;     // player id
  finalScore?: FinalScore;
}

export interface FinalScore {
  xiScore: number;       // max 100
  benchScore: number;    // max 20
  roi: number;           // max 20
  roleBonus: number;     // max 10
  penalties: number;     // negative
  total: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  hasWicketkeeper: boolean;
  bowlingDepth: number;       // count of bowlers + allrounders in XI
  overseasCount: number;
  bestBatter?: string;        // player id
  bestBowler?: string;
  bestAllRounder?: string;
  bestWicketkeeper?: string;
}

export interface Room {
  id: string;
  code: string;           // 6-char join code
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
  maxTeams: number;          // 10
  budgetCr: number;          // 100
  squadSize: number;         // 15
  bidTimerSeconds: number;   // 10
  bidIncrementCr: number;    // 0.25 default
}

export interface Bid {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
}

// Socket.io Events
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
