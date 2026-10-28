-- Migration: 20261029_convert_year_level_to_int_and_purge_strasuc.sql
-- Description:
-- 1. Cleans and converts public.users.year_level from text to integer (1 through 5).
-- 2. Purges legacy 'STRASUC' from tournaments_type_check constraint, leaving strictly
--    Binturungan, Inter-Collegiate, Friendly, and Faculty & Staff Friendly games.

BEGIN;

-- 1. Standardize and clean year_level in public.users
UPDATE public.users
SET year_level = CASE
  WHEN year_level ILIKE '1%' OR year_level ILIKE 'first%' THEN '1'
  WHEN year_level ILIKE '2%' OR year_level ILIKE 'sec%' THEN '2'
  WHEN year_level ILIKE '3%' OR year_level ILIKE 'thi%' THEN '3'
  WHEN year_level ILIKE '4%' OR year_level ILIKE 'four%' THEN '4'
  WHEN year_level ILIKE '5%' OR year_level ILIKE 'fif%' THEN '5'
  ELSE NULL
END
WHERE year_level IS NOT NULL;

-- 2. Alter column to integer with check constraint (1 to 5)
ALTER TABLE public.users
  ALTER COLUMN year_level TYPE integer
  USING (
    CASE 
      WHEN year_level ~ '^[0-9]+$' THEN year_level::integer 
      ELSE NULL 
    END
  );

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_year_level_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_year_level_check
  CHECK (year_level IS NULL OR (year_level >= 1 AND year_level <= 5));

-- 3. Update tournaments_type_check constraint to strictly purge STRASUC
ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_type_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_type_check CHECK (
    type = ANY (ARRAY[
      'Friendly'::text,
      'Friendly Games'::text,
      'Inter-Collegiate'::text,
      'Inter-Collegiate League'::text,
      'Faculty and Staff Friendly Games'::text,
      'Faculty & Staff Friendly Games'::text,
      'Binturungan'::text
    ])
  );

COMMIT;
