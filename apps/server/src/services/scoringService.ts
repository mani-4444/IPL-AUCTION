import type { Team, FinalScore, TeamPlayer } from '../types';

function getPlayer(team: Team, playerId: string): TeamPlayer | undefined {
  return team.players.find((p) => p.id === playerId);
}

/**
 * Calculate the Role Royalty Bonus: +2.5 for each category where the team
 * owns the best player (highest rating) across all teams.
 * Categories: best batter, best bowler, best all-rounder, best wicketkeeper.
 */
function calculateRoleBonus(
  xi: TeamPlayer[],
  allTeams: Team[]
): { bonus: number; bestBatter?: string; bestBowler?: string; bestAllRounder?: string; bestWicketkeeper?: string } {
  const categories: { role: string; key: string }[] = [
    { role: 'Batsman', key: 'bestBatter' },
    { role: 'Bowler', key: 'bestBowler' },
    { role: 'All-Rounder', key: 'bestAllRounder' },
    { role: 'Wicketkeeper', key: 'bestWicketkeeper' },
  ];

  let bonus = 0;
  const result: Record<string, string | undefined> = {};

  for (const cat of categories) {
    // Find the highest rated player in this role across ALL teams' XIs
    let bestRating = -1;
    let bestPlayerId: string | undefined;
    let bestTeamId: string | undefined;

    for (const t of allTeams) {
      const teamXI = t.playingXI.map((id) => t.players.find((p) => p.id === id)).filter(Boolean) as TeamPlayer[];
      for (const p of teamXI) {
        if (p.role === cat.role && p.rating > bestRating) {
          bestRating = p.rating;
          bestPlayerId = p.id;
          bestTeamId = t.id;
        }
      }
    }

    result[cat.key] = bestPlayerId;

    // Check if this team's XI contains the best player
    if (bestPlayerId && xi.some((p) => p.id === bestPlayerId)) {
      bonus += 12.5;
    }
  }

  return {
    bonus,
    bestBatter: result.bestBatter,
    bestBowler: result.bestBowler,
    bestAllRounder: result.bestAllRounder,
    bestWicketkeeper: result.bestWicketkeeper,
  };
}

export function calculateFinalScore(team: Team, allTeams: Team[]): FinalScore {
  const xi = team.playingXI
    .map((id) => getPlayer(team, id))
    .filter(Boolean) as TeamPlayer[];

  const bench = team.bench
    .map((id) => getPlayer(team, id))
    .filter(Boolean) as TeamPlayer[];

  const captain = team.captain ? getPlayer(team, team.captain) : undefined;
  const vc = team.viceCaptain ? getPlayer(team, team.viceCaptain) : undefined;

  // --- XI Score (max ~100) ---
  // Captain and VC ratings count 2x. Divide by 13 (9 normal + 2 + 2), scale to max ~100
  let xiSum = 0;
  for (const p of xi) {
    if (captain && p.id === captain.id) {
      xiSum += p.rating * 2;
    } else if (vc && p.id === vc.id) {
      xiSum += p.rating * 2;
    } else {
      xiSum += p.rating;
    }
  }
  const xiScore = xiSum / 13;

  // --- Bench Score (max 20) ---
  const benchSum = bench.reduce((s, p) => s + p.rating, 0);
  const benchAvg = bench.length > 0 ? benchSum / bench.length : 0;
  const benchScore = (benchAvg / 100) * 30;

  // --- ROI (max 20, capped) ---
  const totalRating = [...xi, ...bench].reduce((s, p) => s + p.rating, 0);
  const totalSpent = team.budgetRemaining < 100
    ? 100 - team.budgetRemaining
    : 1; // Avoid division by zero
  const roi = Math.min((totalRating / totalSpent) * 0.5, 20);

  // --- Penalties ---
  const hasWK = xi.some((p) => p.role === 'Wicketkeeper');
  const bowlingCount = xi.filter(
    (p) => p.role === 'Bowler' || p.role === 'All-Rounder'
  ).length;
  const overseasCount = xi.filter((p) => p.nationality === 'Overseas').length;

  let penalties = 0;
  if (!hasWK) penalties -= 10;
  if (bowlingCount < 5) penalties -= 10;
  if (overseasCount > 4) penalties -= 10 * (overseasCount - 4);

  // --- Role Royalty Bonus (max 10) ---
  const { bonus: roleBonus, bestBatter, bestBowler, bestAllRounder, bestWicketkeeper } =
    calculateRoleBonus(xi, allTeams);

  const total = xiScore + benchScore + roi + roleBonus + penalties;

  return {
    xiScore: Math.round(xiScore * 100) / 100,
    benchScore: Math.round(benchScore * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    roleBonus,
    penalties,
    total: Math.round(total * 100) / 100,
    breakdown: {
      hasWicketkeeper: hasWK,
      bowlingDepth: bowlingCount,
      overseasCount,
      bestBatter,
      bestBowler,
      bestAllRounder,
      bestWicketkeeper,
    },
  };
}

export function calculateAllScores(teams: Team[]): void {
  for (const team of teams) {
    team.finalScore = calculateFinalScore(team, teams);
  }

  // Sort by total score descending
  teams.sort((a, b) => (b.finalScore?.total ?? 0) - (a.finalScore?.total ?? 0));
}
