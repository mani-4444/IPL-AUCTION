/**
 * Test scoring formula with mock data.
 * Usage: npx ts-node scripts/test-scoring.ts
 */

// Inline types to avoid rootDir import issues
type PlayerRole = 'Batsman' | 'Wicketkeeper' | 'Bowler' | 'All-Rounder';

interface TeamPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  rating: number;
  basePrice: number;
  nationality: 'Indian' | 'Overseas';
  team: string;
  isSold: boolean;
  soldPrice: number;
}

interface Team {
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
  finalScore?: any;
}

function makePlayer(
  id: string,
  name: string,
  role: PlayerRole,
  rating: number,
  nationality: 'Indian' | 'Overseas' = 'Indian',
  soldPrice: number = 2
): TeamPlayer {
  return {
    id, name, role, rating,
    basePrice: 1, nationality, team: 'CSK',
    isSold: true, soldPrice,
  };
}

// Import scoring function
// We can't import directly due to ts paths, so we replicate the test inline
function calculateFinalScore(team: Team, allTeams: Team[]) {
  const xi = team.playingXI.map(id => team.players.find(p => p.id === id)!);
  const bench = team.bench.map(id => team.players.find(p => p.id === id)!);
  const captain = team.players.find(p => p.id === team.captain);
  const vc = team.players.find(p => p.id === team.viceCaptain);

  // XI Score
  let xiSum = 0;
  for (const p of xi) {
    if (captain && p.id === captain.id) xiSum += p.rating * 2;
    else if (vc && p.id === vc.id) xiSum += p.rating * 2;
    else xiSum += p.rating;
  }
  const xiScore = (xiSum / 13) * 10;

  // Bench Score
  const benchAvg = bench.reduce((s, p) => s + p.rating, 0) / bench.length;
  const benchScore = benchAvg * 2;

  // ROI
  const totalRating = [...xi, ...bench].reduce((s, p) => s + p.rating, 0);
  const totalSpent = 100 - team.budgetRemaining;
  const roi = Math.min((totalRating / totalSpent) * 2, 20);

  // Penalties
  const hasWK = xi.some(p => p.role === 'Wicketkeeper');
  const bowlingCount = xi.filter(p => p.role === 'Bowler' || p.role === 'All-Rounder').length;
  const overseasCount = xi.filter(p => p.nationality === 'Overseas').length;
  let penalties = 0;
  if (!hasWK) penalties -= 10;
  if (bowlingCount < 5) penalties -= 10;
  if (overseasCount > 4) penalties -= 10 * (overseasCount - 4);

  const total = xiScore + benchScore + roi + penalties;

  return { xiScore: +xiScore.toFixed(2), benchScore: +benchScore.toFixed(2), roi: +roi.toFixed(2), penalties, total: +total.toFixed(2), hasWK, bowlingCount, overseasCount };
}

// --- Build test teams ---
const team1: Team = {
  id: 't1', userId: 'u1', userName: 'Test User', roomId: 'r1',
  teamName: 'Super Kings', budgetRemaining: 40,
  players: [
    makePlayer('p1', 'Batsman 1', 'Batsman', 85),
    makePlayer('p2', 'Batsman 2', 'Batsman', 80),
    makePlayer('p3', 'Batsman 3', 'Batsman', 75),
    makePlayer('p4', 'WK 1', 'Wicketkeeper', 82),
    makePlayer('p5', 'Bowler 1', 'Bowler', 78),
    makePlayer('p6', 'Bowler 2', 'Bowler', 76),
    makePlayer('p7', 'Bowler 3', 'Bowler', 74),
    makePlayer('p8', 'AR 1', 'All-Rounder', 80),
    makePlayer('p9', 'AR 2', 'All-Rounder', 77),
    makePlayer('p10', 'Batsman 4', 'Batsman', 70, 'Overseas'),
    makePlayer('p11', 'Bowler 4', 'Bowler', 72, 'Overseas'),
    // Bench
    makePlayer('p12', 'Bench 1', 'Batsman', 65),
    makePlayer('p13', 'Bench 2', 'Bowler', 60),
    makePlayer('p14', 'Bench 3', 'All-Rounder', 68),
    makePlayer('p15', 'Bench 4', 'Batsman', 55),
  ],
  playingXI: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11'],
  bench: ['p12','p13','p14','p15'],
  captain: 'p1',
  viceCaptain: 'p4',
};

const result = calculateFinalScore(team1, [team1]);

console.log('=== Scoring Test Results ===');
console.log(`XI Score:    ${result.xiScore} (sum with C/VC 2x, /13 *10)`);
console.log(`Bench Score: ${result.benchScore} (avg bench rating * 2)`);
console.log(`ROI:         ${result.roi} (capped at 20)`);
console.log(`Penalties:   ${result.penalties}`);
console.log(`  Has WK: ${result.hasWK}, Bowling depth: ${result.bowlingCount}, Overseas in XI: ${result.overseasCount}`);
console.log(`TOTAL:       ${result.total}`);
console.log('');

// Assertions
let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

assert('XI Score > 0', result.xiScore > 0);
assert('Bench Score > 0', result.benchScore > 0);
assert('ROI > 0 and <= 20', result.roi > 0 && result.roi <= 20);
assert('No WK penalty (has WK)', result.hasWK === true && result.penalties >= -10);
assert('Bowling depth >= 5 (no penalty)', result.bowlingCount >= 5);
assert('Overseas <= 4 (no penalty)', result.overseasCount <= 4);
assert('Total is sum of components', Math.abs(result.total - (result.xiScore + result.benchScore + result.roi + result.penalties)) < 0.1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
