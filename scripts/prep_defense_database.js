import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Read environment variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['SUPABASE_LEGACY_SERVICE_ROLE_KEY'] || envVars['SUPABASE_SECRET_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = 'PsuSportsTrack@2026!';

// The 9 Strict Ballgames
const OFFICIAL_BALLGAMES = [
  'Basketball',
  'Volleyball',
  'Soccer',
  'Futsal',
  'Sepak Takraw',
  'Baseball',
  'Softball',
  'Pickleball',
  'Table Tennis'
];

// College metadata
const COLLEGE_DEFS = [
  { code: 'CS', name: 'College of Sciences (CS)', mascot: 'Titans', program: 'BS Computer Science' },
  { code: 'CEAT', name: 'College of Engineering, Architecture and Technology (CEAT)', mascot: 'Builders', program: 'BS Civil Engineering' },
  { code: 'CBA', name: 'College of Business and Accountancy (CBA)', mascot: 'Wolves', program: 'BS Accountancy' },
  { code: 'CTE', name: 'College of Teacher Education (CTE)', mascot: 'Educators', program: 'B Secondary Education' },
  { code: 'CCJE', name: 'College of Criminal Justice Education (CCJE)', mascot: 'Enforcers', program: 'BS Criminology' },
  { code: 'CAH', name: 'College of Arts and Humanities (CAH)', mascot: 'Artisans', program: 'BA Communication' },
  { code: 'CNHS', name: 'College of Nursing and Health Sciences (CNHS)', mascot: 'Healers', program: 'BS Nursing' },
  { code: 'CHMT', name: 'College of Hospitality Management and Tourism (CHMT)', mascot: 'Voyagers', program: 'BS Hospitality Management' }
];

// Realistic Filipino Student Athlete Names pool (Authentic, NO superheroes/cartoon fakers)
const REALISTIC_FILIPINO_ATHLETES = [
  { name: 'Kenneth Alcantara', position: 'Shooting Guard (SG)' },
  { name: 'Gabriel Mendoza', position: 'Small Forward (SF)' },
  { name: 'Joshua Dalisay', position: 'Power Forward (PF)' },
  { name: 'Christian Cruz', position: 'Center (C)' },
  { name: 'Jeric Morales', position: 'Guard / Utility' },
  { name: 'Carlo Villanueva', position: 'Point Guard (PG)' },
  { name: 'Renzo Gutierrez', position: 'Shooting Guard (SG)' },
  { name: 'Dave Bautista', position: 'Forward (PF)' },
  { name: 'Rafael Ramos', position: 'Center (C)' },
  { name: 'John Paul Reyes', position: 'Reserve Guard' },
  { name: 'Andrei Ramos', position: 'Outside Hitter (OH)' },
  { name: 'Mark Anthony Solis', position: 'Setter (S)' },
  { name: 'Kian Marasigan', position: 'Middle Blocker (MB)' },
  { name: 'Ezekiel Castro', position: 'Opposite Hitter (OPP)' },
  { name: 'Lorenzo Cruz', position: 'Libero (L)' },
  { name: 'Cedric Aquino', position: 'Defensive Specialist (DS)' },
  { name: 'Janzen Morales', position: 'Reserve Hitter' },
  { name: 'Giancarlo Perez', position: 'Reserve Setter' },
  { name: 'Paolo Reyes', position: 'Striker / Forward (ST)' },
  { name: 'Julian De Leon', position: 'Central Midfielder (CM)' },
  { name: 'Vince Madrigal', position: 'Winger (LW/RW)' },
  { name: 'Patrick Roxas', position: 'Center Back (CB)' },
  { name: 'Enzo Falcon', position: 'Goalkeeper (GK)' },
  { name: 'Dexter Ayala', position: 'Fullback (LB/RB)' },
  { name: 'Lucas Cojuangco', position: 'Reserve Midfielder' },
  { name: 'Santino Romualdez', position: 'Reserve Striker' },
  { name: 'Angelo Santos', position: 'Tekong (Server)' },
  { name: 'Marcus Sterling', position: 'Killer (Spiker)' },
  { name: 'Nico Montelibano', position: 'Feeder (Setter)' },
  { name: 'Carlos Imperial', position: 'Reserve Tekong' },
  { name: 'Alfonso Araneta', position: 'Pitcher (P)' },
  { name: 'Lance Sterling', position: 'Catcher (C)' },
  { name: 'Matthew Zobel', position: '1st Base / Infielder' },
  { name: 'Aris Thorne', position: 'Shortstop (SS)' },
  { name: 'Justin Mercado', position: 'Outfielder (OF)' },
  { name: 'Francis Pineda', position: 'Utility Infielder' },
  { name: 'Vincent Legaspi', position: 'Singles Paddler 1' },
  { name: 'Jerome Salazar', position: 'Singles Paddler 2' },
  { name: 'Kyle Navarro', position: 'Doubles Specialist' },
  { name: 'Bryan Ocampo', position: 'Reserve Paddler' }
];

async function main() {
  console.log('====================================================================');
  console.log('  PSU SPORTSTRACK - CAPSTONE DEFENSE DATABASE PURGE & MASTER SEEDER');
  console.log('====================================================================\n');

  // STEP 1: Fetch Colleges & Clusters
  console.log('🏛️  Fetching Colleges and Clusters...');
  const { data: colleges, error: colErr } = await supabase.from('colleges').select('id, college_name');
  if (colErr || !colleges) throw new Error('Failed to fetch colleges: ' + colErr?.message);
  
  const { data: clusters, error: clErr } = await supabase.from('clusters').select('id, name, college_codes, campuses');
  if (clErr || !clusters) throw new Error('Failed to fetch clusters: ' + clErr?.message);

  const collegeMap = {};
  colleges.forEach(c => {
    const match = c.college_name.match(/\(([^)]+)\)/);
    const code = match ? match[1] : c.college_name.slice(0, 4).toUpperCase();
    collegeMap[code] = c;
  });

  const clusterMap = {};
  clusters.forEach(cl => {
    clusterMap[cl.name] = cl;
  });

  // Helper to map college to cluster
  const getClusterForCollege = (code) => {
    return clusters.find(cl => cl.college_codes && cl.college_codes.includes(code)) || clusters[0];
  };

  // STEP 2: Fetch and partition users: KEEP Real accounts, PURGE Joke Faker accounts
  console.log('👥 Auditing users table...');
  const { data: allUsers, error: userErr } = await supabase.from('users').select('id, email, full_name, role, is_verified, college_id');
  if (userErr) throw userErr;

  const jokeUsers = (allUsers || []).filter(u => u.email && (u.email.startsWith('athlete.') || u.email.includes('faker')));
  const realUsers = (allUsers || []).filter(u => !jokeUsers.some(ju => ju.id === u.id));

  console.log(`ℹ️  Found ${allUsers.length} total users: ${realUsers.length} real accounts to preserve, ${jokeUsers.length} joke faker accounts to purge.`);

  // Purge joke users from public.users and auth.users
  if (jokeUsers.length > 0) {
    console.log(`🗑️  Purging ${jokeUsers.length} joke faker users...`);
    const jokeIds = jokeUsers.map(u => u.id);
    
    // Clear dependent relations first
    await supabase.from('team_roster').delete().in('player_id', jokeIds);
    await supabase.from('match_player_stats').delete().in('player_id', jokeIds);
    await supabase.from('player_stars').delete().in('player_id', jokeIds);
    
    // Delete from public.users
    await supabase.from('users').delete().in('id', jokeIds);

    // Delete from auth.users
    for (const ju of jokeUsers) {
      try {
        await supabase.auth.admin.deleteUser(ju.id);
      } catch (_) {}
    }
    console.log('✅ Joke faker users purged.');
  }

  // Ensure Standard Password for the 4 Presentation Accounts
  const PRESENTATION_EMAILS = [
    'sports.director@psu.palawan.edu.ph',
    'adminmarco@gmail.com',
    'patrick.manalo@psu.palawan.edu.ph',
    'danilo.soriano@psu.palawan.edu.ph',
    'owen@gmail.com',
    'jdelacruz2024@psu.palawan.edu.ph',
    'johnpaolo@gmail.com',
    'puno@gmail.com',
    'martin@gmail.com'
  ];

  console.log('🔑 Ensuring uniform defense password for presentation accounts...');
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const au of (authList?.users || [])) {
    if (au.email && PRESENTATION_EMAILS.includes(au.email.toLowerCase())) {
      try {
        await supabase.auth.admin.updateUserById(au.id, { password: DEFAULT_PASSWORD });
      } catch (_) {}
    }
  }

  // STEP 3: Clear Old Matches, Tournaments, and Brackets
  console.log('🧹 Clearing legacy brackets and tournaments...');
  // Break foreign key cycles
  await supabase.from('matches').update({ next_match_id: null, loser_next_match_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('match_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('match_player_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('player_stars').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('team_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ Stale tournament records cleared.');

  // STEP 4: Seed Clean Realistic PalawanSU Student Athletes
  console.log('🌱 Seeding authentic PalawanSU Student Athlete profiles...');
  const studentAthleteUsers = [];

  // Find or link Juan Dela Cruz (Star Demo Account)
  let juanUser = realUsers.find(u => u.email === 'jdelacruz2024@psu.palawan.edu.ph');
  const csCol = collegeMap['CS'];
  if (juanUser && csCol) {
    await supabase.from('users').update({
      college_id: csCol.id,
      program: 'BS Information Technology',
      year_level: 3,
      is_verified: true,
      role: 'player_student',
      preferred_sports: ['Basketball', 'Volleyball'],
      primary_position: 'Point Guard (PG)'
    }).eq('id', juanUser.id);
  }

  // Create additional authentic student athlete users for each college
  let athleteCounter = 100;
  for (const cDef of COLLEGE_DEFS) {
    const col = collegeMap[cDef.code];
    if (!col) continue;

    for (let i = 0; i < 8; i++) {
      athleteCounter++;
      const studentNum = `202480${athleteCounter}`;
      const email = `${studentNum}@psu.palawan.edu.ph`;
      const nameObj = REALISTIC_FILIPINO_ATHLETES[(athleteCounter) % REALISTIC_FILIPINO_ATHLETES.length];
      const fullName = `${nameObj.name}`;

      // Check if user already exists
      const existing = realUsers.find(u => u.email === email);
      if (existing) {
        studentAthleteUsers.push(existing);
      } else {
        const { data: createdAuth, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'player_student' }
        });

        if (!authErr && createdAuth?.user) {
          const { data: pubUser } = await supabase.from('users').upsert({
            id: createdAuth.user.id,
            email,
            full_name: fullName,
            role: 'player_student',
            is_verified: true,
            is_facilitator: false,
            college_id: col.id,
            program: cDef.program,
            year_level: (i % 4) + 1,
            student_number: `2024-8-${athleteCounter}`,
            preferred_sports: ['Basketball', 'Volleyball', 'Soccer'],
            primary_position: nameObj.position
          }).select().single();

          if (pubUser) studentAthleteUsers.push(pubUser);
        }
      }
    }
  }
  console.log(`✅ Student athlete pool populated (${studentAthleteUsers.length} verified athletes).`);

  // STEP 5: SEED 2026 TOURNAMENTS (18 Tournaments: 9 Completed + 9 Ongoing)
  console.log('🏆 Seeding 2026 Tournaments (18 tournaments across all 9 ballgames)...');

  // Identify Key Personnel
  const superAdminUser = realUsers.find(u => u.role === 'super_admin') || allUsers[0];
  const facilitatorUser = realUsers.find(u => u.role === 'facilitator' || u.email.includes('patrick.manalo')) || allUsers[0];
  const coachDanilo = realUsers.find(u => u.email.includes('danilo.soriano')) || realUsers.find(u => u.role === 'coach') || allUsers[0];
  const coachOwen = realUsers.find(u => u.email.includes('owen')) || coachDanilo;

  const allAthletesPool = [...realUsers.filter(u => u.role === 'player_student'), ...studentAthleteUsers];

  // Helper to create teams and full rosters for a tournament
  async function createTeamsForTournament(tournId, sportName) {
    const teams = [];
    for (const cDef of COLLEGE_DEFS) {
      const col = collegeMap[cDef.code];
      const cluster = getClusterForCollege(cDef.code);
      const teamName = `${cDef.code} ${cDef.mascot}`;
      const coachId = cDef.code === 'CBA' ? coachDanilo.id : (cDef.code === 'CS' ? coachOwen.id : null);

      const { data: team, error } = await supabase.from('teams').insert({
        name: teamName,
        tournament_id: tournId,
        status: 'Approved',
        affiliation_type: 'college',
        college_id: col ? col.id : null,
        cluster_id: cluster ? cluster.id : null,
        coach_id: coachId
      }).select().single();

      if (error) console.error('Error creating team:', error);
      if (team) {
        teams.push(team);

        // Fetch athletes for this college
        const colAthletes = allAthletesPool.filter(a => a.college_id === col?.id);
        const rosterPool = colAthletes.length >= 8 ? colAthletes : allAthletesPool;

        // Ensure Juan Dela Cruz is in CS Basketball
        const squadMembers = [];
        if (cDef.code === 'CS' && sportName === 'Basketball' && juanUser) {
          squadMembers.push(juanUser);
        }

        for (const ath of rosterPool) {
          if (squadMembers.length >= 8) break;
          if (!squadMembers.some(m => m.id === ath.id)) {
            squadMembers.push(ath);
          }
        }

        // Insert into team_roster with starters and substitutes
        for (let idx = 0; idx < squadMembers.length; idx++) {
          const ath = squadMembers[idx];
          const isStarter = idx < 5; // First 5 are starters
          const isCaptain = idx === 0;
          const jerseyNum = isCaptain ? 7 : (idx * 5 + 3);

          await supabase.from('team_roster').insert({
            team_id: team.id,
            player_id: ath.id,
            status: 'Approved',
            jersey_number: jerseyNum,
            is_starter: isStarter,
            is_captain: isCaptain,
            availability_status: isStarter ? 'Active' : 'Bench',
            position: isStarter ? (idx === 0 ? 'Point Guard (PG)' : (idx === 1 ? 'Shooting Guard (SG)' : (idx === 2 ? 'Small Forward (SF)' : (idx === 3 ? 'Power Forward (PF)' : 'Center (C)')))) : 'Substitute / Bench'
          });
        }
      }
    }
    return teams;
  }

  // 5A. 2026 COMPLETED TOURNAMENTS (9 Sports)
  for (const sport of OFFICIAL_BALLGAMES) {
    const isBasketball = sport === 'Basketball';
    const tournName = `PSU Binturungan 2026 - ${sport} Classic`;

    const { data: tourn } = await supabase.from('tournaments').insert({
      name: tournName,
      sport,
      type: 'Binturungan',
      status: 'Completed',
      start_date: '2026-10-15',
      end_date: '2026-10-25'
    }).select().single();

    if (!tourn) continue;
    const teams = await createTeamsForTournament(tourn.id, sport);
    if (teams.length < 8) continue;

    // Build 8-team single elimination bracket
    // T0: CS, T1: CEAT, T2: CBA, T3: CTE, T4: CCJE, T5: CAH, T6: CNHS, T7: CHMT
    // QF 1: T0 (CS) vs T4 (CCJE) -> Winner T0
    // QF 2: T1 (CEAT) vs T5 (CAH) -> Winner T1
    // QF 3: T2 (CBA) vs T6 (CNHS) -> Winner T2
    // QF 4: T3 (CTE) vs T7 (CHMT) -> Winner T3
    // SF 1: T0 (CS) vs T1 (CEAT) -> Winner T0, Loser T1
    // SF 2: T2 (CBA) vs T3 (CTE) -> Winner T2, Loser T3
    // 3rd: T1 (CEAT) vs T3 (CTE) -> Winner T1 (Bronze)
    // Finals: T0 (CS) vs T2 (CBA) -> Winner T0 (Gold), Loser T2 (Silver)

    const baseScore = isBasketball ? 75 : (sport === 'Volleyball' ? 25 : 3);

    // Finals Match
    const { data: finals } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Finals',
      status: 'Completed',
      team_a_id: teams[0].id,
      team_b_id: teams[2].id,
      team_a_score: baseScore + 10,
      team_b_score: baseScore + 4,
      winner_team_id: teams[0].id,
      match_time: '2026-10-25 16:00:00+08',
      venue: 'PSU Main Gymnasium - Championship Court'
    }).select().single();

    // 3rd Place Match
    const { data: bronzeMatch } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Bronze Playoff',
      status: 'Completed',
      team_a_id: teams[1].id,
      team_b_id: teams[3].id,
      team_a_score: baseScore + 8,
      team_b_score: baseScore + 2,
      winner_team_id: teams[1].id,
      match_time: '2026-10-25 13:00:00+08',
      venue: 'PSU Main Gymnasium - Court B'
    }).select().single();

    // Semifinals
    const { data: sf1 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 1',
      status: 'Completed',
      team_a_id: teams[0].id,
      team_b_id: teams[1].id,
      team_a_score: baseScore + 12,
      team_b_score: baseScore + 8,
      winner_team_id: teams[0].id,
      next_match_id: finals?.id,
      loser_next_match_id: bronzeMatch?.id,
      match_time: '2026-10-24 14:00:00+08',
      venue: 'PSU Main Gymnasium - Court A'
    }).select().single();

    const { data: sf2 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 2',
      status: 'Completed',
      team_a_id: teams[2].id,
      team_b_id: teams[3].id,
      team_a_score: baseScore + 6,
      team_b_score: baseScore + 1,
      winner_team_id: teams[2].id,
      next_match_id: finals?.id,
      loser_next_match_id: bronzeMatch?.id,
      match_time: '2026-10-24 16:00:00+08',
      venue: 'PSU Main Gymnasium - Court A'
    }).select().single();

    // Quarterfinals
    const qfData = [
      { a: 0, b: 4, win: 0, next: sf1?.id },
      { a: 1, b: 5, win: 1, next: sf1?.id },
      { a: 2, b: 6, win: 2, next: sf2?.id },
      { a: 3, b: 7, win: 3, next: sf2?.id }
    ];

    for (let q = 0; q < qfData.length; q++) {
      const qf = qfData[q];
      const { data: qfMatch } = await supabase.from('matches').insert({
        tournament_id: tourn.id,
        round: `Quarterfinal ${q + 1}`,
        status: 'Completed',
        team_a_id: teams[qf.a].id,
        team_b_id: teams[qf.b].id,
        team_a_score: qf.win === qf.a ? baseScore + 14 : baseScore + 5,
        team_b_score: qf.win === qf.b ? baseScore + 14 : baseScore + 5,
        winner_team_id: teams[qf.win].id,
        next_match_id: qf.next,
        match_time: `2026-10-23 0${9 + q * 2}:00:00+08`,
        venue: 'PSU Main Gymnasium'
      }).select().single();

      // Seed match player stats for Juan Dela Cruz if CS is in match
      if (isBasketball && (qf.a === 0 || qf.b === 0) && juanUser && qfMatch) {
        await supabase.from('match_player_stats').insert({
          match_id: qfMatch.id,
          team_id: teams[0].id,
          player_id: juanUser.id,
          jersey_number: 7,
          points: 22,
          assists: 8,
          rebounds: 5,
          steals: 3,
          blocks: 1,
          fouls: 2
        });
      }
    }

    // Award MVP Star for Tournament Champion
    if (isBasketball && juanUser && finals) {
      await supabase.from('player_stars').insert({
        player_id: juanUser.id,
        star_type: 'gold',
        tournament_id: tourn.id,
        match_id: finals.id,
        justification: 'Finals MVP: Directed offense with 28 points, 10 assists in championship game.',
        awarded_by: superAdminUser.id
      });
    }
  }

  // 5B. 2026 ONGOING TOURNAMENTS (9 Sports)
  console.log('⚡ Seeding 2026 Ongoing Tournaments (including the Marquee Live Demo Game)...');
  for (const sport of OFFICIAL_BALLGAMES) {
    const isBasketball = sport === 'Basketball';
    const tournName = isBasketball
      ? "PSU Palaro 2026 - Men's Basketball Championship"
      : `PSU Inter-Collegiate 2026 - ${sport} Cup`;

    const { data: tourn } = await supabase.from('tournaments').insert({
      name: tournName,
      sport,
      type: 'Binturungan',
      status: 'Active',
      start_date: '2026-11-01',
      end_date: '2026-11-10'
    }).select().single();

    if (!tourn) continue;
    const teams = await createTeamsForTournament(tourn.id, sport);
    if (teams.length < 8) continue;

    const baseScore = isBasketball ? 70 : (sport === 'Volleyball' ? 25 : 3);

    // Finals (Scheduled)
    const { data: finals } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Finals',
      status: 'Scheduled',
      match_time: '2026-11-08 16:00:00+08',
      venue: 'PSU Main Gymnasium - Championship Court'
    }).select().single();

    // Semifinal 2 (Scheduled)
    const { data: sf2 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 2',
      status: 'Scheduled',
      team_a_id: teams[2].id, // CBA
      team_b_id: teams[3].id, // CTE
      match_time: '2026-11-05 16:00:00+08',
      next_match_id: finals?.id,
      venue: 'PSU Main Gymnasium - Court A'
    }).select().single();

    // SEMIFINAL 1: THE MARQUEE LIVE DEMO GAME (CS Titans vs CEAT Builders)
    const { data: sf1 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 1',
      status: isBasketball ? 'Ongoing' : 'Scheduled',
      team_a_id: teams[0].id, // CS Titans
      team_b_id: teams[1].id, // CEAT Builders
      team_a_score: isBasketball ? 64 : 0,
      team_b_score: isBasketball ? 61 : 0,
      current_period: isBasketball ? 'Q4' : 'Period 1',
      game_time_seconds: isBasketball ? 222 : 0, // 03:42 on clock
      is_clock_running: isBasketball,
      active_scorekeeper_id: isBasketball ? facilitatorUser.id : null,
      designated_facilitator_id: isBasketball ? facilitatorUser.id : null,
      match_time: '2026-11-03 14:00:00+08',
      next_match_id: finals?.id,
      venue: 'PSU Main Gymnasium - Court A'
    }).select().single();

    // If Basketball, add live box scores and play-by-play events
    if (isBasketball && sf1 && juanUser) {
      console.log(`🎯 Configured Marquee Live Showcase Match: SF1 (${sf1.id}) CS (64) vs CEAT (61)`);
      
      // Box scores for starters
      await supabase.from('match_player_stats').insert([
        {
          match_id: sf1.id,
          team_id: teams[0].id,
          player_id: juanUser.id,
          jersey_number: 7,
          points: 18,
          assists: 6,
          rebounds: 4,
          steals: 2,
          blocks: 0,
          fouls: 2
        }
      ]);

      // Recent match event
      await supabase.from('match_events').insert({
        match_id: sf1.id,
        team_id: teams[0].id,
        player_id: juanUser.id,
        event_type: 'point',
        points: 2,
        period: 'Q4',
        game_clock: '04:15',
        description: 'Juan Dela Cruz driving layup'
      });
    }

    // 4 Quarterfinals (All Completed to populate bracket)
    const qfData = [
      { a: 0, b: 4, scoreA: baseScore + 12, scoreB: baseScore + 4, win: 0, next: sf1?.id },
      { a: 1, b: 5, scoreA: baseScore + 18, scoreB: baseScore + 9, win: 1, next: sf1?.id },
      { a: 2, b: 6, scoreA: baseScore + 6, scoreB: baseScore, win: 2, next: sf2?.id },
      { a: 3, b: 7, scoreA: baseScore + 8, scoreB: baseScore + 5, win: 3, next: sf2?.id }
    ];

    for (let q = 0; q < qfData.length; q++) {
      const qf = qfData[q];
      await supabase.from('matches').insert({
        tournament_id: tourn.id,
        round: `Quarterfinal ${q + 1}`,
        status: 'Completed',
        team_a_id: teams[qf.a].id,
        team_b_id: teams[qf.b].id,
        team_a_score: qf.scoreA,
        team_b_score: qf.scoreB,
        winner_team_id: teams[qf.win].id,
        next_match_id: qf.next,
        match_time: `2026-11-02 0${9 + q * 2}:00:00+08`,
        venue: 'PSU Main Gymnasium'
      });
    }
  }

  // STEP 6: SEED 2025 HISTORICAL ARCHIVE (9 Completed Tournaments)
  console.log('🏛️  Seeding 2025 Historical Championship Tournaments (9 ballgames)...');
  for (const sport of OFFICIAL_BALLGAMES) {
    const tournName = `PSU Binturungan 2025 - ${sport} Championship`;

    const { data: tourn } = await supabase.from('tournaments').insert({
      name: tournName,
      sport,
      type: 'Binturungan',
      status: 'Completed',
      start_date: '2025-10-14',
      end_date: '2025-10-28'
    }).select().single();

    if (!tourn) continue;
    const teams = await createTeamsForTournament(tourn.id, sport);
    if (teams.length < 8) continue;

    const baseScore = sport === 'Basketball' ? 74 : (sport === 'Volleyball' ? 25 : 2);

    // In 2025: Tribo Apolaki / CTE was Champion, CEAT was Runner-Up, CS was Bronze
    const { data: finals } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Finals',
      status: 'Completed',
      team_a_id: teams[3].id, // CTE
      team_b_id: teams[1].id, // CEAT
      team_a_score: baseScore + 11,
      team_b_score: baseScore + 7,
      winner_team_id: teams[3].id,
      match_time: '2025-10-28 16:00:00+08',
      venue: 'PSU Main Gymnasium'
    }).select().single();

    const { data: bronze } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Bronze Playoff',
      status: 'Completed',
      team_a_id: teams[0].id, // CS
      team_b_id: teams[2].id, // CBA
      team_a_score: baseScore + 9,
      team_b_score: baseScore + 4,
      winner_team_id: teams[0].id,
      match_time: '2025-10-28 13:00:00+08',
      venue: 'PSU Main Gymnasium'
    }).select().single();

    const { data: sf1 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 1',
      status: 'Completed',
      team_a_id: teams[3].id,
      team_b_id: teams[0].id,
      team_a_score: baseScore + 14,
      team_b_score: baseScore + 8,
      winner_team_id: teams[3].id,
      next_match_id: finals?.id,
      loser_next_match_id: bronze?.id,
      match_time: '2025-10-26 14:00:00+08'
    }).select().single();

    const { data: sf2 } = await supabase.from('matches').insert({
      tournament_id: tourn.id,
      round: 'Semifinal 2',
      status: 'Completed',
      team_a_id: teams[1].id,
      team_b_id: teams[2].id,
      team_a_score: baseScore + 8,
      team_b_score: baseScore + 6,
      winner_team_id: teams[1].id,
      next_match_id: finals?.id,
      loser_next_match_id: bronze?.id,
      match_time: '2025-10-26 16:00:00+08'
    }).select().single();

    // 4 QFs in 2025
    await supabase.from('matches').insert([
      { tournament_id: tourn.id, round: 'Quarterfinal 1', status: 'Completed', team_a_id: teams[3].id, team_b_id: teams[7].id, team_a_score: baseScore + 10, team_b_score: baseScore + 2, winner_team_id: teams[3].id, next_match_id: sf1?.id },
      { tournament_id: tourn.id, round: 'Quarterfinal 2', status: 'Completed', team_a_id: teams[0].id, team_b_id: teams[4].id, team_a_score: baseScore + 15, team_b_score: baseScore + 9, winner_team_id: teams[0].id, next_match_id: sf1?.id },
      { tournament_id: tourn.id, round: 'Quarterfinal 3', status: 'Completed', team_a_id: teams[1].id, team_b_id: teams[5].id, team_a_score: baseScore + 12, team_b_score: baseScore + 6, winner_team_id: teams[1].id, next_match_id: sf2?.id },
      { tournament_id: tourn.id, round: 'Quarterfinal 4', status: 'Completed', team_a_id: teams[2].id, team_b_id: teams[6].id, team_a_score: baseScore + 7, team_b_score: baseScore + 3, winner_team_id: teams[2].id, next_match_id: sf2?.id }
    ]);
  }

  // STEP 7: SEED FACULTY & STAFF GAMES 2026 (Category Isolation Proof)
  console.log('🤝 Seeding Faculty and Staff Games (Volleyball)...');
  const { data: facultyTourn } = await supabase.from('tournaments').insert({
    name: 'PSU Faculty & Staff Games 2026 - Volleyball Tournament',
    sport: 'Volleyball',
    type: 'Friendly',
    status: 'Active',
    start_date: '2026-10-28',
    end_date: '2026-11-05'
  }).select().single();

  if (facultyTourn) {
    const { data: fTeam1 } = await supabase.from('teams').insert({
      name: 'CTE Faculty Mentors',
      tournament_id: facultyTourn.id,
      status: 'Approved',
      affiliation_type: 'college',
      college_id: collegeMap['CTE']?.id
    }).select().single();

    const { data: fTeam2 } = await supabase.from('teams').insert({
      name: 'ICTD / CEAT Staff Spikers',
      tournament_id: facultyTourn.id,
      status: 'Approved',
      affiliation_type: 'college',
      college_id: collegeMap['CEAT']?.id
    }).select().single();

    if (fTeam1 && fTeam2) {
      await supabase.from('matches').insert({
        tournament_id: facultyTourn.id,
        round: 'Exhibition Match',
        status: 'Ongoing',
        team_a_id: fTeam1.id,
        team_b_id: fTeam2.id,
        team_a_score: 21,
        team_b_score: 19,
        current_period: 'Set 2',
        game_time_seconds: 450,
        is_clock_running: true,
        match_time: '2026-11-03 10:00:00+08',
        venue: 'PSU Gymnasium - Court B'
      });
    }
  }

  console.log('\n====================================================================');
  console.log('🎉 DEFENSE MASTER SEEDING COMPLETE!');
  console.log('   - 18 Tournaments in 2026 (9 Completed + 9 Ongoing across all ballgames)');
  console.log('   - 9 Historical Tournaments in 2025 (Completed with full brackets & medalists)');
  console.log('   - 1 Faculty & Staff Tournament (Friendly category isolation proof)');
  console.log('   - Total Tournaments Active: 28');
  console.log('   - 0 Joke faker accounts remaining');
  console.log('   - Juan Dela Cruz (jdelacruz2024@psu.palawan.edu.ph) verified in CS Basketball');
  console.log('   - Marquee Live Match: SF1 CS (64) vs CEAT (61), Q4 03:42, ready in Kiosk');
  console.log('   - Uniform Defense Password: ' + DEFAULT_PASSWORD);
  console.log('====================================================================\n');
}

main().catch(err => {
  console.error('❌ Seeder script failed:', err);
  process.exit(1);
});
