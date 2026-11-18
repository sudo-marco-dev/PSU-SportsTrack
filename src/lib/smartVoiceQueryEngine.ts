/**
 * Smart Voice Query & Natural Language Understanding Engine
 * PSU SportsTrack - Multimodal Public Access Interface
 *
 * Provides:
 * 1. Semantic Sentence Structure Analysis (Interrogative questions, Top-N leaderboards, vague requests)
 * 2. Temporal Window Resolution (this/last/next week, this/last month, this/last year, today/this day/yesterday)
 * 3. Levenshtein Fuzzy Suggester & Phonetic Auto-correction
 * 4. Analytical Question Answering (Who won, Top N highest scoring players, Top N win-rate tribes/squads, MVP, colleges)
 * 5. Smart Temporal Fallback when specific windows yield 0 records
 */

import { supabase } from '@/lib/supabase';
import { extractCollegeCode, fetchBatchPlayerSummaries } from '@/lib/playerStatsEngine';

// ==========================================
// 1. Types & Interfaces
// ==========================================

export type QueryIntent =
  | 'question_winner'
  | 'question_top_college'
  | 'question_highest_mvp'
  | 'question_highest_win_rate'
  | 'question_top_scorers'
  | 'question_tribe_squad_win_rate'
  | 'filter_matches'
  | 'filter_players'
  | 'filter_colleges'
  | 'filter_schedules'
  | 'filter_stars'
  | 'navigation'
  | 'help'
  | 'general';

export interface TemporalWindow {
  type:
    | 'this_week'
    | 'last_week'
    | 'next_week'
    | 'this_month'
    | 'last_month'
    | 'next_month'
    | 'this_year'
    | 'last_year'
    | 'today'
    | 'yesterday'
    | 'upcoming'
    | 'past'
    | 'all_time';
  label: string;
  startDate?: string; // ISO string
  endDate?: string;   // ISO string
  expectedStatus?: 'Scheduled' | 'Ongoing' | 'Completed' | 'any';
}

export interface FuzzyCorrection {
  original: string;
  corrected: string;
  entityType: 'sport' | 'college' | 'player' | 'general';
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  subtitle?: string;
  metricValue: string;
  metricLabel?: string;
  route?: string;
}

export interface DirectAnswerData {
  title: string;
  headline: string;
  details?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
  metricValue?: string;
  metricLabel?: string;
  entityRoute?: string;
  leaderboard?: LeaderboardRow[];
}

export interface SmartVoiceAnalysis {
  rawTranscript: string;
  intent: QueryIntent;
  sport?: string;
  college?: string;
  playerName?: string;
  topN?: number;
  entityTarget?: 'tribes' | 'squads' | 'both' | 'colleges' | 'players';
  temporalWindow?: TemporalWindow;
  fuzzyCorrection?: FuzzyCorrection;
  spokenResponse: string;
  directAnswer?: DirectAnswerData;
  targetRoute: string;
  confidence: number;
}

// ==========================================
// 2. Constants & Catalogs
// ==========================================

export const ALL_SPORTS = [
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

export const KNOWN_COLLEGES: Record<string, { code: string; fullName: string; aliases: string[] }> = {
  CET: {
    code: 'CET',
    fullName: 'College of Engineering and Technology',
    aliases: ['cet', 'ceat', 'engineering', 'set', 'sat', 'tech'],
  },
  CBA: {
    code: 'CBA',
    fullName: 'College of Business and Accountancy',
    aliases: ['cba', 'business', 'accountancy', 'commerce', 'see ba'],
  },
  CAS: {
    code: 'CAS',
    fullName: 'College of Arts and Sciences',
    aliases: ['cas', 'arts and sciences', 'arts', 'sciences', 'kass'],
  },
  CTE: {
    code: 'CTE',
    fullName: 'College of Teacher Education',
    aliases: ['cte', 'education', 'teachers', 'teaching'],
  },
  CS: {
    code: 'CS',
    fullName: 'College of Sciences',
    aliases: ['cs', 'science', 'college of sciences'],
  },
  CIT: {
    code: 'CIT',
    fullName: 'College of Industrial Technology',
    aliases: ['cit', 'industrial', 'industrial tech'],
  },
  CCJE: {
    code: 'CCJE',
    fullName: 'College of Criminal Justice Education',
    aliases: ['ccje', 'ccj', 'criminology', 'criminal justice', 'cops'],
  },
  CHMT: {
    code: 'CHMT',
    fullName: 'College of Hospitality Management and Tourism',
    aliases: ['chmt', 'hospitality', 'tourism', 'hrm'],
  },
  CNHS: {
    code: 'CNHS',
    fullName: 'College of Nursing and Health Sciences',
    aliases: ['cnhs', 'cahs', 'nursing', 'health sciences', 'med'],
  },
  CAF: {
    code: 'CAF',
    fullName: 'College of Agriculture and Forestry',
    aliases: ['caf', 'agriculture', 'forestry', 'agri'],
  },
};

const PHONETIC_SPORT_CORRECTIONS: Record<string, string> = {
  besketball: 'basketball',
  baseketball: 'basketball',
  baskeball: 'basketball',
  basket: 'basketball',
  volybal: 'volleyball',
  voleyball: 'volleyball',
  vollyball: 'volleyball',
  volly: 'volleyball',
  sepak: 'sepak takraw',
  takraw: 'sepak takraw',
  sepaktakraw: 'sepak takraw',
  badmington: 'badminton',
  badminten: 'badminton',
  'table tenis': 'table tennis',
  pingpong: 'table tennis',
  'ping pong': 'table tennis',
  futsall: 'futsal',
  socer: 'soccer',
  futball: 'football',
};

const NUMBER_WORD_MAP: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

// ==========================================
// 3. String Utilities & Levenshtein Distance
// ==========================================

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[bn][an];
}

export function findBestFuzzyMatch(
  term: string,
  candidates: string[],
  maxDistance = 2
): { match: string; distance: number } | null {
  const lower = term.toLowerCase().trim();
  if (!lower) return null;

  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const cand of candidates) {
    const candLower = cand.toLowerCase();
    if (candLower === lower) {
      return { match: cand, distance: 0 };
    }
    const dist = levenshteinDistance(lower, candLower);
    if (dist <= maxDistance && dist < minDistance) {
      minDistance = dist;
      bestMatch = cand;
    }
  }

  if (bestMatch && minDistance <= maxDistance) {
    return { match: bestMatch, distance: minDistance };
  }
  return null;
}

/**
 * Extracts Top-N limit (e.g., "top 3", "top five", "first 5") from normalized text.
 */
