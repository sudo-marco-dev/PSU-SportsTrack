-- ==============================================================================
-- PSU SportsTrack: Soft Delete & Recovery System Migration
-- Migration: 20261009_soft_delete_and_recovery.sql
-- Strictly non-destructive: Adds soft-delete flags and timestamps
-- ==============================================================================

-- 1. Soft Delete Columns for Tournaments
ALTER TABLE IF EXISTS tournaments 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 2. Soft Delete Columns for Teams
ALTER TABLE IF EXISTS teams 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 3. Foreign Keys for Admin Blame Auditing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tournaments_deleted_by_fkey' AND table_name = 'tournaments'
  ) THEN
    ALTER TABLE tournaments 
    ADD CONSTRAINT tournaments_deleted_by_fkey 
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'teams_deleted_by_fkey' AND table_name = 'teams'
  ) THEN
    ALTER TABLE teams 
    ADD CONSTRAINT teams_deleted_by_fkey 
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Indexes for Instant Filtering Performance
CREATE INDEX IF NOT EXISTS idx_tournaments_is_deleted ON tournaments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_teams_is_deleted ON teams(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

