-- ==============================================================================
-- PSU SportsTrack: Unified Role Schema Normalization
-- Migration: 20261010_unify_roles.sql
-- Description: Consolidates legacy PascalCase roles ('Admin', 'Coach', 'Player')
--              into canonical snake_case roles ('super_admin', 'coach', 'player_student').
-- ==============================================================================

-- 1. Normalize existing user rows to canonical snake_case roles
UPDATE users SET role = 'super_admin' WHERE role = 'Admin';
UPDATE users SET role = 'coach' WHERE role = 'Coach';
UPDATE users SET role = 'player_student' WHERE role = 'Player';

-- 2. Update role check constraint on users table
DO $$
DECLARE
  chk_name TEXT;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'users'::regclass 
    AND contype = 'c' 
    AND pg_get_constraintdef(c.oid) LIKE '%role%';

  IF chk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(chk_name);
  END IF;

  ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN (
    'super_admin',
    'facilitator',
    'coach',
    'player_student',
    'player_faculty'
  ));
END $$;
