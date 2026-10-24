-- PSU SportsTrack: Capstone Remediation & Officials Governance Migration
-- Migration: 20261024_capstone_remediation_and_governance.sql
-- Description:
--   1. Extends users_role_check to support 'player_staff' and 'official'.
--   2. Adds employee_id and department to public.users.
--   3. Adds guard_user_registration trigger to prevent self-privilege escalation on signup.
--   4. Adds tournament & match conflict of interest enforcement, scorer accountability & lease token fields.
--   5. Adds match_score_events accountability (recorded_by, undone_by, undone_at).
--   6. Implements atomic claim_match_lease RPC with conflict of interest & shortage policy evaluation.
--   7. Updates sync_offline_match_events RPC to atomically sync events, box scores, and player stats.
--   8. Hardens match_score_events, match_player_stats, and verification_documents RLS policies.
--   9. Enhances advance_bracket_on_match_completed to handle BYE matchups seamlessly.

-- ==============================================================================
-- 1. Extend users_role_check Constraint
-- ==============================================================================
DO $$
DECLARE
  chk_name TEXT;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'public.users'::regclass 
    AND contype = 'c' 
    AND pg_get_constraintdef(c.oid) LIKE '%role%';

  IF chk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(chk_name);
  END IF;

  ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN (
    'super_admin',
    'facilitator',
    'coach',
    'player_student',
    'player_faculty',
    'player_staff',
    'official',
    'dev'
  ));
END $$;

-- ==============================================================================
-- 2. Add Employee & Department Columns to public.users
-- ==============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;

