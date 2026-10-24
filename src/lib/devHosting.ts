import type { SupabaseClient } from '@supabase/supabase-js';
import { formatErrorMessage, type ScenarioResult } from './devScenarios';

export interface HostTournamentParams {
  sport: string; // One of the strict 9 official ballgames
  division: 'Binturungan' | 'Inter-Collegiate' | 'Friendly';
  teamCount: 4 | 8;
  customName?: string;
}

export const OFFICIAL_BALLGAMES = [
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

export const SPORT_VENUES: Record<string, string[]> = {
  Basketball: ['PSU Main Gym - Court 1', 'PSU Main Gym - Court 2'],
  Volleyball: ['PSU Main Gym - Court 2', 'PSU Multi-Purpose Covered Court'],
  Soccer: ['PSU Football Pitch & Track Oval'],
  Futsal: ['PSU Multi-Purpose Covered Court', 'PSU Student Activity Center'],
  'Sepak Takraw': ['PSU Sepak Takraw Court', 'PSU Main Gym - Court 3'],
  Baseball: ['PSU Diamond Baseball Field'],
  Softball: ['PSU Softball Diamond 2'],
  Pickleball: ['PSU Racket Sports Center - Court 1', 'PSU Racket Sports Center - Court 2'],
  'Table Tennis': ['PSU Student Pavilion - Table 1', 'PSU Student Pavilion - Table 2'],
};

const DIVISION_TEAMS: Record<string, string[]> = {
  Binturungan: [
    'Tribo Apolaki',
    'Tribo Libulan',
    'Tribo Tala',
    'Tribo Haliya',
    'Tribo Mapulon',
    'Tribo Dumangan',
    'Tribo Mayari',
    'Tribo Sidapa',
  ],
  'Inter-Collegiate': [
    'CAS Titans',
    'CBA Wolves',
    'CEAT Builders',
    'CIT Cyber Knights',
    'CCJE Enforcers',
    'CTE Educators',
    'CNHS Healers',
    'CHMT Voyagers',
  ],
  Friendly: [
    'Faculty All-Stars',
    'Staff Smashers',
    'Alumni Legends',
    'Varsity Reserves',
    'ICTD Hackers',
    'Facilities Knights',
    'Admin Eagles',
    'Health Voyagers',
  ],
};

/**
 * Rapid Multi-Ballgame Tournament Hosting Engine
 * 1-click batch hosting for any of the 9 official PSU ballgames with automated
 * collegiate/cluster teams, assigned coaches, seedings, and bracket trees with venues.
 */
export async function hostSingleTournament(
  supabase: SupabaseClient,
  params: HostTournamentParams
): Promise<ScenarioResult> {
  try {
    const { sport, division, teamCount, customName } = params;

    // Strict 9 Ballgame Scope Guardrail
    const isOfficial = OFFICIAL_BALLGAMES.some(
      (b) => b.toLowerCase() === sport.toLowerCase()
    );
    if (!isOfficial) {
      throw new Error(
        `Sport "${sport}" is outside the strict 9 official PSU ballgames scope.`
      );
    }

    const tournamentName =
      customName || `[DEV] PSU ${division} 2026 - ${sport} Championship`;

    // 1. Clean existing tournament with this name if already present
    const { data: existing } = await supabase
      .from('tournaments')
      .select('id')
      .eq('name', tournamentName)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('matches')
        .update({ next_match_id: null, loser_next_match_id: null })
        .eq('tournament_id', existing.id);
      const { data: oldM } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', existing.id);
      if (oldM && oldM.length > 0) {
        const ids = oldM.map((m) => m.id);
        await supabase.from('match_score_events').delete().in('match_id', ids);
        await supabase.from('match_player_stats').delete().in('match_id', ids);
        await supabase.from('match_events').delete().in('match_id', ids);
        await supabase.from('player_stars').delete().in('match_id', ids);
        await supabase.from('matches').delete().in('id', ids);
      }
      const { data: oldTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('tournament_id', existing.id);
      if (oldTeams && oldTeams.length > 0) {
        const tIds = oldTeams.map((t) => t.id);
        await supabase.from('team_roster').delete().in('team_id', tIds);
      }
      await supabase.from('teams').delete().eq('tournament_id', existing.id);
      await supabase.from('tournaments').delete().eq('id', existing.id);
    }

    // 2. Insert Tournament
    const today = new Date().toISOString().split('T')[0];
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data: tourn, error: tournErr } = await supabase
      .from('tournaments')
      .insert({
        name: tournamentName,
        sport,
        type: division,
        status: 'Active',
        start_date: today,
        end_date: twoWeeks,
      })
      .select('id')
      .single();

    if (tournErr || !tourn) throw tournErr || new Error('Failed to create tournament');

    // 3. Find Coaches to Assign (with fallback to verified collegiate coach IDs)
    const { data: coaches } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'coach')
      .limit(teamCount);
    const fallbackCoachIds = [
      '8932be90-4547-4935-9cb6-f80f1c5fc80c',
      '643bc8a1-4ef8-4153-a78b-8135c9ed3198',
      '89df93db-55f6-4a68-9f5c-e2fc51d0ce40',
      '917829e1-e534-4dbf-b673-76e5e47cbf3d',
    ];
    const coachIds = (coaches && coaches.length > 0) ? coaches.map((c) => c.id) : fallbackCoachIds;

    // 4. Create Collegiate / Cluster Teams
    const teamPool = (DIVISION_TEAMS[division] || DIVISION_TEAMS['Inter-Collegiate']).slice(
      0,
      teamCount
    );
    const createdTeams: { id: string; name: string }[] = [];

    for (let i = 0; i < teamPool.length; i++) {
      const rawName = teamPool[i];
      const teamPayload = {
        name: `[DEV] ${rawName}`,
        tournament_id: tourn.id,
        status: 'Approved',
        coach_id: coachIds[i % coachIds.length] || null,
        seed: i + 1,
      };

      const { data: created, error: teamErr } = await supabase
        .from('teams')
        .insert(teamPayload)
        .select('id, name')
        .single();

      if (teamErr || !created) throw teamErr || new Error(`Failed to create team ${rawName}`);
      createdTeams.push(created);
    }

    // 5. Populate Active Roster with Authentic Starters & Substitutes
    const { data: dbAthletes } = await supabase
      .from('users')
      .select('id, full_name')
      .in('role', ['player_student', 'player_faculty', 'player_staff'])
      .limit(teamCount * 6);

    const positionsBySport = [
      'Point Guard (PG)', 'Shooting Guard (SG)', 'Small Forward (SF)', 'Power Forward (PF)', 'Center (C)',
      'Setter (S)', 'Outside Hitter (OH)', 'Middle Blocker (MB)', 'Libero (L)',
    ];
    const jerseyPool = [7, 10, 11, 23, 24, 30, 33, 45, 99];

    if (dbAthletes && dbAthletes.length >= teamCount * 2) {
      const rosterEntries = [];
      const playersPerTeam = Math.min(5, Math.floor(dbAthletes.length / teamCount));

      for (let t = 0; t < createdTeams.length; t++) {
        const team = createdTeams[t];
        for (let p = 0; p < playersPerTeam; p++) {
          const athleteIndex = t * playersPerTeam + p;
          const athlete = dbAthletes[athleteIndex];
          if (athlete) {
            rosterEntries.push({
              team_id: team.id,
              player_id: athlete.id,
              jersey_number: jerseyPool[p % jerseyPool.length],
              is_starter: p < 3,
              is_captain: p === 0,
              status: 'Approved',
              position: positionsBySport[p % positionsBySport.length],
            });
          }
        }
      }

      if (rosterEntries.length > 0) {
        await supabase.from('team_roster').insert(rosterEntries);
      }
    }

    const venues = SPORT_VENUES[sport] || ['PSU Main Gym - Court 1'];
    const venue1 = venues[0];
    const venue2 = venues[1] || venues[0];

    let liveMatchId: string | undefined;

    // Helper for scheduling match offsets
    const calcTime = (offsetHours: number) => {
      const d = new Date();
      d.setHours(d.getHours() + offsetHours);
      return d.toISOString();
    };

    if (teamCount === 4) {
      // 4 TEAMS BRACKET: Semifinal 1, Semifinal 2, Finals, and 3rd Place Bronze Playoff
      // Step A: Finals
      const { data: finals, error: fErr } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: 'Finals',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(48),
          venue: venue1,
        })
        .select('id')
        .single();
      if (fErr) throw fErr;

      // Step B: Bronze Playoff
      const { data: bronze, error: bErr } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: '3rd Place Playoff',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(44),
          venue: venue2,
        })
        .select('id')
        .single();
      if (bErr) throw bErr;

      // Step C: Semifinal 1 (Live Ongoing Match)
      const { data: sf1, error: sf1Err } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          team_a_id: createdTeams[0].id,
          team_b_id: createdTeams[1].id,
          round: 'Semifinals',
          status: 'Ongoing',
          team_a_score: sport === 'Basketball' ? 54 : sport === 'Volleyball' ? 1 : 1,
          team_b_score: sport === 'Basketball' ? 51 : sport === 'Volleyball' ? 1 : 0,
          match_time: calcTime(-1),
          venue: venue1,
          next_match_id: finals.id,
          next_match_slot: 'team_a',
          loser_next_match_id: bronze.id,
          loser_next_match_slot: 'team_a',
        })
        .select('id')
        .single();
      if (sf1Err) throw sf1Err;
      liveMatchId = sf1.id;

      // Insert starting event for live match
      await supabase.from('match_events').insert({
        match_id: sf1.id,
        description: `[DEV Game Start] ${createdTeams[0].name} vs ${createdTeams[1].name} tipped off at ${venue1}!`,
      });

      // Step D: Semifinal 2
      const { error: sf2Err } = await supabase.from('matches').insert({
        tournament_id: tourn.id,
        team_a_id: createdTeams[2].id,
        team_b_id: createdTeams[3].id,
        round: 'Semifinals',
        status: 'Scheduled',
        team_a_score: 0,
        team_b_score: 0,
        match_time: calcTime(3),
        venue: venue1,
        next_match_id: finals.id,
        next_match_slot: 'team_b',
        loser_next_match_id: bronze.id,
        loser_next_match_slot: 'team_b',
      });
      if (sf2Err) throw sf2Err;
    } else {
      // 8 TEAMS BRACKET: 4 Quarterfinals -> 2 Semifinals -> Finals & Bronze
      const { data: finals } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: 'Finals',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(72),
          venue: venue1,
        })
        .select('id')
        .single();

      const { data: bronze } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: '3rd Place Playoff',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(68),
          venue: venue2,
        })
        .select('id')
        .single();

      const { data: sf1 } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: 'Semifinals',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(24),
          venue: venue1,
          next_match_id: finals?.id || null,
          next_match_slot: 'team_a',
          loser_next_match_id: bronze?.id || null,
          loser_next_match_slot: 'team_a',
        })
        .select('id')
        .single();

      const { data: sf2 } = await supabase
        .from('matches')
        .insert({
          tournament_id: tourn.id,
          round: 'Semifinals',
          status: 'Scheduled',
          team_a_score: 0,
          team_b_score: 0,
          match_time: calcTime(26),
          venue: venue1,
          next_match_id: finals?.id || null,
          next_match_slot: 'team_b',
          loser_next_match_id: bronze?.id || null,
          loser_next_match_slot: 'team_b',
        })
        .select('id')
        .single();

      // Quarterfinals 1-4
      const qfConfigs = [
        { teamA: createdTeams[0].id, teamB: createdTeams[7].id, nextId: sf1?.id, slot: 'team_a', status: 'Ongoing', live: true },
        { teamA: createdTeams[1].id, teamB: createdTeams[6].id, nextId: sf1?.id, slot: 'team_b', status: 'Scheduled', live: false },
        { teamA: createdTeams[2].id, teamB: createdTeams[5].id, nextId: sf2?.id, slot: 'team_a', status: 'Scheduled', live: false },
        { teamA: createdTeams[3].id, teamB: createdTeams[4].id, nextId: sf2?.id, slot: 'team_b', status: 'Scheduled', live: false },
      ];

      for (let q = 0; q < qfConfigs.length; q++) {
        const c = qfConfigs[q];
        const { data: createdQf } = await supabase
          .from('matches')
          .insert({
            tournament_id: tourn.id,
            team_a_id: c.teamA,
            team_b_id: c.teamB,
            round: 'Quarterfinals',
            status: c.status,
            team_a_score: c.live ? 24 : 0,
            team_b_score: c.live ? 22 : 0,
            match_time: calcTime(q * 2),
            venue: q % 2 === 0 ? venue1 : venue2,
            next_match_id: c.nextId || null,
            next_match_slot: c.slot,
          })
          .select('id')
          .single();

        if (c.live && createdQf) {
          liveMatchId = createdQf.id;
          await supabase.from('match_events').insert({
            match_id: createdQf.id,
            description: `[DEV Game Start] Quarterfinal match opened with intense action!`,
          });
        }
      }
    }

    return {
      success: true,
      message: `Hosted ${tournamentName} with ${teamCount} teams, seedings, and complete bracket tree at ${venue1}.`,
      tournamentId: tourn.id,
      liveMatchId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to host tournament',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * 1-Click Batch Host: All 9 Official PSU Ballgame Disciplines
 */
export async function hostAllBallgamesCircuit(
  supabase: SupabaseClient,
  division: 'Binturungan' | 'Inter-Collegiate' | 'Friendly' = 'Inter-Collegiate'
): Promise<ScenarioResult> {
  try {
    const hostedIds: string[] = [];

    for (const sport of OFFICIAL_BALLGAMES) {
      const res = await hostSingleTournament(supabase, {
        sport,
        division,
        teamCount: 4,
      });
      if (res.tournamentId) {
        hostedIds.push(res.tournamentId);
      }
    }

    return {
      success: true,
      message: `Successfully hosted all 9 official PSU ballgame tournaments simultaneously (${division} division) with collegiate squads and playoff brackets!`,
      tournamentId: hostedIds[0],
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to batch host 9-ballgame circuit',
      error: formatErrorMessage(err),
    };
  }
}
