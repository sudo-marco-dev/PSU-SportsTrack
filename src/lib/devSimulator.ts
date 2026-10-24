import type { SupabaseClient } from '@supabase/supabase-js';
import { formatErrorMessage, type ScenarioResult } from './devScenarios';

export interface ActiveMatchRecord {
  id: string;
  round: string;
  status: string;
  team_a_score: number;
  team_b_score: number;
  team_a_id?: string;
  team_b_id?: string;
  next_match_id?: string | null;
  next_match_slot?: string | null;
  loser_next_match_id?: string | null;
  loser_next_match_slot?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament: { name: string; sport: string } | null;
}

const COMMENTARY_TEMPLATES: Record<string, string[]> = {
  Basketball: [
    'drives through the paint for an acrobatic layup',
    'swishes a clutch 3-pointer from the corner wing',
    'knocks down both free throws under intense defensive pressure',
    'finishes a thunderous fastbreak transition jam',
    'drills a pull-up mid-range jumper off the pick-and-roll',
  ],
  Volleyball: [
    'hammers an unstoppable cross-court spike kill past the seam',
    'serves a sizzling direct service ace along the back line',
    'elevates for a monster roof block at the net',
    'delivers an off-speed tip into the deep campfire zone',
    'converts a quick slide attack off the high set',
  ],
  Soccer: [
    'blasts a curling strike into the top corner from outside the 18-yard box',
    'coolly slots the penalty kick into the bottom left corner',
    'heads home a pinpoint corner kick delivery',
    'pounces on a loose ball in the penalty area for a clinical finish',
  ],
  Football: [
    'blasts a curling strike into the top corner from outside the 18-yard box',
    'coolly slots the penalty kick into the bottom left corner',
    'heads home a pinpoint corner kick delivery',
  ],
  Futsal: [
    'threads a toe-poke finish into the lower corner past the keeper',
    'completes a rapid one-touch give-and-go for an open-net goal',
    'powers a direct free kick into the roof of the net',
  ],
  'Sepak Takraw': [
    'executes an explosive overhead roll spike over the 2-man wall',
    'Tekong fires a blistering drop service ace directly into open court',
    'Killer pulls off an acrobatic sunback spike into the sideline',
    'Feeder blocks the opponent smash cleanly with a high kick block',
  ],
  Baseball: [
    'cracks a sharp line drive to left field for an RBI single',
    'launches a colossal 2-run home run over the center field fence',
    'delivers a clutch bases-loaded double into the right-field alley',
    'smashes a towering grand slam into the deep bleachers',
  ],
  Softball: [
    'drills a line-drive single up the middle driving in a run',
    'crushes a 2-run home run clearing the left-field fence',
    'executes a flawless sacrifice bunt bringing the runner home',
  ],
  Pickleball: [
    'executes a razor-sharp kitchen volley winner right down the sideline',
    'forces an error with a deceptive backhand dink at the non-volley zone',
    'serves an unreturnable deep topspin ace',
  ],
  'Table Tennis': [
    'unleashes a blistering third-ball forehand loop winner across court',
    'produces a venomous backhand flick right onto the white edge line',
    'outlasts opponent in a furious 14-shot counter-topspin rally',
  ],
};

/**
 * Sport-Aware Single-Play Step Injection
 */
