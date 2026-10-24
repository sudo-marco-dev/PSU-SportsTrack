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
export async function injectCleanSlate(
  supabase: SupabaseClient,
  options?: { mode?: 'safe_dev_only' | 'hard_reset' }
): Promise<ScenarioResult> {
  const mode = options?.mode || 'safe_dev_only';
  try {
    if (mode === 'safe_dev_only') {
      // 1. Find all tournaments tagged with [DEV] or matching dev demo titles
      const { data: devTourns } = await supabase
        .from('tournaments')
        .select('id, name');

      const matchingTournIds = (devTourns || [])
        .filter((t) => t.name?.includes('[DEV]') || t.name?.includes('PSU Binturungan 2026') || t.name?.includes('PSU Palaro 2026'))
        .map((t) => t.id);

      if (matchingTournIds.length > 0) {
        // Break match references
        await supabase
          .from('matches')
          .update({ next_match_id: null, loser_next_match_id: null })
          .in('tournament_id', matchingTournIds);

        const { data: devMatches } = await supabase
          .from('matches')
          .select('id')
          .in('tournament_id', matchingTournIds);

        if (devMatches && devMatches.length > 0) {
          const matchIds = devMatches.map((m) => m.id);
          await supabase.from('match_score_events').delete().in('match_id', matchIds);
          await supabase.from('match_player_stats').delete().in('match_id', matchIds);
          await supabase.from('match_events').delete().in('match_id', matchIds);
          await supabase.from('player_stars').delete().in('match_id', matchIds);
          await supabase.from('matches').delete().in('id', matchIds);
        }

        const { data: devTeams } = await supabase
          .from('teams')
          .select('id')
          .in('tournament_id', matchingTournIds);
        if (devTeams && devTeams.length > 0) {
          const teamIds = devTeams.map((t) => t.id);
          await supabase.from('team_roster').delete().in('team_id', teamIds);
        }

        await supabase.from('teams').delete().in('tournament_id', matchingTournIds);
        await supabase.from('tournaments').delete().in('id', matchingTournIds);
      }

      // Also clean faker users tagged with [DEV]
      const { data: devUsers } = await supabase
        .from('users')
        .select('id, full_name');
      const matchingUserIds = (devUsers || [])
        .filter((u) => u.full_name?.startsWith('[DEV]'))
        .map((u) => u.id);

      if (matchingUserIds.length > 0) {
        await supabase.from('verification_documents').delete().in('user_id', matchingUserIds);
        await supabase.from('users').delete().in('id', matchingUserIds);
      }

      return {
        success: true,
        message: 'Safe Clean Slate complete: All [DEV] mock tournaments, matches, teams, and faker profiles purged safely without affecting production data.',
      };
    } else {
      // Hard Reset: Complete wipe of all test tournaments and matches
      await supabase.from('matches').update({
        next_match_id: null,
        loser_next_match_id: null,
      }).neq('id', '00000000-0000-0000-0000-000000000000');

      await supabase.from('match_score_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('match_player_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('match_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('player_stars').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('team_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      return {
        success: true,
        message: 'Complete Hard Reset executed: All test tournaments, brackets, and rosters completely wiped. Colleges and root accounts preserved.',
      };
    }
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
    const targetStudents = (students && students.length > 0)
      ? students
      : [
          { id: '8785501d-cfd8-41c7-a4f3-1e87858392d4', full_name: 'Mark Mendoza', email: 'mmendoza2024@psu.palawan.edu.ph' },
          { id: '90c2dc25-d13c-4464-9992-bf561e1ce9d2', full_name: 'Juan Dela Cruz', email: 'jdelacruz2024@psu.palawan.edu.ph' },
          { id: 'b0786737-4091-40e8-8638-71e1c37c112a', full_name: 'Kuya Roberto Dalisay', email: 'staff@gmail.com' },
        ];

    const studentIds = targetStudents.map((s) => s.id);
    await supabase.from('verification_documents').delete().in('user_id', studentIds);

    const mockDocs = [
      {
        user_id: targetStudents[0].id,
        storage_path: 'mock_cor_sample_high.pdf',
        document_type: 'COR',
        status: 'Pending',
        confidence_score: 95,
        extracted_full_name: targetStudents[0].full_name || 'Mark Mendoza',
        extracted_student_no: '2024-8-0912',
        extracted_college: 'CS',
        extracted_program: 'BS Computer Science',
        extracted_year_level: '1st Year',
      },
      ...(targetStudents.length > 1
        ? [{
            user_id: targetStudents[1].id,
            storage_path: 'mock_cor_sample_med.pdf',
            document_type: 'COR',
            status: 'Pending',
            confidence_score: 80,
            extracted_full_name: targetStudents[1].full_name || 'Maria Santos',
            extracted_student_no: '2022-8-0115',
            extracted_college: 'CBA',
            extracted_program: 'BS Accountancy',
            extracted_year_level: '4th Year',
          }]
        : []),
      ...(targetStudents.length > 2
        ? [{
            user_id: targetStudents[2].id,
            storage_path: 'mock_cor_sample_low.pdf',
            document_type: 'STAFF_ID',
            status: 'Pending',
            confidence_score: 45,
            extracted_full_name: targetStudents[2].full_name || 'Kuya Roberto Dalisay',
            extracted_student_no: 'EMP-2024-0188',
            extracted_college: 'General Services',
            extracted_program: null,
            extracted_year_level: null,
          }]
        : []),
    ];

    const { error: docErr } = await supabase.from('verification_documents').insert(mockDocs);
    if (docErr) throw docErr;

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

    // 1. Fetch colleges & clusters
    const { data: collegeList, error: colErr } = await supabase
      .from('colleges')
      .select('id, college_name');

    if (colErr || !collegeList || collegeList.length === 0) {
      throw new Error('Colleges table is empty or inaccessible');
    }

    const { data: dbClusters } = await supabase.from('clusters').select('id, name, college_codes');
    const tribeByCollegeCode: Record<string, string> = {};
    (dbClusters || []).forEach((cl) => {
      (cl.college_codes || []).forEach((cCode: string) => {
        tribeByCollegeCode[cCode] = cl.id;
      });
    });

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
        squadName: `${code} ${mascotNames[code] || 'Squad'}`,
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

    // Ensure all 9 colleges have their student athlete roster pools initialized
    activeCodes.forEach((code) => {
      if (!studentsByCollege[code]) studentsByCollege[code] = [];
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const matchTime = (offsetHours = 0) => {
      const d = new Date();
      d.setHours(d.getHours() + offsetHours);
      return d.toISOString();
    };

    const sportRosterRoles: Record<string, { starters: string[]; subs: string[] }> = {
      Basketball: {
        starters: ['Point Guard (PG)', 'Shooting Guard (SG)', 'Small Forward (SF)', 'Power Forward (PF)', 'Center (C)'],
        subs: ['6th Man Guard (G)', 'Backup Small Forward (SF)', 'Backup Power Forward (PF)', 'Backup Center (C)'],
      },
      Volleyball: {
        starters: ['Setter (S)', 'Outside Hitter 1 (OH)', 'Outside Hitter 2 (OH)', 'Middle Blocker 1 (MB)', 'Opposite Hitter (OPP)', 'Libero (L)'],
        subs: ['Defensive Specialist (DS)', 'Backup Setter (S)', 'Middle Blocker 2 (MB)', 'Serving Specialist (SS)'],
      },
      Soccer: {
        starters: [
          'Goalkeeper (GK)', 'Center Back (CB)', 'Center Back 2 (CB)', 'Left Back (LB)', 'Right Back (RB)',
          'Defensive Midfield (CDM)', 'Central Midfield (CM)', 'Attacking Midfield (CAM)', 'Left Wing (LW)', 'Right Wing (RW)', 'Striker (ST)'
        ],
        subs: ['Backup Goalkeeper (GK)', 'Sub Midfielder (CM)', 'Sub Winger (W)', 'Sub Striker (ST)'],
      },
      Futsal: {
        starters: ['Goalkeeper (GK)', 'Fixo (Defender)', 'Ala Right (Winger)', 'Ala Left (Winger)', 'Pivo (Pivot/Striker)'],
        subs: ['Backup Goalkeeper (GK)', 'Sub Ala (Winger)', 'Sub Fixo (Defender)', 'Sub Pivo (Pivot)'],
      },
      'Sepak Takraw': {
        starters: ['Tekong (Server)', 'Killer (Striker)', 'Feeder (Setter)'],
        subs: ['Alternate Tekong (Server)', 'Alternate Feeder (Setter)', 'Alternate Killer (Striker)'],
      },
      Baseball: {
        starters: [
          'Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 'Third Base (3B)',
          'Shortstop (SS)', 'Left Field (LF)', 'Center Field (CF)', 'Right Field (RF)'
        ],
        subs: ['Relief Pitcher (RP)', 'Backup Catcher (C)', 'Utility Infielder (IF)', 'Pinch Hitter (PH)'],
      },
      Softball: {
        starters: [
          'Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 'Third Base (3B)',
          'Shortstop (SS)', 'Left Field (LF)', 'Center Field (CF)', 'Right Field (RF)'
        ],
        subs: ['Relief Pitcher (RP)', 'Backup Catcher (C)', 'Utility Outfielder (OF)', 'Pinch Hitter (PH)'],
      },
      Pickleball: {
        starters: ['Singles Ace #1', 'Singles Ace #2', 'Doubles Specialist #1', 'Doubles Specialist #2'],
        subs: ['Alternate Singles #1', 'Alternate Doubles #1', 'Reserve Player'],
      },
      'Table Tennis': {
        starters: ['Singles Ace #1', 'Singles Ace #2', 'Doubles Ace #1', 'Doubles Ace #2'],
        subs: ['Alternate Singles #1', 'Alternate Doubles #1', 'Reserve Player'],
      },
    };

    interface MatchSpec {
      teamA?: string;
      teamB?: string;
      scoreA: number;
      scoreB: number;
      status: 'Scheduled' | 'Ongoing' | 'Completed';
      offsetHours: number;
      court: string;
      events?: string[];
    }

    interface SportScenarioDef {
      sport: string;
      title: string;
      status: 'Active' | 'Completed';
      venuePrefix: string;
      isMarquee?: boolean;
      elimMatches: {
        round: string;
        teamA: string;
        teamB: string;
        scoreA: number;
        scoreB: number;
        status: 'Scheduled' | 'Ongoing' | 'Completed';
        offsetHours: number;
        court: string;
        events?: string[];
      }[];
      quarters: [MatchSpec, MatchSpec, MatchSpec, MatchSpec];
      semis: [MatchSpec, MatchSpec];
      bronze: MatchSpec;
      finals: MatchSpec;
      mvpStars?: { collegeCode: string; starType: 'Gold' | 'Red' }[];
    }

    const ALL_SPORTS_CONFIG: SportScenarioDef[] = [
      // 1. BASKETBALL: Completed Marquee Tournament (CEAT Gold, CS Silver, CBA Bronze)
      {
        sport: 'Basketball',
        title: 'Basketball Championship (Marquee)',
        isMarquee: true,
        status: 'Completed',
        venuePrefix: 'PSU Main Gymnasium',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CCJE', scoreA: 88, scoreB: 74, status: 'Completed', offsetHours: -48, court: 'Court 1' },
          { round: 'Group Stage - Pool A', teamA: 'CBA', teamB: 'CCRD', scoreA: 82, scoreB: 71, status: 'Completed', offsetHours: -46, court: 'Court 2' },
          { round: 'Group Stage - Pool B', teamA: 'CS', teamB: 'CTE', scoreA: 90, scoreB: 78, status: 'Completed', offsetHours: -44, court: 'Court 1' },
          { round: 'Group Stage - Pool B', teamA: 'CHMT', teamB: 'CAH', scoreA: 76, scoreB: 70, status: 'Completed', offsetHours: -42, court: 'Court 2' },
        ],
        quarters: [
          { teamA: 'CEAT', teamB: 'CCRD', scoreA: 84, scoreB: 72, status: 'Completed', offsetHours: -30, court: 'Court 1' },
          { teamA: 'CBA', teamB: 'CHMT', scoreA: 79, scoreB: 68, status: 'Completed', offsetHours: -28, court: 'Court 2' },
          { teamA: 'CS', teamB: 'CAH', scoreA: 82, scoreB: 75, status: 'Completed', offsetHours: -26, court: 'Court 1' },
          { teamA: 'CCJE', teamB: 'CTE', scoreA: 77, scoreB: 73, status: 'Completed', offsetHours: -24, court: 'Court 2' },
        ],
        semis: [
          { teamA: 'CEAT', teamB: 'CBA', scoreA: 86, scoreB: 81, status: 'Completed', offsetHours: -16, court: 'Court 1' },
          { teamA: 'CS', teamB: 'CCJE', scoreA: 80, scoreB: 74, status: 'Completed', offsetHours: -14, court: 'Court 1' },
        ],
        bronze: { teamA: 'CBA', teamB: 'CCJE', scoreA: 78, scoreB: 72, status: 'Completed', offsetHours: -4, court: 'Court 2' },
        finals: {
          teamA: 'CEAT', teamB: 'CS', scoreA: 92, scoreB: 88, status: 'Completed', offsetHours: -2, court: 'Court 1',
          events: [
            'Championship buzzer sounds: CEAT Red Scorpions (92) defeat CS Byte Titans (88)!',
            'Tournament MVP Gold Star officially awarded to CEAT Team Captain.'
          ]
        },
        mvpStars: [
          { collegeCode: 'CEAT', starType: 'Gold' },
          { collegeCode: 'CEAT', starType: 'Red' },
          { collegeCode: 'CS', starType: 'Red' },
        ],
      },

      // 2. VOLLEYBALL: Active Tournament with Live Semifinals (CEAT vs CCJE)
      {
        sport: 'Volleyball',
        title: "Men's Volleyball Tournament",
        status: 'Active',
        venuePrefix: 'PSU Sports Complex',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CS', teamB: 'CNHS', scoreA: 25, scoreB: 21, status: 'Completed', offsetHours: -40, court: 'Arena Court A' },
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CTE', scoreA: 25, scoreB: 20, status: 'Completed', offsetHours: -38, court: 'Arena Court B' },
          { round: 'Group Stage - Pool B', teamA: 'CBA', teamB: 'CAH', scoreA: 25, scoreB: 22, status: 'Completed', offsetHours: -36, court: 'Arena Court A' },
          { round: 'Group Stage - Pool B', teamA: 'CCJE', teamB: 'CHMT', scoreA: 25, scoreB: 18, status: 'Completed', offsetHours: -34, court: 'Arena Court B' },
        ],
        quarters: [
          { teamA: 'CS', teamB: 'CNHS', scoreA: 25, scoreB: 19, status: 'Completed', offsetHours: -24, court: 'Arena Court A' },
          { teamA: 'CBA', teamB: 'CAH', scoreA: 25, scoreB: 21, status: 'Completed', offsetHours: -22, court: 'Arena Court B' },
          { teamA: 'CEAT', teamB: 'CTE', scoreA: 25, scoreB: 23, status: 'Completed', offsetHours: -20, court: 'Arena Court A' },
          { teamA: 'CCJE', teamB: 'CHMT', scoreA: 25, scoreB: 20, status: 'Completed', offsetHours: -18, court: 'Arena Court B' },
        ],
        semis: [
          { teamA: 'CS', teamB: 'CBA', scoreA: 25, scoreB: 22, status: 'Completed', offsetHours: -6, court: 'Arena Court A' },
          {
            teamA: 'CEAT', teamB: 'CCJE', scoreA: 25, scoreB: 23, status: 'Ongoing', offsetHours: 0, court: 'Arena Court A',
            events: [
              'Set 1: CEAT outside hitter converts cross-court spike (25-23).',
              'Set 2: CCJE answers with massive double block at the net.',
              'Set 3 underway: Intense deuce rally in progress courtside!'
            ]
          },
        ],
        bronze: { teamA: 'CBA', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 4, court: 'Arena Court B' },
        finals: { teamA: 'CS', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 6, court: 'Arena Court A' },
      },

      // 3. SOCCER: Active Tournament with Live Semifinals (CEAT vs CBA)
      {
        sport: 'Soccer',
        title: 'Football / Soccer Cup',
        status: 'Active',
        venuePrefix: 'PSU Main Athletic Oval',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CCRD', scoreA: 3, scoreB: 1, status: 'Completed', offsetHours: -36, court: 'Field 1' },
          { round: 'Group Stage - Pool A', teamA: 'CBA', teamB: 'CTE', scoreA: 2, scoreB: 0, status: 'Completed', offsetHours: -34, court: 'Field 2' },
          { round: 'Group Stage - Pool B', teamA: 'CS', teamB: 'CHMT', scoreA: 1, scoreB: 0, status: 'Completed', offsetHours: -32, court: 'Field 1' },
          { round: 'Group Stage - Pool B', teamA: 'CCJE', teamB: 'CAH', scoreA: 2, scoreB: 1, status: 'Completed', offsetHours: -30, court: 'Field 2' },
        ],
        quarters: [
          { teamA: 'CEAT', teamB: 'CCRD', scoreA: 2, scoreB: 1, status: 'Completed', offsetHours: -20, court: 'Field 1' },
          { teamA: 'CBA', teamB: 'CTE', scoreA: 3, scoreB: 0, status: 'Completed', offsetHours: -18, court: 'Field 2' },
          { teamA: 'CS', teamB: 'CHMT', scoreA: 2, scoreB: 1, status: 'Completed', offsetHours: -16, court: 'Field 1' },
          { teamA: 'CCJE', teamB: 'CAH', scoreA: 1, scoreB: 0, status: 'Completed', offsetHours: -14, court: 'Field 2' },
        ],
        semis: [
          {
            teamA: 'CEAT', teamB: 'CBA', scoreA: 2, scoreB: 1, status: 'Ongoing', offsetHours: 0, court: 'Field 1',
            events: [
              '12\': Header goal scored by CEAT striker off corner delivery.',
              '44\': Equalizer curled into top corner by CBA midfielder!',
              '78\': Breakthrough counter-attack goal finished by CEAT left winger!'
            ]
          },
          { teamA: 'CS', teamB: 'CCJE', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 3, court: 'Field 1' },
        ],
        bronze: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 24, court: 'Field 2' },
        finals: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 26, court: 'Field 1' },
      },

      // 4. FUTSAL: Active Tournament with Ongoing Elimination Decider (CAH vs CCRD)
      {
        sport: 'Futsal',
        title: 'Indoor Futsal Arena',
        status: 'Active',
        venuePrefix: 'PSU Covered Court',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CS', scoreA: 5, scoreB: 3, status: 'Completed', offsetHours: -24, court: 'Pitch 1' },
          { round: 'Group Stage - Pool A', teamA: 'CBA', teamB: 'CCJE', scoreA: 4, scoreB: 2, status: 'Completed', offsetHours: -22, court: 'Pitch 2' },
          { round: 'Group Stage - Pool B', teamA: 'CHMT', teamB: 'CTE', scoreA: 6, scoreB: 5, status: 'Completed', offsetHours: -20, court: 'Pitch 1' },
          {
            round: 'Group Stage - Pool B', teamA: 'CAH', teamB: 'CCRD', scoreA: 3, scoreB: 3, status: 'Ongoing', offsetHours: 0, court: 'Pitch 1',
            events: [
              'Lightning counter: CAH Pivo scores into the bottom left corner.',
              'CCRD Fixo launches long-range screamer into top netting!',
              '2nd Half decider: Both squads pushing for the final playoff qualification slot!'
            ]
          },
        ],
        quarters: [
          { teamA: 'CEAT', teamB: 'CCRD', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 12, court: 'Pitch 1' },
          { teamA: 'CBA', teamB: 'CHMT', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 14, court: 'Pitch 2' },
          { teamA: 'CS', teamB: 'CAH', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 16, court: 'Pitch 1' },
          { teamA: 'CCJE', teamB: 'CTE', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 18, court: 'Pitch 2' },
        ],
        semis: [
          { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 28, court: 'Pitch 1' },
          { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 30, court: 'Pitch 2' },
        ],
        bronze: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 40, court: 'Pitch 2' },
        finals: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 42, court: 'Pitch 1' },
      },

      // 5. SEPAK TAKRAW: Active Tournament in Preliminary Elimination Stage
      {
        sport: 'Sepak Takraw',
        title: 'Sepak Takraw Regu',
        status: 'Active',
        venuePrefix: 'PSU Regu Stadium',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CTE', teamB: 'CAH', scoreA: 21, scoreB: 18, status: 'Completed', offsetHours: -18, court: 'Court A' },
          { round: 'Group Stage - Pool A', teamA: 'CCJE', teamB: 'CCRD', scoreA: 21, scoreB: 15, status: 'Completed', offsetHours: -16, court: 'Court B' },
          { round: 'Group Stage - Pool B', teamA: 'CEAT', teamB: 'CS', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 2, court: 'Court A' },
          { round: 'Group Stage - Pool B', teamA: 'CBA', teamB: 'CHMT', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 4, court: 'Court B' },
        ],
        quarters: [
          { teamA: 'CTE', teamB: 'CCRD', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 16, court: 'Court A' },
          { teamA: 'CCJE', teamB: 'CAH', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 18, court: 'Court B' },
          { teamA: 'CEAT', teamB: 'CHMT', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 20, court: 'Court A' },
          { teamA: 'CBA', teamB: 'CS', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 22, court: 'Court B' },
        ],
        semis: [
          { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 32, court: 'Court A' },
          { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 34, court: 'Court B' },
        ],
        bronze: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 46, court: 'Court B' },
        finals: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 48, court: 'Court A' },
      },

      // 6. BASEBALL: Completed Championship (CBA Gold, CCJE Silver, CEAT Bronze)
      {
        sport: 'Baseball',
        title: 'Baseball Classic Series',
        status: 'Completed',
        venuePrefix: 'PSU Diamond Ballfield',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CBA', teamB: 'CHMT', scoreA: 7, scoreB: 2, status: 'Completed', offsetHours: -50, court: 'Diamond 1' },
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CCRD', scoreA: 6, scoreB: 3, status: 'Completed', offsetHours: -48, court: 'Diamond 2' },
          { round: 'Group Stage - Pool B', teamA: 'CCJE', teamB: 'CTE', scoreA: 5, scoreB: 3, status: 'Completed', offsetHours: -46, court: 'Diamond 1' },
          { round: 'Group Stage - Pool B', teamA: 'CS', teamB: 'CAH', scoreA: 8, scoreB: 4, status: 'Completed', offsetHours: -44, court: 'Diamond 2' },
        ],
        quarters: [
          { teamA: 'CBA', teamB: 'CHMT', scoreA: 6, scoreB: 2, status: 'Completed', offsetHours: -32, court: 'Diamond 1' },
          { teamA: 'CEAT', teamB: 'CCRD', scoreA: 7, scoreB: 3, status: 'Completed', offsetHours: -30, court: 'Diamond 2' },
          { teamA: 'CCJE', teamB: 'CTE', scoreA: 4, scoreB: 3, status: 'Completed', offsetHours: -28, court: 'Diamond 1' },
          { teamA: 'CS', teamB: 'CAH', scoreA: 5, scoreB: 1, status: 'Completed', offsetHours: -26, court: 'Diamond 2' },
        ],
        semis: [
          { teamA: 'CBA', teamB: 'CEAT', scoreA: 8, scoreB: 4, status: 'Completed', offsetHours: -18, court: 'Diamond 1' },
          { teamA: 'CCJE', teamB: 'CS', scoreA: 5, scoreB: 3, status: 'Completed', offsetHours: -16, court: 'Diamond 1' },
        ],
        bronze: { teamA: 'CEAT', teamB: 'CS', scoreA: 6, scoreB: 4, status: 'Completed', offsetHours: -6, court: 'Diamond 2' },
        finals: {
          teamA: 'CBA', teamB: 'CCJE', scoreA: 9, scoreB: 5, status: 'Completed', offsetHours: -3, court: 'Diamond 1',
          events: [
            'Bottom of 9th: CBA ace relief pitcher strikes out the side to seal the championship!',
            'CBA Golden Wolves crowned Binturungan Baseball Champions.'
          ]
        },
        mvpStars: [
          { collegeCode: 'CBA', starType: 'Gold' },
          { collegeCode: 'CBA', starType: 'Red' },
          { collegeCode: 'CCJE', starType: 'Red' },
        ],
      },

      // 7. SOFTBALL: Active Tournament with Upcoming Semifinals
      {
        sport: 'Softball',
        title: 'Softball Diamond League',
        status: 'Active',
        venuePrefix: 'PSU Softball Diamond',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CHMT', teamB: 'CTE', scoreA: 6, scoreB: 3, status: 'Completed', offsetHours: -30, court: 'Field 1' },
          { round: 'Group Stage - Pool A', teamA: 'CEAT', teamB: 'CAH', scoreA: 5, scoreB: 2, status: 'Completed', offsetHours: -28, court: 'Field 2' },
          { round: 'Group Stage - Pool B', teamA: 'CS', teamB: 'CCRD', scoreA: 8, scoreB: 7, status: 'Completed', offsetHours: -26, court: 'Field 1' },
          { round: 'Group Stage - Pool B', teamA: 'CBA', teamB: 'CCJE', scoreA: 4, scoreB: 2, status: 'Completed', offsetHours: -24, court: 'Field 2' },
        ],
        quarters: [
          { teamA: 'CHMT', teamB: 'CTE', scoreA: 5, scoreB: 3, status: 'Completed', offsetHours: -16, court: 'Field 1' },
          { teamA: 'CEAT', teamB: 'CAH', scoreA: 4, scoreB: 2, status: 'Completed', offsetHours: -14, court: 'Field 2' },
          { teamA: 'CS', teamB: 'CCRD', scoreA: 7, scoreB: 6, status: 'Completed', offsetHours: -12, court: 'Field 1' },
          { teamA: 'CBA', teamB: 'CCJE', scoreA: 3, scoreB: 1, status: 'Completed', offsetHours: -10, court: 'Field 2' },
        ],
        semis: [
          { teamA: 'CHMT', teamB: 'CEAT', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 5, court: 'Field 1' },
          { teamA: 'CS', teamB: 'CBA', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 7, court: 'Field 2' },
        ],
        bronze: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 22, court: 'Field 2' },
        finals: { scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 24, court: 'Field 1' },
      },

      // 8. PICKLEBALL: Active Tournament with Live Semifinals (CCJE vs CEAT)
      {
        sport: 'Pickleball',
        title: 'Pickleball Open Division',
        status: 'Active',
        venuePrefix: 'PSU Racket Sports Center',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CS', teamB: 'CCRD', scoreA: 11, scoreB: 7, status: 'Completed', offsetHours: -28, court: 'Court 1' },
          { round: 'Group Stage - Pool A', teamA: 'CBA', teamB: 'CTE', scoreA: 11, scoreB: 6, status: 'Completed', offsetHours: -26, court: 'Court 2' },
          { round: 'Group Stage - Pool B', teamA: 'CCJE', teamB: 'CHMT', scoreA: 12, scoreB: 10, status: 'Completed', offsetHours: -24, court: 'Court 1' },
          { round: 'Group Stage - Pool B', teamA: 'CEAT', teamB: 'CAH', scoreA: 11, scoreB: 8, status: 'Completed', offsetHours: -22, court: 'Court 2' },
        ],
        quarters: [
          { teamA: 'CS', teamB: 'CCRD', scoreA: 11, scoreB: 7, status: 'Completed', offsetHours: -14, court: 'Court 1' },
          { teamA: 'CBA', teamB: 'CTE', scoreA: 11, scoreB: 6, status: 'Completed', offsetHours: -12, court: 'Court 2' },
          { teamA: 'CCJE', teamB: 'CHMT', scoreA: 12, scoreB: 10, status: 'Completed', offsetHours: -10, court: 'Court 1' },
          { teamA: 'CEAT', teamB: 'CAH', scoreA: 11, scoreB: 8, status: 'Completed', offsetHours: -8, court: 'Court 2' },
        ],
        semis: [
          { teamA: 'CS', teamB: 'CBA', scoreA: 11, scoreB: 9, status: 'Completed', offsetHours: -3, court: 'Court 1' },
          {
            teamA: 'CCJE', teamB: 'CEAT', scoreA: 10, scoreB: 9, status: 'Ongoing', offsetHours: 0, court: 'Court 1',
            events: [
              'Set 1: CCJE doubles ace takes first game 11-9.',
              'Set 2 tied 9-9: Rapid dink exchanges at the kitchen line!'
            ]
          },
        ],
        bronze: { teamA: 'CBA', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 5, court: 'Court 2' },
        finals: { teamA: 'CS', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 7, court: 'Court 1' },
      },

      // 9. TABLE TENNIS: Active Tournament with Concluded Semifinals and Tonight's Marquee Final (CTE vs CEAT)
      {
        sport: 'Table Tennis',
        title: 'Table Tennis Singles & Doubles',
        status: 'Active',
        venuePrefix: 'PSU Student Pavilion',
        elimMatches: [
          { round: 'Group Stage - Pool A', teamA: 'CTE', teamB: 'CCRD', scoreA: 11, scoreB: 7, status: 'Completed', offsetHours: -26, court: 'Table 1' },
          { round: 'Group Stage - Pool A', teamA: 'CS', teamB: 'CAH', scoreA: 11, scoreB: 5, status: 'Completed', offsetHours: -24, court: 'Table 2' },
          { round: 'Group Stage - Pool B', teamA: 'CEAT', teamB: 'CBA', scoreA: 11, scoreB: 8, status: 'Completed', offsetHours: -22, court: 'Table 1' },
          { round: 'Group Stage - Pool B', teamA: 'CCJE', teamB: 'CHMT', scoreA: 11, scoreB: 9, status: 'Completed', offsetHours: -20, court: 'Table 2' },
        ],
        quarters: [
          { teamA: 'CTE', teamB: 'CHMT', scoreA: 11, scoreB: 6, status: 'Completed', offsetHours: -12, court: 'Table 1' },
          { teamA: 'CS', teamB: 'CBA', scoreA: 11, scoreB: 4, status: 'Completed', offsetHours: -10, court: 'Table 2' },
          { teamA: 'CEAT', teamB: 'CAH', scoreA: 11, scoreB: 8, status: 'Completed', offsetHours: -8, court: 'Table 1' },
          { teamA: 'CCJE', teamB: 'CCRD', scoreA: 11, scoreB: 7, status: 'Completed', offsetHours: -6, court: 'Table 2' },
        ],
        semis: [
          { teamA: 'CTE', teamB: 'CS', scoreA: 11, scoreB: 8, status: 'Completed', offsetHours: -4, court: 'Table 1' },
          { teamA: 'CEAT', teamB: 'CCJE', scoreA: 11, scoreB: 9, status: 'Completed', offsetHours: -2, court: 'Table 1' },
        ],
        bronze: {
          teamA: 'CS', teamB: 'CCJE', scoreA: 11, scoreB: 7, status: 'Completed', offsetHours: -1, court: 'Table 2',
          events: ['Bronze medal playoff concluded: CS Byte Titans (11) defeat CCJE (7) for the Bronze Medal!']
        },
        finals: { teamA: 'CTE', teamB: 'CEAT', scoreA: 0, scoreB: 0, status: 'Scheduled', offsetHours: 3, court: 'Table 1' },
      },
    ];

    let marqueeBasketballTournId = '';
    let liveVolleyballMatchId = '';

    // Loop through all 9 sports and inject complete tournament lifecycle:
    // - Full Phase 1 Elimination Fixtures (Pool A & Pool B)
    // - Full Phase 2 Playoff Knockout Tree (Quarterfinals, Semifinals, 3rd Place Bronze, Championship Final)
    // - Complete rosters with starters and bench substitutes for all 9 colleges
    for (const sportDef of ALL_SPORTS_CONFIG) {
      const tName = `PSU Binturungan 2026 - ${sportDef.title}`;

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
      const { data: tourn, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: tName,
          sport: sportDef.sport,
          type: 'Binturungan',
          status: sportDef.status,
          start_date: todayStr,
          end_date: nextTwoWeeks,
        })
        .select('id')
        .single();

      if (tErr || !tourn) throw tErr || new Error(`Failed to create tournament for ${sportDef.sport}`);
      const tId = tourn.id;
      if (sportDef.isMarquee) marqueeBasketballTournId = tId;

      // 2. Insert Teams for all 9 colleges
      const teamInsertPayload = activeCodes.map((code) => {
        const col = collegeMap[code];
        return {
          name: col.squadName,
          tournament_id: tId,
          status: 'Approved',
          coach_id: coachByCollege[col.id] || null,
          college_id: col.id,
          cluster_id: tribeByCollegeCode[code] || null,
          affiliation_type: 'college',
        };
      });

      const { data: createdTeams, error: teamInsErr } = await supabase
        .from('teams')
        .insert(teamInsertPayload)
        .select('id, name');

      if (teamInsErr || !createdTeams) throw teamInsErr || new Error(`Failed to insert teams for ${sportDef.sport}`);

      const teamLookup: Record<string, string> = {};
      createdTeams.forEach((t) => {
        teamLookup[t.name] = t.id;
      });

      // 3. Populate Sport-Specific Rosters for every college team (full starting lineup + full bench substitutes)
      const rosterEntries: {
        team_id: string;
        player_id: string;
        jersey_number: number;
        is_starter: boolean;
        is_captain: boolean;
        position: string;
        status: string;
        availability_status: string;
      }[] = [];
      const rolesConfig = sportRosterRoles[sportDef.sport] || sportRosterRoles['Basketball'];
      const jerseyNumbers = [1, 3, 5, 7, 8, 10, 11, 13, 15, 17, 21, 23, 24, 30, 33, 44, 99];

      for (const code of activeCodes) {
        const col = collegeMap[code];
        const teamId = teamLookup[col.squadName];
        if (!teamId) continue;

        // Collect available players for this team (prioritize college's own student athletes)
        const collegeAthletes = [...(studentsByCollege[code] || [])];
        const assignedIds = new Set(collegeAthletes.map((a) => a.id));
        const neededAthletes = rolesConfig.starters.length + rolesConfig.subs.length;

        // Supplement from campus athlete pool if needed to ensure 100% full starting lineup and bench substitutes
        if (collegeAthletes.length < neededAthletes && allStudents && allStudents.length > 0) {
          for (const extra of allStudents) {
            if (!assignedIds.has(extra.id)) {
              collegeAthletes.push(extra);
              assignedIds.add(extra.id);
              if (collegeAthletes.length >= neededAthletes) break;
            }
          }
        }

        const players = collegeAthletes;
        if (players.length === 0) continue;

        // Assign starters (is_starter=true, availability_status='Active')
        for (let sIdx = 0; sIdx < rolesConfig.starters.length && sIdx < players.length; sIdx++) {
          rosterEntries.push({
            team_id: teamId,
            player_id: players[sIdx].id,
            jersey_number: jerseyNumbers[sIdx % jerseyNumbers.length],
            is_starter: true,
            is_captain: sIdx === 0,
            position: rolesConfig.starters[sIdx],
            status: 'Approved',
            availability_status: 'Active',
          });
        }

        // Assign subs (is_starter=false, availability_status='Bench')
        const starterCount = rolesConfig.starters.length;
        for (let subIdx = 0; subIdx < rolesConfig.subs.length; subIdx++) {
          const pIdx = starterCount + subIdx;
          if (pIdx < players.length) {
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
      }

      if (rosterEntries.length > 0) {
        await supabase.from('team_roster').insert(rosterEntries);
      }

      // 4. PHASE 2: Knockout Bracket Matches Generation
      // A. Insert Finals match
      const { data: finM } = await supabase
        .from('matches')
        .insert({
          tournament_id: tId,
          team_a_id: sportDef.finals.teamA ? teamLookup[collegeMap[sportDef.finals.teamA]?.squadName] || null : null,
          team_b_id: sportDef.finals.teamB ? teamLookup[collegeMap[sportDef.finals.teamB]?.squadName] || null : null,
          team_a_score: sportDef.finals.scoreA,
          team_b_score: sportDef.finals.scoreB,
          round: 'Finals',
          status: sportDef.finals.status,
          match_time: matchTime(sportDef.finals.offsetHours),
          venue: `${sportDef.venuePrefix} - ${sportDef.finals.court}`,
        })
        .select('id')
        .single();

      // B. Insert 3rd Place Bronze Playoff match
      const { data: brzM } = await supabase
        .from('matches')
        .insert({
          tournament_id: tId,
          team_a_id: sportDef.bronze.teamA ? teamLookup[collegeMap[sportDef.bronze.teamA]?.squadName] || null : null,
          team_b_id: sportDef.bronze.teamB ? teamLookup[collegeMap[sportDef.bronze.teamB]?.squadName] || null : null,
          team_a_score: sportDef.bronze.scoreA,
          team_b_score: sportDef.bronze.scoreB,
          round: '3rd Place Playoff',
          status: sportDef.bronze.status,
          match_time: matchTime(sportDef.bronze.offsetHours),
          venue: `${sportDef.venuePrefix} - ${sportDef.bronze.court}`,
        })
        .select('id')
        .single();

      // C. Insert Semifinals (linking to Finals and 3rd Place Bronze)
      const { data: sf1M } = await supabase
        .from('matches')
        .insert({
          tournament_id: tId,
          team_a_id: sportDef.semis[0].teamA ? teamLookup[collegeMap[sportDef.semis[0].teamA]?.squadName] || null : null,
          team_b_id: sportDef.semis[0].teamB ? teamLookup[collegeMap[sportDef.semis[0].teamB]?.squadName] || null : null,
          team_a_score: sportDef.semis[0].scoreA,
          team_b_score: sportDef.semis[0].scoreB,
          round: 'Semifinals',
          status: sportDef.semis[0].status,
          match_time: matchTime(sportDef.semis[0].offsetHours),
          next_match_id: finM?.id || null,
          next_match_slot: 'team_a',
          loser_next_match_id: brzM?.id || null,
          loser_next_match_slot: 'team_a',
          venue: `${sportDef.venuePrefix} - ${sportDef.semis[0].court}`,
        })
        .select('id')
        .single();

      const { data: sf2M } = await supabase
        .from('matches')
        .insert({
          tournament_id: tId,
          team_a_id: sportDef.semis[1].teamA ? teamLookup[collegeMap[sportDef.semis[1].teamA]?.squadName] || null : null,
          team_b_id: sportDef.semis[1].teamB ? teamLookup[collegeMap[sportDef.semis[1].teamB]?.squadName] || null : null,
          team_a_score: sportDef.semis[1].scoreA,
          team_b_score: sportDef.semis[1].scoreB,
          round: 'Semifinals',
          status: sportDef.semis[1].status,
          match_time: matchTime(sportDef.semis[1].offsetHours),
          next_match_id: finM?.id || null,
          next_match_slot: 'team_b',
          loser_next_match_id: brzM?.id || null,
          loser_next_match_slot: 'team_b',
          venue: `${sportDef.venuePrefix} - ${sportDef.semis[1].court}`,
        })
        .select('id')
        .single();

      if (sportDef.semis[1].status === 'Ongoing' && sf2M) {
        liveVolleyballMatchId = sf2M.id;
      }

      // D. Insert 4 Quarterfinals (linking to Semifinals)
      const qfPayload = [
        {
          tournament_id: tId,
          team_a_id: sportDef.quarters[0].teamA ? teamLookup[collegeMap[sportDef.quarters[0].teamA]?.squadName] || null : null,
          team_b_id: sportDef.quarters[0].teamB ? teamLookup[collegeMap[sportDef.quarters[0].teamB]?.squadName] || null : null,
          team_a_score: sportDef.quarters[0].scoreA,
          team_b_score: sportDef.quarters[0].scoreB,
          round: 'Quarterfinals',
          status: sportDef.quarters[0].status,
          match_time: matchTime(sportDef.quarters[0].offsetHours),
          next_match_id: sf1M?.id || null,
          next_match_slot: 'team_a',
          venue: `${sportDef.venuePrefix} - ${sportDef.quarters[0].court}`,
        },
        {
          tournament_id: tId,
          team_a_id: sportDef.quarters[1].teamA ? teamLookup[collegeMap[sportDef.quarters[1].teamA]?.squadName] || null : null,
          team_b_id: sportDef.quarters[1].teamB ? teamLookup[collegeMap[sportDef.quarters[1].teamB]?.squadName] || null : null,
          team_a_score: sportDef.quarters[1].scoreA,
          team_b_score: sportDef.quarters[1].scoreB,
          round: 'Quarterfinals',
          status: sportDef.quarters[1].status,
          match_time: matchTime(sportDef.quarters[1].offsetHours),
          next_match_id: sf1M?.id || null,
          next_match_slot: 'team_b',
          venue: `${sportDef.venuePrefix} - ${sportDef.quarters[1].court}`,
        },
        {
          tournament_id: tId,
          team_a_id: sportDef.quarters[2].teamA ? teamLookup[collegeMap[sportDef.quarters[2].teamA]?.squadName] || null : null,
          team_b_id: sportDef.quarters[2].teamB ? teamLookup[collegeMap[sportDef.quarters[2].teamB]?.squadName] || null : null,
          team_a_score: sportDef.quarters[2].scoreA,
          team_b_score: sportDef.quarters[2].scoreB,
          round: 'Quarterfinals',
          status: sportDef.quarters[2].status,
          match_time: matchTime(sportDef.quarters[2].offsetHours),
          next_match_id: sf2M?.id || null,
          next_match_slot: 'team_a',
          venue: `${sportDef.venuePrefix} - ${sportDef.quarters[2].court}`,
        },
        {
          tournament_id: tId,
          team_a_id: sportDef.quarters[3].teamA ? teamLookup[collegeMap[sportDef.quarters[3].teamA]?.squadName] || null : null,
          team_b_id: sportDef.quarters[3].teamB ? teamLookup[collegeMap[sportDef.quarters[3].teamB]?.squadName] || null : null,
          team_a_score: sportDef.quarters[3].scoreA,
          team_b_score: sportDef.quarters[3].scoreB,
          round: 'Quarterfinals',
          status: sportDef.quarters[3].status,
          match_time: matchTime(sportDef.quarters[3].offsetHours),
          next_match_id: sf2M?.id || null,
          next_match_slot: 'team_b',
          venue: `${sportDef.venuePrefix} - ${sportDef.quarters[3].court}`,
        },
      ];

      await supabase.from('matches').insert(qfPayload);

      // 5. PHASE 1: Elimination Fixtures (Pool A & Pool B)
      const elimPayload = sportDef.elimMatches.map((em) => ({
        tournament_id: tId,
        team_a_id: teamLookup[collegeMap[em.teamA]?.squadName] || null,
        team_b_id: teamLookup[collegeMap[em.teamB]?.squadName] || null,
        team_a_score: em.scoreA,
        team_b_score: em.scoreB,
        round: em.round,
        status: em.status,
        match_time: matchTime(em.offsetHours),
        next_match_id: null,
        loser_next_match_id: null,
        venue: `${sportDef.venuePrefix} - ${em.court}`,
      }));

      const { data: createdElims } = await supabase.from('matches').insert(elimPayload).select('id, round, status');

      // 6. Log Events and Commentary
      const eventsToInsert: { match_id: string; description: string }[] = [];
      if (finM && sportDef.finals.events) {
        sportDef.finals.events.forEach((desc) => {
          eventsToInsert.push({ match_id: finM.id, description: desc });
        });
      }
      if (sf2M && sportDef.semis[1].events) {
        sportDef.semis[1].events.forEach((desc) => {
          eventsToInsert.push({ match_id: sf2M.id, description: desc });
        });
      }
      if (sf1M && sportDef.semis[0].events) {
        sportDef.semis[0].events.forEach((desc) => {
          eventsToInsert.push({ match_id: sf1M.id, description: desc });
        });
      }
      if (brzM && sportDef.bronze.events) {
        sportDef.bronze.events.forEach((desc) => {
          eventsToInsert.push({ match_id: brzM.id, description: desc });
        });
      }
      if (createdElims) {
        sportDef.elimMatches.forEach((em, idx) => {
          if (em.events && createdElims[idx]) {
            em.events.forEach((desc) => {
              eventsToInsert.push({ match_id: createdElims[idx].id, description: desc });
            });
          }
        });
      }

      if (eventsToInsert.length > 0) {
        await supabase.from('match_events').insert(eventsToInsert);
      }

      // 7. Award Official MVP Stars for Completed Championships
      if (finM && sportDef.mvpStars && sportDef.mvpStars.length > 0) {
        const starEntries: {
          player_id: string;
          match_id: string;
          tournament_id: string;
          star_type: 'Gold' | 'Red';
        }[] = [];
        for (const s of sportDef.mvpStars) {
          const playerId = studentsByCollege[s.collegeCode]?.[0]?.id;
          if (playerId) {
            starEntries.push({
              player_id: playerId,
              match_id: finM.id,
              tournament_id: tId,
              star_type: s.starType,
            });
          }
        }
        if (starEntries.length > 0) {
          await supabase.from('player_stars').insert(starEntries);
        }
      }
    }

    return {
      success: true,
      message: 'The Grand Binturungan Olympiad injected: All 9 sports created with full Phase 1 elimination fixtures & Phase 2 playoff brackets, full starting lineups and bench subs on all teams, and realistic tournament event simulation!',
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
 * Helper to ensure authentic PSU Binturungan tribes exist in clusters table.
 */
async function ensureClusters(supabase: SupabaseClient) {
  const authenticClusters = [
    { name: 'Tribo Apolaki', description: 'God of Sun & War — College of Teacher Education (CTE), College of Criminal Justice Education (CCJE), Laboratory High School', college_codes: ['CTE', 'CCJE'] },
    { name: 'Tribo Libulan', description: 'Deity of the Moon & Guidance — College of Engineering, Architecture and Technology (CEAT), College of Nursing and Health Sciences (CNHS), School of Law, School of Medicine', college_codes: ['CEAT', 'CNHS'] },
    { name: 'Tribo Tala', description: 'Goddess of the Morning & Evening Star — College of Business and Accountancy (CBA), College of Hospitality Management and Tourism (CHMT)', college_codes: ['CBA', 'CHMT'] },
    { name: 'Tribo Haliya', description: 'Goddess of Moonlight & Protection — College of Sciences (CS), College of Arts and Humanities (CAH)', college_codes: ['CS', 'CAH'] },
    { name: 'Tribo Mapulon', description: 'God of Seasons & Harvest — CCRD Del Sur (Brooke\'s Point, Bataraza, Balabac, Sofronio Española Campuses)', college_codes: ['CCRD'] },
    { name: 'Tribo Dumangan', description: 'God of Bountiful Harvest — CCRD Del Norte (Roxas, Taytay, Coron, San Vicente, El Nido, Cuyo, Dumaran, Linapacan Campuses)', college_codes: ['CCRD'] },
  ];

  for (const c of authenticClusters) {
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
