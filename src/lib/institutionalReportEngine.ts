import { supabase } from '@/lib/supabase';
import { extractCollegeCode } from '@/lib/collegeDictionary';

export interface ReportFilterOptions {
  academicYear: string; // 'current' | '2026' | '2025' | '2024' | 'all'
  sport: string; // 'all' | 'Basketball' | ...
  division: string; // 'all' | 'binturungan' | 'collegiate' | 'friendly'
}

export interface WinningCollegeRecord {
  tournamentId: string;
  tournamentName: string;
  sport: string;
  academicYear: string;
  division: string;
  championCollege: string;
  championCollegeCode: string;
  championTeamName: string;
  runnerUpCollege: string;
  runnerUpCollegeCode: string;
  runnerUpTeamName: string;
  bronzeCollege: string;
  bronzeCollegeCode: string;
  bronzeTeamName: string;
  finalsScore: string;
}

export interface TeamStandingRecord {
  teamId: string;
  teamName: string;
  collegeName: string;
  collegeCode: string;
  sport: string;
  tournamentName: string;
  division: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
}

export interface AthleteStandingRecord {
  playerId: string;
  playerName: string;
  collegeName: string;
  collegeCode: string;
  sport: string;
  teamName: string;
  gamesPlayed: number;
  totalPoints: number;
  ppg: number;
  mvpCount: number;
  rank: number;
}

export interface MvpAwardRecord {
  starId: string;
  starType: 'Gold' | 'Red';
  awardTitle: string;
  athleteName: string;
  collegeName: string;
  collegeCode: string;
  sport: string;
  tournamentName: string;
  matchContext: string;
  awardedDate: string;
}

export interface ParticipationSummaryRecord {
  sport: string;
  totalTournaments: number;
  totalTeams: number;
  totalAthletes: number;
  collegesRepresented: number;
  collegeCodes: string[];
}

export interface CollegeParticipationRecord {
  collegeName: string;
  collegeCode: string;
  participatingSports: string[];
  totalTeams: number;
  totalAthletes: number;
  championships: number;
  runnerUps: number;
  goldStars: number;
  redStars: number;
}

export interface InstitutionalReportData {
  metadata: {
    reportTitle: string;
    generatedAt: string;
    generatedBy: string;
    academicYear: string;
    sportFilter: string;
    divisionFilter: string;
  };
  winningColleges: WinningCollegeRecord[];
  teamStandings: TeamStandingRecord[];
  athleteStandings: AthleteStandingRecord[];
  mvpAwards: MvpAwardRecord[];
  sportParticipation: ParticipationSummaryRecord[];
  collegeParticipation: CollegeParticipationRecord[];
}

