import { supabase } from '@/lib/supabase';
import { getSportScoringProfile } from '@/lib/sportScoringRules';

export type SportActionCardItem = {
  actionType: string;
  label: string;
  sublabel: string;
  pointsPerAction: number;
  count: number;
  totalPoints: number;
};

/**
 * Returns the sport-specific scoring action cards for a given sport (using SPORT_SCORING_PROFILES),
 * or an aggregated multi-sport breakdown when sport is 'All'.
 */
export function getSportScoringActionCards(
  sport: string,
  actionCounts: Record<string, number>,
  breakdown: ActionBreakdown
): SportActionCardItem[] {
  if (sport && sport !== 'All') {
    const profile = getSportScoringProfile(sport);
    return profile.actions.map((act) => {
      let count = actionCounts[act.actionType] || 0;
      if (count === 0) {
        if (act.actionType === 'Triple') count = breakdown.threePointers;
        else if (act.actionType === 'Field') count = breakdown.twoPointers;
        else if (act.actionType === 'FT') count = breakdown.freeThrows;
        else if (act.actionType === 'Kill' || act.actionType === 'Spike') count = breakdown.kills;
        else if (act.actionType === 'Ace') count = breakdown.aces;
        else if (act.actionType === 'Block') count = breakdown.blocks;
        else if (act.actionType === 'Goal') count = breakdown.goals;
        else if (act.actionType === 'Penalty') count = breakdown.penalties;
        else if (act.actionType === 'Run') count = breakdown.runs;
        else if (act.actionType === 'Point') count = breakdown.rallyPoints;
      }
      return {
        actionType: act.actionType,
        label: act.sublabel,
        sublabel: act.description,
        pointsPerAction: act.points,
        count,
        totalPoints: count * act.points,
      };
    });
  }

  // When 'All' sports is selected, return all non-zero actions across sports, or default top actions
  const allItems: SportActionCardItem[] = [
    { actionType: 'Triple', label: '3-Pointers', sublabel: 'Basketball (+3 PTS)', pointsPerAction: 3, count: breakdown.threePointers, totalPoints: breakdown.threePointers * 3 },
    { actionType: 'Field', label: '2PT Field Goals', sublabel: 'Basketball (+2 PTS)', pointsPerAction: 2, count: breakdown.twoPointers, totalPoints: breakdown.twoPointers * 2 },
    { actionType: 'FT', label: 'Free Throws', sublabel: 'Basketball (+1 PT)', pointsPerAction: 1, count: breakdown.freeThrows, totalPoints: breakdown.freeThrows },
    { actionType: 'Kill', label: 'Kills & Spikes', sublabel: 'Volleyball / Takraw (+1 PT)', pointsPerAction: 1, count: breakdown.kills, totalPoints: breakdown.kills },
    { actionType: 'Ace', label: 'Service Aces', sublabel: 'Volleyball / Takraw (+1 PT)', pointsPerAction: 1, count: breakdown.aces, totalPoints: breakdown.aces },
    { actionType: 'Block', label: 'Blocks', sublabel: 'Volleyball / Takraw (+1 PT)', pointsPerAction: 1, count: breakdown.blocks, totalPoints: breakdown.blocks },
    { actionType: 'Goal', label: 'Goals', sublabel: 'Soccer / Futsal (+1 GOAL)', pointsPerAction: 1, count: breakdown.goals, totalPoints: breakdown.goals },
    { actionType: 'Penalty', label: 'Penalty Kicks', sublabel: 'Soccer / Futsal (+1 GOAL)', pointsPerAction: 1, count: breakdown.penalties, totalPoints: breakdown.penalties },
    { actionType: 'Run', label: 'Runs & RBIs', sublabel: 'Baseball / Softball (+1 RUN)', pointsPerAction: 1, count: breakdown.runs, totalPoints: breakdown.runs },
    { actionType: 'HR', label: 'Home Runs', sublabel: 'Baseball / Softball (2R/3R/GS)', pointsPerAction: 2, count: breakdown.homeRuns, totalPoints: breakdown.homeRuns * 2 },
    { actionType: 'Point', label: 'Rally Points', sublabel: 'Pickleball / Table Tennis (+1 PT)', pointsPerAction: 1, count: breakdown.rallyPoints, totalPoints: breakdown.rallyPoints },
  ];

  const nonZero = allItems.filter((item) => item.count > 0);
  return nonZero.length > 0 ? nonZero : allItems.slice(0, 6);
}

/**
 * Picks the most relevant sport-specific stat pill for a player card in Scouting / Coach Recruitment
 */