export async function simulateSportPlay(
  supabase: SupabaseClient,
  matchId: string,
  targetTeam: 'team_a' | 'team_b',
  points: number,
  actionLabel: string,
  sportName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select(`
        id, team_a_score, team_b_score,
        team_a_id, team_b_id,
        team_a:team_a_id(name),
        team_b:team_b_id(name),
        tournament:tournament_id(sport)
      `)
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) throw new Error(fetchErr?.message || 'Target match not found');

    const effectiveSport = sportName || (match.tournament as any)?.sport || 'Basketball';
    const teamName =
      targetTeam === 'team_a'
        ? (match.team_a as any)?.name || 'Team A'
        : (match.team_b as any)?.name || 'Team B';

    const newScore =
      targetTeam === 'team_a'
        ? (match.team_a_score || 0) + points
        : (match.team_b_score || 0) + points;

    const updatePayload =
      targetTeam === 'team_a' ? { team_a_score: newScore } : { team_b_score: newScore };

    const { error: updateErr } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', matchId);

    if (updateErr) throw updateErr;

    // Pick authentic sport commentary
    const templates = COMMENTARY_TEMPLATES[effectiveSport] || COMMENTARY_TEMPLATES['Basketball'];
    const randomFlavor = templates[Math.floor(Math.random() * templates.length)];
    const description = `[Dev Bot] ${teamName} scored +${points} (${actionLabel}): ${teamName} ${randomFlavor}!`;

    await supabase.from('match_events').insert({
      match_id: matchId,
      description,
    });

    const targetTeamId = targetTeam === 'team_a' ? match.team_a_id : match.team_b_id;
    if (targetTeamId) {
      const { data: roster } = await supabase
        .from('team_roster')
        .select('player_id')
        .eq('team_id', targetTeamId)
        .limit(1)
        .maybeSingle();

      await supabase.from('match_score_events').insert({
        match_id: matchId,
        team_id: targetTeamId,
        player_id: roster?.player_id || null,
        points: points,
        action_type: actionLabel,
        stat_type: `PTS_${points}`,
        delta: points,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: formatErrorMessage(err) };
  }
}

/**
 * Fast-Forward to Clutch Match Moments
 * Respects authentic scoring patterns across all 9 official ballgames.
 */
