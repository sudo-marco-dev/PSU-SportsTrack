/**
 * Voice Command Grammar & Intent Parser for PSU SportsTrack
 * Accurately parses courtside voice inputs into structured sports actions.
 */

import type { ParsedVoiceCommand } from '@/types/multimodal';

interface MatchContext {
  teamAName: string;
  teamBName: string;
  sport?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
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
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty one': 21,
  'twenty two': 22,
  'twenty three': 23,
  'twenty four': 24,
  'twenty five': 25,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text: string, targets: string[]): boolean {
  return targets.some((t) => text.includes(t.toLowerCase()));
}

/**
 * Determines which team (if any) was referenced in the speech
 */
export function resolveTeam(
  text: string,
  teamAName: string,
  teamBName: string
): 'a' | 'b' | null {
  const normText = normalizeText(text);
  const normA = normalizeText(teamAName);
  const normB = normalizeText(teamBName);

  // Split college/team acronyms & words
  const aKeywords = [
    'team a',
    'team 1',
    'team one',
    normA,
    ...normA.split(' ').filter((w) => w.length > 2),
  ].filter(Boolean);

  const bKeywords = [
    'team b',
    'team 2',
    'team two',
    normB,
    ...normB.split(' ').filter((w) => w.length > 2),
  ].filter(Boolean);

  // Exact team match priority
  if (normA && normText.includes(normA)) return 'a';
  if (normB && normText.includes(normB)) return 'b';

  // Keyword check
  const hasA = containsAny(normText, aKeywords);
  const hasB = containsAny(normText, bKeywords);

  if (hasA && !hasB) return 'a';
  if (hasB && !hasA) return 'b';

  // Specific fallback for "team a" or "team b"
  if (/\b(team a|to a|for a|from a)\b/i.test(text)) return 'a';
  if (/\b(team b|to b|for b|from b)\b/i.test(text)) return 'b';

  return null;
}

/**
 * Extracts points from phrases like "3 points", "two points", "basket", "free throw"
 */
function extractPoints(text: string): { points: number; actionType: string } | null {
  const norm = normalizeText(text);

  // Sport action shortcuts
  if (norm.includes('free throw') || norm.includes('penalty')) {
    return { points: 1, actionType: 'Free Throw' };
  }
  if (norm.includes('three pointer') || norm.includes('3 pointer') || norm.includes('triple') || norm.includes('from downtown')) {
    return { points: 3, actionType: '3-Pointer' };
  }
  if (norm.includes('layup') || norm.includes('dunk') || norm.includes('basket') || norm.includes('field goal')) {
    return { points: 2, actionType: 'Field Goal' };
  }
  if (norm.includes('goal')) {
    return { points: 1, actionType: 'Goal' };
  }

  // Regex for digits: "give 2 points", "+3 points", "add 2 points", "1 point"
  const digitMatch = norm.match(/(?:give\s+|add\s+|\bplus\s+|\+)?(\d+)\s*(?:points?|pts?|score)?/i);
  if (digitMatch && digitMatch[1]) {
    const val = parseInt(digitMatch[1], 10);
    if (!isNaN(val) && val > 0 && val <= 10) {
      return {
        points: val,
        actionType: val === 3 ? '3-Pointer' : val === 2 ? 'Field Goal' : 'Point',
      };
    }
  }

  // Number words: "two points", "plus three"
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b(?:give|add|plus)?\\s*${word}\\s*(?:points?|pts?)?\\b`, 'i').test(norm)) {
      if (num <= 5 && num > 0) {
        return {
          points: num,
          actionType: num === 3 ? '3-Pointer' : num === 2 ? 'Field Goal' : 'Point',
        };
      }
    }
  }

  return null;
}

/**
 * Extracts jersey / player numbers from speech (e.g. "player 24", "number 7", "player #1")
 */
function extractPlayerNumber(text: string): number | null {
  const norm = normalizeText(text);
  const match = norm.match(/(?:player|number|jersey|no\.?)\s*#?\s*(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(?:player|number|jersey)\\s+#?${word}\\b`, 'i').test(norm)) {
      return num;
    }
  }

  return null;
}

/**
 * Parses player substitution phrases:
 * "Substitute player 1 to player 2 from Team A"
 * "Substitute player 1 with player 2"
 * "Sub out 1 sub in 2 for Team B"
 * "Sub player 1 for player 2 Team A"
 */
