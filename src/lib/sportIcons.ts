import type { IconType } from 'react-icons';
import { 
  GiBasketballBall, 
  GiVolleyballBall, 
  GiSoccerBall, 
  GiShuttlecock, 
  GiBaseballBat, 
  GiSoccerKick, 
  GiPingPongBat, 
  GiGamepad, 
  GiChessKnight, 
  GiRunningShoe 
} from 'react-icons/gi';
import { FaPersonSwimming } from 'react-icons/fa6';
import { Trophy } from 'lucide-react';

export const SPORT_ICONS: Record<string, IconType> = {
  Basketball: GiBasketballBall,
  Volleyball: GiVolleyballBall,
  Soccer: GiSoccerBall,
  Football: GiSoccerBall,
  Badminton: GiShuttlecock,
  Baseball: GiBaseballBat,
  Futsal: GiSoccerKick,
  'Table Tennis': GiPingPongBat,
  Esports: GiGamepad,
  Chess: GiChessKnight,
  Swimming: FaPersonSwimming,
  Athletics: GiRunningShoe,
  Running: GiRunningShoe,
  Track: GiRunningShoe,
};

export const getSportIcon = (sportName?: string | null): IconType => {
  if (!sportName) return Trophy as unknown as IconType;
  const normalized = sportName.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (normalized.includes(key.toLowerCase())) return icon;
  }
  return Trophy as unknown as IconType;
};