-- ==============================================================================
-- 3. Trigger: Prevent Self-Privilege Escalation on User Registration
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.guard_user_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- If invoked without an authenticated user (service role) allow it
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check caller's role in the database
  SELECT lower(role) INTO v_caller_role FROM public.users WHERE id = auth.uid();

  -- If the caller is inserting their own row (self-registration) or caller is not an admin
  IF (v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'dev')) THEN
    -- Strictly forbid assigning elevated roles during registration
    IF NEW.role IN ('super_admin', 'facilitator', 'dev', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: Self-registration for elevated roles (%) is strictly forbidden.', NEW.role;
    END IF;

    -- Force security invariants on new unvetted registrations
    NEW.is_verified := false;
    NEW.account_status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_user_registration ON public.users;
CREATE TRIGGER trg_guard_user_registration
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_user_registration();

-- ==============================================================================
-- 4. Conflict of Interest, Scorer Accountability & Match Governance Columns
-- ==============================================================================
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS enforce_conflict_of_interest BOOLEAN DEFAULT true;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS enforce_conflict_of_interest BOOLEAN;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS conflict_flag BOOLEAN DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS conflict_notes TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS official_scorekeeper_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS scorer_notes TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lease_token UUID;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add accountability columns to match_score_events
ALTER TABLE public.match_score_events ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.users(id) DEFAULT auth.uid();
ALTER TABLE public.match_score_events ADD COLUMN IF NOT EXISTS undone_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.match_score_events ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;

-- ==============================================================================
-- 5. Function: claim_match_lease with Atomic Shortage Policy Evaluation
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_match_lease(
  p_match_id UUID,
  p_force BOOLEAN DEFAULT false,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_college UUID;
  v_match RECORD;
  v_tourn RECORD;
  v_team_a RECORD;
  v_team_b RECORD;
  v_enforce_coi BOOLEAN;
  v_has_conflict BOOLEAN := false;
  v_conflict_reason TEXT := NULL;
  v_now TIMESTAMPTZ := now();
  v_new_lease_token UUID;
  v_expires_at TIMESTAMPTZ := v_now + INTERVAL '90 seconds';
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT role, college_id INTO v_caller_role, v_caller_college FROM public.users WHERE id = v_caller_id;

  IF NOT (lower(v_caller_role) IN ('super_admin', 'admin', 'dev', 'facilitator', 'official')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only tournament facilitators, officials, or admins may claim the scoring console.');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found.');
  END IF;

  SELECT * INTO v_tourn FROM public.tournaments WHERE id = v_match.tournament_id;

  -- 1. Active Concurrency Check
  IF v_match.active_scorekeeper_id IS NOT NULL 
     AND v_match.active_scorekeeper_id <> v_caller_id 
     AND v_match.lease_expires_at > v_now 
     AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_locked', true,
      'message', 'Scoring console is currently active and presided over by another official.'
    );
  END IF;

  -- 2. Conflict of Interest Evaluation
  v_enforce_coi := COALESCE(v_match.enforce_conflict_of_interest, v_tourn.enforce_conflict_of_interest, true);

  IF v_match.team_a_id IS NOT NULL THEN
    SELECT college_id, name INTO v_team_a FROM public.teams WHERE id = v_match.team_a_id;
  END IF;

  IF v_match.team_b_id IS NOT NULL THEN
    SELECT college_id, name INTO v_team_b FROM public.teams WHERE id = v_match.team_b_id;
  END IF;

  -- Check department / college affiliation match
  IF v_caller_college IS NOT NULL THEN
    IF v_team_a.college_id IS NOT NULL AND v_caller_college = v_team_a.college_id THEN
      v_has_conflict := true;
      v_conflict_reason := 'Official shares collegiate affiliation with ' || COALESCE(v_team_a.name, 'Team A') || '.';
    ELSIF v_team_b.college_id IS NOT NULL AND v_caller_college = v_team_b.college_id THEN
      v_has_conflict := true;
      v_conflict_reason := 'Official shares collegiate affiliation with ' || COALESCE(v_team_b.name, 'Team B') || '.';
    END IF;
  END IF;

  -- Check if caller is listed on either team's roster
  IF NOT v_has_conflict THEN
    IF EXISTS (
      SELECT 1 FROM public.team_roster 
      WHERE player_id = v_caller_id 
        AND team_id IN (v_match.team_a_id, v_match.team_b_id)
        AND status <> 'Rejected'
    ) THEN
      v_has_conflict := true;
      v_conflict_reason := 'Official is registered as a rostered squad athlete on a competing team.';
    END IF;
  END IF;

  -- If conflict exists and enforcement is active
  IF v_has_conflict AND v_enforce_coi AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'conflict_reason', v_conflict_reason,
      'message', 'Conflict of Interest detected: ' || v_conflict_reason || ' You may override under Shortage Policy if no other facilitator is available.'
    );
  END IF;

  -- 3. Issue atomic lease
  v_new_lease_token := gen_random_uuid();

  UPDATE public.matches
  SET 
    active_scorekeeper_id = v_caller_id,
    official_scorekeeper_id = COALESCE(official_scorekeeper_id, v_caller_id),
    lease_expires_at = v_expires_at,
    lease_token = v_new_lease_token,
    conflict_flag = v_has_conflict,
    conflict_notes = CASE 
      WHEN v_has_conflict THEN 
        COALESCE(p_override_reason, COALESCE(v_conflict_reason, '') || ' Presiding under Facilitator Shortage Policy override.')
      ELSE conflict_notes 
    END,
    updated_at = v_now
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'lease_token', v_new_lease_token,
    'lease_expires_at', v_expires_at,
    'conflict_flag', v_has_conflict,
    'conflict_notes', CASE WHEN v_has_conflict THEN COALESCE(p_override_reason, v_conflict_reason) ELSE NULL END,
    'is_shortage_override', (v_has_conflict AND p_force),
    'message', CASE 
      WHEN v_has_conflict THEN 'Scoring Console claimed under Facilitator Shortage Policy override.'
      ELSE 'Scoring Console claimed! You are presiding.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_match_lease(UUID, BOOLEAN, TEXT) TO authenticated;

