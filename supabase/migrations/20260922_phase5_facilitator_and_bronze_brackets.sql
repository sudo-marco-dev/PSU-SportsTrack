-- ==============================================================================
-- PSU SportsTrack: Phase 5 Facilitator Authority, Bronze Bracket, and Team Ops
-- Migration: 20260922_phase5_facilitator_and_bronze_brackets.sql
-- Strictly non-destructive: alters tables with IF NOT EXISTS guards
-- ==============================================================================

-- 1. Matches Table Enhancements for Bronze Bracket & Facilitator Lease
ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS loser_next_match_id UUID;

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS loser_next_match_slot VARCHAR(10); -- 'team_a' | 'team_b'

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS active_scorekeeper_id UUID;

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS matches 
ADD COLUMN IF NOT EXISTS venue VARCHAR(150);

-- Safe foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_matches_loser_next_match' AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT fk_matches_loser_next_match 
    FOREIGN KEY (loser_next_match_id) REFERENCES matches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_matches_scorekeeper' AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT fk_matches_scorekeeper 
    FOREIGN KEY (active_scorekeeper_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Team Roster Enhancements for Lineup & Game-Day Ops
ALTER TABLE IF EXISTS team_roster 
ADD COLUMN IF NOT EXISTS position VARCHAR(50); -- e.g. 'PG', 'SG', 'SF', 'PF', 'C' / 'Setter', 'Spiker', 'Libero'

ALTER TABLE IF EXISTS team_roster 
ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS team_roster 
ADD COLUMN IF NOT EXISTS is_starter BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS team_roster 
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'active'; -- 'active', 'benched', 'injured', 'excused'

-- 3. Atomic Batch Sync RPC for Court-Side Offline Recovery
CREATE OR REPLACE FUNCTION sync_offline_match_events(
  p_match_id UUID,
  p_team_a_score INT,
  p_team_b_score INT,
  p_events JSONB DEFAULT '[]'::jsonb,
  p_is_completed BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event JSONB;
  v_inserted_count INT := 0;
BEGIN
  -- Update match score and completion status
  UPDATE matches 
  SET 
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    status = CASE WHEN p_is_completed THEN 'Completed'::match_status ELSE status END,
    updated_at = now()
  WHERE id = p_match_id;

  -- Insert all buffered commentary events
  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      INSERT INTO match_events (
        match_id, 
        description, 
        created_at
      ) VALUES (
        p_match_id,
        v_event->>'description',
        COALESCE((v_event->>'created_at')::timestamptz, now())
      );
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'events_synced', v_inserted_count,
    'status', CASE WHEN p_is_completed THEN 'Completed' ELSE 'Ongoing' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
