export type FloatingDelta = {
  id: string;
  delta: string;
  isPositive: boolean;
  timestamp: number;
};

export type LeadChangeAlert = {
  team: 'a' | 'b';
  teamName: string;
  scoreA: number;
  scoreB: number;
  timestamp: number;
};

export type MomentumRun = {
  team: 'a' | 'b';
  teamName: string;
  points: number;
};

/**
 * Detects if a lead change has occurred based on previous vs incoming scores.
 */
export const detectLeadChange = (
  prevScoreA: number,
  prevScoreB: number,
  newScoreA: number,
  newScoreB: number,
  teamAName: string,
  teamBName: string
): LeadChangeAlert | null => {
  // If scores haven't changed, no lead change
  if (prevScoreA === newScoreA && prevScoreB === newScoreB) return null;

  const prevLeader = prevScoreA > prevScoreB ? 'a' : prevScoreB > prevScoreA ? 'b' : 'tie';
  const newLeader = newScoreA > newScoreB ? 'a' : newScoreB > newScoreA ? 'b' : 'tie';

  // Lead change occurs when a team takes the lead:
  // 1. From trailing directly to leading (a was trailing b, now a leads b, or vice-versa)
  // 2. From tie to leading (as long as game has started and previous state was non-zero)
  if (newLeader !== 'tie' && prevLeader !== newLeader) {
    const leaderTeamName = newLeader === 'a' ? (teamAName || 'Team A') : (teamBName || 'Team B');
    return {
      team: newLeader,
      teamName: leaderTeamName,
      scoreA: newScoreA,
      scoreB: newScoreB,
      timestamp: Date.now(),
    };
  }

  return null;
};

/**
 * Inspects recent match events in reverse chronological order to determine
 * whether an active unanswered scoring run exists for either team.
 */
export const detectMomentumRun = (
  events: { description: string }[],
  teamAName: string,
  teamBName: string,
  pointUnit: string = 'PTS'
): MomentumRun | null => {
  if (!events || events.length === 0 || !teamAName || !teamBName) return null;

  const cleanA = teamAName.trim().toLowerCase();
  const cleanB = teamBName.trim().toLowerCase();

  // Low scoring sports like Soccer/Futsal threshold is 2+ goals, standard ball games is 5+ points
  const threshold = pointUnit === 'GOAL' ? 2 : 5;

  let runTeam: 'a' | 'b' | null = null;
  let runPoints = 0;

  for (const evt of events) {
    const desc = evt?.description?.toLowerCase() || '';

    // Check if event is a score event (e.g., "scored 3 points", "scored 1 GOAL", etc.)
    const scoreMatch = desc.match(/scored\s+(\d+)/);
    if (!scoreMatch) continue; // Skip non-scoring commentary like substitutions/timeouts

    const pts = parseInt(scoreMatch[1], 10) || 0;
    if (pts <= 0) continue;

    const isTeamA = desc.includes(`for ${cleanA}`) || desc.startsWith(`${cleanA} scored`) || desc.includes(cleanA);
    const isTeamB = desc.includes(`for ${cleanB}`) || desc.startsWith(`${cleanB} scored`) || desc.includes(cleanB);

    if (isTeamA && !isTeamB) {
      if (runTeam === null) {
        runTeam = 'a';
        runPoints += pts;
      } else if (runTeam === 'a') {
        runPoints += pts;
      } else {
        // Run broken by opposing team
        break;
      }
    } else if (isTeamB && !isTeamA) {
      if (runTeam === null) {
        runTeam = 'b';
        runPoints += pts;
      } else if (runTeam === 'b') {
        runPoints += pts;
      } else {
        // Run broken by opposing team
        break;
      }
    } else {
      // Ambiguous team context, halt search
      break;
    }
  }

  if (runTeam && runPoints >= threshold) {
    return {
      team: runTeam,
      teamName: runTeam === 'a' ? teamAName : teamBName,
      points: runPoints,
    };
  }

  return null;
};