-- ==============================================================================
-- 6. Updated sync_offline_match_events RPC (Atomic Box Score Persistence)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_offline_match_events(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_events jsonb DEFAULT '[]'::jsonb,
  p_is_completed boolean DEFAULT false,
  p_score_events jsonb DEFAULT '[]'::jsonb,
  p_player_stats jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_scorekeeper_id uuid;
  v_event JSONB;
  v_score_event JSONB;
  v_player_stat JSONB;
  v_inserted_count INT := 0;
  v_score_events_synced INT := 0;
  v_player_stats_synced INT := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  SELECT active_scorekeeper_id INTO v_scorekeeper_id FROM public.matches WHERE id = p_match_id;

  IF NOT (
    lower(v_caller_role) IN ('super_admin', 'admin', 'dev', 'facilitator', 'official') 
    OR v_scorekeeper_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned scorekeepers or tournament facilitators can sync match scores.';
  END IF;

  -- 1. Update Match Scores & Status
  UPDATE public.matches 
  SET 
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    status = CASE WHEN p_is_completed THEN 'Completed' ELSE status END,
    finalized_by = CASE WHEN p_is_completed THEN COALESCE(finalized_by, v_caller_id) ELSE finalized_by END,
    finalized_at = CASE WHEN p_is_completed THEN COALESCE(finalized_at, v_now) ELSE finalized_at END,
    updated_at = v_now
  WHERE id = p_match_id;

  -- 2. Insert match commentary/play events
  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      INSERT INTO public.match_events (
        match_id, 
        description, 
        created_at
      ) VALUES (
        p_match_id,
        v_event->>'description',
        COALESCE((v_event->>'created_at')::timestamptz, v_now)
      );
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  -- 3. Insert offline match score events (box score audit logs)
  IF p_score_events IS NOT NULL AND jsonb_array_length(p_score_events) > 0 THEN
    FOR v_score_event IN SELECT * FROM jsonb_array_elements(p_score_events)
    LOOP
      INSERT INTO public.match_score_events (
        match_id,
        team_id,
        player_id,
        points,
        delta,
        action_type,
        stat_type,
        recorded_by,
        undone,
        undone_by,
        undone_at,
        created_at
      ) VALUES (
        p_match_id,
        (v_score_event->>'team_id')::uuid,
        NULLIF(v_score_event->>'player_id', '')::uuid,
        COALESCE((v_score_event->>'points')::int, 0),
        COALESCE((v_score_event->>'delta')::int, (v_score_event->>'points')::int, 0),
        COALESCE(v_score_event->>'action_type', 'score'),
        COALESCE(v_score_event->>'stat_type', 'PTS'),
        v_caller_id,
        COALESCE((v_score_event->>'undone')::boolean, false),
        CASE WHEN COALESCE((v_score_event->>'undone')::boolean, false) THEN v_caller_id ELSE NULL END,
        CASE WHEN COALESCE((v_score_event->>'undone')::boolean, false) THEN v_now ELSE NULL END,
        COALESCE((v_score_event->>'created_at')::timestamptz, v_now)
      );
      v_score_events_synced := v_score_events_synced + 1;
    END LOOP;
  END IF;

  -- 4. Upsert aggregated player points
  IF p_player_stats IS NOT NULL AND jsonb_array_length(p_player_stats) > 0 THEN
    FOR v_player_stat IN SELECT * FROM jsonb_array_elements(p_player_stats)
    LOOP
      INSERT INTO public.match_player_stats (
        match_id,
        team_id,
        player_id,
        jersey_number,
        points,
        updated_at
      ) VALUES (
        p_match_id,
        (v_player_stat->>'team_id')::uuid,
        (v_player_stat->>'player_id')::uuid,
        v_player_stat->>'jersey_number',
        COALESCE((v_player_stat->>'points')::int, 0),
        v_now
      )
      ON CONFLICT (match_id, player_id) DO UPDATE
      SET 
        points = EXCLUDED.points,
        jersey_number = COALESCE(EXCLUDED.jersey_number, match_player_stats.jersey_number),
        updated_at = v_now;

      v_player_stats_synced := v_player_stats_synced + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'events_synced', v_inserted_count,
    'score_events_synced', v_score_events_synced,
    'player_stats_synced', v_player_stats_synced,
    'status', CASE WHEN p_is_completed THEN 'Completed' ELSE 'Ongoing' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_offline_match_events(uuid, integer, integer, jsonb, boolean, jsonb, jsonb) TO authenticated;

-- ==============================================================================
-- 7. Restrict match_score_events & match_player_stats RLS Write Policies
-- ==============================================================================
DROP POLICY IF EXISTS "Allow scorekeeper insert match_score_events" ON public.match_score_events;
CREATE POLICY "Allow scorekeeper insert match_score_events"
ON public.match_score_events FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND lower(users.role) IN ('super_admin', 'facilitator', 'dev', 'admin', 'official')
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_score_events.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND (matches.lease_expires_at IS NULL OR matches.lease_expires_at > now())
  ))
);

