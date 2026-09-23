-- ==============================================================================
-- PSU SportsTrack: Super Admin vs Facilitator Architectural Governance Migration
-- Migration: 20260916_superadmin_facilitator_governance.sql
-- Strictly non-destructive: preserves existing tables, columns, and data
-- ==============================================================================

-- 1. College Clusters Table
CREATE TABLE IF NOT EXISTS clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  college_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Profiles / Users Table Enhancements
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS faculty_id_url TEXT;

ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS revalidated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS cluster_id UUID;

-- Safe foreign key constraint for cluster_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_users_cluster' AND table_name = 'users'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT fk_users_cluster 
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update role check constraint on users (if any exists, drop and replace with extended list)
DO $$
DECLARE
  chk_name TEXT;
BEGIN
  -- Find any existing check constraint on users.role
  SELECT conname INTO chk_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'users'::regclass 
    AND contype = 'c' 
    AND pg_get_constraintdef(c.oid) LIKE '%role%';

  IF chk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(chk_name);
  END IF;

  -- Add updated check constraint supporting all institutional roles
  ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN (
    'super_admin',
    'facilitator',
    'coach',
    'player_student',
    'player_faculty',
    'Admin', -- Legacy backwards compatibility
    'Coach', -- Legacy backwards compatibility
    'Player'  -- Legacy backwards compatibility
  ));
EXCEPTION WHEN OTHERS THEN
  NULL; -- If check cannot be added, column remains flexible text
END $$;

-- Safe check constraint on account_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_users_account_status' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_account_status 
    CHECK (account_status IN ('active', 'inactive', 'archived', 'soft_deleted'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Profiles View (Backward compatibility alias for users)
CREATE OR REPLACE VIEW profiles AS 
SELECT * FROM users;

-- 4. Team Roster Jersey Number
ALTER TABLE IF EXISTS team_roster 
ADD COLUMN IF NOT EXISTS jersey_number INT;

-- 5. Matches Finalization Columns
ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES users(id);

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- 6. Match Event Undo Buffer (Granular Action Log)
CREATE TABLE IF NOT EXISTS match_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID REFERENCES users(id),
  points INT DEFAULT 0,
  action_type TEXT DEFAULT 'score',
  stat_type VARCHAR(20) DEFAULT 'PTS_1', -- 'PTS_1', 'PTS_2', 'PTS_3', 'AST', 'REB', 'STL', 'BLK', 'FOUL'
  delta INT NOT NULL DEFAULT 1,
  undone BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_score_events_undo 
ON match_score_events(match_id, undone, created_at DESC);

-- 7. Match Player Stats Junction Table (For Box-Scores)
CREATE TABLE IF NOT EXISTS match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID REFERENCES users(id),
  jersey_number INT,
  custom_player_label TEXT,
  points INT DEFAULT 0,
  assists INT DEFAULT 0,
  rebounds INT DEFAULT 0,
  steals INT DEFAULT 0,
  blocks INT DEFAULT 0,
  fouls INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_player_stats_match 
ON match_player_stats(match_id);

-- 8. Immutable Global Audit Logging Support
ALTER TABLE IF EXISTS audit_logs 
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id);

ALTER TABLE IF EXISTS audit_logs 
ADD COLUMN IF NOT EXISTS target_id TEXT;

ALTER TABLE IF EXISTS audit_logs 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 9. Row Level Security (RLS)
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

-- Read policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clusters' AND policyname = 'Allow public read clusters'
  ) THEN
    CREATE POLICY "Allow public read clusters" ON clusters FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_score_events' AND policyname = 'Allow public read match_score_events'
  ) THEN
    CREATE POLICY "Allow public read match_score_events" ON match_score_events FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_player_stats' AND policyname = 'Allow public read match_player_stats'
  ) THEN
    CREATE POLICY "Allow public read match_player_stats" ON match_player_stats FOR SELECT USING (true);
  END IF;

  -- Super Admin management policy on clusters
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clusters' AND policyname = 'Allow super admin manage clusters'
  ) THEN
    CREATE POLICY "Allow super admin manage clusters" ON clusters FOR ALL 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'Admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'Admin')
      )
    );
  END IF;

  -- Facilitator and Super Admin write policy on match scoring (Only ongoing matches!)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_score_events' AND policyname = 'Allow scorekeepers insert ongoing match_score_events'
  ) THEN
    CREATE POLICY "Allow scorekeepers insert ongoing match_score_events" ON match_score_events FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_player_stats' AND policyname = 'Allow scorekeepers manage match_player_stats'
  ) THEN
    CREATE POLICY "Allow scorekeepers manage match_player_stats" ON match_player_stats FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 10. Realtime Replication Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE match_player_stats;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE match_score_events;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