export function extractTopNLimit(norm: string, defaultLimit = 3): number {
  const digitMatch = norm.match(/\b(?:top|first|best|highest)\s+(\d+)\b/i);
  if (digitMatch && digitMatch[1]) {
    const parsed = parseInt(digitMatch[1], 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return Math.min(10, parsed);
    }
  }

  for (const [word, num] of Object.entries(NUMBER_WORD_MAP)) {
    if (new RegExp(`\\b(?:top|first|best|highest)\\s+${word}\\b`, 'i').test(norm)) {
      return num;
    }
  }

  return defaultLimit;
}

// ==========================================
// 4. Temporal Expression Resolver
// ==========================================

export function resolveTemporalWindow(norm: string): TemporalWindow | undefined {
  const now = new Date();

  const isUpcomingIntent = norm.includes('upcoming') || norm.includes('scheduled') || norm.includes('next');
  const isPastIntent =
    norm.includes('last ') ||
    norm.includes('past ') ||
    norm.includes('previous ') ||
    norm.includes('completed') ||
    norm.includes('finished');

  const impliedStatus: 'Scheduled' | 'Completed' | 'any' = isUpcomingIntent
    ? 'Scheduled'
    : isPastIntent
    ? 'Completed'
    : 'any';

  const getStartOfWeek = (d: Date, weekOffset = 0) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getEndOfWeek = (startOfWeek: Date) => {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // 1. Last week / this last week / past week (must check BEFORE "this week")
  if (
    norm.includes('this last week') ||
    norm.includes('last week') ||
    norm.includes('past week') ||
    norm.includes('previous week')
  ) {
    const start = getStartOfWeek(now, -1);
    const end = getEndOfWeek(start);
    return {
      type: 'last_week',
      label: 'Last Week',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Completed',
    };
  }

  // 2. This week / current week
  if (norm.includes('this week') || norm.includes('current week')) {
    const start = getStartOfWeek(now, 0);
    const end = getEndOfWeek(start);
    return {
      type: 'this_week',
      label: 'This Week',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: impliedStatus,
    };
  }

  // 3. Next week
  if (norm.includes('next week') || norm.includes('following week')) {
    const start = getStartOfWeek(now, 1);
    const end = getEndOfWeek(start);
    return {
      type: 'next_week',
      label: 'Next Week',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Scheduled',
    };
  }

  // 4. Last month
  if (norm.includes('last month') || norm.includes('previous month') || norm.includes('this last month')) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return {
      type: 'last_month',
      label: 'Last Month',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Completed',
    };
  }

  // 5. This month
  if (norm.includes('this month') || norm.includes('current month')) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return {
      type: 'this_month',
      label: 'This Month',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: impliedStatus,
    };
  }

  // 6. Last year
  if (norm.includes('last year') || norm.includes('previous year') || norm.includes('past year')) {
    const prevYear = now.getFullYear() - 1;
    const start = new Date(prevYear, 0, 1);
    const end = new Date(prevYear, 11, 31, 23, 59, 59, 999);
    return {
      type: 'last_year',
      label: `Year ${prevYear}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Completed',
    };
  }

  // 7. This year
  if (norm.includes('this year')) {
    const currentYear = now.getFullYear();
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    return {
      type: 'this_year',
      label: `Year ${currentYear}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: impliedStatus,
    };
  }

  // 8. Today / this day / tonight / yesterday
  if (norm.includes('today') || norm.includes('this day') || norm.includes('tonight')) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return {
      type: 'today',
      label: 'Today',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: impliedStatus,
    };
  }

  if (norm.includes('yesterday')) {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const start = new Date(yest);
    start.setHours(0, 0, 0, 0);
    const end = new Date(yest);
    end.setHours(23, 59, 59, 999);
    return {
      type: 'yesterday',
      label: 'Yesterday',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Completed',
    };
  }

  // 9. Upcoming general
  if (
    norm.includes('upcoming') ||
    norm.includes('future') ||
    norm.includes('next games') ||
    norm.includes('scheduled')
  ) {
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 45);
    return {
      type: 'upcoming',
      label: 'Upcoming Games',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Scheduled',
    };
  }

  // 10. Past / Last matches / Recent matches
  if (
    norm.includes('past game') ||
    norm.includes('past games') ||
    norm.includes('past match') ||
    norm.includes('last match') ||
    norm.includes('last matches') ||
    norm.includes('last game') ||
    norm.includes('last games') ||
    norm.includes('recent game') ||
    norm.includes('recent match') ||
    norm.includes('history') ||
    norm.includes('finished') ||
    norm.includes('completed')
  ) {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 120);
    return {
      type: 'past',
      label: 'Recent Completed Matches',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      expectedStatus: 'Completed',
    };
  }

  return undefined;
}

// ==========================================
// 5. Entity & Sport Resolution with Fuzzy Suggester
// ==========================================

export function resolveSportAndFuzzy(norm: string): { sport?: string; fuzzyCorrection?: FuzzyCorrection } {
  for (const s of ALL_SPORTS) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(norm)) {
      return { sport: s };
    }
  }

  const words = norm.split(' ');
  for (const w of words) {
    if (PHONETIC_SPORT_CORRECTIONS[w]) {
      const corrected = PHONETIC_SPORT_CORRECTIONS[w];
      return {
        sport: corrected,
        fuzzyCorrection: {
          original: w,
          corrected,
          entityType: 'sport',
        },
      };
    }
  }

  for (const w of words) {
    if (w.length >= 5) {
      const best = findBestFuzzyMatch(w, ALL_SPORTS, 2);
      if (best && best.distance > 0) {
        return {
          sport: best.match,
          fuzzyCorrection: {
            original: w,
            corrected: best.match,
            entityType: 'sport',
          },
        };
      }
    }
  }

  return {};
}

export function resolveCollegeAndAliases(norm: string): { college?: string; fuzzyCorrection?: FuzzyCorrection } {
  for (const [key, meta] of Object.entries(KNOWN_COLLEGES)) {
    for (const alias of meta.aliases) {
      if (new RegExp(`\\b${alias}\\b`, 'i').test(norm)) {
        return {
          college: key,
          fuzzyCorrection:
            alias !== key.toLowerCase() && alias !== meta.code.toLowerCase()
              ? { original: alias, corrected: key, entityType: 'college' }
              : undefined,
        };
      }
    }
  }

  // Exclude common English prepositions/pronouns/question words from fuzzy college matching
  const stopWords = new Set(['who', 'what', 'when', 'the', 'for', 'top', 'win', 'won', 'are', 'and', 'all', 'last', 'day', 'mvp', 'has', 'his', 'her']);
  const words = norm.split(' ');
  const collegeCodes = Object.keys(KNOWN_COLLEGES);
  for (const w of words) {
    if (stopWords.has(w)) continue;
    if (w.length >= 2 && w.length <= 5) {
      const best = findBestFuzzyMatch(w.toUpperCase(), collegeCodes, 1);
      if (best && best.distance > 0) {
        return {
          college: best.match,
          fuzzyCorrection: {
            original: w,
            corrected: best.match,
            entityType: 'college',
          },
        };
      }
    }
  }

  return {};
}

