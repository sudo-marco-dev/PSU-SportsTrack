-- ==============================================================================
-- PSU SportsTrack: Security Hardening, Foreign Key Indexes & RLS Optimization
-- Migration: 20261014_harden_security_and_indexes.sql
-- Description:
--   1. Revokes public/anon RPC execution on sync_offline_match_events and secures search_path
--   2. Tightens RLS write policies on match scoring events & player stats
--   3. Adds covering B-tree indexes for all 25 unindexed foreign keys
--   4. Adds game clock state columns to matches table
--   5. Optimizes RLS policies to use (SELECT auth.uid()) initPlan caching and consolidates permissive policies
-- ==============================================================================

-- 1. Security Definer RPC Execution & Search Path Hardening
REVOKE EXECUTE ON FUNCTION public.sync_offline_match_events(uuid, integer, integer, jsonb, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_offline_match_events(uuid, integer, integer, jsonb, boolean) TO authenticated;
ALTER FUNCTION public.sync_offline_match_events(uuid, integer, integer, jsonb, boolean) SET search_path = 'public';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_user_email_sync') THEN
    REVOKE EXECUTE ON FUNCTION public.handle_user_email_sync() FROM anon, public, authenticated;
    ALTER FUNCTION public.handle_user_email_sync() SET search_path = 'public';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_profiles_update') THEN
    REVOKE EXECUTE ON FUNCTION public.handle_profiles_update() FROM anon, public, authenticated;
    ALTER FUNCTION public.handle_profiles_update() SET search_path = 'public';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_role' AND pronargs = 1) THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public, authenticated;
    ALTER FUNCTION public.get_user_role(uuid) SET search_path = 'public';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronargs = 1) THEN
    REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon, public;
    GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
    ALTER FUNCTION public.has_role(text) SET search_path = 'public';
  END IF;
END $$;

-- 2. Secure Offline Match Events RPC with Caller Authorization Check
CREATE OR REPLACE FUNCTION public.sync_offline_match_events(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_events jsonb DEFAULT '[]'::jsonb,
  p_is_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_scorekeeper_id uuid;
  v_event JSONB;
  v_inserted_count INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  SELECT active_scorekeeper_id INTO v_scorekeeper_id FROM public.matches WHERE id = p_match_id;

  IF NOT (
    lower(v_caller_role) IN ('super_admin', 'admin', 'dev', 'facilitator') 
    OR v_scorekeeper_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned scorekeepers or tournament facilitators can sync match scores.';
  END IF;

  UPDATE matches 
  SET 
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    status = CASE WHEN p_is_completed THEN 'Completed' ELSE status END,
    updated_at = now()
  WHERE id = p_match_id;

  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      INSERT INTO match_events (
        match_id, 
        description, 
        created_at
      ) VALUES (
        p_match_id,
        v_event->>'description',
        COALESCE((v_event->>'created_at')::timestamptz, now())
      );
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'events_synced', v_inserted_count,
    'status', CASE WHEN p_is_completed THEN 'Completed' ELSE 'Ongoing' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- 3. Covering Indexes for All 25 Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_player_id ON match_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_team_id ON match_player_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_match_score_events_player_id ON match_score_events(player_id);
CREATE INDEX IF NOT EXISTS idx_match_score_events_team_id ON match_score_events(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser_next_match ON matches(loser_next_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_scorekeeper ON matches(active_scorekeeper_id);
CREATE INDEX IF NOT EXISTS idx_matches_finalized_by ON matches(finalized_by);
CREATE INDEX IF NOT EXISTS idx_matches_next_match_id ON matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_a_id ON matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_b_id ON matches(team_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_stars_awarded_by ON player_stars(awarded_by);
CREATE INDEX IF NOT EXISTS idx_player_stars_match_id ON player_stars(match_id);
CREATE INDEX IF NOT EXISTS idx_player_stars_player_id ON player_stars(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stars_tournament_id ON player_stars(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_roster_player_id ON team_roster(player_id);
CREATE INDEX IF NOT EXISTS idx_teams_coach_id ON teams(coach_id);
CREATE INDEX IF NOT EXISTS idx_teams_deleted_by ON teams(deleted_by);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_deleted_by ON tournaments(deleted_by);
CREATE INDEX IF NOT EXISTS idx_users_cluster_id ON users(cluster_id);
CREATE INDEX IF NOT EXISTS idx_users_college_id ON users(college_id);

-- 4. Game Clock State Persistence in matches
ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS game_time_seconds INT DEFAULT 600,
ADD COLUMN IF NOT EXISTS current_period VARCHAR(50) DEFAULT 'Period 1',
ADD COLUMN IF NOT EXISTS is_clock_running BOOLEAN DEFAULT false;

-- 5. Consolidated RLS Policies with InitPlan (SELECT auth.uid()) Optimization
-- Clusters
DROP POLICY IF EXISTS "Allow super admin manage clusters" ON clusters;
CREATE POLICY "Allow super admin insert clusters" ON clusters FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'dev')));
CREATE POLICY "Allow super admin update clusters" ON clusters FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'dev')))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'dev')));
CREATE POLICY "Allow super admin delete clusters" ON clusters FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'dev')));

-- Colleges
DROP POLICY IF EXISTS "Allow admin write of colleges" ON colleges;
CREATE POLICY "Allow admin insert colleges" ON colleges FOR INSERT TO authenticated WITH CHECK (has_role('Admin'));
CREATE POLICY "Allow admin update colleges" ON colleges FOR UPDATE TO authenticated USING (has_role('Admin'));
CREATE POLICY "Allow admin delete colleges" ON colleges FOR DELETE TO authenticated USING (has_role('Admin'));