export async function fetchInstitutionalReportData(
  filters: ReportFilterOptions,
  adminName: string = 'Administrator'
): Promise<InstitutionalReportData> {
  const [tournamentsRes, teamsRes, matchesRes, collegesRes, rosterRes, starsRes, statsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, sport, type, status, start_date, end_date, created_at')
      .or('is_deleted.is.null,is_deleted.eq.false'),
    supabase
      .from('teams')
      .select('id, name, tournament_id, status, affiliation_type, college_id, colleges:college_id(id, college_name)')
      .eq('status', 'Approved')
      .or('is_deleted.is.null,is_deleted.eq.false'),
    supabase
      .from('matches')
      .select('id, tournament_id, round, status, match_time, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, team_a:team_a_id(name), team_b:team_b_id(name)')
      .or('is_deleted.is.null,is_deleted.eq.false'),
    supabase
      .from('colleges')
      .select('id, college_name'),
    supabase
      .from('team_roster')
      .select('id, team_id, player_id, jersey_number, position, status, users:player_id(id, full_name, college_id, colleges:college_id(college_name))')
      .eq('status', 'Approved'),
    supabase
      .from('player_stars')
      .select('id, star_type, player_id, tournament_id, match_id, created_at, users:player_id(id, full_name, college_id, colleges:college_id(college_name)), tournaments:tournament_id(name, sport), matches:match_id(round, team_a:team_a_id(name), team_b:team_b_id(name))'),
    supabase
      .from('match_player_stats')
      .select('match_id, player_id, team_id, points')
  ]);

  const rawTournaments = tournamentsRes.data || [];
  const rawTeams = teamsRes.data || [];
  const rawMatches = matchesRes.data || [];
  const rawColleges = collegesRes.data || [];
  const rawRosters = rosterRes.data || [];
  const rawStars = starsRes.data || [];
  const rawStats = statsRes.data || [];

  const collegeMap = new Map<string, string>();
  rawColleges.forEach((c: any) => {
    collegeMap.set(c.id, c.college_name);
  });

  const getTeamCollegeName = (team: any): string => {
    if (!team) return 'General Squad';
    if (team.college_id && collegeMap.has(team.college_id)) {
      return collegeMap.get(team.college_id)!;
    }
    const colObj = Array.isArray(team.colleges) ? team.colleges[0] : team.colleges;
    if (colObj?.college_name) return colObj.college_name;
    const name = team.name || '';
    for (const c of rawColleges) {
      const code = extractCollegeCode(c.college_name).toLowerCase();
      if (name.toLowerCase().includes(code)) return c.college_name;
    }
    return 'University Squad';
  };

  // 1. Filter Tournaments by criteria
  const isFriendly = (t: any): boolean => {
    const s = `${t.type || ''} ${t.name || ''}`.toLowerCase();
    return s.includes('friendly') || s.includes('faculty') || s.includes('staff');
  };

  const filteredTournaments = rawTournaments.filter((t: any) => {
    // Academic Year
    if (filters.academicYear !== 'all') {
      const targetYear = filters.academicYear === 'current' ? '2026' : filters.academicYear;
      const dateStr = t.start_date || t.created_at || '';
      const nameStr = t.name || '';
      if (!dateStr.includes(targetYear) && !nameStr.includes(targetYear)) {
        return false;
      }
    }

    // Sport Discipline
    if (filters.sport !== 'all') {
      if ((t.sport || '').toLowerCase() !== filters.sport.toLowerCase()) {
        return false;
      }
    }

    // Division
    if (filters.division !== 'all') {
      const d = filters.division.toLowerCase();
      if (d === 'friendly') {
        if (!isFriendly(t)) return false;
      } else if (d === 'binturungan') {
        const s = `${t.type || ''} ${t.name || ''}`.toLowerCase();
        if (!s.includes('binturungan')) return false;
      } else if (d === 'collegiate') {
        const s = `${t.type || ''} ${t.name || ''}`.toLowerCase();
        if (!s.includes('colleg')) return false;
      }
    }

    return true;
  });

  const filteredTournIds = new Set(filteredTournaments.map((t: any) => t.id));
  const tournMap = new Map<string, any>(filteredTournaments.map((t: any) => [t.id, t]));

  const filteredTeams = rawTeams.filter((t: any) => filteredTournIds.has(t.tournament_id));
  const teamMap = new Map<string, any>(rawTeams.map((t: any) => [t.id, t]));

  const filteredMatches = rawMatches.filter((m: any) => filteredTournIds.has(m.tournament_id));

  // 2. Compute Module 1: Winning College per Sport per Year
  const winningColleges: WinningCollegeRecord[] = [];

  for (const tourn of filteredTournaments) {
    const tMatches = filteredMatches.filter((m: any) => m.tournament_id === tourn.id);
    if (tMatches.length === 0) continue;

    // Identify Finals match
    const finalsMatch = tMatches.find((m: any) => {
      const r = (m.round || '').toLowerCase();
      return r.includes('grand final') || (r.includes('final') && !r.includes('semi') && !r.includes('quarter'));
    });

    const bronzeMatch = tMatches.find((m: any) => {
      const r = (m.round || '').toLowerCase();
      return r.includes('bronze') || r.includes('3rd');
    });

    if (finalsMatch && finalsMatch.status === 'Completed') {
      const scoreA = Number(finalsMatch.team_a_score || 0);
      const scoreB = Number(finalsMatch.team_b_score || 0);
      const champTeamId = finalsMatch.winner_team_id || (scoreA >= scoreB ? finalsMatch.team_a_id : finalsMatch.team_b_id);
      const runnerTeamId = champTeamId === finalsMatch.team_a_id ? finalsMatch.team_b_id : finalsMatch.team_a_id;

      const champTeam = teamMap.get(champTeamId);
      const runnerTeam = teamMap.get(runnerTeamId);

      const champColName = getTeamCollegeName(champTeam);
      const runnerColName = getTeamCollegeName(runnerTeam);

      let bronzeColName = 'N/A';
      let bronzeColCode = '—';
      let bronzeTeamName = 'None';

      if (bronzeMatch && bronzeMatch.status === 'Completed') {
        const bScoreA = Number(bronzeMatch.team_a_score || 0);
        const bScoreB = Number(bronzeMatch.team_b_score || 0);
        const bronzeTeamId = bronzeMatch.winner_team_id || (bScoreA >= bScoreB ? bronzeMatch.team_a_id : bronzeMatch.team_b_id);
        const bTeam = teamMap.get(bronzeTeamId);
        bronzeColName = getTeamCollegeName(bTeam);
        bronzeColCode = extractCollegeCode(bronzeColName);
        bronzeTeamName = bTeam?.name || 'Third Place Squad';
      }

      const matchYear = (tourn.start_date || tourn.created_at || '2026').substring(0, 4);

      winningColleges.push({
        tournamentId: tourn.id,
        tournamentName: tourn.name,
        sport: tourn.sport || 'Ballgame',
        academicYear: matchYear,
        division: tourn.type || (isFriendly(tourn) ? 'Friendly' : 'Championship'),
        championCollege: champColName,
        championCollegeCode: extractCollegeCode(champColName),
        championTeamName: champTeam?.name || 'Champion Squad',
        runnerUpCollege: runnerColName,
        runnerUpCollegeCode: extractCollegeCode(runnerColName),
        runnerUpTeamName: runnerTeam?.name || 'Runner-Up Squad',
        bronzeCollege: bronzeColName,
        bronzeCollegeCode: bronzeColCode,
        bronzeTeamName: bronzeTeamName,
        finalsScore: `${scoreA} - ${scoreB}`,
      });
    }
  }

  // 3. Compute Module 2: Team & Athlete Standings
  const teamStatsMap = new Map<string, {
    matchesPlayed: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
  }>();

  for (const m of filteredMatches) {
    if (m.status !== 'Completed') continue;
    const sA = Number(m.team_a_score || 0);
    const sB = Number(m.team_b_score || 0);

    if (m.team_a_id) {
      const cur = teamStatsMap.get(m.team_a_id) || { matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      cur.matchesPlayed += 1;
      cur.pointsFor += sA;
      cur.pointsAgainst += sB;
      if (m.winner_team_id === m.team_a_id || (!m.winner_team_id && sA > sB)) cur.wins += 1;
      else if (sA < sB) cur.losses += 1;
      teamStatsMap.set(m.team_a_id, cur);
    }

    if (m.team_b_id) {
      const cur = teamStatsMap.get(m.team_b_id) || { matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      cur.matchesPlayed += 1;
      cur.pointsFor += sB;
      cur.pointsAgainst += sA;
      if (m.winner_team_id === m.team_b_id || (!m.winner_team_id && sB > sA)) cur.wins += 1;
      else if (sB < sA) cur.losses += 1;
      teamStatsMap.set(m.team_b_id, cur);
    }
  }

  const teamStandings: TeamStandingRecord[] = filteredTeams.map((t: any) => {
    const stats = teamStatsMap.get(t.id) || { matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
    const colName = getTeamCollegeName(t);
    const tourn = tournMap.get(t.tournament_id);
    const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 1000) / 10 : 0;
    const pointDiff = stats.pointsFor - stats.pointsAgainst;

    return {
      teamId: t.id,
      teamName: t.name,
      collegeName: colName,
      collegeCode: extractCollegeCode(colName),
      sport: tourn?.sport || 'Ballgame',
      tournamentName: tourn?.name || 'Tournament',
      division: tourn?.type || 'Championship',
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      winRate,
      pointsFor: stats.pointsFor,
      pointsAgainst: stats.pointsAgainst,
      pointDiff,
      rank: 1, // Will sort and assign rank
    };
  });

  teamStandings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.pointDiff - a.pointDiff;
  });

  teamStandings.forEach((item, index) => {
    item.rank = index + 1;
  });

  // Athlete Standings: Aggregate stats from match_player_stats for players belonging to filtered teams
  const playerStatsMap = new Map<string, {
    playerName: string;
    collegeName: string;
    sport: string;
    teamName: string;
    gamesPlayed: number;
    totalPoints: number;
    mvpCount: number;
  }>();

  const filteredTeamIds = new Set(filteredTeams.map((t: any) => t.id));
  const activeRosterUserMap = new Map<string, { name: string; college: string; teamName: string; sport: string }>();

  for (const r of rawRosters) {
    if (!filteredTeamIds.has(r.team_id)) continue;
    const userObj = Array.isArray(r.users) ? r.users[0] : r.users;
    if (!userObj) continue;
    const teamObj = teamMap.get(r.team_id);
    const tournObj = tournMap.get(teamObj?.tournament_id);
    const colObj = Array.isArray(userObj.colleges) ? userObj.colleges[0] : userObj.colleges;
    const cName = colObj?.college_name || getTeamCollegeName(teamObj);

    activeRosterUserMap.set(userObj.id, {
      name: userObj.full_name || 'Athlete',
      college: cName,
      teamName: teamObj?.name || 'Squad',
      sport: tournObj?.sport || 'Ballgame',
    });
  }

  for (const s of rawStats) {
    const userInfo = activeRosterUserMap.get(s.player_id);
    if (!userInfo) continue;

    const cur = playerStatsMap.get(s.player_id) || {
      playerName: userInfo.name,
      collegeName: userInfo.college,
      sport: userInfo.sport,
      teamName: userInfo.teamName,
      gamesPlayed: 0,
      totalPoints: 0,
      mvpCount: 0,
    };

    cur.gamesPlayed += 1;
    cur.totalPoints += Number(s.points || 0);
    playerStatsMap.set(s.player_id, cur);
  }

  // Count MVPs for players
  for (const st of rawStars) {
    if (filteredTournIds.has(st.tournament_id) && playerStatsMap.has(st.player_id)) {
      playerStatsMap.get(st.player_id)!.mvpCount += 1;
    }
  }

  const athleteStandings: AthleteStandingRecord[] = Array.from(playerStatsMap.entries()).map(([pId, val]) => {
    const ppg = val.gamesPlayed > 0 ? Math.round((val.totalPoints / val.gamesPlayed) * 10) / 10 : val.totalPoints;
    return {
      playerId: pId,
      playerName: val.playerName,
      collegeName: val.collegeName,
      collegeCode: extractCollegeCode(val.collegeName),
      sport: val.sport,
      teamName: val.teamName,
      gamesPlayed: val.gamesPlayed,
      totalPoints: val.totalPoints,
      ppg,
      mvpCount: val.mvpCount,
      rank: 1,
    };
  });

  athleteStandings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.ppg !== a.ppg) return b.ppg - a.ppg;
    return b.mvpCount - a.mvpCount;
  });

  athleteStandings.forEach((item, index) => {
    item.rank = index + 1;
  });

  // 4. Compute Module 3: Gold Star & Red Star MVP Award Records
  const mvpAwards: MvpAwardRecord[] = [];

  for (const st of rawStars) {
    if (st.tournament_id && !filteredTournIds.has(st.tournament_id)) continue;

    const userObj = Array.isArray(st.users) ? st.users[0] : st.users;
    const tournObj = Array.isArray(st.tournaments) ? st.tournaments[0] : st.tournaments;
    const matchObj = Array.isArray(st.matches) ? st.matches[0] : st.matches;

    const athleteName = userObj?.full_name || 'Athlete';
    const colObj = Array.isArray(userObj?.colleges) ? userObj?.colleges[0] : userObj?.colleges;
    const collegeName = colObj?.college_name || (userObj?.college_id && collegeMap.get(userObj.college_id)) || 'Palawan State University';

    const isGold = st.star_type === 'Gold';
    const awardTitle = isGold ? 'Gold Star • Tournament MVP' : 'Red Star • Match MVP';

    let matchContext = 'Tournament Wide';
    if (!isGold && matchObj) {
      const mA = matchObj as any;
      const tA = Array.isArray(mA.team_a) ? mA.team_a[0]?.name : mA.team_a?.name;
      const tB = Array.isArray(mA.team_b) ? mA.team_b[0]?.name : mA.team_b?.name;
      matchContext = `${mA.round || 'Match'} (${tA || 'TBD'} vs ${tB || 'TBD'})`;
    }

    mvpAwards.push({
      starId: st.id,
      starType: isGold ? 'Gold' : 'Red',
      awardTitle,
      athleteName,
      collegeName,
      collegeCode: extractCollegeCode(collegeName),
      sport: tournObj?.sport || 'Ballgame',
      tournamentName: tournObj?.name || 'Tournament Event',
      matchContext,
      awardedDate: (st.created_at || '').substring(0, 10),
    });
  }

  mvpAwards.sort((a, b) => {
    if (a.starType === 'Gold' && b.starType !== 'Gold') return -1;
    if (a.starType !== 'Gold' && b.starType === 'Gold') return 1;
    return new Date(b.awardedDate).getTime() - new Date(a.awardedDate).getTime();
  });

  // 5. Compute Module 4: Event Participation Summary (by Sport and by College)
  const sportSummaryMap = new Map<string, {
    totalTournaments: number;
    teamIds: Set<string>;
    athleteIds: Set<string>;
    collegeCodes: Set<string>;
  }>();

  for (const t of filteredTournaments) {
    const sport = t.sport || 'Ballgame';
    if (!sportSummaryMap.has(sport)) {
      sportSummaryMap.set(sport, {
        totalTournaments: 0,
        teamIds: new Set(),
        athleteIds: new Set(),
        collegeCodes: new Set(),
      });
    }
    sportSummaryMap.get(sport)!.totalTournaments += 1;
  }

  for (const team of filteredTeams) {
    const tourn = tournMap.get(team.tournament_id);
    const sport = tourn?.sport || 'Ballgame';
    const colName = getTeamCollegeName(team);
    const cCode = extractCollegeCode(colName);

    if (sportSummaryMap.has(sport)) {
      sportSummaryMap.get(sport)!.teamIds.add(team.id);
      sportSummaryMap.get(sport)!.collegeCodes.add(cCode);
    }
  }

  for (const r of rawRosters) {
    if (!filteredTeamIds.has(r.team_id)) continue;
    const team = teamMap.get(r.team_id);
    const tourn = tournMap.get(team?.tournament_id);
    const sport = tourn?.sport || 'Ballgame';
    if (sportSummaryMap.has(sport)) {
      sportSummaryMap.get(sport)!.athleteIds.add(r.player_id);
    }
  }

  const sportParticipation: ParticipationSummaryRecord[] = Array.from(sportSummaryMap.entries()).map(([sp, val]) => ({
    sport: sp,
    totalTournaments: val.totalTournaments,
    totalTeams: val.teamIds.size,
    totalAthletes: val.athleteIds.size,
    collegesRepresented: val.collegeCodes.size,
    collegeCodes: Array.from(val.collegeCodes).sort(),
  }));

  sportParticipation.sort((a, b) => b.totalAthletes - a.totalAthletes);

  // College-level Participation Breakdown
  const collegeSummaryMap = new Map<string, {
    collegeName: string;
    sports: Set<string>;
    teamIds: Set<string>;
    athleteIds: Set<string>;
    championships: number;
    runnerUps: number;
    goldStars: number;
    redStars: number;
  }>();

  for (const col of rawColleges) {
    collegeSummaryMap.set(col.id, {
      collegeName: col.college_name,
      sports: new Set(),
      teamIds: new Set(),
      athleteIds: new Set(),
      championships: 0,
      runnerUps: 0,
      goldStars: 0,
      redStars: 0,
    });
  }

  // Fill in college teams & athletes
  for (const team of filteredTeams) {
    const colName = getTeamCollegeName(team);
    const colObj = rawColleges.find((c: any) => c.college_name === colName || team.college_id === c.id);
    if (colObj && collegeSummaryMap.has(colObj.id)) {
      const cur = collegeSummaryMap.get(colObj.id)!;
      cur.teamIds.add(team.id);
      const tourn = tournMap.get(team.tournament_id);
      if (tourn?.sport) cur.sports.add(tourn.sport);
    }
  }

  for (const r of rawRosters) {
    if (!filteredTeamIds.has(r.team_id)) continue;
    const team = teamMap.get(r.team_id);
    const colName = getTeamCollegeName(team);
    const colObj = rawColleges.find((c: any) => c.college_name === colName || team?.college_id === c.id);
    if (colObj && collegeSummaryMap.has(colObj.id)) {
      collegeSummaryMap.get(colObj.id)!.athleteIds.add(r.player_id);
    }
  }

  // Count titles
  for (const win of winningColleges) {
    const matchCol = rawColleges.find((c: any) => extractCollegeCode(c.college_name) === win.championCollegeCode);
    if (matchCol && collegeSummaryMap.has(matchCol.id)) {
      collegeSummaryMap.get(matchCol.id)!.championships += 1;
    }
    const matchRunner = rawColleges.find((c: any) => extractCollegeCode(c.college_name) === win.runnerUpCollegeCode);
    if (matchRunner && collegeSummaryMap.has(matchRunner.id)) {
      collegeSummaryMap.get(matchRunner.id)!.runnerUps += 1;
    }
  }

  // Count MVPs
  for (const mvp of mvpAwards) {
    const matchCol = rawColleges.find((c: any) => extractCollegeCode(c.college_name) === mvp.collegeCode);
    if (matchCol && collegeSummaryMap.has(matchCol.id)) {
      if (mvp.starType === 'Gold') collegeSummaryMap.get(matchCol.id)!.goldStars += 1;
      else collegeSummaryMap.get(matchCol.id)!.redStars += 1;
    }
  }

  const collegeParticipation: CollegeParticipationRecord[] = Array.from(collegeSummaryMap.values())
    .filter((c) => c.teamIds.size > 0 || c.athleteIds.size > 0 || c.championships > 0)
    .map((c) => ({
      collegeName: c.collegeName,
      collegeCode: extractCollegeCode(c.collegeName),
      participatingSports: Array.from(c.sports).sort(),
      totalTeams: c.teamIds.size,
      totalAthletes: c.athleteIds.size,
      championships: c.championships,
      runnerUps: c.runnerUps,
      goldStars: c.goldStars,
      redStars: c.redStars,
    }));

  collegeParticipation.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.goldStars !== a.goldStars) return b.goldStars - a.goldStars;
    return b.totalAthletes - a.totalAthletes;
  });

  return {
    metadata: {
      reportTitle: 'PSU SportsTrack Institutional Athletic Report',
      generatedAt: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      generatedBy: adminName,
      academicYear: filters.academicYear === 'current' ? 'Academic Year 2026' : filters.academicYear === 'all' ? 'All Academic Periods' : `AY ${filters.academicYear}`,
      sportFilter: filters.sport === 'all' ? 'All Official Ballgame Disciplines' : filters.sport,
      divisionFilter: filters.division === 'all' ? 'All Tournament Divisions' : filters.division.toUpperCase(),
    },
    winningColleges,
    teamStandings,
    athleteStandings,
    mvpAwards,
    sportParticipation,
    collegeParticipation,
  };
}

