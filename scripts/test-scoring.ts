/**
 * Scoring formula verification script.
 * Usage: npx ts-node scripts/test-scoring.ts
 */

// ── Inline types (avoid rootDir cross-package import) ──────────────────────
type PlayerRole = 'Batsman' | 'Wicketkeeper' | 'Bowler' | 'All-Rounder';

interface TeamPlayer {
  id: string; name: string; role: PlayerRole; rating: number;
  basePrice: number; nationality: 'Indian' | 'Overseas';
  team: string; isSold: boolean; soldPrice: number;
}

interface Team {
  id: string; userId: string; userName: string; roomId: string;
  teamName: string; budgetRemaining: number;
  players: TeamPlayer[]; playingXI: string[]; bench: string[];
  captain?: string; viceCaptain?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(label: string, condition: boolean, detail = '') {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.log(`  ✗  ${label}${detail ? '  →  ' + detail : ''}`); failed++; }
}

function near(a: number, b: number, eps = 0.01) { return Math.abs(a - b) < eps; }

function p(
  id: string, name: string, role: PlayerRole, rating: number,
  nationality: 'Indian' | 'Overseas' = 'Indian', soldPrice = 2
): TeamPlayer {
  return { id, name, role, rating, basePrice: 1, nationality, team: 'TST', isSold: true, soldPrice };
}

// ── Scoring implementation (mirrors apps/server/src/services/scoringService.ts) ──
function roleBonus(xi: TeamPlayer[], allTeams: Team[]) {
  const cats = [
    { role: 'Batsman', key: 'bat' },
    { role: 'Bowler', key: 'bowl' },
    { role: 'All-Rounder', key: 'ar' },
    { role: 'Wicketkeeper', key: 'wk' },
  ] as const;
  let bonus = 0;
  for (const cat of cats) {
    let bestRating = -1, bestId: string | undefined;
    for (const t of allTeams) {
      const txi = t.playingXI.map(id => t.players.find(pp => pp.id === id)!).filter(Boolean);
      for (const pp of txi) {
        if (pp.role === cat.role && pp.rating > bestRating) {
          bestRating = pp.rating; bestId = pp.id;
        }
      }
    }
    if (bestId && xi.some(pp => pp.id === bestId)) bonus += 2.5;
  }
  return bonus;
}

function score(team: Team, allTeams: Team[]) {
  const xi = team.playingXI.map(id => team.players.find(p => p.id === id)!).filter(Boolean);
  const bench = team.bench.map(id => team.players.find(p => p.id === id)!).filter(Boolean);
  const c = team.players.find(p => p.id === team.captain);
  const vc = team.players.find(p => p.id === team.viceCaptain);

  let xiSum = 0;
  for (const pp of xi) {
    if (c && pp.id === c.id)  xiSum += pp.rating * 2;
    else if (vc && pp.id === vc.id) xiSum += pp.rating * 2;
    else xiSum += pp.rating;
  }
  const xiScore = (xiSum / 13) * 10;

  const benchAvg = bench.length ? bench.reduce((s, pp) => s + pp.rating, 0) / bench.length : 0;
  const benchScore = benchAvg * 2;

  const totalRating = [...xi, ...bench].reduce((s, pp) => s + pp.rating, 0);
  const totalSpent = team.budgetRemaining < 100 ? 100 - team.budgetRemaining : 1;
  const roi = Math.min((totalRating / totalSpent) * 2, 20);

  const hasWK = xi.some(pp => pp.role === 'Wicketkeeper');
  const bowlingDepth = xi.filter(pp => pp.role === 'Bowler' || pp.role === 'All-Rounder').length;
  const overseasCount = xi.filter(pp => pp.nationality === 'Overseas').length;
  let penalties = 0;
  if (!hasWK) penalties -= 10;
  if (bowlingDepth < 5) penalties -= 10;
  if (overseasCount > 4) penalties -= 10 * (overseasCount - 4);

  const rb = roleBonus(xi, allTeams);
  const total = xiScore + benchScore + roi + rb + penalties;
  return { xiScore, benchScore, roi, roleBonus: rb, penalties, total, hasWK, bowlingDepth, overseasCount };
}

