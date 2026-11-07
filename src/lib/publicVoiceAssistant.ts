/**
 * Public Voice Assistant Query Engine for PSU SportsTrack
 * Empowers students, athletes, and fans to search fixtures, players, and star leaderboards.
 */

import { supabase } from '@/lib/supabase';
import type { ParsedPublicVoiceQuery } from '@/types/multimodal';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses user spoken queries into structured PublicVoiceQuery
 */
export function parsePublicVoiceQuery(rawTranscript: string): ParsedPublicVoiceQuery {
  const norm = normalize(rawTranscript);

  // 1. Upcoming Games This Week / Fixtures
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
      targetRoute: '/tournaments',
      spokenResponse: 'Here are the upcoming games scheduled this week across Palawan State University.',
      confidence: 0.95,
    };
  }

  // 2. Highest Stars / MVP Leaderboards
  if (
    norm.includes('highest stars') ||
    norm.includes('most stars') ||
    norm.includes('mvp') ||
    norm.includes('top players') ||
    norm.includes('star leaders') ||
    norm.includes('gold stars') ||
    norm.includes('red stars')
  ) {
    return {
      rawTranscript,
      queryType: 'highest_stars',
      targetRoute: '/rankings',
      spokenResponse: 'Opening the university MVP star leaderboard. Here are the top standout athletes.',
      confidence: 0.96,
    };
  }

  // 3. Player Search
  const playerMatch = norm.match(/(?:search for player|find player|player|who is)\s+(.+)/i);
  if (playerMatch && playerMatch[1]) {
    const term = playerMatch[1].trim();
    return {
      rawTranscript,
      queryType: 'player_search',
      searchTerm: term,
      targetRoute: '/scouting',
      spokenResponse: `Searching records for player ${term}.`,
      confidence: 0.92,
    };
  }

  // 4. Sport Specific Schedules (Basketball, Volleyball, etc.)
  const sports = ['basketball', 'volleyball', 'football', 'sepak takraw', 'badminton', 'table tennis', 'chess'];
  for (const s of sports) {
    if (norm.includes(s)) {
      return {
        rawTranscript,
        queryType: 'sport_schedule',
        sport: s,
        targetRoute: '/tournaments',
        spokenResponse: `Showing scheduled matches and brackets for ${s.toUpperCase()}.`,
        confidence: 0.9,
      };
    }
  }

  // 5. Navigation Shortcuts
  if (norm.includes('rankings') || norm.includes('standings') || norm.includes('medal tally')) {
    return {
      rawTranscript,
      queryType: 'navigation',
      targetRoute: '/rankings',
      spokenResponse: 'Navigating to College Standings and Medal Rankings.',
      confidence: 0.98,
    };
  }
  if (norm.includes('tournaments') || norm.includes('explorer') || norm.includes('brackets')) {
    return {
      rawTranscript,
      queryType: 'navigation',
      targetRoute: '/tournaments',
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

  // 6. Help
  if (norm.includes('help') || norm.includes('what can i ask') || norm.includes('commands')) {
    return {
      rawTranscript,
      queryType: 'help',
      spokenResponse: 'You can ask: "Search for upcoming games this week", "Search for player Cruz", or "Search for players with highest stars".',
      confidence: 0.99,
    };
  }

  // Fallback: General Search
  return {
    rawTranscript,
    queryType: 'general_search',
    searchTerm: rawTranscript,
    targetRoute: '/tournaments',
    spokenResponse: `Searching tournaments and matches for "${rawTranscript}".`,
    confidence: 0.7,
  };
}

/**
 * Executes database queries based on the parsed public voice query
 */
export async function executePublicVoiceDataQuery(query: ParsedPublicVoiceQuery) {
  try {
    switch (query.queryType) {
      case 'upcoming_games': {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            id,
            status,
            round,
            venue,
            team_a_score,
            team_b_score,
            team_a:teams!matches_team_a_id_fkey(name),
            team_b:teams!matches_team_b_id_fkey(name),
            tournament:tournaments!matches_tournament_id_fkey(name, sport)
          `)
          .in('status', ['Scheduled', 'Ongoing'])
          .limit(4);

        if (error) throw error;
        return { type: 'upcoming_games', items: data || [] };
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
          .limit(10);

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
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            role,
            is_verified,
            college:colleges!users_college_id_fkey(college_name)
          `)
          .ilike('full_name', `%${term}%`)
          .limit(4);

        if (error) throw error;
        return { type: 'player_search', items: data || [] };
      }

      case 'sport_schedule': {
        const sport = query.sport || '';
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, name, sport, type, status, start_date')
          .ilike('sport', `%${sport}%`)
          .limit(4);

        if (error) throw error;
        return { type: 'sport_schedule', items: data || [] };
      }

      default:
        return { type: 'general_search', items: [] };
    }
  } catch (err) {
    console.warn('[PublicVoiceAssistant] Query error:', err);
    return { type: query.queryType, items: [], error: true };
  }
}
