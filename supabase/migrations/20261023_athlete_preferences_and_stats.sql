-- Add athlete scouting preferences & primary position to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_sports text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_position text;

COMMENT ON COLUMN public.users.preferred_sports IS 'Preferred sports declared by the athlete for scouting and recruitment';
COMMENT ON COLUMN public.users.primary_position IS 'Primary playing position declared by the athlete';
