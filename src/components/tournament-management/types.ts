import type { IconType } from 'react-icons';
import {
  GiBasketballBall,
  GiVolleyballBall,
  GiSoccerBall,
  GiBaseballBat,
  GiBaseballGlove,
  GiSoccerKick,
  GiPingPongBat,
  GiTennisRacket
} from 'react-icons/gi';

export type Tournament = {
  id: string;
  name: string;
  sport: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type PendingTeam = {
  id: string;
  name: string;
  status: string;
  users: {
    full_name: string;
  } | null;
  tournaments: {
    name: string;
  } | null;
};

export type SportConfig = {
  name: string;
  icon: IconType;
  category: string;
};

export const BINTURUNGAN_DEFAULT_SPORTS: SportConfig[] = [
  { name: 'Basketball', icon: GiBasketballBall, category: 'Court' },
  { name: 'Volleyball', icon: GiVolleyballBall, category: 'Court' },
  { name: 'Soccer', icon: GiSoccerBall, category: 'Pitch' },
  { name: 'Futsal', icon: GiSoccerKick, category: 'Indoor' },
  { name: 'Sepak Takraw', icon: GiSoccerKick, category: 'Court' },
  { name: 'Baseball', icon: GiBaseballBat, category: 'Diamond' },
  { name: 'Softball', icon: GiBaseballGlove, category: 'Diamond' },
  { name: 'Pickleball', icon: GiTennisRacket, category: 'Paddle' },
  { name: 'Table Tennis', icon: GiPingPongBat, category: 'Paddle' },
];

export const BALLGAMES_LIST = BINTURUNGAN_DEFAULT_SPORTS;

export type BracketFormatType = 'single' | 'double' | 'round_robin_only' | 'round_robin_playoffs';

export type ProposedMatch = {
  team_a_id: string | null;
  team_a_name: string;
  team_b_id: string | null;
  team_b_name: string;
  round: string;
  match_time: string;
  venue: string;
  local_id: string;
  next_match_local_id?: string;
  next_match_slot?: 'team_a' | 'team_b';
  loser_next_match_local_id?: string;
  loser_next_match_slot?: 'team_a' | 'team_b';
  is_editable_seed?: boolean;
  bracket_section?: 'upper' | 'lower' | 'finals' | 'pool';
};

export type ApprovedTeam = {
  id: string;
  name: string;
};

export type TournamentStanding = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  finalRank?: number;
  stage?: string;
  medal?: 'gold' | 'silver' | 'bronze' | 'elimination';
};