export function getPrimarySportStatPill(
  summary?: PlayerDirectorySummary | null,
  sportContext?: string | null
): { label: string; value: number; unitLabel: string } {
  const sp = (sportContext && sportContext !== 'All' ? sportContext : summary?.activeSports?.[0] || '').toLowerCase();
  if (sp.includes('volleyball') || sp.includes('takraw')) {
    return { label: 'KIL', value: (summary?.kills || 0) + (summary?.aces || 0), unitLabel: 'Kills & Aces' };
  }
  if (sp.includes('soccer') || sp.includes('futsal') || sp.includes('football')) {
    return { label: 'GLS', value: (summary?.goals || 0) + (summary?.penalties || 0), unitLabel: 'Goals' };
  }
  if (sp.includes('baseball') || sp.includes('softball')) {
    return { label: 'RUN', value: (summary?.runs || 0) + (summary?.homeRuns || 0), unitLabel: 'Runs / HRs' };
  }
  if (sp.includes('pickleball') || sp.includes('table tennis')) {
    return { label: 'WIN', value: summary?.rallyPoints || summary?.totalPoints || 0, unitLabel: 'Rally Pts' };
  }
  if (sp.includes('basketball')) {
    return { label: '3PM', value: summary?.threePointers || 0, unitLabel: '3-Pointers' };
  }
  // Auto-detect based on highest recorded action if no sport context is set
  if (summary) {
    if (summary.kills + summary.aces + summary.blocks > summary.threePointers && summary.kills + summary.aces + summary.blocks > summary.goals) {
      return { label: 'KIL', value: summary.kills, unitLabel: 'Kills/Spikes' };
    }
    if (summary.goals + summary.penalties > summary.threePointers) {
      return { label: 'GLS', value: summary.goals + summary.penalties, unitLabel: 'Goals' };
    }
    if (summary.runs + summary.homeRuns > summary.threePointers) {
      return { label: 'RUN', value: summary.runs + summary.homeRuns, unitLabel: 'Runs' };
    }
    if (summary.threePointers > 0) {
      return { label: '3PM', value: summary.threePointers, unitLabel: '3-Pointers' };
    }
  }
  return { label: 'MVP', value: summary?.mvpCount || 0, unitLabel: 'MVP Stars' };
}

export type ActionBreakdown = {
  threePointers: number; // Basketball 'Triple' (+3)
  twoPointers: number;   // Basketball 'Field' (+2)
  freeThrows: number;    // Basketball 'FT' (+1)
  kills: number;         // Volleyball 'Kill' / Takraw 'Spike'
  aces: number;          // Volleyball / Takraw 'Ace'
  blocks: number;        // Volleyball / Takraw 'Block'
  goals: number;         // Soccer / Futsal 'Goal'
  penalties: number;     // Soccer / Futsal 'Penalty'
  homeRuns: number;      // Baseball '2-Run' | '3-Run' | 'GrandSlam'
  runs: number;          // Baseball 'Run'
  rallyPoints: number;   // Pickleball / Table Tennis 'Point'
};

export type RecordedGameLog = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  sport: string;
  round: string;
  status: string;
  matchTime: string | null;
  venue: string | null;
  myTeamId: string;
  myTeamName: string;
  myTeamScore: number;
  opponentTeamName: string;
  opponentTeamScore: number;
  result: 'W' | 'L' | 'D' | 'LIVE';
  playerPoints: number;
  jerseyNumber: string | null;
  threePointers: number;
  twoPointers: number;
  freeThrows: number;
  kills: number;
  aces: number;
  blocks: number;
  goals: number;
  penalties: number;
  homeRuns: number;
  runs: number;
  rallyPoints: number;
  actionCounts: Record<string, number>;
  isMatchMvp: boolean;
};

export type SportTelemetrySummary = {
  sport: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  ppg: number;
  mvpCount: number;
  activeSquadCount: number;
  actionBreakdown: ActionBreakdown;
  actionCounts: Record<string, number>;
};

export type PlayerSquadRecord = {
  rosterId: string;
  teamId: string;
  teamName: string;
  teamStatus: string;
  rosterStatus: string;
  jerseyNumber: number | null;
  position: string | null;
  isCaptain: boolean;
  isStarter: boolean;
  tournamentName: string;
  sport: string;
  tournamentStatus: string;
};

export type PlayerStarRecord = {
  id: string;
  starType: 'Red' | 'Gold';
  matchId: string | null;
  round: string | null;
  tournamentName: string | null;
  createdAt: string;
};

export type PlayerTelemetry = {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  ppg: number;
  redStars: number;
  goldStars: number;
  actionBreakdown: ActionBreakdown;
  actionCounts: Record<string, number>;
  perSportTelemetry: Record<string, SportTelemetrySummary>;
  sortedSports: SportTelemetrySummary[];
  recordedGames: RecordedGameLog[];
  activeSquads: PlayerSquadRecord[];
  stars: PlayerStarRecord[];
};

export type PlayerDirectorySummary = {
  playerId: string;
  gamesPlayed: number;
  totalPoints: number;
  ppg: number;
  threePointers: number;
  twoPointers: number;
  freeThrows: number;
  kills: number;
  aces: number;
  blocks: number;
  goals: number;
  penalties: number;
  homeRuns: number;
  runs: number;
  rallyPoints: number;
  mvpCount: number;
  redStars: number;
  goldStars: number;
  activeSports: string[];
  activeTeamNames: string[];
  positions: string[];
};

export type BoxScorePlayerRow = {
  playerId: string | null;
  playerName: string;
  jerseyNumber: string | null;
  position: string | null;
  isStarter: boolean;
  isCaptain: boolean;
  totalPoints: number;
  threePointers: number;
  twoPointers: number;
  freeThrows: number;
  kills: number;
  aces: number;
  blocks: number;
  goals: number;
  penalties: number;
  homeRuns: number;
  runs: number;
  isMvp: boolean;
};

export type MatchBoxScoreData = {
  match: {
    id: string;
    round: string;
    status: string;
    match_time: string | null;
    venue: string | null;
    team_a_id: string | null;
    team_b_id: string | null;
    team_a_score: number;
    team_b_score: number;
    winner_team_id: string | null;
    team_a_name: string;
    team_b_name: string;
    tournament_name: string;
    sport: string;
    official_scorekeeper_name?: string | null;
    finalizer_name?: string | null;
    finalized_at?: string | null;
    scorer_notes?: string | null;
    conflict_flag?: boolean;
    conflict_notes?: string | null;
  };
  teamABox: BoxScorePlayerRow[];
  teamBBox: BoxScorePlayerRow[];
  events: {
    id: string;
    description: string;
    created_at: string;
  }[];
};

