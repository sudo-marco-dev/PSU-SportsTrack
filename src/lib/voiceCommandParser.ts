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
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if query contains any of the target tokens
 */
function containsAny(text: string, targets: string[]): boolean {
  return targets.some((t) => text.includes(t.toLowerCase()));
}

/**
 * Determines which team (if any) was referenced in the speech
 */
function resolveTeam(
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
  if (/\b(team a|to a|for a)\b/i.test(text)) return 'a';
  if (/\b(team b|to b|for b)\b/i.test(text)) return 'b';

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

  // Regex for digits: "+3 points", "add 2 points", "1 point"
  const digitMatch = norm.match(/(?:\+|\badd\s+|\bplus\s+)?(\d+)\s*(?:points?|pts?|score)?/i);
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
    if (new RegExp(`\\b(?:add|plus)?\\s*${word}\\s*(?:points?|pts?)?\\b`, 'i').test(norm)) {
      if (num <= 5) {
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
 * Extracts jersey / player numbers from speech (e.g. "player 24", "number 7")
 */
function extractPlayerNumber(text: string): number | null {
  const norm = normalizeText(text);
  const match = norm.match(/(?:player|number|jersey|no\.?)\s*(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(?:player|number|jersey)\\s+${word}\\b`, 'i').test(norm)) {
      return num;
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

  // 1. Check for Undo / Cancel
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

  // 2. Check for Timeout
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

  // 3. Check for Foul / Technical / Violation
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

  // 4. Check for Deduction / Score Correction
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

  // 5. Check for Commentary / Play-by-play broadcast
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

  // 6. Check for Help
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

  // 7. Check for Points / Score update
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
      confidence: team ? 0.92 : 0.65, // Lower confidence if team wasn't explicitly detected
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