DROP POLICY IF EXISTS "Allow scorekeeper write match_player_stats" ON public.match_player_stats;
CREATE POLICY "Allow scorekeeper write match_player_stats"
ON public.match_player_stats FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND lower(users.role) IN ('super_admin', 'facilitator', 'dev', 'admin', 'official')
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_player_stats.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND (matches.lease_expires_at IS NULL OR matches.lease_expires_at > now())
  ))
);

DROP POLICY IF EXISTS "Allow scorekeeper update match_player_stats" ON public.match_player_stats;
CREATE POLICY "Allow scorekeeper update match_player_stats"
ON public.match_player_stats FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND lower(users.role) IN ('super_admin', 'facilitator', 'dev', 'admin', 'official')
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_player_stats.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND (matches.lease_expires_at IS NULL OR matches.lease_expires_at > now())
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND lower(users.role) IN ('super_admin', 'facilitator', 'dev', 'admin', 'official')
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_player_stats.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND (matches.lease_expires_at IS NULL OR matches.lease_expires_at > now())
  ))
);

-- ==============================================================================
-- 8. Restrict verification_documents UPDATE to Super Admins & Guard Status
-- ==============================================================================
DROP POLICY IF EXISTS "Only admins can update verification status" ON public.verification_documents;
CREATE POLICY "Only admins can update verification status"
ON public.verification_documents FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND lower(role) IN ('super_admin', 'admin', 'dev')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND lower(role) IN ('super_admin', 'admin', 'dev')
  )
);

CREATE OR REPLACE FUNCTION public.guard_verification_document()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set status to 'Pending' on initial upload
  NEW.status := 'Pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_verification ON public.verification_documents;
CREATE TRIGGER trg_guard_verification
BEFORE INSERT ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_verification_document();

-- ==============================================================================
-- 9. Enhance Bracket Advancement to Handle BYE Matches
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.advance_bracket_on_match_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_winner_id uuid;
  v_loser_id uuid;
  v_target_field text;
  v_loser_field text;
  v_next_match record;
  v_loser_match record;
  v_feeder_idx int;
  v_loser_feeder_idx int;
  v_team_a_name text;
  v_team_b_name text;