// ── Test data ────────────────────────────────────────────────────────────────
const base11 = [
  p('p1','Bat1','Batsman',85),       // captain 2× = 170
  p('p2','Bat2','Batsman',80),       // vc 2× = 160
  p('p3','Bat3','Batsman',75),
  p('p4','WK1','Wicketkeeper',82),
  p('p5','Bowl1','Bowler',78),
  p('p6','Bowl2','Bowler',76),
  p('p7','Bowl3','Bowler',74),
  p('p8','AR1','All-Rounder',80),
  p('p9','AR2','All-Rounder',77),
  p('p10','Bat4','Batsman',70,'Overseas'),
  p('p11','Bowl4','Bowler',72,'Overseas'),
];
const baseBench = [
  p('p12','Bench1','Batsman',65),
  p('p13','Bench2','Bowler',60),
  p('p14','Bench3','All-Rounder',68),
  p('p15','Bench4','Batsman',55),
];

function makeTeam(
  id: string, name: string, xi: TeamPlayer[], bench: TeamPlayer[],
  captain: string, vc: string, budgetRemaining = 40
): Team {
  return {
    id, userId: id, userName: name, roomId: 'r1', teamName: name,
    budgetRemaining, players: [...xi, ...bench],
    playingXI: xi.map(pp => pp.id),
    bench: bench.map(pp => pp.id),
    captain, viceCaptain: vc,
  };
}

// ── Suite 1: Standard valid team ─────────────────────────────────────────────
console.log('\n=== Suite 1: Standard valid team ===');
const t1 = makeTeam('t1', 'Team Alpha', base11, baseBench, 'p1', 'p2');
const r1 = score(t1, [t1]);

// XI sum: 85*2 + 80*2 + 75 + 82 + 78 + 76 + 74 + 80 + 77 + 70 + 72 = 170+160+684 = 1014
// xiScore = 1014/13*10 = 780
const expectedXiSum = 85*2 + 80*2 + 75 + 82 + 78 + 76 + 74 + 80 + 77 + 70 + 72;
const expectedXiScore = (expectedXiSum / 13) * 10;
console.log(`XI sum: ${expectedXiSum}, xiScore: ${expectedXiScore.toFixed(2)}`);

assert('xiScore matches formula', near(r1.xiScore, expectedXiScore));
assert('XI Score > 0', r1.xiScore > 0);
assert('bench score = avg(65,60,68,55)*2 = 124', near(r1.benchScore, (65+60+68+55)/4*2));
assert('ROI capped at 20', r1.roi <= 20);
assert('ROI > 0', r1.roi > 0);
assert('Has WK — no WK penalty', r1.hasWK);
assert('5 bowlers+AR (5) — no bowling penalty', r1.bowlingDepth >= 5);
assert('2 overseas — no overseas penalty', r1.overseasCount <= 4);
assert('No penalties', r1.penalties === 0);
assert('Total = sum of components', near(r1.total, r1.xiScore + r1.benchScore + r1.roi + r1.roleBonus + r1.penalties));

// ── Suite 2: Missing WK ─────────────────────────────────────────────────────
console.log('\n=== Suite 2: Missing Wicketkeeper (-10 penalty) ===');
const noWKxi = base11.map(pp => pp.role === 'Wicketkeeper' ? p('p4x','ExtraBat','Batsman',75) : pp);
const t2 = makeTeam('t2', 'No WK Team', noWKxi, baseBench, 'p1', 'p2');
const r2 = score(t2, [t2]);
assert('Has no WK', !r2.hasWK);
assert('WK penalty = -10', r2.penalties === -10);

// ── Suite 3: Insufficient bowling depth ─────────────────────────────────────
console.log('\n=== Suite 3: Shallow bowling (<5 bowlers/AR) (-10 penalty) ===');
const shallowBowlXI = [
  p('p1','Bat1','Batsman',85),
  p('p2','Bat2','Batsman',80),
  p('p3','Bat3','Batsman',75),
  p('p3b','Bat4','Batsman',73),
  p('p3c','Bat5','Batsman',71),
  p('p4','WK1','Wicketkeeper',82),
  p('p5','Bowl1','Bowler',78),
  p('p6','Bowl2','Bowler',76),
  p('p7','AR1','All-Rounder',74),
  p('p10','Bat6','Batsman',70),
  p('p11','Bat7','Batsman',68),
];
const t3 = makeTeam('t3', 'Bat Heavy', shallowBowlXI, baseBench, 'p1', 'p2');
const r3 = score(t3, [t3]);
assert('Bowling depth < 5', r3.bowlingDepth < 5);
assert('Bowling penalty = -10', r3.penalties <= -10);

