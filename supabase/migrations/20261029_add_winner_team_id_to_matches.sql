-- Migration: Add winner_team_id to public.matches table
-- Fixes trigger trg_advance_bracket_on_match_completed error when finalizing / completing matches

ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.matches.winner_team_id IS 'Official winning team ID of the completed match, supporting automated bracket progression';