export const AVAILABLE_SPORTS = [
  'Basketball',
  'Volleyball',
  'Soccer',
  'Futsal',
  'Sepak Takraw',
  'Baseball',
  'Softball',
  'Pickleball',
  'Table Tennis',
] as const;

export const AVAILABLE_POSITIONS = [
  'PG (Point Guard)',
  'SG (Shooting Guard)',
  'SF (Small Forward)',
  'PF (Power Forward)',
  'C (Center)',
  'Setter',
  'Outside Hitter / Spiker',
  'Middle Blocker',
  'Libero',
  'Striker / Forward',
  'Midfielder',
  'Defender',
  'Goalkeeper',
  'Tekong / Server',
  'Killer / Spiker',
  'Feeder',
  'Singles / Doubles Specialist',
  'All-Around / Utility',
] as const;

const createEmptyBreakdown = (): ActionBreakdown => ({
  threePointers: 0,
  twoPointers: 0,
  freeThrows: 0,
  kills: 0,
  aces: 0,
  blocks: 0,
  goals: 0,
  penalties: 0,
  homeRuns: 0,
  runs: 0,
  rallyPoints: 0,
});

const incrementBreakdown = (breakdown: ActionBreakdown, actionType: string | null | undefined, points: number) => {
  if (!actionType || points <= 0) return;
  const act = actionType.trim();
  if (act === 'Triple' || act === '3PT') breakdown.threePointers += 1;
  else if (act === 'Field' || act === '2PT') breakdown.twoPointers += 1;
  else if (act === 'FT') breakdown.freeThrows += 1;
  else if (act === 'Kill' || act === 'Spike') breakdown.kills += 1;
  else if (act === 'Ace') breakdown.aces += 1;
  else if (act === 'Block') breakdown.blocks += 1;
  else if (act === 'Goal') breakdown.goals += 1;
  else if (act === 'Penalty') breakdown.penalties += 1;
  else if (act === '2-Run' || act === '3-Run' || act === 'GrandSlam') breakdown.homeRuns += 1;
  else if (act === 'Run') breakdown.runs += 1;
  else if (act === 'Point') breakdown.rallyPoints += 1;
};

/**
 * Extracts short college code from full college name, e.g.,
 * "College of Sciences (CS)" -> "CS"
 */
export function extractCollegeCode(collegeName?: string | null): string {
  if (!collegeName) return '';
  const match = collegeName.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].trim().toUpperCase();
  return collegeName.trim().toUpperCase();
}

/**
 * Checks whether a player's college matches a target team's College or Binturungan Cluster/Tribe.
 */
export function evaluateSquadEligibility(
  playerCollegeId: string | null | undefined,
  playerCollegeName: string | null | undefined,
  targetTeam: {
    affiliation_type?: 'college' | 'cluster' | null;
    college_id?: string | null;
    cluster_id?: string | null;
    colleges?: { college_name: string } | null;
    clusters?: { name: string } | null;
  } | null,
  clustersList: { id: string; name: string; college_codes: string[] }[]
): {
  eligible: boolean;
  badgeLabel: string;
  reason: string;
  affiliationType: 'college' | 'cluster' | 'open';
} {
  if (!targetTeam) {
    return {
      eligible: true,
      badgeLabel: 'Open Recruitment',
      reason: 'Select a target squad to check College or Tribe eligibility.',
      affiliationType: 'open',
    };
  }

  const pCode = extractCollegeCode(playerCollegeName);

  if (targetTeam.affiliation_type === 'cluster' && targetTeam.cluster_id) {
    const cluster = clustersList.find((c) => c.id === targetTeam.cluster_id);
    const clusterName = cluster?.name || targetTeam.clusters?.name || 'Tribe';
    if (!cluster || !cluster.college_codes || cluster.college_codes.length === 0) {
      return {
        eligible: true,
        badgeLabel: `${clusterName} Eligible`,
        reason: `Open cluster recruitment for ${clusterName}`,
        affiliationType: 'cluster',
      };
    }

    const normalizedCodes = cluster.college_codes.map((c) => c.trim().toUpperCase());
    const isMatch =
      Boolean(pCode && normalizedCodes.includes(pCode)) ||
      Boolean(
        playerCollegeName &&
          normalizedCodes.some(
            (code) =>
              playerCollegeName.toUpperCase().includes(`(${code})`) ||
              playerCollegeName.toUpperCase() === code
          )
      );

    return {
      eligible: isMatch,
      badgeLabel: isMatch ? `Eligible • ${clusterName}` : `Out of Tribe (${pCode || 'No College'})`,
      reason: isMatch
        ? `${pCode || playerCollegeName} belongs to ${clusterName} (${normalizedCodes.join(', ')})`
        : `${clusterName} only accepts athletes from: ${normalizedCodes.join(', ')}`,
      affiliationType: 'cluster',
    };
  }

  if (targetTeam.college_id) {
    const teamCollegeName = targetTeam.colleges?.college_name || '';
    const teamCode = extractCollegeCode(teamCollegeName);
    const isMatch =
      (Boolean(playerCollegeId) && playerCollegeId === targetTeam.college_id) ||
      (Boolean(pCode) && Boolean(teamCode) && pCode === teamCode);

    return {
      eligible: isMatch,
      badgeLabel: isMatch ? `Eligible • ${teamCode || 'College Match'}` : `Different College (${pCode || 'Unassigned'})`,
      reason: isMatch
        ? `Verified member of ${teamCollegeName || 'target college'}`
        : `Squad is restricted to ${teamCollegeName || 'its affiliated college'}`,
      affiliationType: 'college',
    };
  }

  return {
    eligible: true,
    badgeLabel: 'Eligible',
    reason: 'Open squad affiliation',
    affiliationType: 'open',
  };
}