-- Match Events
DROP POLICY IF EXISTS "Allow write of match_events by authorized roles" ON match_events;
CREATE POLICY "Allow write of match_events by authorized roles" ON match_events FOR INSERT TO authenticated 
WITH CHECK (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow update of match_events by authorized roles" ON match_events FOR UPDATE TO authenticated 
USING (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow delete of match_events by authorized roles" ON match_events FOR DELETE TO authenticated 
USING (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));

-- Match Player Stats
DROP POLICY IF EXISTS "Allow scorekeepers manage match_player_stats" ON match_player_stats;
CREATE POLICY "Allow scorekeepers insert match_player_stats" ON match_player_stats FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'facilitator', 'dev', 'Admin'))
  OR EXISTS (SELECT 1 FROM matches WHERE matches.id = match_player_stats.match_id AND matches.active_scorekeeper_id = (SELECT auth.uid()))
);
CREATE POLICY "Allow scorekeepers update match_player_stats" ON match_player_stats FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'facilitator', 'dev', 'Admin'))
  OR EXISTS (SELECT 1 FROM matches WHERE matches.id = match_player_stats.match_id AND matches.active_scorekeeper_id = (SELECT auth.uid()))
);
CREATE POLICY "Allow scorekeepers delete match_player_stats" ON match_player_stats FOR DELETE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'facilitator', 'dev', 'Admin'))
  OR EXISTS (SELECT 1 FROM matches WHERE matches.id = match_player_stats.match_id AND matches.active_scorekeeper_id = (SELECT auth.uid()))
);

-- Matches
DROP POLICY IF EXISTS "Allow admin write of matches" ON matches;
DROP POLICY IF EXISTS "Allow score/status updates by authorized roles" ON matches;
CREATE POLICY "Allow admin insert matches" ON matches FOR INSERT TO authenticated 
WITH CHECK (has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow admin delete matches" ON matches FOR DELETE TO authenticated 
USING (has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow score/status updates by authorized roles" ON matches FOR UPDATE TO authenticated 
USING (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev') OR (active_scorekeeper_id = (SELECT auth.uid()))) 
WITH CHECK (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev') OR (active_scorekeeper_id = (SELECT auth.uid())));

-- Player Stars
DROP POLICY IF EXISTS "Allow write of player_stars by authorized roles" ON player_stars;
CREATE POLICY "Allow write of player_stars by authorized roles" ON player_stars FOR INSERT TO authenticated 
WITH CHECK (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow update of player_stars by authorized roles" ON player_stars FOR UPDATE TO authenticated 
USING (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow delete of player_stars by authorized roles" ON player_stars FOR DELETE TO authenticated 
USING (has_role('facilitator') OR has_role('coach') OR has_role('admin') OR has_role('super_admin') OR has_role('dev'));

-- Teams
DROP POLICY IF EXISTS "Allow read of teams to authenticated users" ON teams;
DROP POLICY IF EXISTS "Allow team creation by coaches and admins" ON teams;
DROP POLICY IF EXISTS "Allow team updates by coach or admin" ON teams;
CREATE POLICY "Allow team creation by coaches and admins" ON teams FOR INSERT TO authenticated 
WITH CHECK ((has_role('Coach') AND (coach_id = (SELECT auth.uid()))) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow team updates by coach or admin" ON teams FOR UPDATE TO authenticated 
USING ((has_role('Coach') AND (coach_id = (SELECT auth.uid()))) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'));

-- Tournaments
DROP POLICY IF EXISTS "Allow admin write of tournaments" ON tournaments;
CREATE POLICY "Allow admin insert tournaments" ON tournaments FOR INSERT TO authenticated 
WITH CHECK (has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow admin update tournaments" ON tournaments FOR UPDATE TO authenticated 
USING (has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow admin delete tournaments" ON tournaments FOR DELETE TO authenticated 
USING (has_role('Admin') OR has_role('super_admin') OR has_role('dev'));

-- Users
DROP POLICY IF EXISTS "Allow user creation during registration" ON users;
CREATE POLICY "Allow user creation during registration" ON users FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) = id);

-- Verification Documents
DROP POLICY IF EXISTS "Allow document upload by owner or admin" ON verification_documents;
DROP POLICY IF EXISTS "Allow document updates by owner or admin" ON verification_documents;
CREATE POLICY "Allow document upload by owner or admin" ON verification_documents FOR INSERT TO authenticated 
WITH CHECK ((user_id = (SELECT auth.uid())) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'));
CREATE POLICY "Allow document updates by owner or admin" ON verification_documents FOR UPDATE TO authenticated 
USING ((user_id = (SELECT auth.uid())) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'));

-- Team Roster
DROP POLICY IF EXISTS "Allow roster management by coach, player, or admin" ON team_roster;
DROP POLICY IF EXISTS "Allow roster recruitment invitations by team coach or admin" ON team_roster;
DROP POLICY IF EXISTS "Allow roster removal by coach, player, or admin" ON team_roster;
CREATE POLICY "Allow roster recruitment invitations by team coach or admin" ON team_roster FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND (teams.coach_id = (SELECT auth.uid()) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'))));
CREATE POLICY "Allow roster management by coach, player, or admin" ON team_roster FOR UPDATE TO authenticated 
USING ((player_id = (SELECT auth.uid())) OR EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND (teams.coach_id = (SELECT auth.uid()) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev')))) 
WITH CHECK ((player_id = (SELECT auth.uid())) OR EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND (teams.coach_id = (SELECT auth.uid()) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'))));
CREATE POLICY "Allow roster removal by coach, player, or admin" ON team_roster FOR DELETE TO authenticated 
USING ((player_id = (SELECT auth.uid())) OR EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND (teams.coach_id = (SELECT auth.uid()) OR has_role('Admin') OR has_role('super_admin') OR has_role('dev'))));
