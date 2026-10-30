-- ==============================================================================
-- Migration: 20261031_harden_mvp_star_governance.sql
-- Description: Hardened MVP Awarding, Justification Audit Metadata, and
--              Admin Override Authority on player_stars.
-- ==============================================================================

-- 1. Add justification and override metadata columns to player_stars
ALTER TABLE public.player_stars ADD COLUMN IF NOT EXISTS justification TEXT DEFAULT NULL;
ALTER TABLE public.player_stars ADD COLUMN IF NOT EXISTS override_reason TEXT DEFAULT NULL;
ALTER TABLE public.player_stars ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.player_stars ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stars_overridden_by ON public.player_stars(overridden_by);

-- 2. Harden RLS policies on player_stars
-- INSERT: Facilitator, Official, Admin, Super Admin, Dev (Coaches strictly cannot award MVP stars)
DROP POLICY IF EXISTS "Allow write of player_stars by authorized roles" ON public.player_stars;
CREATE POLICY "Allow write of player_stars by authorized roles" ON public.player_stars 
FOR INSERT TO authenticated 
WITH CHECK (
  has_role('facilitator') 
  OR has_role('official') 
  OR has_role('admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
);

-- UPDATE: Strictly reserved for Administrators and Super Admins (Facilitators cannot tamper post-award)
DROP POLICY IF EXISTS "Allow update of player_stars by authorized roles" ON public.player_stars;
CREATE POLICY "Allow update of player_stars by authorized roles" ON public.player_stars 
FOR UPDATE TO authenticated 
USING (
  has_role('admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
)
WITH CHECK (
  has_role('admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
);

-- DELETE: Strictly reserved for Administrators and Super Admins
DROP POLICY IF EXISTS "Allow delete of player_stars by authorized roles" ON public.player_stars;
CREATE POLICY "Allow delete of player_stars by authorized roles" ON public.player_stars 
FOR DELETE TO authenticated 
USING (
  has_role('admin') 
  OR has_role('super_admin') 
  OR has_role('dev')
);