/**
 * Fetches complete career telemetry, shot/action breakdowns, and recorded game log for a single player.
 */
export async function fetchPlayerTelemetry(playerId: string): Promise<PlayerTelemetry> {
  const [statsRes, scoreEventsRes, rosterRes, starsRes] = await Promise.all([
    supabase
      .from('match_player_stats')
      .select('match_id, team_id, player_id, jersey_number, points, updated_at')
      .eq('player_id', playerId),
    supabase
      .from('match_score_events')
      .select('id, match_id, team_id, player_id, points, action_type, stat_type, delta, created_at')
      .eq('player_id', playerId)
      .or('undone.is.null,undone.eq.false'),
    supabase
      .from('team_roster')
      .select(`
        id,
        team_id,
        status,
        jersey_number,
        position,
        is_captain,
        is_starter,
        teams (
          id,
          name,
          status,
          is_deleted,
          tournaments (
            id,
            name,
            sport,
            status,
            is_deleted
          )
        )
      `)
      .eq('player_id', playerId)
      .neq('status', 'Rejected'),
    supabase
      .from('player_stars')
      .select('id, star_type, match_id, tournament_id, created_at, matches(round), tournaments(name)')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false }),
  ]);

  const statRows = (statsRes.data || []) as any[];
  const eventRows = (scoreEventsRes.data || []) as any[];
  const rosterRows = (rosterRes.data || []) as any[];
  const starRows = (starsRes.data || []) as any[];

  // Build active squads list and map of teamIds the player belongs to
  const activeSquads: PlayerSquadRecord[] = [];
  const approvedTeamIds = new Set<string>();
  const teamJerseyMap = new Map<string, string>();

  for (const r of rosterRows) {
    const teamObj = Array.isArray(r.teams) ? r.teams[0] : r.teams;
    if (!teamObj || teamObj.is_deleted) continue;
    const tourneyObj = Array.isArray(teamObj.tournaments) ? teamObj.tournaments[0] : teamObj.tournaments;
    if (tourneyObj?.is_deleted) continue;

    if (r.status === 'Approved') {
      approvedTeamIds.add(teamObj.id);
      if (r.jersey_number !== null && r.jersey_number !== undefined) {
        teamJerseyMap.set(teamObj.id, String(r.jersey_number));
      }
    }

    activeSquads.push({
      rosterId: r.id,
      teamId: teamObj.id,
      teamName: teamObj.name,
      teamStatus: teamObj.status || 'Pending',
      rosterStatus: r.status,
      jerseyNumber: r.jersey_number ?? null,
      position: r.position || null,
      isCaptain: Boolean(r.is_captain),
      isStarter: Boolean(r.is_starter),
      tournamentName: tourneyObj?.name || 'Official Tournament',
      sport: tourneyObj?.sport || 'Sport',
      tournamentStatus: tourneyObj?.status || 'Draft',
    });
  }

  // Collect all match IDs where the player either has recorded stats/events OR their approved team played
  const matchIdSet = new Set<string>();
  const matchTeamByPlayer = new Map<string, string>();

  for (const s of statRows) {
    if (s.match_id) {
      matchIdSet.add(s.match_id);
      if (s.team_id) matchTeamByPlayer.set(s.match_id, s.team_id);
    }
  }
  for (const e of eventRows) {
    if (e.match_id) {
      matchIdSet.add(e.match_id);
      if (e.team_id) matchTeamByPlayer.set(e.match_id, e.team_id);
    }
  }

  // Also query completed/ongoing matches for the player's approved teams so W/L and GP reflect all games played
  if (approvedTeamIds.size > 0) {
    const teamIdList = Array.from(approvedTeamIds);
    const [teamAMatches, teamBMatches] = await Promise.all([
      supabase
        .from('matches')
        .select('id, team_a_id, status')
        .in('team_a_id', teamIdList)
        .in('status', ['Ongoing', 'Completed']),
      supabase
        .from('matches')
        .select('id, team_b_id, status')
        .in('team_b_id', teamIdList)
        .in('status', ['Ongoing', 'Completed']),
    ]);

    for (const m of teamAMatches.data || []) {
      matchIdSet.add(m.id);
      if (!matchTeamByPlayer.has(m.id)) matchTeamByPlayer.set(m.id, m.team_a_id);
    }
    for (const m of teamBMatches.data || []) {
      matchIdSet.add(m.id);
      if (!matchTeamByPlayer.has(m.id)) matchTeamByPlayer.set(m.id, m.team_b_id);
    }
  }

  // Fetch full match metadata for all collected matchIds
  let matchesData: any[] = [];
  if (matchIdSet.size > 0) {
    const { data } = await supabase
      .from('matches')
      .select(`
        id,
        round,
        status,
        match_time,
        venue,
        team_a_id,
        team_b_id,
        team_a_score,
        team_b_score,
        winner_team_id,
        tournament_id,
        team_a:teams!matches_team_a_id_fkey(id, name),
        team_b:teams!matches_team_b_id_fkey(id, name),
        tournaments(id, name, sport, is_deleted)
      `)
      .in('id', Array.from(matchIdSet));

    matchesData = (data || []).filter((m: any) => {
      const tr = Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments;
      return !tr?.is_deleted && !String(m.round || '').startsWith('[ARCHIVED]');
    });
  }

  // Aggregate career action breakdown & per-match breakdown
  const careerBreakdown = createEmptyBreakdown();
  const careerActionCounts: Record<string, number> = {};
  const perMatchBreakdown = new Map<string, ActionBreakdown>();
  const perMatchActionCounts = new Map<string, Record<string, number>>();
  const perMatchEventPoints = new Map<string, number>();

  const normalizeActionKey = (raw?: string | null): string => {
    const act = (raw || '').trim();
    if (act === '3PT') return 'Triple';
    if (act === '2PT') return 'Field';
    return act;
  };

  for (const e of eventRows) {
    const mId = e.match_id;
    const pts = Number(e.delta ?? e.points ?? 0);
    incrementBreakdown(careerBreakdown, e.action_type, pts);
    const normKey = normalizeActionKey(e.action_type);
    if (normKey && pts > 0) {
      careerActionCounts[normKey] = (careerActionCounts[normKey] || 0) + 1;
    }

    if (mId) {
      if (!perMatchBreakdown.has(mId)) {
        perMatchBreakdown.set(mId, createEmptyBreakdown());
      }
      if (!perMatchActionCounts.has(mId)) {
        perMatchActionCounts.set(mId, {});
      }
      incrementBreakdown(perMatchBreakdown.get(mId)!, e.action_type, pts);
      if (normKey && pts > 0) {
        const mc = perMatchActionCounts.get(mId)!;
        mc[normKey] = (mc[normKey] || 0) + 1;
      }
      perMatchEventPoints.set(mId, (perMatchEventPoints.get(mId) || 0) + pts);
    }
  }

  const statPointsByMatch = new Map<string, { points: number; jersey: string | null }>();
  for (const s of statRows) {
    if (s.match_id) {
      statPointsByMatch.set(s.match_id, {
        points: Number(s.points || 0),
        jersey: s.jersey_number || null,
      });
    }
  }

  const mvpMatchIds = new Set<string>(
    starRows.filter((s) => s.star_type === 'Red' && s.match_id).map((s) => s.match_id)
  );

  const recordedGames: RecordedGameLog[] = [];
  let wins = 0;
  let losses = 0;
  let totalPoints = 0;

  for (const m of matchesData) {
    const tr = Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments;
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;

    const myTeamId =
      matchTeamByPlayer.get(m.id) ||
      (approvedTeamIds.has(m.team_a_id) ? m.team_a_id : m.team_b_id);

    const isTeamA = myTeamId === m.team_a_id;
    const myTeamName = (isTeamA ? teamA?.name : teamB?.name) || 'My Squad';
    const opponentTeamName = (isTeamA ? teamB?.name : teamA?.name) || 'Opponent';
    const myTeamScore = Number(isTeamA ? m.team_a_score : m.team_b_score) || 0;
    const opponentTeamScore = Number(isTeamA ? m.team_b_score : m.team_a_score) || 0;

    let result: 'W' | 'L' | 'D' | 'LIVE' = 'LIVE';
    if (m.status === 'Completed') {
      if (m.winner_team_id) {
        result = m.winner_team_id === myTeamId ? 'W' : 'L';
      } else if (myTeamScore > opponentTeamScore) {
        result = 'W';
      } else if (myTeamScore < opponentTeamScore) {
        result = 'L';
      } else {
        result = 'D';
      }
      if (result === 'W') wins += 1;
      else if (result === 'L') losses += 1;
    }

    const statRec = statPointsByMatch.get(m.id);
    const evtPts = perMatchEventPoints.get(m.id) || 0;
    const playerPoints = Math.max(statRec?.points ?? 0, evtPts, 0);
    totalPoints += playerPoints;

    const mBreakdown = perMatchBreakdown.get(m.id) || createEmptyBreakdown();
    const mActionCounts = perMatchActionCounts.get(m.id) || {};

    recordedGames.push({
      matchId: m.id,
      tournamentId: m.tournament_id,
      tournamentName: tr?.name || 'Official Tournament',
      sport: tr?.sport || 'Basketball',
      round: m.round || 'Match',
      status: m.status,
      matchTime: m.match_time || null,
      venue: m.venue || null,
      myTeamId,
      myTeamName,
      myTeamScore,
      opponentTeamName,
      opponentTeamScore,
      result,
      playerPoints,
      jerseyNumber: statRec?.jersey || teamJerseyMap.get(myTeamId) || null,
      threePointers: mBreakdown.threePointers,
      twoPointers: mBreakdown.twoPointers,
      freeThrows: mBreakdown.freeThrows,
      kills: mBreakdown.kills,
      aces: mBreakdown.aces,
      blocks: mBreakdown.blocks,
      goals: mBreakdown.goals,
      penalties: mBreakdown.penalties,
      homeRuns: mBreakdown.homeRuns,
      runs: mBreakdown.runs,
      rallyPoints: mBreakdown.rallyPoints,
      actionCounts: mActionCounts,
      isMatchMvp: mvpMatchIds.has(m.id),
    });
  }

  // Sort recorded games most recent first
  recordedGames.sort((a, b) => {
    const tA = a.matchTime ? new Date(a.matchTime).getTime() : 0;
    const tB = b.matchTime ? new Date(b.matchTime).getTime() : 0;
    return tB - tA;
  });

  // Build per-sport telemetry for all 9 official sports + any sport present in recordedGames/activeSquads
  const perSportTelemetry: Record<string, SportTelemetrySummary> = {};
  const ensureSportSummary = (sportName: string): SportTelemetrySummary => {
    const cleanSport = sportName.trim();
    if (!perSportTelemetry[cleanSport]) {
      perSportTelemetry[cleanSport] = {
        sport: cleanSport,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPoints: 0,
        ppg: 0,
        mvpCount: 0,
        activeSquadCount: 0,
        actionBreakdown: createEmptyBreakdown(),
        actionCounts: {},
      };
    }
    return perSportTelemetry[cleanSport];
  };

  for (const sp of AVAILABLE_SPORTS) {
    ensureSportSummary(sp);
  }
  for (const sq of activeSquads) {
    if (sq.sport) {
      const s = ensureSportSummary(sq.sport);
      if (sq.rosterStatus === 'Approved') {
        s.activeSquadCount += 1;
      }
    }
  }
  for (const g of recordedGames) {
    const s = ensureSportSummary(g.sport);
    s.gamesPlayed += 1;
    if (g.result === 'W') s.wins += 1;
    else if (g.result === 'L') s.losses += 1;
    s.totalPoints += g.playerPoints;
    if (g.isMatchMvp) s.mvpCount += 1;

    s.actionBreakdown.threePointers += g.threePointers;
    s.actionBreakdown.twoPointers += g.twoPointers;
    s.actionBreakdown.freeThrows += g.freeThrows;
    s.actionBreakdown.kills += g.kills;
    s.actionBreakdown.aces += g.aces;
    s.actionBreakdown.blocks += g.blocks;
    s.actionBreakdown.goals += g.goals;
    s.actionBreakdown.penalties += g.penalties;
    s.actionBreakdown.homeRuns += g.homeRuns;
    s.actionBreakdown.runs += g.runs;
    s.actionBreakdown.rallyPoints += g.rallyPoints;

    for (const [actKey, cnt] of Object.entries(g.actionCounts)) {
      s.actionCounts[actKey] = (s.actionCounts[actKey] || 0) + cnt;
    }
  }

  for (const s of Object.values(perSportTelemetry)) {
    const dec = s.wins + s.losses;
    s.winRate = dec > 0 ? Math.round((s.wins / dec) * 100) : 0;
    s.ppg = s.gamesPlayed > 0 ? Number((s.totalPoints / s.gamesPlayed).toFixed(1)) : 0;
  }

  // Sort sports from Most Played -> Least / Zero Played
  const sortedSports = Object.values(perSportTelemetry).sort((a, b) => {
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.activeSquadCount !== a.activeSquadCount) return b.activeSquadCount - a.activeSquadCount;
    return a.sport.localeCompare(b.sport);
  });

  // If player has stat rows for matches that weren't in matchesData, ensure totalPoints still includes them
  if (recordedGames.length === 0 && statRows.length > 0) {
    totalPoints = statRows.reduce((acc, r) => acc + Number(r.points || 0), 0);
  }

  const gamesPlayed = recordedGames.length;
  const decidedGames = wins + losses;
  const winRate = decidedGames > 0 ? Math.round((wins / decidedGames) * 100) : 0;
  const ppg = gamesPlayed > 0 ? Number((totalPoints / gamesPlayed).toFixed(1)) : 0;

  const stars: PlayerStarRecord[] = starRows.map((s) => ({
    id: s.id,
    starType: s.star_type,
    matchId: s.match_id,
    round: Array.isArray(s.matches) ? s.matches[0]?.round : s.matches?.round || null,
    tournamentName: Array.isArray(s.tournaments) ? s.tournaments[0]?.name : s.tournaments?.name || null,
    createdAt: s.created_at,
  }));

  const redStars = stars.filter((s) => s.starType === 'Red').length;
  const goldStars = stars.filter((s) => s.starType === 'Gold').length;

  return {
    playerId,
    gamesPlayed,
    wins,
    losses,
    winRate,
    totalPoints,
    ppg,
    redStars,
    goldStars,
    actionBreakdown: careerBreakdown,
    actionCounts: careerActionCounts,
    perSportTelemetry,
    sortedSports,
    recordedGames,
    activeSquads,
    stars,
  };
}

