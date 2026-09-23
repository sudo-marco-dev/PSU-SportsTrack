/**
 * Court-side Offline Mutation Queue
 * PSU SportsTrack - Phase 5
 * 
 * Manages local offline buffering of live match points and commentary events
 * when venue Wi-Fi / cellular data drops. Flushes atomically to Supabase upon reconnect.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface OfflineEvent {
  id: string;
  match_id: string;
  description: string;
  created_at: string;
}

export interface OfflineMatchState {
  match_id: string;
  team_a_score: number;
  team_b_score: number;
  events: OfflineEvent[];
  is_completed?: boolean;
  last_updated: string;
}

const STORAGE_PREFIX = 'psu_offline_match_';

export const offlineQueue = {
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
        last_updated: new Date().toISOString()
      };

      existing.team_a_score = teamAScore;
      existing.team_b_score = teamBScore;
      existing.is_completed = isCompleted || existing.is_completed;
      existing.last_updated = new Date().toISOString();

      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(existing));
      console.log(`📦 [OfflineQueue] Buffered score for match ${matchId}: ${teamAScore} - ${teamBScore}`);
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
        last_updated: new Date().toISOString()
      };

      existing.events.push(newEvent);
      existing.last_updated = new Date().toISOString();

      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(existing));
      console.log(`📦 [OfflineQueue] Buffered event for match ${matchId}: "${description}"`);
    } catch (err) {
      console.error('Error buffering offline event:', err);
    }

    return newEvent;
  },

  /**
   * Get number of pending offline actions for this match
   */
  getPendingCount(matchId: string): number {
    const state = this.getState(matchId);
    if (!state) return 0;
    return state.events.length + (state.team_a_score > 0 || state.team_b_score > 0 ? 1 : 0);
  },

  /**
   * Clear the offline queue for a match after successful server sync
   */
  clear(matchId: string) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${matchId}`);
      console.log(`🧹 [OfflineQueue] Cleared cache for match ${matchId}`);
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

    console.log(`🚀 [OfflineQueue] Synchronizing offline cache for match ${matchId}...`, state);

    try {
      // 1. Try atomic batch RPC if available
      const { data: rpcData, error: rpcError } = await supabase.rpc('sync_offline_match_events', {
        p_match_id: matchId,
        p_team_a_score: state.team_a_score,
        p_team_b_score: state.team_b_score,
        p_events: state.events,
        p_is_completed: state.is_completed || false
      });

      if (!rpcError && rpcData?.success) {
        this.clear(matchId);
        return { success: true, syncedEvents: state.events.length };
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

      if (state.events.length > 0) {
        const eventsPayload = state.events.map(e => ({
          match_id: matchId,
          description: e.description,
          created_at: e.created_at
        }));

        const { error: eventsError } = await supabase
          .from('match_events')
          .insert(eventsPayload);

        if (eventsError) throw eventsError;
      }

      this.clear(matchId);
      return { success: true, syncedEvents: state.events.length };
    } catch (err) {
      console.error('❌ [OfflineQueue] Failed to flush offline queue:', err);
      return { success: false, syncedEvents: 0 };
    }
  }
};
