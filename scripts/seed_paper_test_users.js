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
const anonKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('❌ Missing Supabase URL, Service Role Key, or Anon Key in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = 'PsuSportsTrack@2026!';

const TEST_USERS = [
  {
    key: 'admin',
    email: 'sports.director@psu.palawan.edu.ph',
    full_name: 'Dr. Ramon Bautista',
    role: 'super_admin',
    is_verified: true,
    is_facilitator: true,
    college_code: 'CAS',
    department: 'University Sports Development Office',
    employee_id: 'EMP-2024-0001',
    preferred_sports: ['Basketball', 'Volleyball'],
  },
  {
    key: 'coach',
    email: 'danilo.soriano@psu.palawan.edu.ph',
    full_name: 'Coach Danilo Soriano',
    role: 'coach',
    is_verified: true,
    is_facilitator: false,
    college_code: 'CBA',
    department: 'Business Administration & Varsity Athletics',
    employee_id: 'EMP-2024-0104',
    preferred_sports: ['Basketball', 'Volleyball'],
  },
  {
    key: 'facilitator',
    email: 'patrick.manalo@psu.palawan.edu.ph',
    full_name: 'Engr. Patrick Manalo',
    role: 'facilitator',
    is_verified: true,
    is_facilitator: true,
    college_code: 'CEAT',
    department: 'Civil Engineering • Technical Officials Committee',
    employee_id: 'EMP-2024-0211',
    preferred_sports: ['Basketball', 'Sepak Takraw'],
  },
  {
    key: 'student_verified',
    email: 'jdelacruz2024@psu.palawan.edu.ph',
    full_name: 'Juan Dela Cruz',
    role: 'player_student',
    is_verified: true,
    is_facilitator: false,
    college_code: 'CAS',
    program: 'BS Information Technology',
    year_level: 3,
    age: 20,
    student_number: '2024-8-0284',
    preferred_sports: ['Basketball', 'Volleyball'],
    primary_position: 'Point Guard (PG)',
  },
  {
    key: 'faculty_verified',
    email: 'elena.fernandez@psu.palawan.edu.ph',
    full_name: 'Prof. Elena Fernandez',
    role: 'player_faculty',
    is_verified: true,
    is_facilitator: false,
    college_code: 'CTE',
    department: 'Physical Education & Athletics',
    employee_id: 'EMP-2021-0089',
    age: 34,
    preferred_sports: ['Pickleball', 'Table Tennis'],
    primary_position: 'Doubles Specialist',
  },
  {
    key: 'staff_verified',
    email: 'roberto.mendoza@psu.palawan.edu.ph',
    full_name: 'Roberto Mendoza',
    role: 'player_staff',
    is_verified: true,
    is_facilitator: false,
    college_code: 'CEAT',
    department: 'Information & Communications Technology Division (ICTD)',
    employee_id: 'EMP-2022-0312',
    age: 29,
    preferred_sports: ['Basketball', 'Softball'],
    primary_position: 'Shooting Guard (SG)',
  },
  {
    key: 'student_pending',
    email: 'mmendoza2024@psu.palawan.edu.ph',
    full_name: 'Mark Mendoza',
    role: 'player_student',
    is_verified: false,
    is_facilitator: false,
    college_code: 'CS',
    program: 'BS Computer Science',
    year_level: 1,
    age: 19,
    student_number: '2024-8-0912',
    preferred_sports: ['Table Tennis', 'Basketball'],
    primary_position: 'Singles Paddler',
  },
  {
    key: 'faculty_pending',
    email: 'carlos.villanueva@psu.palawan.edu.ph',
    full_name: 'Prof. Carlos Villanueva',
    role: 'player_faculty',
    is_verified: false,
    is_facilitator: false,
    college_code: 'CEAT',
    department: 'Mechanical Engineering Department',
    employee_id: 'EMP-2024-0419',
    age: 38,
    preferred_sports: ['Soccer', 'Futsal'],
    primary_position: 'Central Midfielder',
  },
  {
    key: 'staff_pending',
    email: 'liza.santos@psu.palawan.edu.ph',
    full_name: 'Liza Santos',
    role: 'player_staff',
    is_verified: false,
    is_facilitator: false,
    college_code: 'CBA',
    department: 'University Registrar Office',
    employee_id: 'EMP-2024-0508',
    age: 27,
    preferred_sports: ['Volleyball', 'Pickleball'],
    primary_position: 'Outside Hitter',
  },
];

async function run() {
  console.log('==============================================================');
  console.log('  PSU SPORTSTRACK - PAPER DOCUMENTATION DB USER & DATA SEEDER');
  console.log('==============================================================\n');

  // 1. Fetch Colleges
  const { data: colleges } = await adminClient.from('colleges').select('id, college_name');
  const findCollegeId = (code) => {
    if (!colleges) return null;
    const match = colleges.find(
      (c) =>
        c.college_name.includes(`(${code})`) ||
        c.college_name.toUpperCase().includes(code.toUpperCase())
    );
    return match ? match.id : colleges[0]?.id || null;
  };

  // 2. Fetch existing Auth users
  const { data: authList, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('❌ Failed to list auth users:', listErr.message);
    process.exit(1);
  }
  const authUsersByEmail = new Map(
    (authList?.users || []).map((u) => [u.email?.toLowerCase(), u])
  );

  const userMap = {};

  for (const spec of TEST_USERS) {
    const emailLower = spec.email.toLowerCase();
    let authUser = authUsersByEmail.get(emailLower);

    // Check if public.users already has a record with this email
    const { data: existingPublicUser } = await adminClient
      .from('users')
      .select('id, email')
      .ilike('email', emailLower)
      .maybeSingle();

    if (!authUser) {
      const createPayload = {
        email: spec.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: spec.full_name,
          role: spec.role,
        },
      };
      if (existingPublicUser?.id) {
        createPayload.id = existingPublicUser.id;
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser(createPayload);
      if (createErr) {
        console.warn(`⚠️ Create auth user warning for ${spec.email}:`, createErr.message);
      } else {
        authUser = created.user;
        console.log(`✅ Created Auth user: ${spec.full_name} <${spec.email}> (${authUser.id})`);
      }
    } else {
      // Ensure password and email confirmation are up to date
      const { data: updated, error: updErr } = await adminClient.auth.admin.updateUserById(authUser.id, {
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: spec.full_name,
          role: spec.role,
        },
      });
      if (!updErr && updated?.user) {
        authUser = updated.user;
      }
      console.log(`🔄 Updated Auth user: ${spec.full_name} <${spec.email}> (${authUser.id})`);
    }

    const userId = authUser?.id || existingPublicUser?.id;
    if (!userId) continue;

    // If existingPublicUser had a different ID than authUser, clean up the orphan or update by ID
    const collegeId = findCollegeId(spec.college_code);
    const profilePayload = {
      id: userId,
      email: spec.email,
      full_name: spec.full_name,
      role: spec.role,
      is_verified: spec.is_verified,
      is_facilitator: spec.is_facilitator,
      college_id: collegeId,
      department: spec.department || null,
      employee_id: spec.employee_id || null,
      student_number: spec.student_number || null,
      program: spec.program || null,
      year_level: spec.year_level || null,
      age: spec.age || 21,
      preferred_sports: spec.preferred_sports || ['Basketball'],
      primary_position: spec.primary_position || null,
      account_status: 'active',
    };

    const { error: upsertErr } = await adminClient
      .from('users')
      .upsert(profilePayload, { onConflict: 'id' });

    if (upsertErr) {
      console.warn(`⚠️ Upsert public.users warning for ${spec.email}:`, upsertErr.message);
    }

    userMap[spec.key] = { ...profilePayload, id: userId };
  }

  // 3. Seed Pending Verification Documents for Admin Verifications Queue (/admin/verifications)
  console.log('\n📄 Seeding Pending Verification Documents for Admin Clearance Queue...');
  const pendingDocsSpecs = [
    {
      user: userMap['student_pending'],
      document_type: 'COR',
      storage_path: `${userMap['student_pending']?.id}/cor_mark_mendoza_2026.pdf`,
      status: 'Pending',
      confidence_score: 96,
      extracted_full_name: 'Mark Mendoza',
      extracted_student_no: '2024-8-0912',
      extracted_college: 'College of Sciences (CS)',
      extracted_program: 'BS Computer Science',
      extracted_year_level: '1st Year',
      extracted_school_year: '2026-2027 1st Semester',
      extracted_total_units: '21.0',
      extracted_age: 19,
      auto_match_status: 'High Confidence Match',
    },
    {
      user: userMap['faculty_pending'],
      document_type: 'FACULTY_ID',
      storage_path: `${userMap['faculty_pending']?.id}/faculty_id_carlos_villanueva.jpg`,
      status: 'Pending',
      confidence_score: 92,
      extracted_full_name: 'Prof. Carlos Villanueva',
      extracted_student_no: 'EMP-2024-0419',
      extracted_college: 'College of Engineering, Architecture and Technology (CEAT)',
      extracted_program: 'Mechanical Engineering Department',
      auto_match_status: 'Verified Faculty ID Format',
    },
    {
      user: userMap['staff_pending'],
      document_type: 'STAFF_ID',
      storage_path: `${userMap['staff_pending']?.id}/staff_id_liza_santos.jpg`,
      status: 'Pending',
      confidence_score: 89,
      extracted_full_name: 'Liza Santos',
      extracted_student_no: 'EMP-2024-0508',
      extracted_college: 'University Administration',
      extracted_program: 'University Registrar Office',
      auto_match_status: 'Verified Employee ID',
    },
  ];

  for (const docSpec of pendingDocsSpecs) {
    if (!docSpec.user?.id) continue;
    await adminClient
      .from('verification_documents')
      .delete()
      .eq('user_id', docSpec.user.id)
      .eq('status', 'Pending');

    const { error: docErr } = await adminClient.from('verification_documents').insert({
      user_id: docSpec.user.id,
      document_type: docSpec.document_type,
      storage_path: docSpec.storage_path,
      status: docSpec.status,
      confidence_score: docSpec.confidence_score,
      extracted_full_name: docSpec.extracted_full_name,
      extracted_student_no: docSpec.extracted_student_no,
      extracted_college: docSpec.extracted_college,
      extracted_program: docSpec.extracted_program,
      extracted_year_level: docSpec.extracted_year_level || null,
      extracted_school_year: docSpec.extracted_school_year || null,
      extracted_total_units: docSpec.extracted_total_units || null,
      extracted_age: docSpec.extracted_age || null,
      auto_match_status: docSpec.auto_match_status,
    });
    if (docErr) {
      console.warn(`⚠️ Failed to insert verification doc for ${docSpec.extracted_full_name}:`, docErr.message);
    } else {
      console.log(`✅ Seeded Pending ${docSpec.document_type} for ${docSpec.extracted_full_name}`);
    }
  }

  // 4. Ensure Coach Danilo Soriano has Active Teams & Approved Roster Players
  console.log('\n🏀 Ensuring Coach Danilo Soriano has Teams & Full Squad Rosters...');
  const coachId = userMap['coach']?.id;
  const cbaCollegeId = findCollegeId('CBA');
  const casCollegeId = findCollegeId('CAS');

  // Find an Ongoing Basketball Tournament and Volleyball Tournament
  const { data: allTourneys } = await adminClient
    .from('tournaments')
    .select('id, name, sport, status, is_deleted')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false });

  let bballTourney = (allTourneys || []).find((t) => t.sport === 'Basketball' && t.status === 'Ongoing');
  if (!bballTourney) {
    bballTourney = (allTourneys || []).find((t) => t.sport === 'Basketball');
  }
  let vballTourney = (allTourneys || []).find((t) => t.sport === 'Volleyball' && t.status === 'Ongoing');
  if (!vballTourney) {
    vballTourney = (allTourneys || []).find((t) => t.sport === 'Volleyball');
  }

  if (coachId && bballTourney) {
    // Ensure CBA Golden Wolves team belongs to Coach Danilo Soriano
    const { data: existingCoachTeams } = await adminClient
      .from('teams')
      .select('id, name, status, tournament_id')
      .eq('coach_id', coachId);

    let wolvesTeamId = existingCoachTeams?.[0]?.id;
    if (!wolvesTeamId) {
      // Check if there is an existing CBA team we can assign to Coach Danilo Soriano
      const { data: cbaTeams } = await adminClient
        .from('teams')
        .select('id, name')
        .ilike('name', '%CBA%')
        .limit(2);

      if (cbaTeams && cbaTeams.length > 0) {
        wolvesTeamId = cbaTeams[0].id;
        await adminClient
          .from('teams')
          .update({ coach_id: coachId, status: 'Approved', college_id: cbaCollegeId })
          .eq('id', wolvesTeamId);
        if (cbaTeams[1]) {
          await adminClient
            .from('teams')
            .update({ coach_id: coachId, status: 'Approved', college_id: cbaCollegeId })
            .eq('id', cbaTeams[1].id);
        }
      } else {
        const { data: newTeam } = await adminClient
          .from('teams')
          .insert({
            name: 'CBA GOLDEN WOLVES',
            tournament_id: bballTourney.id,
            coach_id: coachId,
            college_id: cbaCollegeId,
            affiliation_type: 'college',
            status: 'Approved',
          })
          .select('id')
          .single();
        wolvesTeamId = newTeam?.id;
      }
    }

    // Ensure at least 1 Pending team exists for Admin Team Approvals tab
    const { data: pendingTeamsCheck } = await adminClient
      .from('teams')
      .select('id')
      .eq('status', 'Pending')
      .limit(1);

    if (!pendingTeamsCheck || pendingTeamsCheck.length === 0) {
      if (vballTourney) {
        await adminClient.from('teams').insert({
          name: 'CBA LADY WOLVES VARSITY',
          tournament_id: vballTourney.id,
          coach_id: coachId,
          college_id: cbaCollegeId,
          affiliation_type: 'college',
          status: 'Pending',
        });
      }
    }

    // Populate roster for wolvesTeamId if needed
    if (wolvesTeamId) {
      const { data: currentRoster } = await adminClient
        .from('team_roster')
        .select('id, player_id')
        .eq('team_id', wolvesTeamId);

      if (!currentRoster || currentRoster.length < 5) {
        const { data: samplePlayers } = await adminClient
          .from('users')
          .select('id, full_name')
          .eq('role', 'player_student')
          .eq('is_verified', true)
          .limit(8);

        const existingPlayerIds = new Set((currentRoster || []).map((r) => r.player_id));
        const jerseyNumbers = [4, 7, 11, 13, 15, 21, 23, 30];
        let idx = 0;
        for (const p of samplePlayers || []) {
          if (existingPlayerIds.has(p.id)) continue;
          await adminClient.from('team_roster').insert({
            team_id: wolvesTeamId,
            player_id: p.id,
            jersey_number: jerseyNumbers[idx % jerseyNumbers.length],
            is_starter: idx < 5,
            status: 'Approved',
          });
          idx++;
        }
        console.log(`✅ Populated ${idx} players on Coach Danilo Soriano's squad (${wolvesTeamId})`);
      }
    }
  }

  // 5. Ensure Juan Dela Cruz has Career Stats, Roster Membership & MVP Stars
  console.log('\n⭐ Ensuring Student Athlete (Juan Dela Cruz) has Career Telemetry & Stars...');
  const juanId = userMap['student_verified']?.id;
  if (juanId && bballTourney) {
    // Find a CAS team or any ongoing team
    const { data: casTeam } = await adminClient
      .from('teams')
      .select('id, name, tournament_id')
      .ilike('name', '%CAS%')
      .limit(1)
      .maybeSingle();

    const targetTeamId = casTeam?.id;
    if (targetTeamId) {
      const { data: juanRoster } = await adminClient
        .from('team_roster')
        .select('id')
        .eq('team_id', targetTeamId)
        .eq('player_id', juanId)
        .maybeSingle();

      if (!juanRoster) {
        await adminClient.from('team_roster').insert({
          team_id: targetTeamId,
          player_id: juanId,
          jersey_number: 7,
          is_starter: true,
          status: 'Approved',
          court_status: 'on_court',
        });
      }
    }

    // Find a match in bballTourney
    const { data: sampleMatch } = await adminClient
      .from('matches')
      .select('id, tournament_id, team_a_id')
      .eq('tournament_id', bballTourney.id)
      .limit(1)
      .maybeSingle();

    if (sampleMatch) {
      // Ensure match_player_stats entry for Juan Dela Cruz
      const { data: existingStats } = await adminClient
        .from('match_player_stats')
        .select('id')
        .eq('player_id', juanId)
        .limit(1);

      if (!existingStats || existingStats.length === 0) {
        await adminClient.from('match_player_stats').insert({
          match_id: sampleMatch.id,
          tournament_id: sampleMatch.tournament_id,
          team_id: targetTeamId || sampleMatch.team_a_id,
          player_id: juanId,
          sport: 'Basketball',
          points: 24,
          assists: 7,
          rebounds: 5,
          steals: 3,
          blocks: 1,
          three_pointers_made: 4,
          fouls: 2,
          is_mvp: true,
        });
      }

      // Ensure player_stars entry
      const { data: existingStars } = await adminClient
        .from('player_stars')
        .select('id')
        .eq('player_id', juanId)
        .limit(1);

      if (!existingStars || existingStars.length === 0) {
        await adminClient.from('player_stars').insert([
          {
            player_id: juanId,
            match_id: sampleMatch.id,
            tournament_id: sampleMatch.tournament_id,
            star_type: 'Red',
            awarded_by: userMap['admin']?.id || null,
          },
          {
            player_id: juanId,
            match_id: sampleMatch.id,
            tournament_id: sampleMatch.tournament_id,
            star_type: 'Gold',
            awarded_by: userMap['admin']?.id || null,
          },
        ]);
      }
    }
  }

  // 6. Ensure Facilitator Engr. Patrick Manalo is assigned to active matches
  const faciId = userMap['facilitator']?.id;
  const adminId = userMap['admin']?.id;
  if (faciId) {
    const { data: ongoingMatches } = await adminClient
      .from('matches')
      .select('id')
      .in('status', ['Ongoing', 'Scheduled'])
      .limit(6);

    if (ongoingMatches && ongoingMatches.length > 0) {
      const mIds = ongoingMatches.map((m) => m.id);
      await adminClient
        .from('matches')
        .update({ designated_facilitator_id: faciId })
        .in('id', mIds);
      console.log(`✅ Assigned Facilitator Engr. Patrick Manalo to ${mIds.length} active/scheduled matches`);
    }
  }

  // 6.5 Seed Appendix I: Official Match Box Score, Bracket Winners & Audit Logs with JSON Diffs
  console.log('\n📊 Seeding Appendix I (Box Score, Bracket Winners & Audit Trail JSON Diffs)...');
  // Soft-delete any leftover test tournament like "PSU Friendly Games00" so FR-43 reports are 100% clean
  await adminClient
    .from('tournaments')
    .update({ is_deleted: true })
    .ilike('name', '%Friendly Games00%');

  const marqueeTourId = '6805d349-f20b-4781-9591-b8731ff684df';
  const finalsMatchId = 'b2561fce-6d3b-47fa-b68c-9edda34cadca';
  const ceatTeamId = '1841d2d1-417d-40e2-bc76-f0eec757b456';
  const csTeamId = '7f910cb3-b2c1-450c-8fd2-d6c824282fc9';

  // Ensure all completed matches in Marquee Basketball Tournament have winner_team_id set
  const { data: marqueeMatches } = await adminClient
    .from('matches')
    .select('id, round, status, team_a_id, team_b_id, team_a_score, team_b_score')
    .eq('tournament_id', marqueeTourId)
    .eq('status', 'Completed');

  for (const mm of marqueeMatches || []) {
    const winId = (mm.team_a_score || 0) >= (mm.team_b_score || 0) ? mm.team_a_id : mm.team_b_id;
    await adminClient
      .from('matches')
      .update({
        winner_team_id: winId,
        official_scorekeeper_id: faciId || adminId,
        finalized_by: faciId || adminId,
        finalized_at: '2026-10-27T17:45:00+00:00',
        venue: mm.id === finalsMatchId ? 'PSU Main Gymnasium - Court 1 (Championship Arena)' : 'PSU Main Gymnasium',
        scorer_notes:
          mm.id === finalsMatchId
            ? 'Official Championship Finals tally certified by Technical Officials Committee and signed by both head coaches.'
            : null,
      })
      .eq('id', mm.id);
  }

  // Populate detailed player box score for Finals Match (CEAT Red Scorpions 92 - 88 CS Byte Titans)
  const { data: finalsRosters } = await adminClient
    .from('team_roster')
    .select('id, team_id, player_id, jersey_number, position, is_starter, is_captain, users:player_id(full_name)')
    .in('team_id', [ceatTeamId, csTeamId])
    .eq('status', 'Approved');

  if (finalsRosters && finalsRosters.length > 0) {
    const ceatPlayers = finalsRosters.filter((r) => r.team_id === ceatTeamId);
    const csPlayers = finalsRosters.filter((r) => r.team_id === csTeamId);

    // Clear previous Finals box score stats & events to avoid duplicates
    await adminClient.from('match_player_stats').delete().eq('match_id', finalsMatchId);
    await adminClient.from('match_score_events').delete().eq('match_id', finalsMatchId);
    await adminClient.from('match_events').delete().eq('match_id', finalsMatchId);

    // Ensure Star MVP on Finals match is the #1 CEAT player
    const mvpPlayer = ceatPlayers[0];
    if (mvpPlayer?.player_id) {
      await adminClient.from('player_stars').delete().eq('match_id', finalsMatchId);
      await adminClient.from('player_stars').insert([
        {
          player_id: mvpPlayer.player_id,
          match_id: finalsMatchId,
          tournament_id: marqueeTourId,
          star_type: 'Red',
          awarded_by: faciId || adminId,
          justification:
            'Delivered game-high 28 PTS (5 3PM, 5 2PM, 3 FTM) including the go-ahead clutch three-pointer with 0:18 remaining in 4Q to seal the Championship.',
        },
        {
          player_id: mvpPlayer.player_id,
          match_id: finalsMatchId,
          tournament_id: marqueeTourId,
          star_type: 'Gold',
          awarded_by: adminId || faciId,
          justification: 'Crowned Season MVP after leading CEAT Red Scorpions to the PSU Binturungan 2026 Basketball title.',
        },
      ]);
    }

    // CEAT breakdown summing to 92 PTS: [28, 22, 16, 12, 8, 6, 0, ...]
    const ceatProfiles = [
      { pts: 28, p3: 5, p2: 5, ft: 3, j: 7, pos: 'PG (Point Guard)', starter: true, cap: true },
      { pts: 22, p3: 3, p2: 5, ft: 3, j: 11, pos: 'SG (Shooting Guard)', starter: true, cap: false },
      { pts: 16, p3: 2, p2: 4, ft: 2, j: 23, pos: 'SF (Small Forward)', starter: true, cap: false },
      { pts: 12, p3: 0, p2: 5, ft: 2, j: 15, pos: 'PF (Power Forward)', starter: true, cap: false },
      { pts: 8, p3: 0, p2: 3, ft: 2, j: 34, pos: 'C (Center)', starter: true, cap: false },
      { pts: 6, p3: 2, p2: 0, ft: 0, j: 4, pos: 'SG (Sixth Man)', starter: false, cap: false },
    ];

    // CS breakdown summing to 88 PTS: [25, 20, 17, 14, 8, 4, 0, ...]
    const csProfiles = [
      { pts: 25, p3: 4, p2: 5, ft: 3, j: 10, pos: 'PG (Point Guard)', starter: true, cap: true },
      { pts: 20, p3: 2, p2: 6, ft: 2, j: 8, pos: 'SG (Shooting Guard)', starter: true, cap: false },
      { pts: 17, p3: 3, p2: 3, ft: 2, j: 13, pos: 'SF (Small Forward)', starter: true, cap: false },
      { pts: 14, p3: 0, p2: 6, ft: 2, j: 21, pos: 'PF (Power Forward)', starter: true, cap: false },
      { pts: 8, p3: 0, p2: 4, ft: 0, j: 32, pos: 'C (Center)', starter: true, cap: false },
      { pts: 4, p3: 0, p2: 2, ft: 0, j: 5, pos: 'PG (Reserve)', starter: false, cap: false },
    ];

    const seedSquadBox = async (players, profiles, teamId) => {
      for (let i = 0; i < Math.min(players.length, profiles.length); i++) {
        const p = players[i];
        const prof = profiles[i];

        await adminClient
          .from('team_roster')
          .update({
            jersey_number: prof.j,
            position: prof.pos,
            is_starter: prof.starter,
            is_captain: prof.cap,
          })
          .eq('id', p.id);

        await adminClient.from('match_player_stats').insert({
          match_id: finalsMatchId,
          team_id: teamId,
          player_id: p.player_id,
          jersey_number: prof.j,
          points: prof.pts,
        });

        const scoreEvents = [];
        for (let k = 0; k < prof.p3; k++) {
          scoreEvents.push({
            match_id: finalsMatchId,
            team_id: teamId,
            player_id: p.player_id,
            points: 3,
            delta: 3,
            action_type: 'Triple',
            undone: false,
          });
        }
        for (let k = 0; k < prof.p2; k++) {
          scoreEvents.push({
            match_id: finalsMatchId,
            team_id: teamId,
            player_id: p.player_id,
            points: 2,
            delta: 2,
            action_type: 'Field',
            undone: false,
          });
        }
        for (let k = 0; k < prof.ft; k++) {
          scoreEvents.push({
            match_id: finalsMatchId,
            team_id: teamId,
            player_id: p.player_id,
            points: 1,
            delta: 1,
            action_type: 'FT',
            undone: false,
          });
        }
        if (scoreEvents.length > 0) {
          await adminClient.from('match_score_events').insert(scoreEvents);
        }
      }
    };

    await seedSquadBox(ceatPlayers, ceatProfiles, ceatTeamId);
    await seedSquadBox(csPlayers, csProfiles, csTeamId);

    const mvpName = Array.isArray(mvpPlayer?.users)
      ? mvpPlayer.users[0]?.full_name
      : mvpPlayer?.users?.full_name || 'CEAT Captain';

    await adminClient.from('match_events').insert([
      {
        match_id: finalsMatchId,
        description: `[FINAL] Official Championship Match Concluded: CEAT Red Scorpions 92 - 88 CS Byte Titans. Red Star MVP awarded to #7 ${mvpName} (28 PTS).`,
        created_at: '2026-10-27T09:45:00+00:00',
      },
      {
        match_id: finalsMatchId,
        description: `[4Q 0:06] +2 FT Made by #11 (CEAT Red Scorpions) — Score: 92 - 88`,
        created_at: '2026-10-27T09:43:30+00:00',
      },
      {
        match_id: finalsMatchId,
        description: `[4Q 0:18] CLUTCH +3PT Triple by #7 ${mvpName} (CEAT Red Scorpions) — Lead change: 90 - 88!`,
        created_at: '2026-10-27T09:42:10+00:00',
      },
      {
        match_id: finalsMatchId,
        description: `[4Q 0:42] +3PT Triple by #10 (CS Byte Titans) — CS takes 88 - 87 lead!`,
        created_at: '2026-10-27T09:40:00+00:00',
      },
      {
        match_id: finalsMatchId,
        description: `[4Q 1:15] Official Video Review by Technical Committee: 3PT arc verification confirmed (+1 PT adjustment applied).`,
        created_at: '2026-10-27T09:38:00+00:00',
      },
    ]);
    console.log(`✅ Populated full Finals Box Score & Play-by-Play for match ${finalsMatchId}`);
  }

  // Seed Sports-Department-Friendly Audit Trail Records with Previous -> Updated Change Summaries
  if (adminId) {
    // Remove previously seeded JSON_DIFF or CHANGE_SUMMARY logs so re-runs stay idempotent
    await adminClient.from('audit_logs').delete().ilike('details', '%JSON_DIFF:%');
    await adminClient.from('audit_logs').delete().ilike('details', '%CHANGE_SUMMARY:%');

    const auditEntries = [
      {
        admin_id: adminId,
        actor_id: adminId,
        action: 'SCORE_OVERRIDE',
        entity_type: 'matches',
        entity_id: finalsMatchId,
        target_id: finalsMatchId,
        created_at: new Date(Date.now() + 240000).toISOString(),
        details: `Official Technical Committee video review on the Basketball Championship Finals (CEAT Red Scorpions vs. CS Byte Titans): upgraded 4Q 1:15 perimeter shot from a 2-Point Field Goal to a 3-Point Triple after replay check. | CHANGE_SUMMARY:${JSON.stringify({
          previous: 'CEAT 91 – 88 CS (2PT Field Goal)',
          updated: 'CEAT 92 – 88 CS (3PT Triple)',
        })}`,
      },
      {
        admin_id: adminId,
        actor_id: adminId,
        action: 'APPROVE_DOCUMENT',
        entity_type: 'verification_documents',
        entity_id: userMap['student_verified']?.id || null,
        target_id: userMap['student_verified']?.id || null,
        created_at: new Date(Date.now() + 180000).toISOString(),
        details: `Approved Certificate of Registration (COR) and confirmed varsity eligibility for student-athlete Juan Dela Cruz (College of Arts and Sciences). | CHANGE_SUMMARY:${JSON.stringify({
          previous: 'Pending Eligibility Review',
          updated: 'Verified Varsity Athlete (CAS)',
        })}`,
      },
      {
        admin_id: adminId,
        actor_id: adminId,
        action: 'OVERRIDE_STAR',
        entity_type: 'player_stars',
        entity_id: finalsMatchId,
        target_id: finalsMatchId,
        created_at: new Date(Date.now() + 120000).toISOString(),
        details: `Certified official post-game Red Star (Game MVP) and Gold Star (Season MVP) awards for #7 Ezekiel Castro (CEAT Red Scorpions) in the Basketball Championship Finals. | CHANGE_SUMMARY:${JSON.stringify({
          previous: 'Pending Committee Sign-Off',
          updated: 'Official MVP Certified (28 PTS)',
        })}`,
      },
      {
        admin_id: adminId,
        actor_id: adminId,
        action: 'GENERATE_BRACKET',
        entity_type: 'tournaments',
        entity_id: marqueeTourId,
        target_id: marqueeTourId,
        created_at: new Date(Date.now() + 60000).toISOString(),
        details: `Generated the official Single-Elimination Playoff Bracket for PSU Binturungan 2026 - Basketball Championship. | CHANGE_SUMMARY:${JSON.stringify({
          previous: 'Elimination Round Phase',
          updated: '8-Team Playoff Bracket Published',
        })}`,
      },
    ];

    const { error: auditErr } = await adminClient.from('audit_logs').insert(auditEntries);
    if (auditErr) {
      console.warn('⚠️ Audit log seed warning:', auditErr.message);
    } else {
      console.log(`✅ Seeded ${auditEntries.length} Sports-Department-friendly Audit Trail records`);
    }
  }

  // 7. Sign in each test account using a fresh anon client to capture real JWT sessions
  console.log('\n🔐 Generating real authenticated Supabase sessions for Playwright...');
  const sessionsOutput = {};

  for (const spec of TEST_USERS) {
    const tempClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInErr } = await tempClient.auth.signInWithPassword({
      email: spec.email,
      password: DEFAULT_PASSWORD,
    });
    if (signInErr || !signInData.session) {
      console.error(`❌ Failed to sign in ${spec.email}:`, signInErr?.message);
    } else {
      sessionsOutput[spec.key] = {
        profile: userMap[spec.key],
        session: signInData.session,
      };
      console.log(`🔑 Verified real login session for [${spec.key}] ${spec.full_name} (${spec.role})`);
    }
  }

  // Determine the Supabase storage key (sb-<projectRef>-auth-token)
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  fs.writeFileSync(
    'tests/.auth-sessions.json',
    JSON.stringify({ storageKey, password: DEFAULT_PASSWORD, accounts: sessionsOutput }, null, 2)
  );
  console.log(`\n🎉 Saved 9 real authenticated sessions to tests/.auth-sessions.json (key: ${storageKey})`);
}

run().catch((err) => {
  console.error('❌ Fatal seeder error:', err);
  process.exit(1);
});