/**
 * Batch-fetches career stat summaries for all players in 1 parallel query roundtrip.
 * Used by Coach Recruitment Directory and Scouting Hub for instant filtering & sorting.
 */
export async function fetchBatchPlayerSummaries(): Promise<Record<string, PlayerDirectorySummary>> {
  const [statsRes, eventsRes, starsRes, rostersRes] = await Promise.all([
    supabase.from('match_player_stats').select('match_id, player_id, points'),
    supabase
      .from('match_score_events')
      .select('match_id, player_id, points, delta, action_type')
      .or('undone.is.null,undone.eq.false'),
    supabase.from('player_stars').select('player_id, star_type'),
    supabase
      .from('team_roster')
      .select('player_id, position, status, teams(name, is_deleted, status, tournaments(sport, is_deleted))')
      .eq('status', 'Approved'),
  ]);

  const map: Record<string, PlayerDirectorySummary> = {};
  const matchSets: Record<string, Set<string>> = {};

  const ensurePlayer = (id: string): PlayerDirectorySummary => {
    if (!map[id]) {
      map[id] = {
        playerId: id,
        gamesPlayed: 0,
        totalPoints: 0,
        ppg: 0,
        threePointers: 0,
        twoPointers: 0,
        freeThrows: 0,
        kills: 0,
        aces: 0,
        blocks: 0,
        goals: 0,
        penalties: 0,
        homeRuns: 0,
        runs: 0,
        rallyPoints: 0,
        mvpCount: 0,
        redStars: 0,
        goldStars: 0,
        activeSports: [],
        activeTeamNames: [],
        positions: [],
      };
      matchSets[id] = new Set();
    }
    return map[id];
  };

  for (const row of (statsRes.data || []) as any[]) {
    if (!row.player_id) continue;
    const p = ensurePlayer(row.player_id);
    p.totalPoints += Math.max(0, Number(row.points || 0));
    if (row.match_id) matchSets[row.player_id].add(row.match_id);
  }

  for (const ev of (eventsRes.data || []) as any[]) {
    if (!ev.player_id) continue;
    const p = ensurePlayer(ev.player_id);
    if (ev.match_id) matchSets[ev.player_id].add(ev.match_id);
    const pts = Number(ev.delta ?? ev.points ?? 0);
    if (pts > 0) {
      const act = (ev.action_type || '').trim();
      if (act === 'Triple' || act === '3PT') p.threePointers += 1;
      else if (act === 'Field' || act === '2PT') p.twoPointers += 1;
      else if (act === 'FT') p.freeThrows += 1;
      else if (act === 'Kill' || act === 'Spike') p.kills += 1;
      else if (act === 'Ace') p.aces += 1;
      else if (act === 'Block') p.blocks += 1;
      else if (act === 'Goal') p.goals += 1;
      else if (act === 'Penalty') p.penalties += 1;
      else if (act === '2-Run' || act === '3-Run' || act === 'GrandSlam') p.homeRuns += 1;
      else if (act === 'Run') p.runs += 1;
      else if (act === 'Point') p.rallyPoints += 1;
    }
  }

  for (const st of (starsRes.data || []) as any[]) {
    if (!st.player_id) continue;
    const p = ensurePlayer(st.player_id);
    p.mvpCount += 1;
    if (st.star_type === 'Red') p.redStars += 1;
    else if (st.star_type === 'Gold') p.goldStars += 1;
  }

  for (const r of (rostersRes.data || []) as any[]) {
    if (!r.player_id) continue;
    const p = ensurePlayer(r.player_id);
    if (r.position && !p.positions.includes(r.position)) {
      p.positions.push(r.position);
    }
    const tObj = Array.isArray(r.teams) ? r.teams[0] : r.teams;
    if (tObj && !tObj.is_deleted && tObj.status !== 'Rejected') {
      if (tObj.name && !p.activeTeamNames.includes(tObj.name)) {
        p.activeTeamNames.push(tObj.name);
      }
      const trObj = Array.isArray(tObj.tournaments) ? tObj.tournaments[0] : tObj.tournaments;
      if (trObj && !trObj.is_deleted && trObj.sport && !p.activeSports.includes(trObj.sport)) {
        p.activeSports.push(trObj.sport);
      }
    }
  }

  for (const id of Object.keys(map)) {
    const gp = matchSets[id]?.size || 0;
    map[id].gamesPlayed = gp;
    map[id].ppg = gp > 0 ? Number((map[id].totalPoints / gp).toFixed(1)) : 0;
  }

  return map;
}

