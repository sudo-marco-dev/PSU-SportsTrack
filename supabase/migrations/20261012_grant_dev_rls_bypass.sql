-- ==============================================================================
-- PSU SportsTrack: Developer Sandbox RLS Write Privilege Extension
-- Migration: 20261012_grant_dev_rls_bypass.sql
-- Description: Extends public.has_role() to recognize the canonical 'dev' role
--              for root sandbox write privileges on tournaments, teams, matches,
--              rosters, and verification tables.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
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

  RETURN false;
END;
$function$;
