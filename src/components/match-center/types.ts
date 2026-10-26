import { extractCollegeCode } from '@/lib/playerStatsEngine';

export type Tournament = {
  id: string;
  name: string;
  sport?: string | null;
  type?: string | null;
  status: string;
  start_date: string;
  end_date?: string | null;
  is_deleted?: boolean | null;
};

export type TeamAffiliation = {
  id: string;
  name: string;
  affiliation_type: 'college' | 'cluster';
  college_id?: string | null;
  cluster_id?: string | null;
  colleges?: { college_name: string } | null;
  clusters?: { name: string } | null;
};

export type Match = {
  id: string;
  tournament_id: string;
  team_a_id?: string;
  team_b_id?: string;
  team_a_score: number;
  team_b_score: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  match_time: string;
  venue?: string | null;
  tournament?: Tournament | null;
  team_a: { name: string; sport?: string | null } | null;
  team_b: { name: string; sport?: string | null } | null;
  next_match_id?: string | null;
  next_match_slot?: string | null;
};

export type AffiliationBadgeData = {
  type: 'college' | 'cluster';
  label: string;
  badge: string;
  fullName: string;
};

export const getAffiliationBadge = (
  teamId?: string | null,
  teamName?: string | null,
  map?: Map<string, TeamAffiliation>
): AffiliationBadgeData | null => {
  if (!map) return null;
  let t = teamId ? map.get(teamId) : null;
  if (!t && teamName) {
    for (const val of map.values()) {
      if (val.name.toLowerCase() === teamName.toLowerCase()) {
        t = val;
        break;
      }
    }
  }
  if (!t) return null;
  if (t.affiliation_type === 'cluster' && t.clusters?.name) {
    return {
      type: 'cluster',
      label: t.clusters.name,
      badge: t.clusters.name.replace('Tribo ', ''),
      fullName: t.clusters.name
    };
  }
  if (t.colleges?.college_name) {
    const code = extractCollegeCode(t.colleges.college_name);
    return {
      type: 'college',
      label: code,
      badge: code,
      fullName: t.colleges.college_name
    };
  }
  return null;
};
