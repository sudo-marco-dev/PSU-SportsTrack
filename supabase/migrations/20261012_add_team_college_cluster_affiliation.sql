-- ==============================================================================
-- Migration: 20261012_add_team_college_cluster_affiliation.sql
-- Add designated College and Cluster / Tribe Affiliation to Teams
-- Strictly non-destructive: preserves existing tables, columns, and data
-- ==============================================================================

-- 1. Add affiliation_type, college_id, and cluster_id to teams table
ALTER TABLE IF EXISTS teams 
ADD COLUMN IF NOT EXISTS affiliation_type VARCHAR(20) NOT NULL DEFAULT 'college' CHECK (affiliation_type IN ('college', 'cluster'));

ALTER TABLE IF EXISTS teams 
ADD COLUMN IF NOT EXISTS college_id UUID;

ALTER TABLE IF EXISTS teams 
ADD COLUMN IF NOT EXISTS cluster_id UUID;

-- 2. Foreign Key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_teams_college' AND table_name = 'teams'
  ) THEN
    ALTER TABLE teams 
    ADD CONSTRAINT fk_teams_college 
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_teams_cluster' AND table_name = 'teams'
  ) THEN
    ALTER TABLE teams 
    ADD CONSTRAINT fk_teams_cluster 
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_teams_college_id ON teams(college_id);
CREATE INDEX IF NOT EXISTS idx_teams_cluster_id ON teams(cluster_id);
CREATE INDEX IF NOT EXISTS idx_teams_affiliation_type ON teams(affiliation_type);

-- 4. Seed Authentic Palawan State University Binturungan Tribes
INSERT INTO clusters (name, description, college_codes)
VALUES 
  ('Tribo Apolaki', 'God of Sun & War — College of Teacher Education (CTE), College of Criminal Justice Education (CCJE), Laboratory High School', ARRAY['CTE', 'CCJE']),
  ('Tribo Libulan', 'Deity of the Moon & Guidance — College of Engineering, Architecture and Technology (CEAT), College of Nursing and Health Sciences (CNHS), School of Law, School of Medicine', ARRAY['CEAT', 'CNHS']),
  ('Tribo Tala', 'Goddess of the Morning & Evening Star — College of Business and Accountancy (CBA), College of Hospitality Management and Tourism (CHMT)', ARRAY['CBA', 'CHMT']),
  ('Tribo Haliya', 'Goddess of Moonlight & Protection — College of Sciences (CS), College of Arts and Humanities (CAH)', ARRAY['CS', 'CAH']),
  ('Tribo Mapulon', 'God of Seasons & Harvest — CCRD Del Sur (Brooke''s Point, Bataraza, Balabac, Sofronio Española Campuses)', ARRAY['CCRD']),
  ('Tribo Dumangan', 'God of Bountiful Harvest — CCRD Del Norte (Roxas, Taytay, Coron, San Vicente, El Nido, Cuyo, Dumaran, Linapacan Campuses)', ARRAY['CCRD'])
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description,
  college_codes = EXCLUDED.college_codes;

-- 5. Backfill existing teams with college_id and cluster_id based on name/mascot patterns
DO $$
DECLARE
  r RECORD;
  cid UUID;
  clid UUID;
BEGIN
  -- Link teams matching College Names/Codes
  FOR r IN SELECT id, name FROM teams WHERE college_id IS NULL LOOP
    cid := NULL;
    clid := NULL;

    -- Detect CEAT
    IF r.name ILIKE '%CEAT%' OR r.name ILIKE '%Red Scorpions%' OR r.name ILIKE '%Engineering%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%CEAT%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Libulan' LIMIT 1;
    -- Detect CS
    ELSIF r.name ILIKE '%CS%' OR r.name ILIKE '%Byte Titans%' OR r.name ILIKE '%Sciences%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CS)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Haliya' LIMIT 1;
    -- Detect CBA
    ELSIF r.name ILIKE '%CBA%' OR r.name ILIKE '%Golden Wolves%' OR r.name ILIKE '%Wolves%' OR r.name ILIKE '%Business%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CBA)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Tala' LIMIT 1;
    -- Detect CCJE
    ELSIF r.name ILIKE '%CCJE%' OR r.name ILIKE '%Law Enforcers%' OR r.name ILIKE '%Criminal Justice%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CCJE)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Apolaki' LIMIT 1;
    -- Detect CTE
    ELSIF r.name ILIKE '%CTE%' OR r.name ILIKE '%Mentors%' OR r.name ILIKE '%Teacher Education%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CTE)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Apolaki' LIMIT 1;
    -- Detect CAH
    ELSIF r.name ILIKE '%CAH%' OR r.name ILIKE '%Artistics%' OR r.name ILIKE '%Arts and Humanities%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CAH)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Haliya' LIMIT 1;
    -- Detect CCRD
    ELSIF r.name ILIKE '%CCRD%' OR r.name ILIKE '%Foresters%' OR r.name ILIKE '%Community Resources%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CCRD)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Mapulon' LIMIT 1;
    -- Detect CHMT
    ELSIF r.name ILIKE '%CHMT%' OR r.name ILIKE '%Navigators%' OR r.name ILIKE '%Hospitality%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CHMT)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Tala' LIMIT 1;
    -- Detect CNHS
    ELSIF r.name ILIKE '%CNHS%' OR r.name ILIKE '%Medics%' OR r.name ILIKE '%Nursing%' THEN
      SELECT id INTO cid FROM colleges WHERE college_name ILIKE '%(CNHS)%' LIMIT 1;
      SELECT id INTO clid FROM clusters WHERE name = 'Tribo Libulan' LIMIT 1;
    END IF;

    IF cid IS NOT NULL THEN
      UPDATE teams 
      SET 
        college_id = cid, 
        cluster_id = clid,
        affiliation_type = 'college'
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