function parseSubstitution(
  text: string,
  _team: 'a' | 'b' | null
): { subOut: number; subIn: number } | null {
  const norm = normalizeText(text);

  // Pattern 1: sub out X sub in Y
  const subOutInMatch = norm.match(/sub\s+(?:out\s+)?(?:player\s+|#)?(\d+)\s+(?:sub\s+in\s+|(?:to|with|for)\s+(?:player\s+|#)?)(\d+)/i);
  if (subOutInMatch && subOutInMatch[1] && subOutInMatch[2]) {
    return {
      subOut: parseInt(subOutInMatch[1], 10),
      subIn: parseInt(subOutInMatch[2], 10),
    };
  }

  // Pattern 2: substitute player X to player Y / substitute X with Y
  const subMatch = norm.match(/sub(?:stitute)?\s+(?:player\s+|#)?(\d+)\s+(?:to|with|for)\s+(?:player\s+|#)?(\d+)/i);
  if (subMatch && subMatch[1] && subMatch[2]) {
    return {
      subOut: parseInt(subMatch[1], 10),
      subIn: parseInt(subMatch[2], 10),
    };
  }

  // Pattern 3: words e.g. "substitute player one to player two"
  for (const [word1, num1] of Object.entries(NUMBER_WORDS)) {
    for (const [word2, num2] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`sub(?:stitute)?\\s+(?:player\\s+)?${word1}\\s+(?:to|with|for)\\s+(?:player\\s+)?${word2}\\b`, 'i').test(norm)) {
        return { subOut: num1, subIn: num2 };
      }
    }
  }

  return null;
}

/**
 * Main parser entry point
 */
export function parseVoiceCommand(
  rawTranscript: string,
  context: MatchContext
): ParsedVoiceCommand {
  const norm = normalizeText(rawTranscript);
  const team = resolveTeam(rawTranscript, context.teamAName, context.teamBName);
  const teamName = team === 'a' ? context.teamAName : team === 'b' ? context.teamBName : null;
  const playerNumber = extractPlayerNumber(rawTranscript);

  // 1. Check for Substitution
  if (norm.includes('substitute') || norm.includes('substitution') || norm.includes('sub out') || norm.startsWith('sub ')) {
    const subInfo = parseSubstitution(rawTranscript, team);
    if (subInfo) {
      return {
        rawTranscript,
        intent: 'substitution',
        team,
        teamName,
        points: null,
        actionType: 'Substitution',
        playerNumber: subInfo.subOut,
        subOutPlayerNumber: subInfo.subOut,
        subInPlayerNumber: subInfo.subIn,
        confidence: 0.94,
        timestamp: Date.now(),
      };
    }
  }

  // 2. Check for Clock / Timer Controls
  if (
    norm.includes('clock') ||
    norm.includes('timer') ||
    norm.includes('stopwatch') ||
    norm.includes('start time') ||
    norm.includes('stop time')
  ) {
    const isPause = norm.includes('pause') || norm.includes('stop') || norm.includes('hold');
    const isResume = norm.includes('resume') || norm.includes('start') || norm.includes('play') || norm.includes('run');
    if (isPause || isResume) {
      return {
        rawTranscript,
        intent: 'clock',
        team: null,
        teamName: null,
        points: null,
        actionType: isPause ? 'Pause Clock' : 'Resume Clock',
        playerNumber: null,
        clockAction: isPause ? 'pause' : 'resume',
        confidence: 0.95,
        timestamp: Date.now(),
      };
    }
  }

  // 3. Check for Undo / Cancel
  if (
    norm.includes('undo') ||
    norm.includes('cancel last') ||
    norm.includes('revert') ||
    norm.includes('mistake')
  ) {
    return {
      rawTranscript,
      intent: 'undo',
      team: null,
      teamName: null,
      points: null,
      actionType: null,
      playerNumber: null,
      confidence: 0.95,
      timestamp: Date.now(),
    };
  }

  // 4. Check for Timeout
  if (norm.includes('timeout') || norm.includes('time out') || norm.includes('call time')) {
    return {
      rawTranscript,
      intent: 'timeout',
      team,
      teamName,
      points: null,
      actionType: 'Timeout',
      playerNumber,
      confidence: 0.9,
      timestamp: Date.now(),
    };
  }

  // 5. Check for Foul / Technical / Violation
  if (
    norm.includes('foul') ||
    norm.includes('violation') ||
    norm.includes('yellow card') ||
    norm.includes('red card')
  ) {
    return {
      rawTranscript,
      intent: 'foul',
      team,
      teamName,
      points: null,
      actionType: 'Foul',
      playerNumber,
      notes: rawTranscript,
      confidence: 0.88,
      timestamp: Date.now(),
    };
  }

  // 6. Check for Deduction / Score Correction
  if (
    norm.includes('deduct') ||
    norm.includes('minus') ||
    norm.includes('subtract') ||
    norm.includes('wave off') ||
    norm.includes('correction')
  ) {
    return {
      rawTranscript,
      intent: 'deduct',
      team,
      teamName,
      points: null,
      actionType: 'Correction',
      playerNumber,
      confidence: 0.85,
      timestamp: Date.now(),
    };
  }

  // 7. Check for Commentary / Play-by-play broadcast
  if (
    norm.startsWith('commentary') ||
    norm.startsWith('broadcast') ||
    norm.startsWith('announcement') ||
    norm.startsWith('note')
  ) {
    const cleanNote = rawTranscript.replace(/^(commentary|broadcast|announcement|note)[:\s]*/i, '').trim();
    return {
      rawTranscript,
      intent: 'commentary',
      team,
      teamName,
      points: null,
      actionType: 'Commentary',
      playerNumber,
      notes: cleanNote || rawTranscript,
      confidence: 0.9,
      timestamp: Date.now(),
    };
  }

  // 8. Check for Help
  if (norm.includes('help') || norm.includes('what can i say') || norm.includes('commands')) {
    return {
      rawTranscript,
      intent: 'help',
      team: null,
      teamName: null,
      points: null,
      actionType: null,
      playerNumber: null,
      confidence: 0.99,
      timestamp: Date.now(),
    };
  }

  // 9. Check for Points / Score update
  const pointsInfo = extractPoints(rawTranscript);
  if (pointsInfo) {
    return {
      rawTranscript,
      intent: 'score',
      team,
      teamName,
      points: pointsInfo.points,
      actionType: pointsInfo.actionType,
      playerNumber,
      confidence: team ? 0.92 : 0.65,
      timestamp: Date.now(),
    };
  }

  // Default fallback: unknown
  return {
    rawTranscript,
    intent: 'unknown',
    team,
    teamName,
    points: null,
    actionType: null,
    playerNumber,
    confidence: 0.3,
    timestamp: Date.now(),
  };
}
