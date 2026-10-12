-- ==============================================================================
-- PSU SportsTrack: Developer Role Schema Extension
-- Migration: 20261012_add_dev_role.sql
-- Description: Extends users_role_check to recognize canonical 'dev' role for
--              the Developer & Capstone Command Center sandbox environment.
-- ==============================================================================

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
    'player_faculty',
    'dev'
  ));
END $$;
