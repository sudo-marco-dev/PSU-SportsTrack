import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScenarioResult {
  success: boolean;
  message: string;
  tournamentId?: string;
  liveMatchId?: string;
  error?: string;
}

/**
 * Robust error stringifier ensuring Supabase PostgrestError objects
 * never evaluate to [object Object].
 */
export function formatErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error occurred';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description;
    if (typeof obj.details === 'string' && obj.details) return obj.details;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * SCENARIO A: Clean Season Slate
 * Wipes all test tournaments, matches, teams, and temporary records
 * while safely preserving campus colleges, clusters, and all user accounts.
 */
export async function injectCleanSlate(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    // 1. Break match self-referencing foreign keys
    await supabase.from('matches').update({
      next_match_id: null,
      loser_next_match_id: null,
    }).neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Clear dependent match events and star honors
    await supabase.from('match_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('player_stars').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Delete matches
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 4. Delete teams and roster associations
    await supabase.from('team_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 5. Delete test tournaments
    await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    return {
      success: true,
      message: 'Clean Slate injected: All matches, teams, and tournament trees wiped. Colleges and accounts intact.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to inject Clean Slate',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * SCENARIO B: Recruitment & COR Verification Queue
 * Creates draft tournaments, teams, and mock pending student athlete
 * Certificate of Registration (COR) uploads with pre-calculated OCR confidence scores.
 */
export async function injectVerificationQueue(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    await ensureClusters(supabase);

    const { data: coaches } = await supabase.from('users').select('id').eq('role', 'coach').limit(2);
    const { data: students } = await supabase.from('users').select('id, full_name, email').eq('role', 'player_student').limit(5);

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create Draft Tournament
    const { data: tourn, error: tournErr } = await supabase.from('tournaments').insert({
      name: 'PSU Binturungan 2026 - Registration & Eligibility Review',
      sport: 'Volleyball',
      type: 'Binturungan',
      status: 'Draft',
      start_date: today,
      end_date: nextMonth,
    }).select().single();

    if (tournErr) throw tournErr;

    // Create Draft Teams
    const coachId = coaches?.[0]?.id || null;
    const { error: teamErr } = await supabase.from('teams').insert([
      { name: 'CAS Spikers', tournament_id: tourn.id, status: 'Pending', coach_id: coachId },
      { name: 'CBA Lady Wolves', tournament_id: tourn.id, status: 'Pending', coach_id: coaches?.[1]?.id || coachId },
    ]);
    if (teamErr) throw teamErr;

    // Seed Mock Verification Documents in Queue
    if (students && students.length > 0) {
      const studentIds = students.map((s) => s.id);
      await supabase.from('verification_documents').delete().in('user_id', studentIds);

      const mockDocs = [
        {
          user_id: students[0].id,
          storage_path: 'mock_cor_sample_high.pdf',
          document_type: 'COR',
          status: 'Pending',
          confidence_score: 95,
          extracted_full_name: students[0].full_name || 'Juan Dela Cruz',
          extracted_student_no: '2023-8-0284',
          extracted_college: 'CAS',
          extracted_program: 'BS Information Technology',
          extracted_year_level: '3rd Year',
        },
        ...(students.length > 1
          ? [{
              user_id: students[1].id,
              storage_path: 'mock_cor_sample_med.pdf',
              document_type: 'COR',
              status: 'Pending',
              confidence_score: 80,
              extracted_full_name: students[1].full_name || 'Maria Santos',
              extracted_student_no: '2022-8-0115',
              extracted_college: 'CBA',
              extracted_program: 'BS Accountancy',
              extracted_year_level: '4th Year',
            }]
          : []),
        ...(students.length > 2
          ? [{
              user_id: students[2].id,
              storage_path: 'mock_cor_sample_low.pdf',
              document_type: 'COR',
              status: 'Pending',
              confidence_score: 45,
              extracted_full_name: students[2].full_name || 'Alex Reyes',
              extracted_student_no: '2024-8-0991',
              extracted_college: 'CEAT',
              extracted_program: 'BS Civil Engineering',
              extracted_year_level: '1st Year',
            }]
          : []),
      ];

      const { error: docErr } = await supabase.from('verification_documents').insert(mockDocs);
      if (docErr) throw docErr;
    }

    return {
      success: true,
      message: 'Verification Queue injected: Draft tournament, squads, and sample COR records awaiting admin review.',
      tournamentId: tourn.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to inject Verification Queue',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * SCENARIO C: Active Tournament & Live Halftime Match
 * 4 campus squads, active bracket tree, ongoing semifinals CAS (68) vs CBA (65)
 * with live clock, fouls, timeouts, and commentary feed.
 */
export async function injectLiveHalftimeMatch(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    await ensureClusters(supabase);

    const { data: coaches } = await supabase.from('users').select('id').eq('role', 'coach').limit(4);
    const coachIds = (coaches || []).map((c) => c.id);

    const tournamentName = "PSU Palaro 2026 - Men's Basketball Inter-Collegiate";
    let tournamentId: string;

    const { data: existingTourn } = await supabase.from('tournaments').select('id').eq('name', tournamentName).maybeSingle();

    if (existingTourn) {
      tournamentId = existingTourn.id;
      await supabase.from('matches').update({ next_match_id: null, loser_next_match_id: null }).eq('tournament_id', tournamentId);
      const { data: oldMatches } = await supabase.from('matches').select('id').eq('tournament_id', tournamentId);
      if (oldMatches && oldMatches.length > 0) {
        const ids = oldMatches.map((m) => m.id);
        await supabase.from('match_events').delete().in('match_id', ids);
        await supabase.from('player_stars').delete().in('match_id', ids);
        await supabase.from('matches').delete().in('id', ids);
      }
      await supabase.from('teams').delete().eq('tournament_id', tournamentId);
    } else {
      const today = new Date();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { data: newTourn, error: tournErr } = await supabase.from('tournaments').insert({
        name: tournamentName,
        sport: 'Basketball',
        type: 'Binturungan',
        status: 'Active',
        start_date: today.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0],
      }).select().single();

      if (tournErr) throw tournErr;
      tournamentId = newTourn.id;
    }

    // Seed 4 Teams
    const demoTeams = [
      { name: 'CAS Titans', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[0] || null },
      { name: 'CBA Wolves', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[1] || null },
      { name: 'COE Builders', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[2] || null },
      { name: 'CIT Cyber Knights', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[3] || null },
    ];

    const teamMap: Record<string, string> = {};
    for (const t of demoTeams) {
      const { data: createdTeam, error: teamErr } = await supabase.from('teams').insert(t).select().single();
      if (teamErr) throw teamErr;
      teamMap[t.name] = createdTeam.id;
    }

    const matchTime = (offsetHours = 0) => {
      const d = new Date();
      d.setHours(d.getHours() + offsetHours);
      return d.toISOString();
    };

    // Finals & Bronze Slots
    const { data: finalsMatch, error: finErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: 'Finals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(48),
      venue: 'PSU Main Gym - Court 1',
    }).select().single();
    if (finErr) throw finErr;

    const { data: bronzeMatch, error: brnErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: '3rd Place Playoff',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(44),
      venue: 'PSU Main Gym - Court 2',
    }).select().single();
    if (brnErr) throw brnErr;

    // Semifinal 1 (Ongoing Live Match)
    const { data: sf1Match, error: sf1Err } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      team_a_id: teamMap['CAS Titans'],
      team_b_id: teamMap['CBA Wolves'],
      round: 'Semifinals',
      status: 'Ongoing',
      team_a_score: 68,
      team_b_score: 65,
      match_time: matchTime(-1),
      next_match_id: finalsMatch?.id || null,
      next_match_slot: 'team_a',
      loser_next_match_id: bronzeMatch?.id || null,
      loser_next_match_slot: 'team_a',
      venue: 'PSU Main Gym - Court 1',
    }).select().single();
    if (sf1Err) throw sf1Err;

    // Semifinal 2
    const { error: sf2Err } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      team_a_id: teamMap['COE Builders'],
      team_b_id: teamMap['CIT Cyber Knights'],
      round: 'Semifinals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(2),
      next_match_id: finalsMatch?.id || null,
      next_match_slot: 'team_b',
      loser_next_match_id: bronzeMatch?.id || null,
      loser_next_match_slot: 'team_b',
      venue: 'PSU Main Gym - Court 1',
    });
    if (sf2Err) throw sf2Err;

    // Populate active roster for CAS Titans and CBA Wolves
    const { data: players } = await supabase.from('users').select('id').eq('role', 'player_student').limit(10);
    if (players && players.length >= 4) {
      const rosterEntries = [
        { team_id: teamMap['CAS Titans'], player_id: players[0].id, jersey_number: 7, is_starter: true, status: 'Approved', position: 'Point Guard (PG)' },
        { team_id: teamMap['CAS Titans'], player_id: players[1].id, jersey_number: 11, is_starter: true, status: 'Approved', position: 'Shooting Guard (SG)' },
        { team_id: teamMap['CBA Wolves'], player_id: players[2].id, jersey_number: 23, is_starter: true, status: 'Approved', position: 'Small Forward (SF)' },
        { team_id: teamMap['CBA Wolves'], player_id: players[3].id, jersey_number: 5, is_starter: true, status: 'Approved', position: 'Center (C)' },
      ];
      await supabase.from('team_roster').insert(rosterEntries);
    }

    // Commentary Events
    if (sf1Match) {
      const demoEvents = [
        { match_id: sf1Match.id, description: 'Tip-off won by CAS Titans starting center.' },
        { match_id: sf1Match.id, description: '3-pointer drained from deep corner by CAS Titans #7!' },
        { match_id: sf1Match.id, description: 'Fastbreak transition layup finished by CBA Wolves #23.' },
        { match_id: sf1Match.id, description: 'Defensive steal and assist executed by CAS Titans #11.' },
        { match_id: sf1Match.id, description: 'Full timeout called by CBA Wolves coaching staff.' },
        { match_id: sf1Match.id, description: 'End of 3rd Quarter: CAS Titans 68, CBA Wolves 65. Intense game!' },
      ];
      await supabase.from('match_events').insert(demoEvents);
    }

    return {
      success: true,
      message: 'Live Halftime Match injected: Semifinals CAS (68) vs CBA (65) live with clock and commentary.',
      tournamentId,
      liveMatchId: sf1Match?.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to inject Live Halftime Match',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * SCENARIO D: Completed Championship & Medal Ceremony
 * Advances all matches to completion, crowns Champion CAS Titans (Gold),
 * CIT Knights (Silver), and CBA Wolves (Bronze), and awards MVP Stars.
 */
export async function injectCompletedChampionship(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    const base = await injectLiveHalftimeMatch(supabase);
    if (!base.success || !base.tournamentId) {
      throw new Error(base.error || 'Base tournament setup failed');
    }

    const tournamentId = base.tournamentId;

    const { data: matches, error: mErr } = await supabase.from('matches').select('id, round, team_a_id, team_b_id').eq('tournament_id', tournamentId);
    if (mErr) throw mErr;
    if (!matches) throw new Error('Matches not found for tournament');

    const sf1 = matches.find((m) => m.round === 'Semifinals' && m.team_a_id);
    const sf2 = matches.find((m) => m.round === 'Semifinals' && m.id !== sf1?.id);
    const finals = matches.find((m) => m.round === 'Finals');
    const bronze = matches.find((m) => m.round === '3rd Place Playoff');

    // Complete SF1: CAS (82) def CBA (78)
    if (sf1) {
      await supabase.from('matches').update({
        status: 'Completed',
        team_a_score: 82,
        team_b_score: 78,
      }).eq('id', sf1.id);
    }

    // Complete SF2: CIT (75) def COE (70)
    if (sf2) {
      await supabase.from('matches').update({
        status: 'Completed',
        team_a_score: 70,
        team_b_score: 75,
      }).eq('id', sf2.id);
    }

    // Complete Bronze: CBA (80) def COE (74) -> CBA Bronze
    if (bronze && sf1 && sf2) {
      await supabase.from('matches').update({
        team_a_id: sf1.team_b_id, // CBA
        team_b_id: sf2.team_a_id, // COE
        team_a_score: 80,
        team_b_score: 74,
        status: 'Completed',
      }).eq('id', bronze.id);
    }

    // Complete Finals: CAS (88) def CIT (84) -> CAS Gold, CIT Silver
    if (finals && sf1 && sf2) {
      await supabase.from('matches').update({
        team_a_id: sf1.team_a_id, // CAS
        team_b_id: sf2.team_b_id, // CIT
        team_a_score: 88,
        team_b_score: 84,
        status: 'Completed',
      }).eq('id', finals.id);
    }

    // Mark tournament as Completed
    await supabase.from('tournaments').update({ status: 'Completed' }).eq('id', tournamentId);

    // Award MVP Stars using schema-compliant columns (player_id, star_type: 'Gold'/'Red')
    const { data: players } = await supabase.from('users').select('id').eq('role', 'player_student').limit(3);
    if (players && players.length > 0 && finals) {
      const starEntries = [
        { player_id: players[0].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'Gold' },
        { player_id: players[0].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'Red' },
        ...(players.length > 1 ? [{ player_id: players[1].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'Red' }] : []),
      ];
      await supabase.from('player_stars').insert(starEntries);
    }

    return {
      success: true,
      message: 'Completed Championship injected: CAS Titans (Gold), CIT Knights (Silver), CBA Wolves (Bronze) & MVP Stars awarded!',
      tournamentId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to inject Championship',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * SCENARIO E: The Grand Binturungan Olympiad (Master Super Demo Scenario)
 * Simulates a full-scale inter-collegiate university athletic festival:
 * - All 9 Available Sports (Basketball, Volleyball, Soccer, Futsal, Sepak Takraw, Baseball, Softball, Pickleball, Table Tennis)
 * - All 9 PSU Colleges (CAH, CBA, CCRD, CCJE, CEAT, CHMT, CNHS, CS, CTE)
 * - Sport-specific rosters with jerseys, positions, starters (is_starter=true), subs (is_starter=false), and coaches
 * - Full tournament tree lifecycle (Quarterfinals, Semifinals, 3rd-Place Bronze, Finals)
 * - Crowning Gold, Silver, and Bronze medals that immediately populate /ranking
 */
export async function injectSuperDemo(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    await ensureClusters(supabase);

    // 1. Fetch colleges
    const { data: collegeList, error: colErr } = await supabase
      .from('colleges')
      .select('id, college_name');

    if (colErr || !collegeList || collegeList.length === 0) {
      throw new Error('Colleges table is empty or inaccessible');
    }

    // Map college codes
    const getCode = (name: string): string => {
      const match = name.match(/\(([^)]+)\)/);
      return match ? match[1] : name.slice(0, 4).toUpperCase();
    };

    const collegeMap: Record<string, { id: string; name: string; squadName: string }> = {};
    const mascotNames: Record<string, string> = {
      CEAT: 'Red Scorpions',
      CS: 'Byte Titans',
      CBA: 'Golden Wolves',
      CCJE: 'Law Enforcers',
      CHMT: 'Navigators',
      CTE: 'Mentors',
      CAH: 'Artistics',
      CCRD: 'Foresters',
      CNHS: 'Medics',
    };

    collegeList.forEach((c) => {
      const code = getCode(c.college_name);
      collegeMap[code] = {
        id: c.id,
        name: c.college_name,
        squadName: `${code} ${mascotNames[code] || 'Athletics'}`,
      };
    });

    const activeCodes = ['CEAT', 'CS', 'CBA', 'CCJE', 'CHMT', 'CTE', 'CAH', 'CCRD', 'CNHS'].filter(
      (code) => collegeMap[code]
    );

    // 2. Fetch or provision coaches
    const { data: existingCoaches } = await supabase.from('users').select('id, college_id').eq('role', 'coach');
    const coachByCollege: Record<string, string> = {};
    (existingCoaches || []).forEach((c) => {
      if (c.college_id) coachByCollege[c.college_id] = c.id;
    });

    // Provision missing college coaches
    for (const code of activeCodes) {
      const col = collegeMap[code];
      if (!coachByCollege[col.id]) {
        const { data: newCoach } = await supabase
          .from('users')
          .insert({
            full_name: `Coach ${code} Faculty`,
            email: `coach.${code.toLowerCase()}@psu.palawan.edu.ph`,
            role: 'coach',
            college_id: col.id,
            is_verified: true,
          })
          .select('id')
          .single();
        if (newCoach) coachByCollege[col.id] = newCoach.id;
      }
    }

    // 3. Ensure test student athletes pool per college (minimum 8 players each)
    const { data: allStudents } = await supabase
      .from('users')
      .select('id, full_name, college_id')
      .eq('role', 'player_student');

    const studentsByCollege: Record<string, { id: string; full_name: string }[]> = {};
    activeCodes.forEach((code) => {
      studentsByCollege[code] = [];
    });

    (allStudents || []).forEach((st) => {
      for (const code of activeCodes) {
        if (st.college_id === collegeMap[code].id) {
          studentsByCollege[code].push(st);
        }
      }
    });

    const samplePlayerNames = [
      'Aris Thorne', 'Gabriel Vance', 'Christian Cruz', 'Paolo Reyes', 'Jiro Mendoza',
      'Angelo Santos', 'Nathaniel Diaz', 'Dominic Flores', 'Mark Bautista', 'Rafael Ramos',
      'Joshua Dalisay', 'Ezekiel Castro', 'Adrian Del Rosario', 'Kurt Alcantara'
    ];

    for (const code of activeCodes) {
      const currentCount = studentsByCollege[code].length;
      if (currentCount < 8) {
        const needed = 8 - currentCount;
        const newAthletes = [];
        for (let i = 0; i < needed; i++) {
          const idx = (currentCount + i) % samplePlayerNames.length;
          newAthletes.push({
            full_name: `${samplePlayerNames[idx]} (${code})`,
            email: `athlete.${code.toLowerCase()}.${currentCount + i + 1}@psu.palawan.edu.ph`,
            role: 'player_student',
            college_id: collegeMap[code].id,
            student_number: `2024-8-0${(Math.floor(Math.random() * 899) + 100)}`,
            program: `BS ${code} Degree Program`,
            year_level: `${(i % 4) + 1}st Year`,
            is_verified: true,
          });
        }
        const { data: insertedAthletes } = await supabase.from('users').insert(newAthletes).select('id, full_name');
        if (insertedAthletes) {
          studentsByCollege[code].push(...insertedAthletes);
        }
      }
    }

    // 4. The 9 Available PSU Sports
    const ALL_SPORTS = [
      { sport: 'Basketball', title: 'Basketball Championship (Marquee)', isMarquee: true },
      { sport: 'Volleyball', title: "Men's Volleyball Tournament", isVolleyball: true },
      { sport: 'Soccer', title: 'Football / Soccer Cup' },
      { sport: 'Futsal', title: 'Indoor Futsal Arena' },
      { sport: 'Sepak Takraw', title: 'Sepak Takraw Regu' },
      { sport: 'Baseball', title: 'Baseball Classic Series' },
      { sport: 'Softball', title: 'Softball Diamond League' },
      { sport: 'Pickleball', title: 'Pickleball Open Division' },
      { sport: 'Table Tennis', title: 'Table Tennis Singles & Doubles' },
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sportRosterRoles: Record<string, { starters: string[]; subs: string[] }> = {
      Basketball: {
        starters: ['Point Guard (PG)', 'Shooting Guard (SG)', 'Small Forward (SF)', 'Power Forward (PF)', 'Center (C)'],
        subs: ['6th Man Guard (G)', 'Backup Forward (F)', 'Backup Center (C)'],
      },
      Volleyball: {
        starters: ['Setter (S)', 'Outside Hitter 1 (OH)', 'Outside Hitter 2 (OH)', 'Middle Blocker (MB)', 'Opposite Hitter (OPP)', 'Libero (L)'],
        subs: ['Defensive Specialist (DS)', 'Backup Setter (S)'],
      },
      Soccer: {
        starters: ['Goalkeeper (GK)', 'Center Back (CB)', 'Left Back (LB)', 'Right Back (RB)', 'Central Midfield (CM)', 'Attacking Midfield (CAM)', 'Striker (ST)', 'Winger (LW)', 'Winger (RW)'],
        subs: ['Sub Striker (ST)', 'Sub Midfielder (CM)'],
      },
      Futsal: {
        starters: ['Goalkeeper (GK)', 'Fixo (Defender)', 'Ala Right (Winger)', 'Ala Left (Winger)', 'Pivo (Pivot/Striker)'],
        subs: ['Sub Ala', 'Sub Fixo'],
      },
      'Sepak Takraw': {
        starters: ['Tekong (Server)', 'Killer (Striker)', 'Feeder (Setter)'],
        subs: ['Sub Feeder', 'Sub Killer'],
      },
      Baseball: {
        starters: ['Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 'Third Base (3B)', 'Shortstop (SS)', 'Left Field (LF)', 'Center Field (CF)', 'Right Field (RF)'],
        subs: ['Relief Pitcher (RP)', 'Pinch Hitter (DH)'],
      },
      Softball: {
        starters: ['Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 'Third Base (3B)', 'Shortstop (SS)', 'Outfield (OF)'],
        subs: ['Relief Pitcher (RP)', 'Alternate Player'],
      },
      Pickleball: {
        starters: ['Singles Seed #1', 'Doubles Specialist #1', 'Doubles Specialist #2'],
        subs: ['Singles Seed #2', 'Alternate'],
      },
      'Table Tennis': {
        starters: ['Singles Seed #1', 'Doubles Ace #1', 'Doubles Ace #2'],
        subs: ['Singles Seed #2', 'Alternate'],
      },
    };

    let marqueeBasketballTournId = '';
    let liveVolleyballMatchId = '';

    // Loop through all 9 sports and inject tournament + all 9 colleges + rosters
    for (const sportObj of ALL_SPORTS) {
      const tName = `PSU Binturungan 2026 - ${sportObj.title}`;

      // Clean existing tournament with this name if present
      const { data: existingT } = await supabase.from('tournaments').select('id').eq('name', tName).maybeSingle();
      if (existingT) {
        await supabase.from('matches').update({ next_match_id: null, loser_next_match_id: null }).eq('tournament_id', existingT.id);
        const { data: oldM } = await supabase.from('matches').select('id').eq('tournament_id', existingT.id);
        if (oldM && oldM.length > 0) {
          const ids = oldM.map((m) => m.id);
          await supabase.from('match_events').delete().in('match_id', ids);
          await supabase.from('player_stars').delete().in('match_id', ids);
          await supabase.from('matches').delete().in('id', ids);
        }
        await supabase.from('teams').delete().eq('tournament_id', existingT.id);
        await supabase.from('tournaments').delete().eq('id', existingT.id);
      }

      // 1. Create Tournament
      const isCompleted = !!sportObj.isMarquee;
      const { data: tourn, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: tName,
          sport: sportObj.sport,
          type: 'Binturungan',
          status: isCompleted ? 'Completed' : 'Active',
          start_date: todayStr,
          end_date: nextTwoWeeks,
        })
        .select('id')
        .single();

      if (tErr || !tourn) throw tErr || new Error(`Failed to create tournament for ${sportObj.sport}`);
      const tId = tourn.id;
      if (sportObj.isMarquee) marqueeBasketballTournId = tId;

      // 2. Insert Teams for all 9 colleges
      const teamInsertPayload = activeCodes.map((code) => {
        const col = collegeMap[code];
        return {
          name: col.squadName,
          tournament_id: tId,
          status: 'Approved',
          coach_id: coachByCollege[col.id] || null,
        };
      });

      const { data: createdTeams, error: teamInsErr } = await supabase
        .from('teams')
        .insert(teamInsertPayload)
        .select('id, name');

      if (teamInsErr || !createdTeams) throw teamInsErr || new Error(`Failed to insert teams for ${sportObj.sport}`);

      const teamLookup: Record<string, string> = {};
      createdTeams.forEach((t) => {
        teamLookup[t.name] = t.id;
      });

      // 3. Populate Sport-Specific Rosters for every college team
      const rosterEntries = [];
      const rolesConfig = sportRosterRoles[sportObj.sport] || sportRosterRoles['Basketball'];
      const jerseyNumbers = [1, 3, 7, 10, 11, 15, 23, 24, 33, 44, 99];

      for (const code of activeCodes) {
        const col = collegeMap[code];
        const teamId = teamLookup[col.squadName];
        const players = studentsByCollege[code] || [];
        if (!teamId || players.length === 0) continue;

        let pIdx = 0;
        // Assign starters
        for (let sIdx = 0; sIdx < rolesConfig.starters.length && pIdx < players.length; sIdx++, pIdx++) {
          rosterEntries.push({
            team_id: teamId,
            player_id: players[pIdx].id,
            jersey_number: jerseyNumbers[pIdx % jerseyNumbers.length],
            is_starter: true,
            is_captain: sIdx === 0,
            position: rolesConfig.starters[sIdx],
            status: 'Approved',
            availability_status: 'Active',
          });
        }
        // Assign subs
        for (let subIdx = 0; subIdx < rolesConfig.subs.length && pIdx < players.length; subIdx++, pIdx++) {
          rosterEntries.push({
            team_id: teamId,
            player_id: players[pIdx].id,
            jersey_number: jerseyNumbers[pIdx % jerseyNumbers.length],
            is_starter: false,
            is_captain: false,
            position: rolesConfig.subs[subIdx],
            status: 'Approved',
            availability_status: 'Bench',
          });
        }
      }

      if (rosterEntries.length > 0) {
        await supabase.from('team_roster').insert(rosterEntries);
      }

      // 4. Bracket & Matches Generation
      if (sportObj.isMarquee) {
        // Complete 8-team Single Elimination Tournament Lifecycle for Basketball
        // Finals: CEAT (92) def CS (88) -> CEAT Gold, CS Silver
        // Bronze: CBA (78) def CCJE (72) -> CBA Bronze
        const teamCeat = teamLookup[collegeMap['CEAT'].squadName];
        const teamCs = teamLookup[collegeMap['CS'].squadName];
        const teamCba = teamLookup[collegeMap['CBA'].squadName];
        const teamCcje = teamLookup[collegeMap['CCJE'].squadName];
        const teamChmt = teamLookup[collegeMap['CHMT'].squadName];
        const teamCte = teamLookup[collegeMap['CTE'].squadName];
        const teamCah = teamLookup[collegeMap['CAH'].squadName];
        const teamCcrd = teamLookup[collegeMap['CCRD'].squadName];

        const matchTime = (offsetHours = 0) => {
          const d = new Date();
          d.setHours(d.getHours() + offsetHours);
          return d.toISOString();
        };

        // A. Insert Finals & Bronze matches
        const { data: finM } = await supabase
          .from('matches')
          .insert({
            tournament_id: tId,
            team_a_id: teamCeat,
            team_b_id: teamCs,
            team_a_score: 92,
            team_b_score: 88,
            round: 'Finals',
            status: 'Completed',
            match_time: matchTime(-2),
            venue: 'PSU Main Gymnasium - Court 1',
          })
          .select('id')
          .single();

        const { data: brzM } = await supabase
          .from('matches')
          .insert({
            tournament_id: tId,
            team_a_id: teamCba,
            team_b_id: teamCcje,
            team_a_score: 78,
            team_b_score: 72,
            round: '3rd Place Playoff',
            status: 'Completed',
            match_time: matchTime(-4),
            venue: 'PSU Main Gymnasium - Court 2',
          })
          .select('id')
          .single();

        // B. Insert Semifinals (linking to Finals and Bronze)
        const { data: sf1M } = await supabase
          .from('matches')
          .insert({
            tournament_id: tId,
            team_a_id: teamCeat,
            team_b_id: teamCba,
            team_a_score: 86,
            team_b_score: 81,
            round: 'Semifinals',
            status: 'Completed',
            match_time: matchTime(-20),
            next_match_id: finM?.id,
            next_match_slot: 'team_a',
            loser_next_match_id: brzM?.id,
            loser_next_match_slot: 'team_a',
            venue: 'PSU Main Gymnasium - Court 1',
          })
          .select('id')
          .single();

        const { data: sf2M } = await supabase
          .from('matches')
          .insert({
            tournament_id: tId,
            team_a_id: teamCs,
            team_b_id: teamCcje,
            team_a_score: 80,
            team_b_score: 74,
            round: 'Semifinals',
            status: 'Completed',
            match_time: matchTime(-18),
            next_match_id: finM?.id,
            next_match_slot: 'team_b',
            loser_next_match_id: brzM?.id,
            loser_next_match_slot: 'team_b',
            venue: 'PSU Main Gymnasium - Court 1',
          })
          .select('id')
          .single();

        // C. Insert 4 Quarterfinals (linking to Semifinals)
        const qfMatches = [
          {
            tournament_id: tId,
            team_a_id: teamCeat,
            team_b_id: teamCcrd,
            team_a_score: 84,
            team_b_score: 72,
            round: 'Quarterfinals',
            status: 'Completed',
            match_time: matchTime(-40),
            next_match_id: sf1M?.id,
            next_match_slot: 'team_a',
            venue: 'PSU Main Gymnasium - Court 1',
          },
          {
            tournament_id: tId,
            team_a_id: teamCba,
            team_b_id: teamChmt,
            team_a_score: 79,
            team_b_score: 68,
            round: 'Quarterfinals',
            status: 'Completed',
            match_time: matchTime(-38),
            next_match_id: sf1M?.id,
            next_match_slot: 'team_b',
            venue: 'PSU Main Gymnasium - Court 2',
          },
          {
            tournament_id: tId,
            team_a_id: teamCs,
            team_b_id: teamCah,
            team_a_score: 82,
            team_b_score: 75,
            round: 'Quarterfinals',
            status: 'Completed',
            match_time: matchTime(-36),
            next_match_id: sf2M?.id,
            next_match_slot: 'team_a',
            venue: 'PSU Main Gymnasium - Court 1',
          },
          {
            tournament_id: tId,
            team_a_id: teamCcje,
            team_b_id: teamCte,
            team_a_score: 77,
            team_b_score: 73,
            round: 'Quarterfinals',
            status: 'Completed',
            match_time: matchTime(-34),
            next_match_id: sf2M?.id,
            next_match_slot: 'team_b',
            venue: 'PSU Main Gymnasium - Court 2',
          },
        ];

        await supabase.from('matches').insert(qfMatches);

        // D. Award Official MVP Stars
        if (finM && studentsByCollege['CEAT']?.length > 0 && studentsByCollege['CS']?.length > 0) {
          const ceatMvp = studentsByCollege['CEAT'][0].id;
          const csTopScorer = studentsByCollege['CS'][0].id;

          await supabase.from('player_stars').insert([
            { player_id: ceatMvp, match_id: finM.id, tournament_id: tId, star_type: 'Gold' },
            { player_id: ceatMvp, match_id: finM.id, tournament_id: tId, star_type: 'Red' },
            { player_id: csTopScorer, match_id: finM.id, tournament_id: tId, star_type: 'Red' },
          ]);

          await supabase.from('match_events').insert([
            { match_id: finM.id, description: 'Championship buzzer sounds: CEAT Red Scorpions (92) defeat CS Byte Titans (88)!' },
            { match_id: finM.id, description: 'Tournament MVP Gold Star officially awarded to CEAT Team Captain.' },
          ]);
        }
      } else if (sportObj.isVolleyball) {
        // Active Volleyball Match for courtside kiosk testing
        const teamCs = teamLookup[collegeMap['CS']?.squadName];
        const teamCeat = teamLookup[collegeMap['CEAT']?.squadName];

        const { data: vbMatch } = await supabase
          .from('matches')
          .insert({
            tournament_id: tId,
            team_a_id: teamCs,
            team_b_id: teamCeat,
            team_a_score: 25,
            team_b_score: 23,
            round: 'Semifinals',
            status: 'Ongoing',
            match_time: new Date().toISOString(),
            venue: 'PSU Sports Complex - Court B',
          })
          .select('id')
          .single();

        if (vbMatch) {
          liveVolleyballMatchId = vbMatch.id;
          await supabase.from('match_events').insert([
            { match_id: vbMatch.id, description: 'Set 1 won by CS Byte Titans (25 - 23).' },
            { match_id: vbMatch.id, description: 'Set 2 underway: Spike by CEAT outside hitter down the line.' },
          ]);
        }
      } else {
        // Scheduled/Group Fixtures for other sports
        const team1 = teamLookup[collegeMap['CCJE']?.squadName];
        const team2 = teamLookup[collegeMap['CBA']?.squadName];
        const team3 = teamLookup[collegeMap['CHMT']?.squadName];
        const team4 = teamLookup[collegeMap['CTE']?.squadName];

        if (team1 && team2) {
          await supabase.from('matches').insert([
            {
              tournament_id: tId,
              team_a_id: team1,
              team_b_id: team2,
              team_a_score: 1,
              team_b_score: 0,
              round: 'Group Stage Match 1',
              status: 'Completed',
              match_time: new Date(Date.now() - 4 * 3600000).toISOString(),
              venue: 'University Field A',
            },
            ...(team3 && team4
              ? [{
                  tournament_id: tId,
                  team_a_id: team3,
                  team_b_id: team4,
                  team_a_score: 0,
                  team_b_score: 0,
                  round: 'Group Stage Match 2',
                  status: 'Scheduled',
                  match_time: new Date(Date.now() + 2 * 3600000).toISOString(),
                  venue: 'University Field B',
                }]
              : []),
          ]);
        }
      }
    }

    return {
      success: true,
      message: 'The Grand Binturungan Olympiad injected: All 9 sports created, 9 college squads fully rostered with positions & jerseys, complete tournament tree, and CEAT crowned Gold Champion!',
      tournamentId: marqueeBasketballTournId,
      liveMatchId: liveVolleyballMatchId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to inject Super Demo Scenario',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * Helper to ensure the 4 PSU campus clusters exist.
 */
async function ensureClusters(supabase: SupabaseClient) {
  const demoClusters = [
    { name: 'Cluster A - Titans', description: 'College of Arts and Sciences', college_codes: ['CAS'] },
    { name: 'Cluster B - Wolves', description: 'College of Business Administration', college_codes: ['CBA'] },
    { name: 'Cluster C - Builders', description: 'College of Engineering', college_codes: ['COE'] },
    { name: 'Cluster D - Cyber Knights', description: 'College of Information Technology', college_codes: ['CIT'] },
  ];

  for (const c of demoClusters) {
    const { data: existing } = await supabase.from('clusters').select('id').eq('name', c.name).maybeSingle();
    if (!existing) {
      await supabase.from('clusters').insert(c);
    }
  }
}

/**
 * LIVE EVENT SIMULATOR: Injects a realistic point score and commentary event into an active match.
 */
export async function simulateNextPlay(
  supabase: SupabaseClient,
  matchId: string,
  targetTeam: 'team_a' | 'team_b',
  points: number,
  playDescription: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select('team_a_score, team_b_score')
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) throw new Error(fetchErr?.message || 'Match not found');

    const updatePayload = targetTeam === 'team_a'
      ? { team_a_score: (match.team_a_score || 0) + points }
      : { team_b_score: (match.team_b_score || 0) + points };

    const { error: updateErr } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', matchId);

    if (updateErr) throw updateErr;

    // Insert live commentary event
    await supabase.from('match_events').insert({
      match_id: matchId,
      description: playDescription,
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: formatErrorMessage(err) };
  }
}
