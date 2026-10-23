-- PSU SportsTrack: Comprehensive Security, Automated Bracket Engine & Integrity Migration
-- Date: 2026-10-24

-- 1. User Role Protection Trigger (Prevent Self-Privilege Escalation)
CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_verified IS DISTINCT FROM OLD.is_verified OR NEW.account_status IS DISTINCT FROM OLD.account_status) THEN
    -- Allow backend service role / internal triggers where auth.uid() is null
    IF auth.uid() IS NOT NULL THEN
      SELECT lower(role) INTO v_caller_role FROM public.users WHERE id = auth.uid();
      IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'dev') THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can alter user roles, verification, or account status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_user_roles ON public.users;
CREATE TRIGGER trg_protect_user_roles
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_roles();

-- 2. Storage RLS on verification_documents (Prevent Student PII Leak)
DROP POLICY IF EXISTS "Allow users and admins to view verification documents" ON storage.objects;
CREATE POLICY "Allow users and admins to view verification documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verification_documents' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND lower(role) IN ('super_admin', 'admin', 'dev', 'facilitator')
    )
  )
);

-- 3. Match Score Events UPDATE Policy (Allow Scorekeeper Undos)
DROP POLICY IF EXISTS "Allow scorekeepers update ongoing match_score_events" ON public.match_score_events;
CREATE POLICY "Allow scorekeepers update ongoing match_score_events"
ON public.match_score_events FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['super_admin'::text, 'facilitator'::text, 'dev'::text, 'admin'::text, 'Admin'::text])
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_score_events.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND matches.status = 'Ongoing'::text
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['super_admin'::text, 'facilitator'::text, 'dev'::text, 'admin'::text, 'Admin'::text])
  )) OR (EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = match_score_events.match_id
    AND matches.active_scorekeeper_id = (SELECT auth.uid())
    AND matches.status = 'Ongoing'::text
  ))
);

-- 4. Revoke Coach Live Match Write Policies (Strict Sports Governance)
-- matches UPDATE policy
DROP POLICY IF EXISTS "Allow score/status updates by authorized roles" ON public.matches;
CREATE POLICY "Allow score/status updates by authorized roles"
ON public.matches FOR UPDATE TO authenticated
USING (
  has_role('facilitator'::text) OR has_role('admin'::text) OR has_role('super_admin'::text) OR has_role('dev'::text) OR (active_scorekeeper_id = (SELECT auth.uid()))
)
WITH CHECK (
  has_role('facilitator'::text) OR has_role('admin'::text) OR has_role('super_admin'::text) OR has_role('dev'::text) OR (active_scorekeeper_id = (SELECT auth.uid()))
);

-- match_events write policies
DROP POLICY IF EXISTS "Allow write of match_events by authorized roles" ON public.match_events;
CREATE POLICY "Allow write of match_events by authorized roles"
ON public.match_events FOR INSERT TO authenticated
WITH CHECK (
  has_role('facilitator'::text) OR has_role('admin'::text) OR has_role('super_admin'::text) OR has_role('dev'::text) OR
  EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND active_scorekeeper_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Allow update of match_events by authorized roles" ON public.match_events;
CREATE POLICY "Allow update of match_events by authorized roles"
ON public.match_events FOR UPDATE TO authenticated
USING (
  has_role('facilitator'::text) OR has_role('admin'::text) OR has_role('super_admin'::text) OR has_role('dev'::text) OR
  EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND active_scorekeeper_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Allow delete of match_events by authorized roles" ON public.match_events;
CREATE POLICY "Allow delete of match_events by authorized roles"
ON public.match_events FOR DELETE TO authenticated
USING (
  has_role('facilitator'::text) OR has_role('admin'::text) OR has_role('super_admin'::text) OR has_role('dev'::text)
);

-- 5. Referential Integrity Fixes (Audit Logs & Stats Preservation)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey 
  FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_team_id_fkey;
ALTER TABLE public.match_player_stats ADD CONSTRAINT match_player_stats_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.match_score_events DROP CONSTRAINT IF EXISTS match_score_events_team_id_fkey;
ALTER TABLE public.match_score_events ADD CONSTRAINT match_score_events_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 6. Automated Bracket Advancement Trigger
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
BEGIN
  IF NEW.status = 'Completed' AND (OLD.status IS DISTINCT FROM 'Completed') THEN
    -- Determine winner and loser based on scores
    IF COALESCE(NEW.team_a_score, 0) > COALESCE(NEW.team_b_score, 0) THEN
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

    -- Advance Loser to loser_next_match_id
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

DROP TRIGGER IF EXISTS trg_advance_bracket_on_match_completed ON public.matches;
CREATE TRIGGER trg_advance_bracket_on_match_completed
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.advance_bracket_on_match_completed();

-- 7. Server-Side Login Rate Limiting Table & RPC Functions
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  failed_attempts integer DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz DEFAULT now()
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public check of own rate limit via RPC" ON public.auth_rate_limits;
CREATE POLICY "Allow public check of own rate limit via RPC"
ON public.auth_rate_limits FOR SELECT TO public
USING (true);

CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_record record;
  v_now timestamptz := now();
  v_remaining_sec int := 0;
BEGIN
  SELECT * INTO v_record FROM public.auth_rate_limits WHERE lower(email) = lower(p_email);
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'remaining_seconds', 0, 'failed_attempts', 0);
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    v_remaining_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_record.locked_until - v_now))::int);
    RETURN jsonb_build_object('allowed', false, 'remaining_seconds', v_remaining_sec, 'failed_attempts', v_record.failed_attempts);
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
    UPDATE public.auth_rate_limits
    SET failed_attempts = 0, locked_until = NULL
    WHERE id = v_record.id;
    RETURN jsonb_build_object('allowed', true, 'remaining_seconds', 0, 'failed_attempts', 0);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'remaining_seconds', 0, 'failed_attempts', v_record.failed_attempts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_record record;
  v_locked_until timestamptz := NULL;
BEGIN
  INSERT INTO public.auth_rate_limits (email, failed_attempts, last_attempt_at)
  VALUES (lower(p_email), 1, now())
  ON CONFLICT (email) DO UPDATE
  SET failed_attempts = CASE
    WHEN auth_rate_limits.locked_until IS NOT NULL AND auth_rate_limits.locked_until <= now() THEN 1
    ELSE auth_rate_limits.failed_attempts + 1
  END,
  last_attempt_at = now()
  RETURNING * INTO v_record;

  IF v_record.failed_attempts >= 3 THEN
    v_locked_until := now() + interval '5 minutes';
    UPDATE public.auth_rate_limits
    SET locked_until = v_locked_until
    WHERE id = v_record.id;
    RETURN jsonb_build_object('allowed', false, 'remaining_seconds', 300, 'failed_attempts', v_record.failed_attempts);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'remaining_seconds', 0, 'failed_attempts', v_record.failed_attempts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.record_successful_login(p_email text)
RETURNS void AS $$
BEGIN
  UPDATE public.auth_rate_limits
  SET failed_attempts = 0, locked_until = NULL, last_attempt_at = now()
  WHERE lower(email) = lower(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_successful_login(text) TO anon, authenticated;