// ==========================================
// 6. Semantic Intent Parser & Natural Language Understanding
// ==========================================

export function parseNaturalVoiceQuery(rawTranscript: string): SmartVoiceAnalysis {
  const norm = normalizeText(rawTranscript);
  const temporal = resolveTemporalWindow(norm);
  const { sport, fuzzyCorrection: sportFuzzy } = resolveSportAndFuzzy(norm);
  const { college, fuzzyCorrection: collegeFuzzy } = resolveCollegeAndAliases(norm);
  const fuzzy = sportFuzzy || collegeFuzzy;

  // ----------------------------------------------------
  // A. TOP-N & VAGUE INTERROGATIVE QUESTIONS
  // ----------------------------------------------------

  // A1. Top N Highest Scoring Players ("What's the top 3 highest scoring player?", "top scorers", "most points")
  const asksAboutScorers =
    norm.includes('scoring player') ||
    norm.includes('highest scoring') ||
    norm.includes('top scorer') ||
    norm.includes('top scorers') ||
    norm.includes('best scorer') ||
    norm.includes('most points') ||
    ((norm.includes('scorer') || norm.includes('scoring')) &&
      (norm.includes('player') || norm.includes('athlete') || norm.includes('top') || norm.includes('highest')));

  if (asksAboutScorers) {
    const topN = extractTopNLimit(norm, 3);
    const sportSuffix = sport ? ` in ${sport.toUpperCase()}` : '';
    return {
      rawTranscript,
      intent: 'question_top_scorers',
      sport,
      topN,
      entityTarget: 'players',
      fuzzyCorrection: fuzzy,
      spokenResponse: `Analyzing match scoring logs to find the top ${topN} highest scoring players${sportSuffix}...`,
      targetRoute: `/athletics?sort=points`,
      confidence: 0.97,
    };
  }

  // A2. Top N Highest Win Rate Tribes / Clusters / Squads ("What's the top 5 highest win rate tribes or squads?")
  const mentionsTribe = norm.includes('tribe') || norm.includes('tribo') || norm.includes('cluster');
  const mentionsSquad = norm.includes('squad') || norm.includes('team');
  const asksWinRateOrTopEntity =
    (mentionsTribe || mentionsSquad) &&
    (norm.includes('win rate') ||
      norm.includes('winning') ||
      norm.includes('highest') ||
      norm.includes('top') ||
      norm.includes('best') ||
      norm.includes('ranking') ||
      norm.includes('rate'));

  if (asksWinRateOrTopEntity || (norm.includes('win rate') && !norm.includes('player') && !norm.includes('athlete'))) {
    const topN = extractTopNLimit(norm, 5);
    const entityTarget =
      mentionsTribe && mentionsSquad
        ? 'both'
        : mentionsTribe
        ? 'tribes'
        : mentionsSquad
        ? 'squads'
        : 'both';
    const labelText =
      entityTarget === 'tribes' ? 'tribes' : entityTarget === 'squads' ? 'squads' : 'tribes and squads';

    return {
      rawTranscript,
      intent: 'question_tribe_squad_win_rate',
      sport,
      topN,
      entityTarget,
      fuzzyCorrection: fuzzy,
      spokenResponse: `Calculating tournament match records for the top ${topN} highest win rate ${labelText}...`,
      targetRoute: `/ranking?tab=win_rate`,
      confidence: 0.97,
    };
  }

  // A3. Question: "Who won last week / last year / recent match / in basketball?"
  if (
    norm.startsWith('who won') ||
    norm.startsWith('who is the winner') ||
    norm.includes('who won') ||
    norm.includes('who is the champion') ||
    norm.includes('who was the champion') ||
    norm.includes('winner last') ||
    norm.includes('who won the game') ||
    norm.includes('champions last year')
  ) {
    const resolvedTime = temporal || {
      type: 'last_week',
      label: 'Last Week',
      expectedStatus: 'Completed' as const,
    };
    const sportLabel = sport ? ` in ${sport.toUpperCase()}` : '';
    return {
      rawTranscript,
      intent: 'question_winner',
      sport,
      temporalWindow: resolvedTime,
      fuzzyCorrection: fuzzy,
      spokenResponse: `Checking tournament match records to find who won${sportLabel} ${resolvedTime.label.toLowerCase()}...`,
      targetRoute: `/search?q=${encodeURIComponent(rawTranscript)}&type=matches`,
      confidence: 0.97,
    };
  }

  // A4. Question: "Who is the highest rated college right now?" / "Which college is leading?"
  if (
    norm.includes('highest rated college') ||
    norm.includes('top college') ||
    norm.includes('leading college') ||
    norm.includes('number one college') ||
    norm.includes('highest ranking college') ||
    norm.includes('best college') ||
    (norm.includes('who is') && norm.includes('highest') && norm.includes('college'))
  ) {
    return {
      rawTranscript,
      intent: 'question_top_college',
      college,
      fuzzyCorrection: fuzzy,
      spokenResponse: 'Analyzing university medal standings to identify the highest rated college...',
      targetRoute: '/ranking',
      confidence: 0.98,
    };
  }

  // A5. Question: "Search for highest MVP" / "Who has the most MVPs / stars?"
  if (
    norm.includes('highest mvp') ||
    norm.includes('top mvp') ||
    norm.includes('who is the mvp') ||
    norm.includes('most stars') ||
    norm.includes('highest stars') ||
    norm.includes('gold stars') ||
    norm.includes('star leader')
  ) {
    return {
      rawTranscript,
      intent: 'question_highest_mvp',
      fuzzyCorrection: fuzzy,
      spokenResponse: 'Evaluating collegiate star accolades to find the leading MVP athlete...',
      targetRoute: '/ranking?tab=stars',
      confidence: 0.96,
    };
  }

  // A6. Question: "Search for player with highest win rate"
  if (
    norm.includes('highest win rate') ||
    norm.includes('best win rate') ||
    norm.includes('top win rate') ||
    norm.includes('most wins player')
  ) {
    const topN = extractTopNLimit(norm, 1);
    return {
      rawTranscript,
      intent: 'question_highest_win_rate',
      sport,
      topN,
      fuzzyCorrection: fuzzy,
      spokenResponse: 'Calculating athletic match win rates across tournament rosters...',
      targetRoute: '/athletics?sort=win_rate',
      confidence: 0.95,
    };
  }

  // ----------------------------------------------------
  // B. DIRECT NAVIGATION SHORTCUTS
  // ----------------------------------------------------
  if (
    norm.startsWith('go to') ||
    norm.startsWith('open') ||
    norm.startsWith('navigate to') ||
    norm.startsWith('take me to')
  ) {
    if (norm.includes('ranking') || norm.includes('standings') || norm.includes('medals')) {
      return {
        rawTranscript,
        intent: 'navigation',
        targetRoute: '/ranking',
        spokenResponse: 'Navigating to College Standings and Medal Rankings.',
        confidence: 0.99,
      };
    }
    if (norm.includes('tournament') || norm.includes('explorer') || norm.includes('bracket')) {
      return {
        rawTranscript,
        intent: 'navigation',
        targetRoute: '/explorer',
        spokenResponse: 'Navigating to Tournament Explorer.',
        confidence: 0.99,
      };
    }
    if (norm.includes('athletics') || norm.includes('scouting') || norm.includes('roster')) {
      return {
        rawTranscript,
        intent: 'navigation',
        targetRoute: '/athletics',
        spokenResponse: 'Navigating to Athletics Scouting Hub.',
        confidence: 0.99,
      };
    }
    if (norm.includes('home') || norm.includes('dashboard')) {
      return {
        rawTranscript,
        intent: 'navigation',
        targetRoute: '/',
        spokenResponse: 'Navigating to PSU SportsTrack Home.',
        confidence: 0.99,
      };
    }
    if (norm.includes('search') || norm.includes('query')) {
      return {
        rawTranscript,
        intent: 'navigation',
        targetRoute: '/search',
        spokenResponse: 'Opening Dedicated Voice Query Search Hub.',
        confidence: 0.99,
      };
    }
  }

  // ----------------------------------------------------
  // C. CONVERSATIONAL MATCH & FIXTURE FILTERS (Vague / Temporal)
  // e.g. "What's the last matches from basketball this last week?"
  //      "What's the upcoming games for this month / this day / this week?"
  // ----------------------------------------------------
  if (
    norm.includes('game') ||
    norm.includes('games') ||
    norm.includes('match') ||
    norm.includes('matches') ||
    norm.includes('fixture') ||
    temporal ||
    sport
  ) {
    const sportName = sport ? sport.toUpperCase() : 'all sports';
    const timeName = temporal ? temporal.label : '';

    let spoken = `Searching match fixtures for ${sportName}`;
    if (timeName) spoken += ` (${timeName})`;

    const queryParts: string[] = [];
    if (sport) queryParts.push(sport);
    if (temporal) queryParts.push(temporal.type);

    return {
      rawTranscript,
      intent: 'filter_matches',
      sport,
      college,
      temporalWindow: temporal,
      fuzzyCorrection: fuzzy,
      spokenResponse: `${spoken}.`,
      targetRoute: `/search?q=${encodeURIComponent(rawTranscript)}&type=matches`,
      confidence: 0.92,
    };
  }

  // ----------------------------------------------------
  // D. ATHLETE & PLAYER SEARCH
  // ----------------------------------------------------
  const playerMatch = norm.match(/(?:player|players|athlete|athletes|search for player)\s+(.*)/i);
  if (playerMatch && playerMatch[1]) {
    const rawName = playerMatch[1].replace(/^(?:named|with|for|in)\s+/i, '').trim();
    return {
      rawTranscript,
      intent: 'filter_players',
      playerName: rawName,
      fuzzyCorrection: fuzzy,
      spokenResponse: `Searching athletic records for player ${rawName}.`,
      targetRoute: `/search?q=${encodeURIComponent(rawName)}&type=players`,
      confidence: 0.94,
    };
  }

  // ----------------------------------------------------
  // E. COLLEGES & CAMPUSES SEARCH
  // ----------------------------------------------------
  if (college || norm.includes('college') || norm.includes('colleges') || norm.includes('campus')) {
    const colName = college || 'Colleges';
    return {
      rawTranscript,
      intent: 'filter_colleges',
      college: colName,
      fuzzyCorrection: fuzzy,
      spokenResponse: `Searching collegiate standings and rosters for ${colName}.`,
      targetRoute: `/search?q=${encodeURIComponent(colName)}&type=colleges`,
      confidence: 0.93,
    };
  }

  // ----------------------------------------------------
  // F. GENERAL FALLBACK SEARCH
  // ----------------------------------------------------
  return {
    rawTranscript,
    intent: 'general',
    fuzzyCorrection: fuzzy,
    spokenResponse: `Searching sports records and fixtures for "${rawTranscript}".`,
    targetRoute: `/search?q=${encodeURIComponent(rawTranscript)}`,
    confidence: 0.8,
  };
}

