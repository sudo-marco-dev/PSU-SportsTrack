-- ==============================================================================
-- PSU SportsTrack: Expand Clusters for External Campuses as Whole Entities
-- Migration: 20261102_expand_clusters_for_external_campuses.sql
-- Strictly non-destructive: preserves existing tables, columns, and data
-- ==============================================================================

-- 1. Add campuses and color columns to clusters table
ALTER TABLE IF EXISTS clusters 
ADD COLUMN IF NOT EXISTS campuses TEXT[] DEFAULT '{}';

ALTER TABLE IF EXISTS clusters 
ADD COLUMN IF NOT EXISTS color VARCHAR(30) DEFAULT '#f97316';

-- 2. Ensure RLS policies on clusters allow super_admin and admin full management
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
    WHERE tablename = 'clusters' AND policyname = 'Allow admin insert clusters'
  ) THEN
    CREATE POLICY "Allow admin insert clusters" ON clusters FOR INSERT TO authenticated 
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'admin', 'dev')));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clusters' AND policyname = 'Allow admin update clusters'
  ) THEN
    CREATE POLICY "Allow admin update clusters" ON clusters FOR UPDATE TO authenticated 
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'admin', 'dev')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'admin', 'dev')));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clusters' AND policyname = 'Allow admin delete clusters'
  ) THEN
    CREATE POLICY "Allow admin delete clusters" ON clusters FOR DELETE TO authenticated 
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('super_admin', 'Admin', 'admin', 'dev')));
  END IF;
END $$;

-- 3. Seed/Update the authentic 6 Palawan State University Binturungan Tribes
-- Mapping Main Campus Colleges and External Campuses (Whole Entities)
INSERT INTO clusters (name, description, college_codes, campuses, color)
VALUES 
  (
    'Tribo Apolaki', 
    'God of Sun & War — College of Teacher Education (CTE), College of Criminal Justice Education (CCJE)', 
    ARRAY['CTE', 'CCJE'], 
    ARRAY[]::TEXT[], 
    '#f97316'
  ),
  (
    'Tribo Libulan', 
    'Deity of the Moon & Guidance — College of Engineering, Architecture and Technology (CEAT), College of Nursing and Health Sciences (CNHS)', 
    ARRAY['CEAT', 'CNHS'], 
    ARRAY[]::TEXT[], 
    '#3b82f6'
  ),
  (
    'Tribo Tala', 
    'Goddess of the Morning Star — College of Business and Accountancy (CBA), College of Hospitality Management and Tourism (CHMT)', 
    ARRAY['CBA', 'CHMT'], 
    ARRAY[]::TEXT[], 
    '#eab308'
  ),
  (
    'Tribo Haliya', 
    'Goddess of Moonlight & Protection — College of Sciences (CS), College of Arts and Humanities (CAH)', 
    ARRAY['CS', 'CAH'], 
    ARRAY[]::TEXT[], 
    '#a855f7'
  ),
  (
    'Tribo Mapulon', 
    'God of Seasons & Harvest — Southern External Campuses as whole entities (Brooke''s Point, Bataraza, Balabac, Sofronio Española, Narra, Quezon, Rizal)', 
    ARRAY[]::TEXT[], 
    ARRAY['PSU Brooke''s Point', 'PSU Bataraza', 'PSU Balabac', 'PSU Sofronio Española', 'PSU Narra', 'PSU Quezon', 'PSU Rizal'], 
    '#10b981'
  ),
  (
    'Tribo Dumangan', 
    'God of Bountiful Harvest — Northern & Island External Campuses as whole entities (Roxas, Taytay, Coron, San Vicente, El Nido, Cuyo, Dumaran, Linapacan, San Rafael, Araceli)', 
    ARRAY[]::TEXT[], 
    ARRAY['PSU Roxas', 'PSU Taytay', 'PSU Coron', 'PSU San Vicente', 'PSU El Nido', 'PSU Cuyo', 'PSU Dumaran', 'PSU Linapacan', 'PSU San Rafael', 'PSU Araceli'], 
    '#06b6d4'
  )
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description,
  college_codes = EXCLUDED.college_codes,
  campuses = EXCLUDED.campuses,
  color = EXCLUDED.color;
