import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScenarioResult {
  success: boolean;
  message: string;
  tournamentId?: string;
  liveMatchId?: string;
  error?: string;
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
      error: err instanceof Error ? err.message : String(err),
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
    // 1. Ensure clusters exist
    await ensureClusters(supabase);

    // 2. Fetch coach and student user IDs
    const { data: coaches } = await supabase.from('users').select('id').eq('role', 'coach').limit(2);
    const { data: students } = await supabase.from('users').select('id, full_name, email').eq('role', 'player_student').limit(5);

    // 3. Create Draft Tournament
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: tourn, error: tournErr } = await supabase.from('tournaments').insert({
      name: 'PSU Binturungan 2026 - Registration & Eligibility Review',
      sport: 'Volleyball',
      type: 'Binturungan',
      status: 'Draft',
      start_date: today,
      end_date: nextMonth,
    }).select().single();

    if (tournErr) throw tournErr;

    // 4. Create Draft Teams
    const coachId = coaches?.[0]?.id || null;
    await supabase.from('teams').insert([
      { name: 'CAS Spikers', tournament_id: tourn.id, status: 'Pending', coach_id: coachId },
      { name: 'CBA Lady Wolves', tournament_id: tourn.id, status: 'Pending', coach_id: coaches?.[1]?.id || coachId },
    ]);

    // 5. Seed Mock Verification Documents in Queue
    if (students && students.length > 0) {
      // Clean existing pending docs for clean queue
      const studentIds = students.map((s) => s.id);
      await supabase.from('verification_documents').delete().in('user_id', studentIds);

      const mockDocs = [
        {
          user_id: students[0].id,
          document_url: 'https://placeholder.psu.palawan.edu.ph/cor_sample_high.pdf',
          status: 'pending',
          confidence_score: 95,
          extracted_full_name: students[0].full_name || 'Juan Dela Cruz',
          extracted_student_id: '2023-8-0284',
          extracted_college: 'CAS',
        },
        ...(students.length > 1
          ? [{
              user_id: students[1].id,
              document_url: 'https://placeholder.psu.palawan.edu.ph/cor_sample_med.pdf',
              status: 'pending',
              confidence_score: 80,
              extracted_full_name: students[1].full_name || 'Maria Santos',
              extracted_student_id: '2022-8-0115',
              extracted_college: 'CBA',
            }]
          : []),
        ...(students.length > 2
          ? [{
              user_id: students[2].id,
              document_url: 'https://placeholder.psu.palawan.edu.ph/cor_sample_low.pdf',
              status: 'pending',
              confidence_score: 45,
              extracted_full_name: students[2].full_name || 'Alex Reyes',
              extracted_student_id: '2024-8-0991',
              extracted_college: 'CIT',
            }]
          : []),
      ];

      await supabase.from('verification_documents').insert(mockDocs);
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
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * SCENARIO C: Active Tournament & Live Halftime Match
 * The canonical capstone defense scenario: 4 campus squads, active bracket,
 * ongoing semifinals with live score 68 - 65, active clock, fouls, and commentary feed.
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
      // Clean previous matches
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

    // Finals & Bronze
    const { data: finalsMatch } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: 'Finals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(48),
    }).select().single();

    const { data: bronzeMatch } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: '3rd Place Playoff',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(44),
    }).select().single();

    // Semifinal 1 (Ongoing Live Match!)
    const { data: sf1Match } = await supabase.from('matches').insert({
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
    }).select().single();

    // Semifinal 2
    await supabase.from('matches').insert({
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
    });

    // Populate active roster for CAS Titans and CBA Wolves if student accounts exist
    const { data: players } = await supabase.from('users').select('id, full_name').eq('role', 'player_student').limit(10);
    if (players && players.length >= 4) {
      const rosterEntries = [
        { team_id: teamMap['CAS Titans'], player_id: players[0].id, jersey_number: 7, is_starter: true, status: 'Approved' },
        { team_id: teamMap['CAS Titans'], player_id: players[1].id, jersey_number: 11, is_starter: true, status: 'Approved' },
        { team_id: teamMap['CBA Wolves'], player_id: players[2].id, jersey_number: 23, is_starter: true, status: 'Approved' },
        { team_id: teamMap['CBA Wolves'], player_id: players[3].id, jersey_number: 5, is_starter: true, status: 'Approved' },
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
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * SCENARIO D: Completed Championship & Medal Ceremony
 * Advances all matches to completion, crowns Champion CAS Titans,
 * awards Bronze to CBA Wolves, sets Gold/Silver/Bronze stats, and generates MVP Stars.
 */
export async function injectCompletedChampionship(supabase: SupabaseClient): Promise<ScenarioResult> {
  try {
    // Inject base tournament first
    const base = await injectLiveHalftimeMatch(supabase);
    if (!base.success || !base.tournamentId) {
      throw new Error(base.error || 'Base setup failed');
    }

    const tournamentId = base.tournamentId;

    // Fetch matches
    const { data: matches } = await supabase.from('matches').select('id, round, team_a_id, team_b_id').eq('tournament_id', tournamentId);
    if (!matches) throw new Error('Matches not found');

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

    // Populate and Complete Bronze: CBA (80) def COE (74) -> CBA Bronze!
    if (bronze && sf1 && sf2) {
      await supabase.from('matches').update({
        team_a_id: sf1.team_b_id, // CBA
        team_b_id: sf2.team_a_id, // COE
        team_a_score: 80,
        team_b_score: 74,
        status: 'Completed',
      }).eq('id', bronze.id);
    }

    // Populate and Complete Finals: CAS (88) def CIT (84) -> CAS Gold, CIT Silver!
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

    // Award MVP Stars to student players if available
    const { data: players } = await supabase.from('users').select('id').eq('role', 'player_student').limit(3);
    if (players && players.length > 0 && finals) {
      await supabase.from('player_stars').insert([
        { user_id: players[0].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'gold' },
        { user_id: players[0].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'red' },
        ...(players.length > 1 ? [{ user_id: players[1].id, match_id: finals.id, tournament_id: tournamentId, star_type: 'red' }] : []),
      ]);
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
      error: err instanceof Error ? err.message : String(err),
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
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