// ==========================================
// 7. Direct Analytical Query Execution & Synthesis
// ==========================================

function isMatchInTemporalWindow(match: any, tw?: TemporalWindow): boolean {
  if (!tw) return true;
  if (tw.expectedStatus && tw.expectedStatus !== 'any' && match.status !== tw.expectedStatus) {
    return false;
  }
  const effectiveDateStr = match.match_time || match.created_at;
  if (!effectiveDateStr) return !tw.startDate;
  if (tw.startDate && tw.endDate) {
    const ts = new Date(effectiveDateStr).getTime();
    const startTs = new Date(tw.startDate).getTime();
    const endTs = new Date(tw.endDate).getTime();
    return ts >= startTs && ts <= endTs;
  }
  return true;
}

export async function executeSmartVoiceQuery(analysis: SmartVoiceAnalysis): Promise<{
  analysis: SmartVoiceAnalysis;
  directAnswer?: DirectAnswerData;
  items: any[];
  isFallback?: boolean;
  fallbackMessage?: string;
  autoCorrectedNotice?: string;
}> {
  try {
    // ---------------------------------------------------------
    // 1. Top N Highest Scoring Players
    // ---------------------------------------------------------
    if (analysis.intent === 'question_top_scorers') {
      const topN = analysis.topN || 3;
      const [summaries, usersRes] = await Promise.all([
        fetchBatchPlayerSummaries(),
        supabase
          .from('users')
          .select('id, full_name, role, college:colleges!users_college_id_fkey(college_name)')
          .limit(300),
      ]);

      const usersMap = new Map<string, { name: string; college: string }>();
      for (const u of (usersRes.data || []) as any[]) {
        const colObj: any = Array.isArray(u.college) ? u.college[0] : u.college;
        usersMap.set(u.id, {
          name: u.full_name || 'Athlete',
          college: colObj?.college_name || 'PSU Athlete',
        });
      }

      let playerRows = Object.values(summaries)
        .filter((s) => usersMap.has(s.playerId))
        .map((s) => {
          const meta = usersMap.get(s.playerId)!;
          return {
            id: s.playerId,
            full_name: meta.name,
            collegeName: meta.college,
            totalPoints: s.totalPoints,
            ppg: s.ppg,
            gamesPlayed: s.gamesPlayed,
            activeSports: s.activeSports,
            mvpScore: s.goldStars * 3 + s.redStars,
          };
        });

      if (analysis.sport) {
        const targetSport = analysis.sport.toLowerCase();
        const filtered = playerRows.filter((p) =>
          p.activeSports.some((sp) => sp.toLowerCase().includes(targetSport))
        );
        if (filtered.length > 0) playerRows = filtered;
      }

      playerRows.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.ppg !== a.ppg) return b.ppg - a.ppg;
        return b.mvpScore - a.mvpScore;
      });

      const topList = playerRows.slice(0, topN);
      const leaderboard: LeaderboardRow[] = topList.map((p, idx) => ({
        rank: idx + 1,
        name: p.full_name,
        subtitle: `${p.collegeName} (${p.activeSports[0] || 'Multi-Sport'})`,
        metricValue: `${p.totalPoints} PTS`,
        metricLabel: `${p.ppg} PPG across ${p.gamesPlayed} games`,
        route: '/athletics',
      }));

      const spokenList = topList
        .slice(0, 3)
        .map((p, i) => `number ${i + 1} ${p.full_name} with ${p.totalPoints} points`)
        .join(', ');

      const directAnswer: DirectAnswerData = {
        title: `Top ${topN} Highest Scoring Players${analysis.sport ? ` (${analysis.sport.toUpperCase()})` : ''}`,
        headline:
          topList.length > 0
            ? `Led by ${topList[0].full_name} (${topList[0].totalPoints} Total Points)`
            : 'No player scoring telemetry recorded yet',
        details:
          topList.length > 0
            ? `Aggregated from verified live match box scores across ${topList[0].gamesPlayed || 1}+ tournament fixtures.`
            : 'Record player points in live matches to populate scoring leaders.',
        badge: `Top ${topList.length || topN} Scorers`,
        badgeVariant: 'warning',
        metricValue: topList[0] ? `${topList[0].totalPoints} PTS` : '0 PTS',
        metricLabel: topList[0] ? `${topList[0].ppg} PPG Avg` : 'No data',
        entityRoute: '/athletics',
        leaderboard,
      };

      const spoken =
        topList.length > 0
          ? `The top ${topList.length} highest scoring players are ${spokenList}.`
          : 'No player scoring stats have been recorded in tournament matches yet.';

      return {
        analysis: {
          ...analysis,
          spokenResponse: spoken,
          directAnswer,
        },
        directAnswer,
        items: topList,
      };
    }

    // ---------------------------------------------------------
    // 2. Top N Highest Win Rate Tribes / Clusters / Squads
    // ---------------------------------------------------------
    if (analysis.intent === 'question_tribe_squad_win_rate') {
      const topN = analysis.topN || 5;
      const target = analysis.entityTarget || 'both';

      const [clustersRes, collegesRes, teamsRes, matchesRes] = await Promise.all([
        supabase.from('clusters').select('id, name, description, college_codes, color'),
        supabase.from('colleges').select('id, college_name'),
        supabase
          .from('teams')
          .select('id, name, college_id, cluster_id, status, is_deleted')
          .eq('status', 'Approved')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('matches')
          .select('id, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, round, is_deleted')
          .eq('status', 'Completed')
          .or('is_deleted.is.null,is_deleted.eq.false'),
      ]);

      const clusters = (clustersRes.data || []) as any[];
      const colleges = (collegesRes.data || []) as any[];
      const teams = (teamsRes.data || []) as any[];
      const completedMatches = (matchesRes.data || []).filter(
        (m: any) => !String(m.round || '').startsWith('[ARCHIVED]')
      );

      const collegesMap = new Map(colleges.map((c) => [c.id, c.college_name as string]));
      const teamStats = new Map<string, { id: string; name: string; kind: 'Squad'; wins: number; losses: number; played: number; subtitle: string }>();
      const tribeStats = new Map<string, { id: string; name: string; kind: 'Tribe'; wins: number; losses: number; played: number; subtitle: string }>();

      clusters.forEach((cl) => {
        tribeStats.set(cl.id, {
          id: cl.id,
          name: cl.name,
          kind: 'Tribe',
          wins: 0,
          losses: 0,
          played: 0,
          subtitle: cl.description || `Codes: ${(cl.college_codes || []).join(', ')}`,
        });
      });

      const resolveTeamTribeId = (team: any): string | null => {
        if (!team) return null;
        if (team.cluster_id && tribeStats.has(team.cluster_id)) return team.cluster_id;
        const colName = team.college_id ? collegesMap.get(team.college_id) || '' : team.name || '';
        const code = extractCollegeCode(colName).toUpperCase();
        const found = clusters.find(
          (cl) => Array.isArray(cl.college_codes) && cl.college_codes.some((c: string) => c.toUpperCase() === code)
        );
        return found ? found.id : null;
      };

      const teamsById = new Map(teams.map((t) => [t.id, t]));
      teams.forEach((t) => {
        const colName = t.college_id ? collegesMap.get(t.college_id) : undefined;
        teamStats.set(t.id, {
          id: t.id,
          name: t.name,
          kind: 'Squad',
          wins: 0,
          losses: 0,
          played: 0,
          subtitle: colName || 'Collegiate Squad',
        });
      });

      for (const m of completedMatches as any[]) {
        if (!m.team_a_id || !m.team_b_id) continue;
        const sA = Number(m.team_a_score || 0);
        const sB = Number(m.team_b_score || 0);
        const aWon = m.winner_team_id ? m.winner_team_id === m.team_a_id : sA > sB;
        const bWon = m.winner_team_id ? m.winner_team_id === m.team_b_id : sB > sA;

        const sqA = teamStats.get(m.team_a_id);
        if (sqA) {
          sqA.played += 1;
          if (aWon) sqA.wins += 1;
          else if (bWon) sqA.losses += 1;
        }
        const sqB = teamStats.get(m.team_b_id);
        if (sqB) {
          sqB.played += 1;
          if (bWon) sqB.wins += 1;
          else if (aWon) sqB.losses += 1;
        }

        const trAId = resolveTeamTribeId(teamsById.get(m.team_a_id));
        const trBId = resolveTeamTribeId(teamsById.get(m.team_b_id));
        if (trAId && tribeStats.has(trAId) && trAId !== trBId) {
          const trA = tribeStats.get(trAId)!;
          trA.played += 1;
          if (aWon) trA.wins += 1;
          else if (bWon) trA.losses += 1;
        }
        if (trBId && tribeStats.has(trBId) && trAId !== trBId) {
          const trB = tribeStats.get(trBId)!;
          trB.played += 1;
          if (bWon) trB.wins += 1;
          else if (aWon) trB.losses += 1;
        }
      }

      const pool: Array<{ id: string; name: string; kind: 'Tribe' | 'Squad'; wins: number; losses: number; played: number; winRate: number; subtitle: string }> = [];
      if (target === 'tribes' || target === 'both') {
        tribeStats.forEach((entry) => {
          pool.push({
            ...entry,
            winRate: entry.played > 0 ? Math.round((entry.wins / entry.played) * 100) : 0,
          });
        });
      }
      if (target === 'squads' || target === 'both') {
        teamStats.forEach((entry) => {
          pool.push({
            ...entry,
            winRate: entry.played > 0 ? Math.round((entry.wins / entry.played) * 100) : 0,
          });
        });
      }

      // Prioritize active competitors with played matches, sorted by win rate desc then total wins desc
      pool.sort((a, b) => {
        const aHasPlayed = a.played > 0 ? 1 : 0;
        const bHasPlayed = b.played > 0 ? 1 : 0;
        if (bHasPlayed !== aHasPlayed) return bHasPlayed - aHasPlayed;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });

      const topList = pool.slice(0, topN);
      const leaderboard: LeaderboardRow[] = topList.map((row, idx) => ({
        rank: idx + 1,
        name: row.name,
        subtitle: `${row.kind} • ${row.subtitle}`,
        metricValue: `${row.winRate}%`,
        metricLabel: `${row.wins}W - ${row.losses}L (${row.played} GP)`,
        route: '/ranking',
      }));

      const spokenTop = topList
        .slice(0, 3)
        .map((r, i) => `number ${i + 1} ${r.name} at ${r.winRate}%`)
        .join(', ');

      const directAnswer: DirectAnswerData = {
        title: `Top ${topN} Highest Win Rate ${target === 'tribes' ? 'Tribes' : target === 'squads' ? 'Squads' : 'Tribes & Squads'}`,
        headline: topList[0]
          ? `#1 ${topList[0].name} (${topList[0].winRate}% Win Rate)`
          : 'No completed match standings available',
        details: topList[0]
          ? `${topList[0].kind} • ${topList[0].wins} Wins, ${topList[0].losses} Losses across ${topList[0].played} completed matches.`
          : 'Complete matches to compute win rate percentages.',
        badge: `Top ${topList.length || topN} Win Rate`,
        badgeVariant: 'success',
        metricValue: topList[0] ? `${topList[0].winRate}%` : '0%',
        metricLabel: topList[0] ? `${topList[0].wins}W - ${topList[0].losses}L` : '0 GP',
        entityRoute: '/ranking',
        leaderboard,
      };

      const spoken = topList.length > 0
        ? `The top ${topList.length} highest win rate ${target === 'tribes' ? 'tribes' : target === 'squads' ? 'squads' : 'tribes and squads'} are ${spokenTop}.`
        : 'No completed match standings are available yet.';

      return {
        analysis: {
          ...analysis,
          spokenResponse: spoken,
          directAnswer,
        },
        directAnswer,
        items: topList,
      };
    }

    // ---------------------------------------------------------
    // 3. Analytical Question: "Who won last week / last year?"
    // ---------------------------------------------------------
    if (analysis.intent === 'question_winner') {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          round,
          venue,
          match_time,
          created_at,
          team_a_score,
          team_b_score,
          winner_team_id,
          team_a:teams!matches_team_a_id_fkey(id, name),
          team_b:teams!matches_team_b_id_fkey(id, name),
          tournament:tournaments!matches_tournament_id_fkey(id, name, sport)
        `)
        .eq('status', 'Completed')
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;

      let matches = (data || []).filter((m: any) => isMatchInTemporalWindow(m, analysis.temporalWindow));
      if (analysis.sport) {
        const lowerSport = analysis.sport.toLowerCase();
        matches = matches.filter((m: any) => {
          const tObj = Array.isArray(m.tournament) ? m.tournament[0] : m.tournament;
          return tObj?.sport?.toLowerCase().includes(lowerSport);
        });
      }

      let isFallback = false;
      let fallbackMessage = '';

      // Smart Fallback: If 0 matches found in window, show latest completed results
      if (matches.length === 0) {
        isFallback = true;
        fallbackMessage = `No completed matches were recorded for ${analysis.temporalWindow?.label || 'that period'}. Showing the most recent championship results.`;
        matches = data || [];
        if (analysis.sport) {
          const lowerSport = analysis.sport.toLowerCase();
          const sportFiltered = matches.filter((m: any) => {
            const tObj = Array.isArray(m.tournament) ? m.tournament[0] : m.tournament;
            return tObj?.sport?.toLowerCase().includes(lowerSport);
          });
          if (sportFiltered.length > 0) matches = sportFiltered;
        }
        matches = matches.slice(0, 6);
      }

      if (matches.length > 0) {
        const topMatch: any = matches[0];
        const teamAObj: any = Array.isArray(topMatch.team_a) ? topMatch.team_a[0] : topMatch.team_a;
        const teamBObj: any = Array.isArray(topMatch.team_b) ? topMatch.team_b[0] : topMatch.team_b;
        const tournObj: any = Array.isArray(topMatch.tournament) ? topMatch.tournament[0] : topMatch.tournament;

        const teamA = teamAObj?.name || 'Team A';
        const teamB = teamBObj?.name || 'Team B';
        const scoreA = topMatch.team_a_score ?? 0;
        const scoreB = topMatch.team_b_score ?? 0;
        const winner = scoreA >= scoreB ? teamA : teamB;
        const loser = scoreA >= scoreB ? teamB : teamA;
        const winScore = Math.max(scoreA, scoreB);
        const loseScore = Math.min(scoreA, scoreB);
        const sportName = tournObj?.sport || 'Match';
        const round = topMatch.round || 'Final';
        const tournName = tournObj?.name || sportName;

        const headline = `${winner} defeated ${loser} (${winScore} - ${loseScore})`;
        const spoken = isFallback
          ? `${fallbackMessage} In the most recent completed game, ${winner} won against ${loser} ${winScore} to ${loseScore} in ${sportName}.`
          : `In ${analysis.temporalWindow?.label || 'last week'}, ${winner} won against ${loser} ${winScore} to ${loseScore} in ${sportName} ${round}.`;

        const directAnswer: DirectAnswerData = {
          title: `Match Winner (${sportName})`,
          headline,
          details: `${tournName} • ${round} • Venue: ${topMatch.venue || 'Main Gymnasium'}`,
          badge: isFallback ? 'Recent Match Fallback' : 'Verified Winner',
          badgeVariant: 'success',
          metricValue: `${winScore} - ${loseScore}`,
          metricLabel: 'Final Score',
          entityRoute: `/match/${topMatch.id}`,
        };

        return {
          analysis: {
            ...analysis,
            spokenResponse: spoken,
            directAnswer,
          },
          directAnswer,
          items: matches.slice(0, 6),
          isFallback,
          fallbackMessage,
        };
      }

      return {
        analysis: {
          ...analysis,
          spokenResponse: 'No completed match records were found in the database.',
        },
        items: [],
      };
    }

    // ---------------------------------------------------------
    // 4. Analytical Question: "Who is the highest rated college right now?"
    // ---------------------------------------------------------
    if (analysis.intent === 'question_top_college') {
      const [colRes, matchRes] = await Promise.all([
        supabase.from('colleges').select('id, college_name'),
        supabase
          .from('matches')
          .select(`
            id,
            status,
            round,
            team_a_score,
            team_b_score,
            winner_team_id,
            team_a:teams!matches_team_a_id_fkey(id, college_id),
            team_b:teams!matches_team_b_id_fkey(id, college_id)
          `)
          .eq('status', 'Completed'),
      ]);

      const colleges = colRes.data || [];
      const matches = matchRes.data || [];

      const scoreMap = new Map<string, { id: string; name: string; wins: number; finalsWins: number }>();
      colleges.forEach((c) => {
        scoreMap.set(c.id, { id: c.id, name: c.college_name, wins: 0, finalsWins: 0 });
      });

      matches.forEach((m: any) => {
        const sA = m.team_a_score || 0;
        const sB = m.team_b_score || 0;
        const teamAObj: any = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
        const teamBObj: any = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
        const winnerCollegeId = sA >= sB ? teamAObj?.college_id : teamBObj?.college_id;
        if (winnerCollegeId && scoreMap.has(winnerCollegeId)) {
          const entry = scoreMap.get(winnerCollegeId)!;
          entry.wins += 1;
          const r = (m.round || '').toLowerCase();
          if (r.includes('final') || r.includes('championship')) {
            entry.finalsWins += 1;
          }
        }
      });

      const ranked = Array.from(scoreMap.values()).sort(
        (a, b) => b.finalsWins * 5 + b.wins - (a.finalsWins * 5 + a.wins)
      );

      const topCollege = ranked[0] || { name: 'CET (Engineering)', wins: 0, finalsWins: 0 };
      const leaderboard: LeaderboardRow[] = ranked.slice(0, 3).map((c, idx) => ({
        rank: idx + 1,
        name: c.name,
        subtitle: `${c.finalsWins} Championship Titles`,
        metricValue: `${c.wins} Wins`,
        route: '/ranking',
      }));

      const spoken = `The highest rated college right now is ${topCollege.name}, leading the university standings with ${topCollege.finalsWins} championship titles and ${topCollege.wins} match victories.`;

      const directAnswer: DirectAnswerData = {
        title: 'Highest Rated College (#1 Standings)',
        headline: topCollege.name,
        details: `Overall university leader with ${topCollege.finalsWins} Gold Championships and ${topCollege.wins} total match victories.`,
        badge: 'Rank #1 Overall',
        badgeVariant: 'warning',
        metricValue: `${topCollege.finalsWins} Golds`,
        metricLabel: `${topCollege.wins} Total Wins`,
        entityRoute: '/ranking',
        leaderboard,
      };

      return {
        analysis: {
          ...analysis,
          spokenResponse: spoken,
          directAnswer,
        },
        directAnswer,
        items: ranked.slice(0, 5),
      };
    }

    // ---------------------------------------------------------
    // 5. Analytical Question: "Search for highest MVP / most stars"
    // ---------------------------------------------------------
    if (analysis.intent === 'question_highest_mvp') {
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
        .limit(100);

      if (error) throw error;

      const starMap = new Map<string, { id: string; name: string; college: string; gold: number; red: number }>();
      (data || []).forEach((row: any) => {
        const u = Array.isArray(row.user) ? row.user[0] : row.user;
        if (!u) return;
        const colObj = Array.isArray(u.college) ? u.college[0] : u.college;
        const entry = starMap.get(u.id) || {
          id: u.id,
          name: u.full_name || 'Athlete',
          college: colObj?.college_name || 'PSU College',
          gold: 0,
          red: 0,
        };
        if (row.star_type === 'Gold') entry.gold += 1;
        else entry.red += 1;
        starMap.set(u.id, entry);
      });

      const leaderList = Array.from(starMap.values()).sort(
        (a, b) => b.gold * 3 + b.red - (a.gold * 3 + a.red)
      );

      const topMvp = leaderList[0] || {
        name: 'No MVP Stars Awarded Yet',
        college: 'PSU Athletics',
        gold: 0,
        red: 0,
      };

      const leaderboard: LeaderboardRow[] = leaderList.slice(0, 3).map((m, idx) => ({
        rank: idx + 1,
        name: m.name,
        subtitle: m.college,
        metricValue: `${m.gold}G / ${m.red}R`,
        metricLabel: 'MVP Stars',
        route: '/ranking',
      }));

      const spoken = leaderList.length > 0
        ? `The leading MVP athlete right now is ${topMvp.name} from ${topMvp.college}, holding ${topMvp.gold} Gold Stars and ${topMvp.red} Red Stars.`
        : 'No MVP stars have been awarded in tournaments yet.';

      const directAnswer: DirectAnswerData = {
        title: 'MVP Star Leaderboard Leader',
        headline: topMvp.name,
        details: `${topMvp.college} • Standout Athlete Leader`,
        badge: 'Top University MVP',
        badgeVariant: 'warning',
        metricValue: `${topMvp.gold} Gold`,
        metricLabel: `${topMvp.red} Red Stars`,
        entityRoute: '/ranking',
        leaderboard,
      };

      return {
        analysis: {
          ...analysis,
          spokenResponse: spoken,
          directAnswer,
        },
        directAnswer,
        items: leaderList.slice(0, 5),
      };
    }

    // ---------------------------------------------------------
    // 6. Analytical Question: "Player with highest win rate" (Real Match W/L)
    // ---------------------------------------------------------
    if (analysis.intent === 'question_highest_win_rate') {
      const topN = analysis.topN || 1;
      const [rosterRes, matchesRes, usersRes] = await Promise.all([
        supabase.from('team_roster').select('player_id, team_id, status').eq('status', 'Approved'),
        supabase.from('matches').select('id, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id').eq('status', 'Completed'),
        supabase.from('users').select('id, full_name, role, college:colleges!users_college_id_fkey(college_name)').limit(300),
      ]);

      const usersMap = new Map<string, { name: string; college: string }>();
      for (const u of (usersRes.data || []) as any[]) {
        const colObj: any = Array.isArray(u.college) ? u.college[0] : u.college;
        usersMap.set(u.id, {
          name: u.full_name || 'Athlete',
          college: colObj?.college_name || 'PSU Athlete',
        });
      }

      const teamWL = new Map<string, { wins: number; played: number }>();
      for (const m of (matchesRes.data || []) as any[]) {
        if (!m.team_a_id || !m.team_b_id) continue;
        const sA = Number(m.team_a_score || 0);
        const sB = Number(m.team_b_score || 0);
        const aWon = m.winner_team_id ? m.winner_team_id === m.team_a_id : sA > sB;
        const bWon = m.winner_team_id ? m.winner_team_id === m.team_b_id : sB > sA;

        const rA = teamWL.get(m.team_a_id) || { wins: 0, played: 0 };
        rA.played += 1;
        if (aWon) rA.wins += 1;
        teamWL.set(m.team_a_id, rA);

        const rB = teamWL.get(m.team_b_id) || { wins: 0, played: 0 };
        rB.played += 1;
        if (bWon) rB.wins += 1;
        teamWL.set(m.team_b_id, rB);
      }

      const playerWL = new Map<string, { id: string; name: string; college: string; wins: number; totalMatches: number }>();
      for (const r of (rosterRes.data || []) as any[]) {
        const meta = usersMap.get(r.player_id);
        const wl = teamWL.get(r.team_id);
        if (!meta || !wl) continue;
        const entry = playerWL.get(r.player_id) || {
          id: r.player_id,
          name: meta.name,
          college: meta.college,
          wins: 0,
          totalMatches: 0,
        };
        entry.wins += wl.wins;
        entry.totalMatches += wl.played;
        playerWL.set(r.player_id, entry);
      }

      const players = Array.from(playerWL.values())
        .map((p) => ({
          ...p,
          winRate: p.totalMatches > 0 ? Math.round((p.wins / p.totalMatches) * 100) : 0,
        }))
        .sort((a, b) => {
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          return b.wins - a.wins;
        });

      const topPlayer = players[0] || { name: 'No Completed Roster Matches', college: 'PSU Athletics', winRate: 0, wins: 0, totalMatches: 0 };
      const leaderboard: LeaderboardRow[] = players.slice(0, Math.max(3, topN)).map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        subtitle: p.college,
        metricValue: `${p.winRate}%`,
        metricLabel: `${p.wins}W - ${p.totalMatches - p.wins}L`,
        route: '/athletics',
      }));

      const spoken = players.length > 0
        ? `The player with the highest win rate is ${topPlayer.name} from ${topPlayer.college} with a ${topPlayer.winRate}% win rate across ${topPlayer.totalMatches} completed matches.`
        : 'No completed match roster win rates are recorded yet.';

      const directAnswer: DirectAnswerData = {
        title: 'Highest Athletic Win Rate',
        headline: topPlayer.name,
        details: `${topPlayer.college} • ${topPlayer.wins} Wins out of ${topPlayer.totalMatches} Matches Played`,
        badge: 'Win Rate Leader',
        badgeVariant: 'success',
        metricValue: `${topPlayer.winRate}%`,
        metricLabel: `${topPlayer.wins}W - ${Math.max(0, topPlayer.totalMatches - topPlayer.wins)}L`,
        entityRoute: '/athletics',
        leaderboard,
      };

      return {
        analysis: {
          ...analysis,
          spokenResponse: spoken,
          directAnswer,
        },
        directAnswer,
        items: players.slice(0, 5),
      };
    }

    // ---------------------------------------------------------
    // 7. Match Filter Queries (Temporal + Sport + Status with Summary)
    // ---------------------------------------------------------
    const { data: rawMatches, error: matchErr } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        round,
        venue,
        match_time,
        created_at,
        team_a_score,
        team_b_score,
        team_a:teams!matches_team_a_id_fkey(id, name),
        team_b:teams!matches_team_b_id_fkey(id, name),
        tournament:tournaments!matches_tournament_id_fkey(id, name, sport)
      `)
      .order('created_at', { ascending: false })
      .limit(80);

    if (matchErr) throw matchErr;

    let items = (rawMatches || []) as any[];

    if (analysis.temporalWindow) {
      items = items.filter((m) => isMatchInTemporalWindow(m, analysis.temporalWindow));
    }

    if (analysis.sport) {
      const lowerSport = analysis.sport.toLowerCase();
      items = items.filter((m) => {
        const tObj = Array.isArray(m.tournament) ? m.tournament[0] : m.tournament;
        return tObj?.sport?.toLowerCase().includes(lowerSport);
      });
    }

    let isFallback = false;
    let fallbackMessage = '';

    // Smart Temporal Fallback: If 0 items found in exact window, show latest matching sport/status games
    if (items.length === 0 && analysis.temporalWindow) {
      isFallback = true;
      fallbackMessage = `No matches found strictly within ${analysis.temporalWindow.label}. Displaying the closest ${analysis.sport ? analysis.sport + ' ' : ''}fixtures.`;

      let fallbackPool = (rawMatches || []) as any[];
      if (analysis.temporalWindow.expectedStatus && analysis.temporalWindow.expectedStatus !== 'any') {
        const statusFiltered = fallbackPool.filter(
          (m) => m.status === analysis.temporalWindow!.expectedStatus
        );
        if (statusFiltered.length > 0) fallbackPool = statusFiltered;
      }
      if (analysis.sport) {
        const lowerSport = analysis.sport.toLowerCase();
        const sportFiltered = fallbackPool.filter((m) => {
          const tObj = Array.isArray(m.tournament) ? m.tournament[0] : m.tournament;
          return tObj?.sport?.toLowerCase().includes(lowerSport);
        });
        if (sportFiltered.length > 0) fallbackPool = sportFiltered;
      }
      items = fallbackPool.slice(0, 8);
    }

    let autoCorrectedNotice = '';
    if (analysis.fuzzyCorrection) {
      autoCorrectedNotice = `Showing results for "${analysis.fuzzyCorrection.corrected}". Search for "${analysis.fuzzyCorrection.original}" instead?`;
    }

    const sportLabel = analysis.sport ? analysis.sport.toUpperCase() : 'All Sports';
    const timeLabel = analysis.temporalWindow?.label || 'All Periods';
    const directAnswer: DirectAnswerData | undefined =
      analysis.temporalWindow || analysis.sport
        ? {
            title: `${sportLabel} Fixtures (${timeLabel})`,
            headline:
              items.length > 0
                ? `Found ${items.length} ${analysis.sport ? `${analysis.sport} ` : ''}Match${items.length === 1 ? '' : 'es'}`
                : `No ${analysis.sport || ''} Matches Found`,
            details: isFallback
              ? fallbackMessage
              : `Filtered by ${sportLabel} and ${timeLabel}${analysis.temporalWindow?.expectedStatus && analysis.temporalWindow.expectedStatus !== 'any' ? ` (${analysis.temporalWindow.expectedStatus})` : ''}.`,
            badge: isFallback ? 'Closest Matches' : `${items.length} Found`,
            badgeVariant: isFallback ? 'secondary' : 'success',
            metricValue: `${items.length}`,
            metricLabel: 'Fixtures',
            entityRoute: '/explorer',
          }
        : undefined;

    return {
      analysis: {
        ...analysis,
        directAnswer,
      },
      directAnswer,
      items: items.slice(0, 8),
      isFallback,
      fallbackMessage,
      autoCorrectedNotice,
    };
  } catch (err) {
    console.warn('[SmartVoiceQueryEngine] Execution error:', err);
    return {
      analysis,
      items: [],
      isFallback: false,
    };
  }
}