// ── Suite 4: Overseas violation ─────────────────────────────────────────────
console.log('\n=== Suite 4: Too many overseas (>4) (-10 per extra) ===');
const overseasXI = [
  p('p1','Bat1','Batsman',85),
  p('p2','Bat2','Batsman',80,'Overseas'),
  p('p3','Bat3','Batsman',75,'Overseas'),
  p('p4','WK1','Wicketkeeper',82,'Overseas'),
  p('p5','Bowl1','Bowler',78,'Overseas'),
  p('p6','Bowl2','Bowler',76,'Overseas'),
  p('p7','Bowl3','Bowler',74),
  p('p8','AR1','All-Rounder',80),
  p('p9','AR2','All-Rounder',77),
  p('p10','Bat4','Batsman',70),
  p('p11','Bowl4','Bowler',72),
];
const t4 = makeTeam('t4', 'Overseas Heavy', overseasXI, baseBench, 'p1', 'p2');
const r4 = score(t4, [t4]);
assert('Overseas count = 5', r4.overseasCount === 5);
assert('Overseas penalty = -10 (1 extra)', r4.penalties <= -10);

// ── Suite 5: ROI cap ────────────────────────────────────────────────────────
console.log('\n=== Suite 5: ROI capped at 20 ===');
// Spend very little: budgetRemaining = 95 (spent only 5 Cr)
const cheapTeam = makeTeam('t5', 'Bargain Team', base11, baseBench, 'p1', 'p2', 95);
const r5 = score(cheapTeam, [cheapTeam]);
assert('ROI capped at 20', r5.roi === 20);

// ── Suite 6: Role Royalty Bonus ─────────────────────────────────────────────
console.log('\n=== Suite 6: Role Royalty Bonus (2.5 per category won) ===');
const tA_xi = [
  p('a1','SuperBat','Batsman',99),    // best batter overall
  p('a2','Bat2','Batsman',70),
  p('a3','WK','Wicketkeeper',75),
  p('a4','Bowl1','Bowler',78),
  p('a5','Bowl2','Bowler',76),
  p('a6','Bowl3','Bowler',74),
  p('a7','AR1','All-Rounder',80),
  p('a8','AR2','All-Rounder',77),
  p('a9','Bat3','Batsman',68),
  p('a10','Bowl4','Bowler',72),
  p('a11','Bat4','Batsman',65),
];
const tB_xi = [
  p('b1','OkBat','Batsman',75),       // not best batter
  p('b2','SuperWK','Wicketkeeper',98), // best WK overall
  p('b3','SuperBowl','Bowler',99),     // best bowler overall
  p('b4','Bowl2','Bowler',76),
  p('b5','Bowl3','Bowler',74),
  p('b6','SuperAR','All-Rounder',99),  // best AR overall
  p('b7','AR2','All-Rounder',77),
  p('b8','Bat2','Batsman',70),
  p('b9','Bat3','Batsman',68),
  p('b10','Bowl4','Bowler',72),
  p('b11','Bat4','Batsman',65),
];
const bench4 = [
  p('x1','B1','Batsman',50),
  p('x2','B2','Bowler',50),
  p('x3','B3','All-Rounder',50),
  p('x4','B4','Batsman',50),
];
const tA = makeTeam('tA', 'Team A', tA_xi, bench4, 'a1', 'a2');
const tB = makeTeam('tB', 'Team B', tB_xi, bench4, 'b1', 'b2');
const both = [tA, tB];
const rA = score(tA, both);
const rB = score(tB, both);

assert('Team A wins best-batter bonus (+2.5)', near(rA.roleBonus, 2.5));
assert('Team B wins WK+Bowler+AR bonus (+7.5)', near(rB.roleBonus, 7.5));
assert('Role bonus total = 10 (all categories covered)', near(rA.roleBonus + rB.roleBonus, 10));

// ── Suite 7: Edge — zero bench players ──────────────────────────────────────
console.log('\n=== Suite 7: Edge — no bench players ===');
const noBenchTeam: Team = {
  ...t1,
  id: 't7', teamName: 'No Bench',
  bench: [],
  players: base11,
};
const r7 = score(noBenchTeam, [noBenchTeam]);
assert('Bench score = 0 when no bench', r7.benchScore === 0);
assert('Total still computed without crash', Number.isFinite(r7.total));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Some tests FAILED — check scoring formula.\n');
  process.exit(1);
} else {
  console.log('All tests passed.\n');
}