export function generateReportCSV(data: InstitutionalReportData): string {
  const lines: string[] = [];

  const escapeCSV = (val: any) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  // Header Metadata Block
  lines.push(`"PALAWAN STATE UNIVERSITY - SPORTSTRACK INSTITUTIONAL ATHLETIC REPORT"`);
  lines.push(`"Report Generated",${escapeCSV(data.metadata.generatedAt)}`);
  lines.push(`"Generated By",${escapeCSV(data.metadata.generatedBy)}`);
  lines.push(`"Academic Period Scope",${escapeCSV(data.metadata.academicYear)}`);
  lines.push(`"Discipline Scope",${escapeCSV(data.metadata.sportFilter)}`);
  lines.push(`"Tournament Division Scope",${escapeCSV(data.metadata.divisionFilter)}`);
  lines.push('');

  // Section 1: Winning Colleges per Sport per Year
  lines.push(`"=== SECTION 1: WINNING COLLEGES PER SPORT PER YEAR ==="`);
  lines.push(`"Sport","Tournament Name","Year","Division","Champion College","Code","Champion Squad","Runner-Up College","Code","Runner-Up Squad","3rd Place College","Code","Finals Score"`);
  for (const w of data.winningColleges) {
    lines.push([
      escapeCSV(w.sport),
      escapeCSV(w.tournamentName),
      escapeCSV(w.academicYear),
      escapeCSV(w.division),
      escapeCSV(w.championCollege),
      escapeCSV(w.championCollegeCode),
      escapeCSV(w.championTeamName),
      escapeCSV(w.runnerUpCollege),
      escapeCSV(w.runnerUpCollegeCode),
      escapeCSV(w.runnerUpTeamName),
      escapeCSV(w.bronzeCollege),
      escapeCSV(w.bronzeCollegeCode),
      escapeCSV(w.finalsScore),
    ].join(','));
  }
  lines.push('');

  // Section 2: Team Standings
  lines.push(`"=== SECTION 2A: TEAM STANDINGS ==="`);
  lines.push(`"Rank","Team Name","College","Code","Sport","Tournament","Division","Played","Wins","Losses","Win Rate %","Points For","Points Against","Diff"`);
  for (const t of data.teamStandings) {
    lines.push([
      t.rank,
      escapeCSV(t.teamName),
      escapeCSV(t.collegeName),
      escapeCSV(t.collegeCode),
      escapeCSV(t.sport),
      escapeCSV(t.tournamentName),
      escapeCSV(t.division),
      t.matchesPlayed,
      t.wins,
      t.losses,
      `${t.winRate}%`,
      t.pointsFor,
      t.pointsAgainst,
      t.pointDiff >= 0 ? `+${t.pointDiff}` : t.pointDiff,
    ].join(','));
  }
  lines.push('');

  // Section 2B: Athlete Standings
  lines.push(`"=== SECTION 2B: ATHLETE SCORING & PERFORMANCE STANDINGS ==="`);
  lines.push(`"Rank","Athlete Name","College","Code","Sport","Team Squad","Games Played","Total Points","PPG","MVP Awards"`);
  for (const a of data.athleteStandings) {
    lines.push([
      a.rank,
      escapeCSV(a.playerName),
      escapeCSV(a.collegeName),
      escapeCSV(a.collegeCode),
      escapeCSV(a.sport),
      escapeCSV(a.teamName),
      a.gamesPlayed,
      a.totalPoints,
      a.ppg,
      a.mvpCount,
    ].join(','));
  }
  lines.push('');

  // Section 3: MVP Records
  lines.push(`"=== SECTION 3: GOLD STAR & RED STAR MVP AWARD RECORDS ==="`);
  lines.push(`"Star Type","Award Category","Athlete Name","College","Code","Sport","Tournament Event","Match / Phase Context","Awarded Date"`);
  for (const m of data.mvpAwards) {
    lines.push([
      escapeCSV(m.starType),
      escapeCSV(m.awardTitle),
      escapeCSV(m.athleteName),
      escapeCSV(m.collegeName),
      escapeCSV(m.collegeCode),
      escapeCSV(m.sport),
      escapeCSV(m.tournamentName),
      escapeCSV(m.matchContext),
      escapeCSV(m.awardedDate),
    ].join(','));
  }
  lines.push('');

  // Section 4A: Participation by Discipline
  lines.push(`"=== SECTION 4A: PARTICIPATION SUMMARY BY SPORT DISCIPLINE ==="`);
  lines.push(`"Sport Discipline","Tournaments Hosted","Participating Squads","Active Athletes","Colleges Represented","Colleges List"`);
  for (const sp of data.sportParticipation) {
    lines.push([
      escapeCSV(sp.sport),
      sp.totalTournaments,
      sp.totalTeams,
      sp.totalAthletes,
      sp.collegesRepresented,
      escapeCSV(sp.collegeCodes.join(', ')),
    ].join(','));
  }
  lines.push('');

  // Section 4B: Participation & Achievements by College
  lines.push(`"=== SECTION 4B: INSTITUTIONAL COLLEGE PARTICIPATION & MEDAL RECORD ==="`);
  lines.push(`"College Name","Code","Disciplines Entered","Squads Formed","Registered Athletes","Gold / Championships","Silver / Runner-Ups","Gold Star MVPs","Red Star MVPs"`);
  for (const cp of data.collegeParticipation) {
    lines.push([
      escapeCSV(cp.collegeName),
      escapeCSV(cp.collegeCode),
      escapeCSV(cp.participatingSports.join(', ')),
      cp.totalTeams,
      cp.totalAthletes,
      cp.championships,
      cp.runnerUps,
      cp.goldStars,
      cp.redStars,
    ].join(','));
  }

  return lines.join('\n');
}

export function downloadReportCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
