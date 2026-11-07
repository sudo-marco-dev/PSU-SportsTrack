/**
 * Public Voice Assistant Query Engine for PSU SportsTrack
 * Empowers students, athletes, and fans to search fixtures, players, colleges,
 * star leaderboards, and sport schedules.
 */

import { supabase } from '@/lib/supabase';

export type PublicVoiceAssistantQueryType =
  | 'upcoming_games'
  | 'match_search'
  | 'player_search'
  | 'college_search'
  | 'highest_stars'
  | 'sport_schedule'
  | 'navigation'
  | 'general_search'
  | 'help'
  | 'unknown';

export interface ParsedPublicVoiceQuery {
  rawTranscript: string;
  queryType: PublicVoiceAssistantQueryType;
  searchTerm?: string;
  sport?: string;
  targetRoute?: string;
  spokenResponse: string;
  confidence: number;
}

const ALL_SPORTS = [
  'basketball',
  'volleyball',
  'football',
  'sepak takraw',
  'badminton',
  'table tennis',
  'chess',
  'soccer',
  'futsal',
  'baseball',
  'softball',
  'pickleball',
];

const KNOWN_COLLEGES = [
  'ceat',
  'cet',
  'cba',
  'cas',
  'cte',
  'cs',
  'cit',
  'ccje',
  'ccj',
  'chmt',
  'cnhs',
  'cahs',
  'caf',
  'engineering',
  'business',
  'arts',
  'sciences',
  'education',
  'hospitality',
  'nursing',
  'agriculture',
  'criminology',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses user spoken queries into structured ParsedPublicVoiceQuery
 */
export function parsePublicVoiceQuery(rawTranscript: string): ParsedPublicVoiceQuery {
  const norm = normalize(rawTranscript);

  // 1. Direct Navigation Shortcuts (e.g. "go to rankings", "open tournaments", "home")
  if (
    norm.startsWith('go to') ||
    norm.startsWith('open') ||
    norm.startsWith('navigate to') ||
    norm.startsWith('take me to') ||
    norm.startsWith('visit')
  ) {
    if (norm.includes('ranking') || norm.includes('standings') || norm.includes('medal tally')) {
      return {
        rawTranscript,
        queryType: 'navigation',
        targetRoute: '/ranking',
        spokenResponse: 'Navigating to College Standings and Medal Rankings.',
        confidence: 0.98,
      };
    }
    if (norm.includes('tournament') || norm.includes('explorer') || norm.includes('bracket') || norm.includes('fixture')) {
      return {
        rawTranscript,
        queryType: 'navigation',
        targetRoute: '/explorer',
        spokenResponse: 'Navigating to Tournament Explorer.',
        confidence: 0.98,
      };
    }
    if (norm.includes('scouting') || norm.includes('athletic')) {
      return {
        rawTranscript,
        queryType: 'navigation',
        targetRoute: '/athletics',
        spokenResponse: 'Navigating to Athletics Scouting Hub.',
        confidence: 0.98,
      };
    }
    if (norm.includes('home') || norm.includes('dashboard') || norm.includes('main page')) {
      return {
        rawTranscript,
        queryType: 'navigation',
        targetRoute: '/',
        spokenResponse: 'Navigating to PSU SportsTrack Home.',
        confidence: 0.98,
      };
    }
    if (norm.includes('search') || norm.includes('query')) {
      return {
        rawTranscript,
        queryType: 'navigation',
        targetRoute: '/search',
        spokenResponse: 'Opening Dedicated Voice Query Search Hub.',
        confidence: 0.98,
      };
    }
  }

  // 2. Upcoming Games This Week / Fixtures
  if (
    norm.includes('upcoming games') ||
    norm.includes('games this week') ||
    norm.includes('upcoming matches') ||
    norm.includes('matches this week') ||
    norm.includes('next games') ||
    norm.includes('schedule this week')
  ) {
    return {
      rawTranscript,
      queryType: 'upcoming_games',
      targetRoute: '/explorer',
      spokenResponse: 'Here are the upcoming games scheduled this week across Palawan State University.',
      confidence: 0.95,
    };
  }

  // 3. Highest Stars / MVP Leaderboards
  if (
    norm.includes('highest stars') ||
    norm.includes('most stars') ||
    norm.includes('mvp') ||
    norm.includes('top players') ||
    norm.includes('star leaders') ||
    norm.includes('gold stars') ||
    norm.includes('red stars') ||
    norm.includes('star leaderboard') ||
    /\bhighest\b/i.test(norm)
  ) {
    return {
      rawTranscript,
      queryType: 'highest_stars',
      targetRoute: '/ranking',
      spokenResponse: 'Opening the university MVP star leaderboard. Here are the top standout athletes.',
      confidence: 0.96,
    };
  }

  // 4. Player & Athlete Search (singular & plural, name extraction or directory)
  const playerMatch = norm.match(/(?:search for players?|find players?|show players?|who is|players?|athletes?)\s*(.*)/i);
  if (
    /\b(player|players|athlete|athletes)\b/i.test(norm) ||
    norm.includes('who is') ||
    playerMatch
  ) {
    const rawCaptured = playerMatch && playerMatch[1] ? playerMatch[1].trim() : '';
    // Clean filler words
    const term = rawCaptured.replace(/^(?:for|of|in|named|with)\s+/i, '').trim();

    return {
      rawTranscript,
      queryType: 'player_search',
      searchTerm: term,
      targetRoute: term ? '/athletics' : '/athletics',
      spokenResponse: term
        ? `Searching records for player ${term}.`
        : 'Searching university athletes and scouting directory.',
      confidence: 0.93,
    };
  }

  // 5. College & Campus Search (e.g. "colleges", "campus", acronyms like "CET", "CBA")
  const isCollegeQuery =
    /\b(college|colleges|campus|campuses|department|departments)\b/i.test(norm) ||
    KNOWN_COLLEGES.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(norm));

  if (isCollegeQuery) {
    let term = '';
    for (const c of KNOWN_COLLEGES) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(norm)) {
        term = c.toUpperCase();
        break;
      }
    }
    if (!term) {
      const match = norm.match(/(?:college|colleges|campus|campuses)\s+(?:of\s+)?([a-z\s]+)/i);
      if (match && match[1]) term = match[1].trim();
    }

    return {
      rawTranscript,
      queryType: 'college_search',
      searchTerm: term || 'colleges',
      targetRoute: `/search?q=${encodeURIComponent(term || 'colleges')}&type=colleges`,
      spokenResponse: term
        ? `Searching collegiate records and standings for ${term}.`
        : 'Searching collegiate units and campus standings across PSU.',
      confidence: 0.92,
    };
  }

  // 6. Sport Specific Schedules & Tournaments (all catalog sports)
  for (const s of ALL_SPORTS) {
    if (norm.includes(s)) {
      return {
        rawTranscript,
        queryType: 'sport_schedule',
        sport: s,
        targetRoute: `/search?q=${encodeURIComponent(s)}&type=schedules`,
        spokenResponse: `Showing scheduled matches and brackets for ${s.toUpperCase()}.`,
        confidence: 0.9,
      };
    }
  }

  if (norm.includes('schedule') || norm.includes('schedules') || norm.includes('bracket') || norm.includes('brackets')) {
    return {
      rawTranscript,
      queryType: 'sport_schedule',
      sport: '',
      targetRoute: '/search?type=schedules',
      spokenResponse: 'Opening tournament schedules and bracket fixtures.',
      confidence: 0.9,
    };
  }

  // 7. General Match / Matches / Games / Fixtures Trigger
  if (/\b(match|matches|game|games|fixture|fixtures)\b/i.test(norm)) {
    const matchTerm = norm.replace(/\b(?:search for|find|show|view|query)\b/gi, '').trim();
    return {
      rawTranscript,
      queryType: 'match_search',
      searchTerm: matchTerm,
      targetRoute: `/search?q=${encodeURIComponent(matchTerm)}&type=matches`,
      spokenResponse: `Searching matches and game fixtures for "${matchTerm || 'games'}".`,
      confidence: 0.91,
    };
  }

  // 8. Navigation Shortcuts (without explicit "go to")
  if (norm.includes('rankings') || norm.includes('standings') || norm.includes('medal tally')) {
    return {
      rawTranscript,
      queryType: 'navigation',
      targetRoute: '/ranking',
      spokenResponse: 'Navigating to College Standings and Medal Rankings.',
      confidence: 0.98,
    };
  }
  if (norm.includes('tournaments') || norm.includes('explorer') || norm.includes('brackets')) {
    return {
      rawTranscript,
      queryType: 'navigation',
      targetRoute: '/explorer',
      spokenResponse: 'Navigating to Tournament Explorer.',
      confidence: 0.98,
    };
  }
  if (norm.includes('home') || norm.includes('dashboard') || norm.includes('main page')) {
    return {
      rawTranscript,
      queryType: 'navigation',
      targetRoute: '/',
      spokenResponse: 'Navigating to PSU SportsTrack Home.',
      confidence: 0.98,
    };
  }

  // 9. Help
  if (norm.includes('help') || norm.includes('what can i ask') || norm.includes('commands')) {
    return {
      rawTranscript,
      queryType: 'help',
      spokenResponse: 'You can ask: "Search for upcoming games this week", "Search for player Cruz", "Colleges standings", or "Basketball schedule".',
      confidence: 0.99,
    };
  }

  // Fallback: General Search Routing to Dedicated Search Page
  return {
    rawTranscript,
    queryType: 'general_search',
    searchTerm: rawTranscript,
    targetRoute: `/search?q=${encodeURIComponent(rawTranscript)}`,
    spokenResponse: `Searching tournaments and athletic records for "${rawTranscript}".`,
    confidence: 0.7,
  };
}

