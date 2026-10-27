-- ==============================================================================
-- PSU SportsTrack: Admin Role Schema Normalization
-- Migration: 20261027_normalize_admin_role.sql
-- Description: Standardizes 'admin' role in users_role_check constraint and 
--              normalizes any legacy 'super_admin' or 'Admin' role entries.
-- ==============================================================================

-- 1. Extend users_role_check constraint to include canonical 'admin'
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
    'admin',
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

-- 2. Normalize legacy 'super_admin' and 'Admin' records to canonical 'admin'
UPDATE public.users SET role = 'admin' WHERE role = 'super_admin' OR role = 'Admin';