export async function fastForwardToClutch(
  supabase: SupabaseClient,
  matchId: string,
  clutchType: 'tied' | 'match_point' | 'halftime'
): Promise<ScenarioResult> {
  try {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select(`
        id, team_a_score, team_b_score,
        team_a:team_a_id(name),
        team_b:team_b_id(name),
        tournament:tournament_id(sport)
      `)
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) throw new Error(fetchErr?.message || 'Match not found');

    const sport = (match.tournament as any)?.sport || 'Basketball';
    const teamAName = (match.team_a as any)?.name || 'Team A';
    const teamBName = (match.team_b as any)?.name || 'Team B';

    let scoreA = 0;
    let scoreB = 0;
    let eventDesc = '';

    if (clutchType === 'tied') {
      if (sport === 'Basketball') {
        scoreA = 78;
        scoreB = 78;
        eventDesc = `[Fast-Forward: Clutch Tied Game] Tied 78-78 in the 4th Quarter! 1:12 remaining on the game clock.`;
      } else if (sport === 'Volleyball') {
        scoreA = 24;
        scoreB = 24;
        eventDesc = `[Fast-Forward: Deciding Set Deuce] Set 5 Deuce at 24-24! Next squad to lead by 2 claims victory!`;
      } else if (sport === 'Soccer' || sport === 'Football') {
        scoreA = 1;
        scoreB = 1;
        eventDesc = `[Fast-Forward: 88th Minute Tie] Level at 1-1 with 2 minutes of stoppage time added on!`;
      } else if (sport === 'Futsal') {
        scoreA = 3;
        scoreB = 3;
        eventDesc = `[Fast-Forward: Clutch Futsal] Tied 3-3 with under 2 minutes left in regulation!`;
      } else if (sport === 'Sepak Takraw') {
        scoreA = 20;
        scoreB = 20;
        eventDesc = `[Fast-Forward: Set 3 Tie-Break] Deuce at 20-20 in the final regu set!`;
      } else if (sport === 'Table Tennis') {
        scoreA = 10;
        scoreB = 10;
        eventDesc = `[Fast-Forward: Game 5 Deuce] 10-10 deuce in deciding 5th game!`;
      } else if (sport === 'Baseball') {
        scoreA = 4;
        scoreB = 4;
        eventDesc = `[Fast-Forward: Bottom of the 9th] Tied 4-4 with 2 outs and bases loaded!`;
      } else if (sport === 'Softball') {
        scoreA = 3;
        scoreB = 3;
        eventDesc = `[Fast-Forward: Bottom of the 7th] Tied 3-3 in final regulation inning!`;
      } else {
        scoreA = 10;
        scoreB = 10;
        eventDesc = `[Fast-Forward: Deciding Game Deuce] Tied 10-10 at the kitchen line!`;
      }
    } else if (clutchType === 'match_point') {
      if (sport === 'Basketball') {
        scoreA = 86;
        scoreB = 84;
        eventDesc = `[Fast-Forward: Final Possession] ${teamAName} up by 2 with 6.8 seconds remaining!`;
      } else if (sport === 'Volleyball') {
        scoreA = 24;
        scoreB = 22;
        eventDesc = `[Fast-Forward: Championship Match Point] ${teamAName} at Match Point (24-22) in Set 5!`;
      } else if (sport === 'Soccer' || sport === 'Football') {
        scoreA = 2;
        scoreB = 1;
        eventDesc = `[Fast-Forward: Stoppage Time Lead] ${teamAName} leads 2-1 in the 93rd minute!`;
      } else if (sport === 'Sepak Takraw') {
        scoreA = 20;
        scoreB = 18;
        eventDesc = `[Fast-Forward: Match Point] ${teamAName} serving for the gold medal at 20-18!`;
      } else if (sport === 'Table Tennis') {
        scoreA = 10;
        scoreB = 8;
        eventDesc = `[Fast-Forward: Double Match Point] ${teamAName} serving at 10-8!`;
      } else {
        scoreA = 5;
        scoreB = 4;
        eventDesc = `[Fast-Forward: Clutch Lead] ${teamAName} up 5-4 in late stages!`;
      }
    } else {
      // Halftime
      if (sport === 'Basketball') {
        scoreA = 44;
        scoreB = 42;
        eventDesc = `[Fast-Forward: Halftime Break] Halftime whistle: ${teamAName} (44) vs ${teamBName} (42).`;
      } else if (sport === 'Volleyball') {
        scoreA = 1;
        scoreB = 1;
        eventDesc = `[Fast-Forward: Mid-Match] Tied 1 set each: 25-22, 22-25 into Set 3.`;
      } else if (sport === 'Soccer' || sport === 'Football') {
        scoreA = 1;
        scoreB = 0;
        eventDesc = `[Fast-Forward: Halftime] 1st half concluded: ${teamAName} leads 1-0.`;
      } else {
        scoreA = 2;
        scoreB = 1;
        eventDesc = `[Fast-Forward: Mid-Game Break] Teams head into interval: ${teamAName} 2, ${teamBName} 1.`;
      }
    }

    await supabase
      .from('matches')
      .update({ team_a_score: scoreA, team_b_score: scoreB, status: 'Ongoing' })
      .eq('id', matchId);

    await supabase.from('match_events').insert({
      match_id: matchId,
      description: eventDesc,
    });

    return {
      success: true,
      message: `Fast-forwarded ${sport} match to ${clutchType}: ${teamAName} (${scoreA}) vs ${teamBName} (${scoreB}).`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to fast-forward match',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * 1-Click Game Conclusion with Box Score Stats & MVP Stars
 * Automatically marks match Completed, advances bracket winners, and awards MVP honors.
 */
export async function concludeMatchWithStars(
  supabase: SupabaseClient,
  matchId: string,
  winnerPreference: 'team_a' | 'team_b' = 'team_a'
): Promise<ScenarioResult> {
  try {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select(`
        id, round, team_a_id, team_b_id, team_a_score, team_b_score,
        next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot,
        tournament_id,
        team_a:team_a_id(name),
        team_b:team_b_id(name),
        tournament:tournament_id(sport, name)
      `)
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) throw new Error(fetchErr?.message || 'Match not found');

    const sport = (match.tournament as any)?.sport || 'Basketball';
    const isTeamAWinner = winnerPreference === 'team_a';
    const winnerId = isTeamAWinner ? match.team_a_id : match.team_b_id;
    const loserId = isTeamAWinner ? match.team_b_id : match.team_a_id;
    const winnerName = isTeamAWinner
      ? (match.team_a as any)?.name || 'Team A'
      : (match.team_b as any)?.name || 'Team B';
    const loserName = isTeamAWinner
      ? (match.team_b as any)?.name || 'Team B'
      : (match.team_a as any)?.name || 'Team A';

    // Decide final authentic winning scores
    let finalA = match.team_a_score || 0;
    let finalB = match.team_b_score || 0;

    if (finalA <= finalB && isTeamAWinner) {
      finalA = sport === 'Basketball' ? 88 : sport === 'Volleyball' ? 3 : sport === 'Soccer' ? 2 : 11;
      finalB = sport === 'Basketball' ? 82 : sport === 'Volleyball' ? 2 : sport === 'Soccer' ? 1 : 9;
    } else if (finalB <= finalA && !isTeamAWinner) {
      finalB = sport === 'Basketball' ? 88 : sport === 'Volleyball' ? 3 : sport === 'Soccer' ? 2 : 11;
      finalA = sport === 'Basketball' ? 82 : sport === 'Volleyball' ? 2 : sport === 'Soccer' ? 1 : 9;
    }

    // 1. Mark Match as Completed
    await supabase
      .from('matches')
      .update({
        team_a_score: finalA,
        team_b_score: finalB,
        status: 'Completed',
      })
      .eq('id', matchId);

    // 2. Bracket Progression: Advance winner to next match slot
    if (match.next_match_id && winnerId) {
      const slot = match.next_match_slot || 'team_a';
      await supabase
        .from('matches')
        .update({ [slot === 'team_b' ? 'team_b_id' : 'team_a_id']: winnerId })
        .eq('id', match.next_match_id);
    }

    // 3. Bracket Progression: Send loser to Bronze playoff if configured
    if (match.loser_next_match_id && loserId) {
      const slot = match.loser_next_match_slot || 'team_a';
      await supabase
        .from('matches')
        .update({ [slot === 'team_b' ? 'team_b_id' : 'team_a_id']: loserId })
        .eq('id', match.loser_next_match_id);
    }

    // 4. Ingest Final Whistle Commentary
    await supabase.from('match_events').insert({
      match_id: matchId,
      description: `[FINAL WHISTLE] Match Concluded! ${winnerName} defeats ${loserName} (${finalA} - ${finalB}) in an electrifying showdown!`,
    });

    // 5. Award MVP Stars to Match Players
    let firstStarPlayerId: string | null = null;
    let secondStarPlayerId: string | null = null;

    if (winnerId) {
      const { data: winRoster } = await supabase
        .from('team_roster')
        .select('player_id')
        .eq('team_id', winnerId)
        .limit(2);
      if (winRoster && winRoster.length > 0) {
        firstStarPlayerId = winRoster[0].player_id;
        if (winRoster.length > 1) secondStarPlayerId = winRoster[1].player_id;
      }
    }

    if (!firstStarPlayerId || !secondStarPlayerId) {
      const { data: players } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'player_student')
        .limit(3);
      if (players && players.length >= 2) {
        firstStarPlayerId = firstStarPlayerId || players[0].id;
        secondStarPlayerId = secondStarPlayerId || players[1].id;
      }
    }

    if (firstStarPlayerId && secondStarPlayerId) {
      await supabase.from('player_stars').delete().eq('match_id', matchId);
      await supabase.from('player_stars').insert([
        {
          match_id: matchId,
          user_id: firstStarPlayerId,
          star_rating: 3,
          reason: `1st Star MVP Honours: Decisive clutch offensive performance and team leadership for ${winnerName}.`,
        },
        {
          match_id: matchId,
          user_id: secondStarPlayerId,
          star_rating: 2,
          reason: `2nd Star Honours: Defensive stalwart with crucial game-saving plays.`,
        },
      ]);
    }

    return {
      success: true,
      message: `Match concluded! ${winnerName} won ${finalA}-${finalB}, advanced to next round, and MVP Stars were awarded!`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to conclude match',
      error: formatErrorMessage(err),
    };
  }
}
