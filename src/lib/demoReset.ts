import type { SupabaseClient } from '@supabase/supabase-js';

export async function resetDemoState(supabase: SupabaseClient): Promise<{
  success: boolean;
  tournamentId?: string;
  liveMatchId?: string;
  error?: string;
}> {
  try {
    // 1. Ensure Clusters
    const demoClusters = [
      { name: 'Cluster A - Titans', description: 'College of Arts and Sciences', college_codes: ['CAS'] },
      { name: 'Cluster B - Wolves', description: 'College of Business Administration', college_codes: ['CBA'] },
      { name: 'Cluster C - Builders', description: 'College of Engineering', college_codes: ['COE'] },
      { name: 'Cluster D - Cyber Knights', description: 'College of Information Technology', college_codes: ['CIT'] }
    ];

    for (const c of demoClusters) {
      const { data: existing } = await supabase.from('clusters').select('id').eq('name', c.name).maybeSingle();
      if (!existing) {
        await supabase.from('clusters').insert(c);
      }
    }

    // 2. Fetch coaches
    const { data: coaches } = await supabase.from('users').select('id').eq('role', 'Coach').limit(4);
    const coachIds = (coaches || []).map(c => c.id);

    // 3. Find or Create Demo Tournament
    const tournamentName = "PSU Palaro 2026 - Men's Basketball Inter-Collegiate";
    let tournamentId: string;

    const { data: existingTourn } = await supabase.from('tournaments').select('id').eq('name', tournamentName).maybeSingle();

    if (existingTourn) {
      tournamentId = existingTourn.id;
      // Clean previous matches
      await supabase.from('matches').update({ next_match_id: null }).eq('tournament_id', tournamentId);
      try {
        await supabase.from('matches').update({ loser_next_match_id: null }).eq('tournament_id', tournamentId);
      } catch (_) {}

      const { data: oldMatches } = await supabase.from('matches').select('id').eq('tournament_id', tournamentId);
      if (oldMatches && oldMatches.length > 0) {
        const ids = oldMatches.map(m => m.id);
        await supabase.from('match_events').delete().in('match_id', ids);
        await supabase.from('player_stars').delete().in('match_id', ids);
        await supabase.from('matches').delete().in('id', ids);
      }

      await supabase.from('teams').delete().eq('tournament_id', tournamentId);
    } else {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const { data: newTourn, error: tournErr } = await supabase.from('tournaments').insert({
        name: tournamentName,
        sport: 'Basketball',
        type: 'Binturungan',
        status: 'Active',
        start_date: today.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0]
      }).select().single();

      if (tournErr) throw tournErr;
      tournamentId = newTourn.id;
    }

    // 4. Seed 4 Teams
    const demoTeams = [
      { name: 'CAS Titans', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[0] || null },
      { name: 'CBA Wolves', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[1] || null },
      { name: 'COE Builders', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[2] || null },
      { name: 'CIT Cyber Knights', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[3] || null }
    ];

    const teamMap: { [name: string]: string } = {};
    for (const t of demoTeams) {
      const { data: createdTeam, error: teamErr } = await supabase.from('teams').insert(t).select().single();
      if (teamErr) throw teamErr;
      teamMap[t.name] = createdTeam.id;
    }

    // 5. Create Bracket Matches
    const matchTime = (offsetHours = 0) => {
      const d = new Date();
      d.setHours(d.getHours() + offsetHours);
      return d.toISOString();
    };

    const { data: finalsMatch, error: finErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: 'Finals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(48)
    }).select().single();
    if (finErr) throw finErr;

    const { data: bronzeMatch, error: brnErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: '3rd Place Playoff',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(44)
    }).select().single();
    if (brnErr) throw brnErr;

    const { data: sf1Match, error: sf1Err } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      team_a_id: teamMap['CAS Titans'],
      team_b_id: teamMap['CBA Wolves'],
      round: 'Semifinals',
      status: 'Ongoing',
      team_a_score: 68,
      team_b_score: 65,
      match_time: matchTime(-1)
    }).select().single();
    if (sf1Err) throw sf1Err;

    const { data: sf2Match, error: sf2Err } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      team_a_id: teamMap['COE Builders'],
      team_b_id: teamMap['CIT Cyber Knights'],
      round: 'Semifinals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(2)
    }).select().single();
    if (sf2Err) throw sf2Err;

    // 6. Link Next Matches and Losers
    const sf1Links = {
      next_match_id: finalsMatch.id,
      next_match_slot: 'team_a',
      loser_next_match_id: bronzeMatch.id,
      loser_next_match_slot: 'team_a'
    };
    const { error: sf1LinkErr } = await supabase.from('matches').update(sf1Links).eq('id', sf1Match.id);
    if (sf1LinkErr && sf1LinkErr.code === '42703') {
      await supabase.from('matches').update({
        next_match_id: finalsMatch.id,
        next_match_slot: 'team_a'
      }).eq('id', sf1Match.id);
    }

    const sf2Links = {
      next_match_id: finalsMatch.id,
      next_match_slot: 'team_b',
      loser_next_match_id: bronzeMatch.id,
      loser_next_match_slot: 'team_b'
    };
    const { error: sf2LinkErr } = await supabase.from('matches').update(sf2Links).eq('id', sf2Match.id);
    if (sf2LinkErr && sf2LinkErr.code === '42703') {
      await supabase.from('matches').update({
        next_match_id: finalsMatch.id,
        next_match_slot: 'team_b'
      }).eq('id', sf2Match.id);
    }

    // 7. Live Commentary Events
    const demoEvents = [
      { match_id: sf1Match.id, description: 'Tip-off won by CAS Titans starting center.' },
      { match_id: sf1Match.id, description: '3-pointer drained from deep corner by CAS Titans #7 Marco Garcia!' },
      { match_id: sf1Match.id, description: 'Fastbreak transition layup finished by CBA Wolves #23 Joshua Reyes.' },
      { match_id: sf1Match.id, description: 'Defensive steal and assist executed by CAS Titans #11.' },
      { match_id: sf1Match.id, description: 'Full timeout called by CBA Wolves coaching staff.' },
      { match_id: sf1Match.id, description: 'End of 3rd Quarter: CAS Titans 68, CBA Wolves 65. Thrilling 3-point game!' }
    ];

    await supabase.from('match_events').insert(demoEvents);

    return {
      success: true,
      tournamentId,
      liveMatchId: sf1Match.id
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unknown error occurred while resetting demo'
    };
  }
}