/**
 * Fetches a complete Team A vs Team B player box score and shot/action breakdown for any match.
 */
export async function fetchMatchBoxScore(matchId: string): Promise<MatchBoxScoreData | null> {
  const { data: matchData, error } = await supabase
    .from('matches')
    .select(`
      id,
      round,
      status,
      match_time,
      venue,
      team_a_id,
      team_b_id,
      team_a_score,
      team_b_score,
      winner_team_id,
      official_scorekeeper_id,
      finalized_by,
      finalized_at,
      scorer_notes,
      conflict_flag,
      conflict_notes,
      team_a:teams!matches_team_a_id_fkey(id, name),
      team_b:teams!matches_team_b_id_fkey(id, name),
      tournaments(id, name, sport)
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (error || !matchData) return null;

  const m: any = matchData;
  const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
  const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
  const tr = Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments;

  const teamIds = [m.team_a_id, m.team_b_id].filter(Boolean);
  const officialIds = [m.official_scorekeeper_id, m.finalized_by].filter(Boolean) as string[];

  const [rostersRes, statsRes, scoreEventsRes, starsRes, eventsRes, officialsRes] = await Promise.all([
    teamIds.length > 0
      ? supabase
          .from('team_roster')
          .select('team_id, player_id, jersey_number, position, is_starter, is_captain, status, users(full_name)')
          .in('team_id', teamIds)
          .eq('status', 'Approved')
      : Promise.resolve({ data: [] }),
    supabase
      .from('match_player_stats')
      .select('team_id, player_id, jersey_number, custom_player_label, points, users:player_id(full_name)')
      .eq('match_id', matchId),
    supabase
      .from('match_score_events')
      .select('team_id, player_id, points, delta, action_type, undone')
      .eq('match_id', matchId)
      .or('undone.is.null,undone.eq.false'),
    supabase
      .from('player_stars')
      .select('player_id, star_type')
      .eq('match_id', matchId),
    supabase
      .from('match_events')
      .select('id, description, created_at')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(40),
    officialIds.length > 0
      ? supabase.from('users').select('id, full_name').in('id', officialIds)
      : Promise.resolve({ data: [] }),
  ]);

  const officialsMap = new Map((officialsRes.data || []).map((u: any) => [u.id, u.full_name]));
  const officialScorekeeperName = m.official_scorekeeper_id ? (officialsMap.get(m.official_scorekeeper_id) || null) : null;
  const finalizerName = m.finalized_by ? (officialsMap.get(m.finalized_by) || null) : null;

  const mvpIds = new Set<string>((starsRes.data || []).map((s: any) => s.player_id));

  const buildTeamBox = (teamId: string | null): BoxScorePlayerRow[] => {
    if (!teamId) return [];
    const rowsByKey = new Map<string, BoxScorePlayerRow>();

    // Seed with approved roster members
    for (const r of (rostersRes.data || []) as any[]) {
      if (r.team_id !== teamId) continue;
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      const key = r.player_id || `roster-${r.jersey_number}`;
      rowsByKey.set(key, {
        playerId: r.player_id || null,
        playerName: u?.full_name || 'Roster Athlete',
        jerseyNumber: r.jersey_number !== null && r.jersey_number !== undefined ? String(r.jersey_number) : null,
        position: r.position || null,
        isStarter: Boolean(r.is_starter),
        isCaptain: Boolean(r.is_captain),
        totalPoints: 0,
        threePointers: 0,
        twoPointers: 0,
        freeThrows: 0,
        kills: 0,
        aces: 0,
        blocks: 0,
        goals: 0,
        penalties: 0,
        homeRuns: 0,
        runs: 0,
        isMvp: Boolean(r.player_id && mvpIds.has(r.player_id)),
      });
    }

    // Apply match_player_stats
    for (const s of (statsRes.data || []) as any[]) {
      if (s.team_id !== teamId) continue;
      const key = s.player_id || `custom-${s.custom_player_label || s.jersey_number || Math.random()}`;
      const u = Array.isArray(s.users) ? s.users[0] : s.users;
      const existing = rowsByKey.get(key);
      if (existing) {
        existing.totalPoints = Math.max(existing.totalPoints, Number(s.points || 0));
        if (!existing.jerseyNumber && s.jersey_number) existing.jerseyNumber = String(s.jersey_number);
      } else {
        rowsByKey.set(key, {
          playerId: s.player_id || null,
          playerName: u?.full_name || s.custom_player_label || (s.jersey_number ? `Jersey #${s.jersey_number}` : 'Scorer'),
          jerseyNumber: s.jersey_number ? String(s.jersey_number) : null,
          position: null,
          isStarter: false,
          isCaptain: false,
          totalPoints: Number(s.points || 0),
          threePointers: 0,
          twoPointers: 0,
          freeThrows: 0,
          kills: 0,
          aces: 0,
          blocks: 0,
          goals: 0,
          penalties: 0,
          homeRuns: 0,
          runs: 0,
          isMvp: Boolean(s.player_id && mvpIds.has(s.player_id)),
        });
      }
    }

    // Apply match_score_events breakdowns
    const eventPtsByPlayer = new Map<string, number>();
    for (const ev of (scoreEventsRes.data || []) as any[]) {
      if (ev.undone) continue;
      if (ev.team_id !== teamId || !ev.player_id) continue;
      const key = ev.player_id;
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          playerId: ev.player_id,
          playerName: 'Athlete',
          jerseyNumber: null,
          position: null,
          isStarter: false,
          isCaptain: false,
          totalPoints: 0,
          threePointers: 0,
          twoPointers: 0,
          freeThrows: 0,
          kills: 0,
          aces: 0,
          blocks: 0,
          goals: 0,
          penalties: 0,
          homeRuns: 0,
          runs: 0,
          isMvp: mvpIds.has(ev.player_id),
        });
      }
      const row = rowsByKey.get(key)!;
      const pts = Number(ev.delta ?? ev.points ?? 0);
      eventPtsByPlayer.set(key, (eventPtsByPlayer.get(key) || 0) + pts);

      if (pts > 0) {
        const act = (ev.action_type || '').trim();
        if (act === 'Triple' || act === '3PT') row.threePointers += 1;
        else if (act === 'Field' || act === '2PT') row.twoPointers += 1;
        else if (act === 'FT') row.freeThrows += 1;
        else if (act === 'Kill' || act === 'Spike') row.kills += 1;
        else if (act === 'Ace') row.aces += 1;
        else if (act === 'Block') row.blocks += 1;
        else if (act === 'Goal') row.goals += 1;
        else if (act === 'Penalty') row.penalties += 1;
        else if (act === '2-Run' || act === '3-Run' || act === 'GrandSlam') row.homeRuns += 1;
        else if (act === 'Run') row.runs += 1;
      }
    }

    for (const [key, evtPts] of eventPtsByPlayer.entries()) {
      const row = rowsByKey.get(key);
      if (row && evtPts > row.totalPoints) {
        row.totalPoints = evtPts;
      }
    }

    return Array.from(rowsByKey.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return a.playerName.localeCompare(b.playerName);
    });
  };

  return {
    match: {
      id: m.id,
      round: m.round || 'Match',
      status: m.status,
      match_time: m.match_time || null,
      venue: m.venue || null,
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      team_a_score: Number(m.team_a_score || 0),
      team_b_score: Number(m.team_b_score || 0),
      winner_team_id: m.winner_team_id || null,
      team_a_name: teamA?.name || 'Team A',
      team_b_name: teamB?.name || 'Team B',
      tournament_name: tr?.name || 'Tournament',
      sport: tr?.sport || 'Basketball',
      official_scorekeeper_name: officialScorekeeperName,
      finalizer_name: finalizerName,
      finalized_at: m.finalized_at || null,
      scorer_notes: m.scorer_notes || null,
      conflict_flag: Boolean(m.conflict_flag),
      conflict_notes: m.conflict_notes || null,
    },
    teamABox: buildTeamBox(m.team_a_id),
    teamBBox: buildTeamBox(m.team_b_id),
    events: (eventsRes.data || []) as any[],
  };
}
