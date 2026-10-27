-- Migration: Open public directory for active users & rosters (Athletics Hub)
-- Enables unauthenticated guests and university community to view active athletes, coaches, and squad rosters.

-- 1. Users Table Public Directory
DROP POLICY IF EXISTS "Allow read of users to authenticated users" ON public.users;

CREATE POLICY "Allow public read of active users" 
ON public.users 
FOR SELECT 
TO public 
USING (account_status = 'active');

-- 2. Team Roster Public Directory (view squad compositions, positions, jersey numbers)
DROP POLICY IF EXISTS "Allow read of team_roster to authenticated users" ON public.team_roster;

CREATE POLICY "Allow public read of team_roster" 
ON public.team_roster 
FOR SELECT 
TO public 
USING (true);
