-- Allow coaches managing teams to update team roster entries (jersey number, starter, captaincy, position, availability_status)
DROP POLICY IF EXISTS "Allow roster acceptance/rejection by player or admin" ON team_roster;
DROP POLICY IF EXISTS "Allow roster management by coach, player, or admin" ON team_roster;

CREATE POLICY "Allow roster management by coach, player, or admin"
ON team_roster
FOR UPDATE
TO authenticated
USING (
  (player_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_roster.team_id
      AND (teams.coach_id = auth.uid() OR has_role('Admin'::text) OR has_role('super_admin'::text))
  ))
)
WITH CHECK (
  (player_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_roster.team_id
      AND (teams.coach_id = auth.uid() OR has_role('Admin'::text) OR has_role('super_admin'::text))
  ))
);
