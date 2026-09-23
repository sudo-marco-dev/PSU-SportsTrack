import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
  env.split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

async function verify() {
  const url = envVars['VITE_SUPABASE_URL'] + '/rest/v1/';
  const headers = {
    apikey: envVars['SUPABASE_LEGACY_SERVICE_ROLE_KEY'],
    Authorization: 'Bearer ' + envVars['SUPABASE_LEGACY_SERVICE_ROLE_KEY']
  };

  try {
    const res = await fetch(url, { headers });
    const schema = await res.json();
    const defs = schema.definitions || {};

    const checks = {
      'Table: clusters': !!defs.clusters,
      'Table: match_player_stats': !!defs.match_player_stats,
      'Table: match_score_events': !!defs.match_score_events,
      'View/Table: profiles': !!defs.profiles,
      'Column: users.account_status': !!defs.users?.properties?.account_status,
      'Column: users.faculty_id_url': !!defs.users?.properties?.faculty_id_url,
      'Column: users.cluster_id': !!defs.users?.properties?.cluster_id,
      'Column: users.soft_deleted_at': !!defs.users?.properties?.soft_deleted_at,
      'Column: users.revalidated_at': !!defs.users?.properties?.revalidated_at,
      'Column: matches.is_finalized': !!defs.matches?.properties?.is_finalized,
      'Column: matches.finalized_by': !!defs.matches?.properties?.finalized_by,
      'Column: team_roster.jersey_number': !!defs.team_roster?.properties?.jersey_number,
      'Column: audit_logs.actor_id': !!defs.audit_logs?.properties?.actor_id
    };

    console.log('====================================================');
    console.log('   PSU SPORTSTRACK GOVERNANCE SCHEMA STATUS');
    console.log('====================================================');
    let allPassed = true;
    for (const [key, passed] of Object.entries(checks)) {
      console.log(`${passed ? '✅' : '❌'} ${key}: ${passed ? 'ACTIVE' : 'PENDING'}`);
      if (!passed) allPassed = false;
    }

    if (allPassed) {
      console.log('\n🎉 ALL GOVERNANCE TABLES & COLUMNS ARE LIVE IN SUPABASE!');
    } else {
      console.log('\n⚠️ SOME MIGRATIONS ARE PENDING.');
      console.log('Execute supabase/migrations/20260916_superadmin_facilitator_governance.sql in Supabase SQL Editor.');
    }
  } catch (err) {
    console.error('Verification error:', err);
  }
}

verify();
