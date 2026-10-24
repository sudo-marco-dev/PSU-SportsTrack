/**
 * Court-side Offline Mutation Queue
 * PSU SportsTrack - Phase 5 & Capstone Hardening
 * 
 * Manages local offline buffering of live match points, play-by-play commentary events,
 * and individual player box scores when venue Wi-Fi / cellular data drops.
 * Flushes atomically to Supabase upon reconnect.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface OfflineEvent {
  id: string;
  match_id: string;
  description: string;
  created_at: string;
}

export interface OfflineScoreEvent {
  id: string;
  match_id: string;
  team_id: string;
  player_id?: string | null;
  jersey_number?: string | null;
  points: number;
  delta?: number;
  action_type: string;
  stat_type?: string;
  undone?: boolean;
  created_at: string;
}

export interface OfflinePlayerStat {
  team_id: string;
  player_id: string;
  jersey_number?: string | null;
  points: number;
}

export interface OfflineMatchState {
  match_id: string;
  team_a_score: number;
  team_b_score: number;
  events: OfflineEvent[];
  score_events?: OfflineScoreEvent[];
  player_points?: Record<string, number>;
  player_stats?: OfflinePlayerStat[];
  is_completed?: boolean;
  last_updated: string;
}

const STORAGE_PREFIX = 'psu_offline_match_';
const CONTEXT_PREFIX = 'psu_cached_context_';

export const offlineQueue = {
  /**
   * Cache full match metadata and rosters locally for offline resilience
   */
  cacheMatchContext(matchId: string, match: any, rosters: any[]) {
    try {
      localStorage.setItem(
        CONTEXT_PREFIX + matchId,
        JSON.stringify({ match, rosters, cached_at: new Date().toISOString() })
      );
    } catch (err) {
      console.warn('Failed to cache match context locally:', err);
    }
  },

  /**
   * Retrieve cached match metadata and rosters when network is unavailable
   */
  getCachedMatchContext(matchId: string): { match: any; rosters: any[] } | null {
    try {
      const data = localStorage.getItem(CONTEXT_PREFIX + matchId);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Error reading cached match context:', err);
      return null;
    }
  },

  /**
   * Get current offline buffered state for a match
   */
  getState(matchId: string): OfflineMatchState | null {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${matchId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Error reading offline match state:', err);
      return null;
    }
  },

  /**
   * Buffer a score update while offline
   */
  bufferScore(matchId: string, teamAScore: number, teamBScore: number, isCompleted: boolean = false) {
    try {
      const existing = this.getState(matchId) || {
        match_id: matchId,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        events: [],
        score_events: [],
        player_points: {},
        player_stats: [],
        last_updated: new Date().toISOString()
      };

      existing.team_a_score = teamAScore;
      existing.team_b_score = teamBScore;
      existing.is_completed = isCompleted || existing.is_completed;
      existing.last_updated = new Date().toISOString();

      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(existing));
      if (import.meta.env.DEV) console.log(`[OfflineQueue] Buffered score for match ${matchId}: ${teamAScore} - ${teamBScore}`);
    } catch (err) {
      console.error('Error buffering offline score:', err);
    }
  },

  /**
   * Buffer a play-by-play commentary event while offline
   */
  bufferEvent(matchId: string, description: string): OfflineEvent {
    const newEvent: OfflineEvent = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      match_id: matchId,
      description,
      created_at: new Date().toISOString()
    };

    try {
      const existing = this.getState(matchId) || {
        match_id: matchId,
        team_a_score: 0,
        team_b_score: 0,
        events: [],
        score_events: [],
        player_points: {},
        player_stats: [],
        last_updated: new Date().toISOString()
      };

      if (!existing.events) existing.events = [];
      existing.events.push(newEvent);
      existing.last_updated = new Date().toISOString();

      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(existing));
      if (import.meta.env.DEV) console.log(`[OfflineQueue] Buffered event for match ${matchId}: "${description}"`);
    } catch (err) {
      console.error('Error buffering offline event:', err);
    }

    return newEvent;
  },

  /**
   * Buffer an individual player score event for box score persistence while offline
   */
  bufferScoreEvent(
    matchId: string,
    event: Omit<OfflineScoreEvent, 'id' | 'created_at'>
  ): OfflineScoreEvent {
    const newScoreEvent: OfflineScoreEvent = {
      ...event,
      id: `offline-score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    try {
      const existing = this.getState(matchId) || {
        match_id: matchId,
        team_a_score: 0,
        team_b_score: 0,
        events: [],
        score_events: [],
        player_points: {},
        player_stats: [],
        last_updated: new Date().toISOString()
      };

      if (!existing.score_events) existing.score_events = [];
      existing.score_events.push(newScoreEvent);

      // Track aggregated player points
      if (event.player_id) {
        if (!existing.player_points) existing.player_points = {};
        const prevPts = existing.player_points[event.player_id] || 0;
        const nextPts = Math.max(0, prevPts + event.points);
        existing.player_points[event.player_id] = nextPts;

        if (!existing.player_stats) existing.player_stats = [];
        const statIndex = existing.player_stats.findIndex(s => s.player_id === event.player_id);
        if (statIndex >= 0) {
          existing.player_stats[statIndex].points = nextPts;
        } else {
          existing.player_stats.push({
            team_id: event.team_id,
            player_id: event.player_id,
            jersey_number: event.jersey_number,
            points: nextPts
          });
        }
      }

      existing.last_updated = new Date().toISOString();
      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(existing));
    } catch (err) {
      console.error('Error buffering offline score event:', err);
    }

    return newScoreEvent;
  },

  /**
   * Undo the last matching score event from the offline buffer and compensate player points
   */
  undoLastScoreEvent(matchId: string, playerId?: string, points?: number): boolean {
    try {
      const state = this.getState(matchId);
      if (!state) return false;

      // 1. Mark the last matching score event as undone
      if (state.score_events && state.score_events.length > 0) {
        for (let i = state.score_events.length - 1; i >= 0; i--) {
          const ev = state.score_events[i];
          if (!ev.undone && (!playerId || ev.player_id === playerId)) {
            ev.undone = true;
            break;
          }
        }
      }

      // 2. Compensate aggregated player points
      if (playerId && points) {
        if (state.player_points && state.player_points[playerId] !== undefined) {
          state.player_points[playerId] = Math.max(0, state.player_points[playerId] - points);
        }
        if (state.player_stats && state.player_stats.length > 0) {
          const idx = state.player_stats.findIndex(s => s.player_id === playerId);
          if (idx >= 0) {
            state.player_stats[idx].points = Math.max(0, state.player_stats[idx].points - points);
          }
        }
      }

      state.last_updated = new Date().toISOString();
      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Error undoing offline score event:', err);
      return false;
    }
  },

  /**
   * Get number of pending offline actions for this match
   */
  getPendingCount(matchId: string): number {
    const state = this.getState(matchId);
    if (!state) return 0;
    return (
      (state.events?.length || 0) +
      (state.score_events?.length || 0) +
      (state.team_a_score > 0 || state.team_b_score > 0 ? 1 : 0)
    );
  },

  /**
   * Clear the offline queue for a match after successful server sync
   */
  clear(matchId: string) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${matchId}`);
      if (import.meta.env.DEV) console.log(`[OfflineQueue] Cleared cache for match ${matchId}`);
    } catch (err) {
      console.error('Error clearing offline match cache:', err);
    }
  },

  /**
   * Flush pending buffered events & scores to Supabase
   */
  async flush(matchId: string, supabase: SupabaseClient): Promise<{ success: boolean; syncedEvents: number }> {
    const state = this.getState(matchId);
    if (!state) {
      return { success: true, syncedEvents: 0 };
    }

    if (import.meta.env.DEV) console.log(`[OfflineQueue] Synchronizing offline cache for match ${matchId}...`, state);

    try {
      // 1. Try atomic batch RPC if available
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('sync_offline_match_events', {
        p_match_id: matchId,
        p_team_a_score: state.team_a_score,
        p_team_b_score: state.team_b_score,
        p_events: state.events || [],
        p_is_completed: state.is_completed || false,
        p_score_events: state.score_events || [],
        p_player_stats: state.player_stats || []
      });

      if (!rpcError && rpcData?.success) {
        this.clear(matchId);
        const totalSynced = (state.events?.length || 0) + (state.score_events?.length || 0);
        return { success: true, syncedEvents: totalSynced };
      }

      // 2. Fallback to direct client queries if RPC is not yet executed in database
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          team_a_score: state.team_a_score,
          team_b_score: state.team_b_score,
          ...(state.is_completed ? { status: 'Completed' } : {})
        })
        .eq('id', matchId);

      if (matchError) throw matchError;

      if (state.events && state.events.length > 0) {
        const eventsPayload = state.events.map(e => ({
          match_id: matchId,
          description: e.description,
          created_at: e.created_at
        }));

        await supabase.from('match_events').insert(eventsPayload);
      }

      if (state.score_events && state.score_events.length > 0) {
        const scoreEventsPayload = state.score_events.map(se => ({
          match_id: matchId,
          team_id: se.team_id,
          player_id: se.player_id || null,
          points: se.points,
          delta: se.delta ?? se.points,
          action_type: se.action_type,
          stat_type: se.stat_type || 'PTS',
          undone: Boolean(se.undone),
          created_at: se.created_at
        }));

        await supabase.from('match_score_events').insert(scoreEventsPayload);
      }

      if (state.player_stats && state.player_stats.length > 0) {
        for (const ps of state.player_stats) {
          await supabase.from('match_player_stats').upsert({
            match_id: matchId,
            team_id: ps.team_id,
            player_id: ps.player_id,
            jersey_number: ps.jersey_number || null,
            points: ps.points,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'match_id,player_id'
          });
        }
      }

      this.clear(matchId);
      const totalSynced = (state.events?.length || 0) + (state.score_events?.length || 0);
      return { success: true, syncedEvents: totalSynced };
    } catch (err) {
      console.error('[OfflineQueue] Failed to flush offline queue:', err);
      return { success: false, syncedEvents: 0 };
    }
  }
};