/**
 * Executes database queries based on the parsed public voice query
 */
export async function executePublicVoiceDataQuery(query: ParsedPublicVoiceQuery) {
  try {
    switch (query.queryType) {
      case 'upcoming_games':
      case 'match_search': {
        const term = query.searchTerm || '';
        let dbQuery = supabase
          .from('matches')
          .select(`
            id,
            status,
            round,
            venue,
            match_time,
            team_a_score,
            team_b_score,
            team_a:teams!matches_team_a_id_fkey(name),
            team_b:teams!matches_team_b_id_fkey(name),
            tournament:tournaments!matches_tournament_id_fkey(name, sport)
          `)
          .limit(8);

        if (query.queryType === 'upcoming_games') {
          dbQuery = dbQuery.in('status', ['Scheduled', 'Ongoing']);
        }

        const { data, error } = await dbQuery;
        if (error) throw error;

        let items = (data || []) as any[];
        if (term && term !== 'match' && term !== 'matches' && term !== 'games') {
          const lower = term.toLowerCase();
          items = items.filter((m) => {
            const teamA = m.team_a?.name?.toLowerCase() || '';
            const teamB = m.team_b?.name?.toLowerCase() || '';
            const sport = m.tournament?.sport?.toLowerCase() || '';
            const venue = m.venue?.toLowerCase() || '';
            return teamA.includes(lower) || teamB.includes(lower) || sport.includes(lower) || venue.includes(lower);
          });
        }
        return { type: query.queryType, items: items.slice(0, 4) };
      }

      case 'highest_stars': {
        const { data, error } = await supabase
          .from('player_stars')
          .select(`
            id,
            star_type,
            user:users!player_stars_player_id_fkey(
              id,
              full_name,
              college:colleges!users_college_id_fkey(college_name)
            )
          `)
          .limit(60);

        if (error) throw error;

        // Group stars by player
        const map = new Map<string, { id: string; name: string; college: string; gold: number; red: number }>();
        (data || []).forEach((row: any) => {
          const u = row.user;
          if (!u) return;
          const entry = map.get(u.id) || {
            id: u.id,
            name: u.full_name || 'Athlete',
            college: u.college?.college_name || 'PSU College',
            gold: 0,
            red: 0,
          };
          if (row.star_type === 'Gold') entry.gold += 1;
          else entry.red += 1;
          map.set(u.id, entry);
        });

        const list = Array.from(map.values()).sort(
          (a, b) => b.gold * 3 + b.red - (a.gold * 3 + a.red)
        ).slice(0, 4);

        return { type: 'highest_stars', items: list };
      }

      case 'player_search': {
        const term = query.searchTerm || '';
        let dbQuery = supabase
          .from('users')
          .select(`
            id,
            full_name,
            role,
            is_verified,
            primary_position,
            college:colleges!users_college_id_fkey(college_name)
          `)
          .limit(4);

        if (term) {
          dbQuery = dbQuery.ilike('full_name', `%${term}%`);
        }

        const { data, error } = await dbQuery;
        if (error) throw error;
        return { type: 'player_search', items: data || [] };
      }

      case 'college_search': {
        const term = (query.searchTerm || '').trim();
        let dbQuery = supabase
          .from('colleges')
          .select('id, college_name')
          .order('college_name')
          .limit(10);

        if (term && term.toLowerCase() !== 'colleges' && term.toLowerCase() !== 'college') {
          if (term.toUpperCase() === 'CET') {
            dbQuery = dbQuery.or('college_name.ilike.%CET%,college_name.ilike.%CEAT%');
          } else if (term.toUpperCase() === 'CCJ') {
            dbQuery = dbQuery.or('college_name.ilike.%CCJ%,college_name.ilike.%CCJE%');
          } else {
            dbQuery = dbQuery.ilike('college_name', `%${term}%`);
          }
        }

        const [colRes, clRes] = await Promise.allSettled([
          dbQuery,
          supabase.from('clusters').select('id, name, color, college_codes'),
        ]);

        if (colRes.status === 'rejected' || (colRes.status === 'fulfilled' && colRes.value.error)) {
          throw colRes.status === 'rejected' ? colRes.reason : colRes.value.error;
        }

        const rawColleges = colRes.value.data || [];
        const rawClusters = clRes.status === 'fulfilled' && clRes.value.data ? clRes.value.data : [];

        const items = rawColleges.map((c: any) => {
          const codeMatch = c.college_name.match(/\(([^)]+)\)/);
          const code = codeMatch ? codeMatch[1].trim().toUpperCase() : '';
          const matched = rawClusters.find((cl: any) => cl.college_codes && cl.college_codes.includes(code));
          return {
            id: c.id,
            college_name: c.college_name,
            cluster: matched ? { id: matched.id, name: matched.name, color: matched.color } : null,
          };
        });

        return { type: 'college_search', items };
      }

      case 'sport_schedule': {
        const sport = query.sport || query.searchTerm || '';
        let dbQuery = supabase
          .from('tournaments')
          .select('id, name, sport, type, status, start_date, end_date')
          .limit(4);

        if (sport && sport !== 'schedule' && sport !== 'schedules') {
          dbQuery = dbQuery.ilike('sport', `%${sport}%`);
        }

        const { data, error } = await dbQuery;
        if (error) throw error;
        return { type: 'sport_schedule', items: data || [] };
      }

      case 'general_search': {
        const term = query.searchTerm || '';
        let matchQuery = supabase
          .from('matches')
          .select('id, round, venue, status, tournament:tournaments!matches_tournament_id_fkey(name, sport)')
          .limit(2);

        if (term) {
          matchQuery = matchQuery.or(`venue.ilike.%${term}%,round.ilike.%${term}%`);
        }

        // Parallel queries to tournaments, matches, users
        const [tournRes, matchRes, userRes] = await Promise.allSettled([
          supabase.from('tournaments').select('id, name, sport, status').ilike('name', `%${term}%`).limit(2),
          matchQuery,
          supabase.from('users').select('id, full_name, role').ilike('full_name', `%${term}%`).limit(2),
        ]);

        const items: any[] = [];
        if (tournRes.status === 'fulfilled' && tournRes.value.data) {
          tournRes.value.data.forEach((t: any) => items.push({ ...t, entityType: 'tournament' }));
        }
        if (matchRes.status === 'fulfilled' && matchRes.value.data) {
          matchRes.value.data.forEach((m: any) => items.push({ ...m, entityType: 'match' }));
        }
        if (userRes.status === 'fulfilled' && userRes.value.data) {
          userRes.value.data.forEach((u: any) => items.push({ ...u, entityType: 'player' }));
        }

        return { type: 'general_search', items };
      }

      default:
        return { type: query.queryType || 'unknown', items: [] };
    }
  } catch (err) {
    console.warn('[PublicVoiceAssistant] Query error:', err);
    return { type: query.queryType, items: [], error: true };
  }
}