BEGIN
  IF NEW.status = 'Completed' AND (OLD.status IS DISTINCT FROM 'Completed') THEN
    -- Fetch team names to check for BYE
    IF NEW.team_a_id IS NOT NULL THEN
      SELECT name INTO v_team_a_name FROM public.teams WHERE id = NEW.team_a_id;
    END IF;
    IF NEW.team_b_id IS NOT NULL THEN
      SELECT name INTO v_team_b_name FROM public.teams WHERE id = NEW.team_b_id;
    END IF;

    -- Handle BYE match explicitly
    IF NEW.team_b_id IS NULL OR UPPER(COALESCE(v_team_b_name, '')) = 'BYE' THEN
      v_winner_id := NEW.team_a_id;
      v_loser_id := NULL;
    ELSIF NEW.team_a_id IS NULL OR UPPER(COALESCE(v_team_a_name, '')) = 'BYE' THEN
      v_winner_id := NEW.team_b_id;
      v_loser_id := NULL;
    ELSIF COALESCE(NEW.team_a_score, 0) > COALESCE(NEW.team_b_score, 0) THEN
      v_winner_id := NEW.team_a_id;
      v_loser_id := NEW.team_b_id;
    ELSIF COALESCE(NEW.team_b_score, 0) > COALESCE(NEW.team_a_score, 0) THEN
      v_winner_id := NEW.team_b_id;
      v_loser_id := NEW.team_a_id;
    ELSE
      v_winner_id := NEW.winner_team_id;
      IF v_winner_id = NEW.team_a_id THEN
        v_loser_id := NEW.team_b_id;
      ELSIF v_winner_id = NEW.team_b_id THEN
        v_loser_id := NEW.team_a_id;
      END IF;
    END IF;

    IF NEW.winner_team_id IS NULL AND v_winner_id IS NOT NULL THEN
      NEW.winner_team_id := v_winner_id;
    END IF;

    -- Advance Winner to next_match_id
    IF NEW.next_match_id IS NOT NULL AND v_winner_id IS NOT NULL THEN
      IF NEW.next_match_slot IN ('team_a', 'team_b') THEN
        v_target_field := CASE WHEN NEW.next_match_slot = 'team_a' THEN 'team_a_id' ELSE 'team_b_id' END;
      ELSE
        SELECT team_a_id, team_b_id INTO v_next_match FROM public.matches WHERE id = NEW.next_match_id;
        IF v_next_match.team_a_id IS NOT NULL AND (v_next_match.team_a_id = NEW.team_a_id OR v_next_match.team_a_id = NEW.team_b_id) THEN
          v_target_field := 'team_a_id';
        ELSIF v_next_match.team_b_id IS NOT NULL AND (v_next_match.team_b_id = NEW.team_a_id OR v_next_match.team_b_id = NEW.team_b_id) THEN
          v_target_field := 'team_b_id';
        ELSE
          SELECT COALESCE(array_position(array_agg(id ORDER BY id), NEW.id), 1)
          INTO v_feeder_idx
          FROM public.matches WHERE next_match_id = NEW.next_match_id;

          IF v_feeder_idx = 2 THEN
            v_target_field := 'team_b_id';
          ELSE
            v_target_field := 'team_a_id';
          END IF;
        END IF;
      END IF;

      IF v_target_field = 'team_a_id' THEN
        UPDATE public.matches SET team_a_id = v_winner_id WHERE id = NEW.next_match_id;
      ELSE
        UPDATE public.matches SET team_b_id = v_winner_id WHERE id = NEW.next_match_id;
      END IF;
    END IF;

    -- Advance Loser to loser_next_match_id (if not a BYE match)
    IF NEW.loser_next_match_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
      IF NEW.loser_next_match_slot IN ('team_a', 'team_b') THEN
        v_loser_field := CASE WHEN NEW.loser_next_match_slot = 'team_a' THEN 'team_a_id' ELSE 'team_b_id' END;
      ELSE
        SELECT team_a_id, team_b_id INTO v_loser_match FROM public.matches WHERE id = NEW.loser_next_match_id;
        IF v_loser_match.team_a_id IS NOT NULL AND (v_loser_match.team_a_id = NEW.team_a_id OR v_loser_match.team_a_id = NEW.team_b_id) THEN
          v_loser_field := 'team_a_id';
        ELSIF v_loser_match.team_b_id IS NOT NULL AND (v_loser_match.team_b_id = NEW.team_a_id OR v_loser_match.team_b_id = NEW.team_b_id) THEN
          v_loser_field := 'team_b_id';
        ELSE
          SELECT COALESCE(array_position(array_agg(id ORDER BY id), NEW.id), 1)
          INTO v_loser_feeder_idx
          FROM public.matches WHERE loser_next_match_id = NEW.loser_next_match_id;

          IF v_loser_feeder_idx = 2 THEN
            v_loser_field := 'team_b_id';
          ELSE
            v_loser_field := 'team_a_id';
          END IF;
        END IF;
      END IF;

      IF v_loser_field = 'team_a_id' THEN
        UPDATE public.matches SET team_a_id = v_loser_id WHERE id = NEW.loser_next_match_id;
      ELSE
        UPDATE public.matches SET team_b_id = v_loser_id WHERE id = NEW.loser_next_match_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
