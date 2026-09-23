import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Read environment variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_LEGACY_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runSeed() {
  console.log('====================================================');
  console.log('  PSU SPORTSTRACK - CAPSTONE DEMO ARENA SEED SCRIPT');
  console.log('====================================================\n');

  try {
    // Step 1: Ensure Campus Clusters
    console.log('🏛️ Checking campus clusters...');
    const demoClusters = [
      { name: 'Cluster A - Titans', description: 'College of Arts and Sciences', college_codes: ['CAS'] },
      { name: 'Cluster B - Wolves', description: 'College of Business Administration', college_codes: ['CBA'] },
      { name: 'Cluster C - Builders', description: 'College of Engineering', college_codes: ['COE'] },
      { name: 'Cluster D - Cyber Knights', description: 'College of Information Technology', college_codes: ['CIT'] }
    ];

    const clusterMap = {};
    for (const c of demoClusters) {
      const { data: existing } = await supabase.from('clusters').select('id, name').eq('name', c.name).maybeSingle();
      if (existing) {
        clusterMap[c.name] = existing.id;
      } else {
        const { data: created, error } = await supabase.from('clusters').insert(c).select().single();
        if (!error && created) clusterMap[c.name] = created.id;
      }
    }
    console.log(`✅ Clusters active: ${Object.keys(clusterMap).length}`);

    // Step 2: Fetch available Coaches for team assignment
    const { data: coaches } = await supabase.from('users').select('id, full_name').eq('role', 'Coach').limit(4);
    const coachIds = (coaches || []).map(c => c.id);

    // Step 3: Create / Reset Demo Tournament
    const tournamentName = "PSU Palaro 2026 - Men's Basketball Inter-Collegiate";
    console.log(`🏆 Verifying tournament: "${tournamentName}"...`);

    let tournamentId = null;
    const { data: existingTourn } = await supabase.from('tournaments').select('id').eq('name', tournamentName).maybeSingle();

    if (existingTourn) {
      tournamentId = existingTourn.id;
      console.log(`ℹ️ Existing tournament found (${tournamentId}). Resetting matches and demo state...`);
      
      // Clear pointer links to avoid foreign key errors
      await supabase.from('matches').update({ next_match_id: null }).eq('tournament_id', tournamentId);
      try {
        await supabase.from('matches').update({ loser_next_match_id: null }).eq('tournament_id', tournamentId);
      } catch (_) {}

      // Delete old match events and matches
      const { data: oldMatches } = await supabase.from('matches').select('id').eq('tournament_id', tournamentId);
      if (oldMatches && oldMatches.length > 0) {
        const ids = oldMatches.map(m => m.id);
        await supabase.from('match_events').delete().in('match_id', ids);
        await supabase.from('player_stars').delete().in('match_id', ids);
        await supabase.from('matches').delete().in('id', ids);
      }

      // Delete existing demo teams for this tournament
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
      console.log(`✨ Created new demo tournament (${tournamentId}).`);
    }

    // Step 4: Seed 4 Inter-Collegiate Basketball Teams for this Tournament
    console.log('🏀 Creating approved demo basketball squads...');
    const demoTeams = [
      { name: 'CAS Titans', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[0] || null },
      { name: 'CBA Wolves', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[1] || null },
      { name: 'COE Builders', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[2] || null },
      { name: 'CIT Cyber Knights', tournament_id: tournamentId, status: 'Approved', coach_id: coachIds[3] || null }
    ];

    const teamMap = {};
    for (const t of demoTeams) {
      const { data: createdTeam, error: teamErr } = await supabase.from('teams').insert(t).select().single();
      if (teamErr) throw teamErr;
      teamMap[t.name] = createdTeam.id;
    }
    console.log(`✅ Teams seeded for tournament:`, Object.keys(teamMap));

    // Step 5: Insert Bracket Nodes (Finals, Bronze, Semi 1, Semi 2)
    console.log('⚡ Generating championship playoff bracket with 3rd-Place Bronze Playoff...');
    const matchTime = (offsetHours = 0) => {
      const d = new Date();
      d.setHours(d.getHours() + offsetHours);
      return d.toISOString();
    };

    // Node 1: Finals
    const { data: finalsMatch, error: finErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: 'Finals',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(48)
    }).select().single();
    if (finErr) throw finErr;

    // Node 2: 3rd Place Bronze Playoff
    const { data: bronzeMatch, error: brnErr } = await supabase.from('matches').insert({
      tournament_id: tournamentId,
      round: '3rd Place Playoff',
      status: 'Scheduled',
      team_a_score: 0,
      team_b_score: 0,
      match_time: matchTime(44)
    }).select().single();
    if (brnErr) throw brnErr;

    // Node 3: Semifinal 1 (Ongoing Live Match for court-side demo)
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

    // Node 4: Semifinal 2 (Scheduled)
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

    // Step 6: Link Semifinals winners to Finals and losers to Bronze Playoff
    console.log('🔗 Wiring pointer links (Winners -> Finals, Losers -> Bronze)...');
    
    // SF 1 pointers
    const sf1Links = {
      next_match_id: finalsMatch.id,
      next_match_slot: 'team_a',
      loser_next_match_id: bronzeMatch.id,
      loser_next_match_slot: 'team_a'
    };
    const { error: sf1LinkErr } = await supabase.from('matches').update(sf1Links).eq('id', sf1Match.id);
    if (sf1LinkErr && sf1LinkErr.code === '42703') {
      // Graceful fallback if loser_next_match_id is pending in schema
      await supabase.from('matches').update({
        next_match_id: finalsMatch.id,
        next_match_slot: 'team_a'
      }).eq('id', sf1Match.id);
    }

    // SF 2 pointers
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

    // Step 7: Populate Live Match Timeline Events for SF 1
    console.log('📢 Seeding live commentary timeline events for matchroom demo...');
    const demoEvents = [
      { match_id: sf1Match.id, description: 'Tip-off won by CAS Titans starting center.' },
      { match_id: sf1Match.id, description: '3-pointer drained from deep corner by CAS Titans #7 Marco Garcia!' },
      { match_id: sf1Match.id, description: 'Fastbreak transition layup finished by CBA Wolves #23 Joshua Reyes.' },
      { match_id: sf1Match.id, description: 'Defensive steal and assist executed by CAS Titans #11.' },
      { match_id: sf1Match.id, description: 'Full timeout called by CBA Wolves coaching staff.' },
      { match_id: sf1Match.id, description: 'End of 3rd Quarter: CAS Titans 68, CBA Wolves 65. Thrilling 3-point game!' }
    ];

    await supabase.from('match_events').insert(demoEvents);

    console.log('\n====================================================');
    console.log('🎉 CAPSTONE DEMO ARENA SEED COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
    console.log(`🏆 Tournament ID: ${tournamentId}`);
    console.log(`🏟️ Live Ongoing Match ID: ${sf1Match.id}`);
    console.log(`   URL: /match/${sf1Match.id}`);
    console.log(`🥇 Finals Match ID: ${finalsMatch.id}`);
    console.log(`🥉 Bronze Playoff Match ID: ${bronzeMatch.id}`);
    console.log('====================================================\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    process.exit(1);
  }
}

runSeed();
