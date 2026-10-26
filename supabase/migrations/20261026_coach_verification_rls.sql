-- Migration: 20261026_coach_verification_rls.sql
-- Description: Enforce coach verification check on teams and team_roster operations
-- Prevents unverified coaches from creating teams or inviting players/managing rosters.

-- 1. Helper function to check if current user is an approved/verified Coach
CREATE OR REPLACE FUNCTION public.is_verified_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND (role ILIKE 'coach')
      AND is_verified = true
      AND (account_status IS NULL OR account_status = 'active')
  );
$$;

-- 2. Update Teams Insert Policy
DROP POLICY IF EXISTS "Allow team creation by coaches and admins" ON public.teams;
CREATE POLICY "Allow team creation by coaches and admins" ON public.teams 
FOR INSERT TO authenticated 
WITH CHECK (
  (public.is_verified_coach() AND coach_id = auth.uid())
  OR has_role('Admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
);

-- 3. Update Teams Update Policy
DROP POLICY IF EXISTS "Allow team updates by coach or admin" ON public.teams;
CREATE POLICY "Allow team updates by coach or admin" ON public.teams 
FOR UPDATE TO authenticated 
USING (
  (public.is_verified_coach() AND coach_id = auth.uid())
  OR has_role('Admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
);

-- 4. Update Team Roster Insert Policy (Recruitment Invitations)
DROP POLICY IF EXISTS "Allow roster recruitment invitations by team coach or admin" ON public.team_roster;
CREATE POLICY "Allow roster recruitment invitations by team coach or admin" ON public.team_roster 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_roster.team_id 
      AND (
        (teams.coach_id = auth.uid() AND public.is_verified_coach())
        OR has_role('Admin') 
        OR has_role('super_admin') 
        OR has_role('dev')
      )
  )
);

-- 5. Update Team Roster Update Policy (Lineup modifications)
DROP POLICY IF EXISTS "Allow roster management by coach, player, or admin" ON public.team_roster;
CREATE POLICY "Allow roster management by coach, player, or admin" ON public.team_roster 
FOR UPDATE TO authenticated 
USING (
  (player_id = auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_roster.team_id 
      AND (
        (teams.coach_id = auth.uid() AND public.is_verified_coach())
        OR has_role('Admin') 
        OR has_role('super_admin') 
        OR has_role('dev')
      )
  )
) 
WITH CHECK (
  (player_id = auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_roster.team_id 
      AND (
        (teams.coach_id = auth.uid() AND public.is_verified_coach())
        OR has_role('Admin') 
        OR has_role('super_admin') 
        OR has_role('dev')
      )
  )
);

-- 6. Update Team Roster Delete Policy (Roster member removals)
DROP POLICY IF EXISTS "Allow roster removal by coach, player, or admin" ON public.team_roster;
CREATE POLICY "Allow roster removal by coach, player, or admin" ON public.team_roster 
FOR DELETE TO authenticated 
USING (
  (player_id = auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_roster.team_id 
      AND (
        (teams.coach_id = auth.uid() AND public.is_verified_coach())
        OR has_role('Admin') 
        OR has_role('super_admin') 
        OR has_role('dev')
      )
  )
);
