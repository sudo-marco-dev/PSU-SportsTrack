-- ==============================================================================
-- Migration: 20261030_harden_facilitator_role_and_governance.sql
-- Description: Hardened Facilitator Dual-Role Capability, Designated Match
--              Reservation Engine, and Strict Anti-COI Enforcement.
-- ==============================================================================

-- 1. Add is_facilitator capability flag to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_facilitator BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_is_facilitator ON public.users(is_facilitator) WHERE is_facilitator = true;

-- 2. Add designated_facilitator_id to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS designated_facilitator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_designated_facilitator ON public.matches(designated_facilitator_id);

-- 3. Seamlessly backfill existing facilitator users to dual-role model
-- Existing users with role = 'facilitator' get is_facilitator = true
-- and their primary role restored to their previous_role (or default 'player_student')
UPDATE public.users 
SET 
  is_facilitator = true,
  role = COALESCE(previous_role, 'player_student')
WHERE role = 'facilitator';

-- 4. Extend public.has_role() to recognize is_facilitator flag
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_is_facilitator boolean;
BEGIN
  SELECT role, is_facilitator INTO v_role, v_is_facilitator FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF lower(v_role) = lower(role_name) THEN
    RETURN true;
  END IF;

  -- Platform Developers and Super Admins hold root sandbox write privileges
  IF lower(v_role) IN ('super_admin', 'admin', 'dev') THEN
    RETURN true;
  END IF;

  -- Dual-role Facilitator check: if asking for 'facilitator' or 'official', check is_facilitator flag
  IF lower(role_name) IN ('facilitator', 'official') AND COALESCE(v_is_facilitator, false) = true THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- 5. Harden public.claim_match_lease() with Designated Match Reservation and Strict Anti-COI
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
  v_caller_is_facilitator BOOLEAN := false;
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
  v_designated_user RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT role, is_facilitator, college_id 
  INTO v_caller_role, v_caller_is_facilitator, v_caller_college 
  FROM public.users 
  WHERE id = v_caller_id;

  -- Verify caller possesses officiating or admin authorization
  IF NOT (
    lower(COALESCE(v_caller_role, '')) IN ('super_admin', 'admin', 'dev', 'facilitator', 'official') 
    OR COALESCE(v_caller_is_facilitator, false) = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only accredited tournament facilitators, officials, or administrators may claim the scoring console.');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found.');
  END IF;

  SELECT * INTO v_tourn FROM public.tournaments WHERE id = v_match.tournament_id;

  -- 1. Designated Facilitator Reservation Check
  IF v_match.designated_facilitator_id IS NOT NULL 
     AND v_match.designated_facilitator_id <> v_caller_id 
     AND lower(COALESCE(v_caller_role, '')) NOT IN ('super_admin', 'admin', 'dev') THEN
    
    SELECT full_name INTO v_designated_user FROM public.users WHERE id = v_match.designated_facilitator_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'is_reserved', true,
      'designated_name', COALESCE(v_designated_user.full_name, 'another assigned official'),
      'message', 'This match is reserved for official ' || COALESCE(v_designated_user.full_name, 'another official') || '. Only the designated official or an Administrator may officiate.'
    );
  END IF;

  -- 2. Active Concurrency Check (Single Scorekeeper Heartbeat)
  IF v_match.active_scorekeeper_id IS NOT NULL 
     AND v_match.active_scorekeeper_id <> v_caller_id 
     AND v_match.lease_expires_at > v_now 
     AND NOT (p_force AND lower(COALESCE(v_caller_role, '')) IN ('super_admin', 'admin', 'dev')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_locked', true,
      'message', 'Scoring console is currently active and presided over by another official.'
    );
  END IF;

  -- 3. Conflict of Interest Evaluation
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

  -- Check if caller is listed on either team's active roster
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

  -- Strict Anti-COI Enforcement:
  -- Non-admin callers CANNOT force-override their own conflict of interest.
  IF v_has_conflict AND v_enforce_coi THEN
    IF NOT (p_force AND lower(COALESCE(v_caller_role, '')) IN ('super_admin', 'admin', 'dev')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'conflict_reason', v_conflict_reason,
        'is_admin', (lower(COALESCE(v_caller_role, '')) IN ('super_admin', 'admin', 'dev')),
        'message', 'Conflict of Interest: ' || v_conflict_reason || ' Only a Tournament Administrator may authorize a shortage override.'
      );
    END IF;
  END IF;

  -- 4. Issue atomic lease
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
        COALESCE(p_override_reason, COALESCE(v_conflict_reason, '') || ' Presiding under Administrator Shortage Policy override.')
      ELSE conflict_notes 
    END,
    updated_at = v_now
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'lease_token', v_new_lease_token,
    'expires_at', v_expires_at,
    'conflict', v_has_conflict,
    'message', CASE 
      WHEN v_has_conflict THEN 'Scoring console claimed under Administrator Shortage Policy override.'
      ELSE 'Scoring console lease acquired successfully.'
    END
  );
END;
$$;
