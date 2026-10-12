export type SportScoringAction = {
  label: string;
  sublabel: string;
  points: number;
  actionType: string;
  description: string;
};

export type SportScoringProfile = {
  sport: string;
  pointUnit: string; // 'PTS', 'GOALS', 'RUNS', etc.
  periods: string[];
  actions: SportScoringAction[];
  deductibleValues: number[];
  teamFoulBonusThreshold?: number; // Fouls before penalty/bonus
  defaultTimeouts?: number;        // Total timeouts
  defaultPeriodMinutes?: number;   // Default game clock period in minutes (0 if untimed/set-based)
  onCourtPlayerCount?: number;     // Active players on court/field
};

export const SPORT_SCORING_PROFILES: Record<string, SportScoringProfile> = {
  Basketball: {
    sport: 'Basketball',
    pointUnit: 'PTS',
    periods: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter', 'Overtime (OT)'],
    actions: [
      { label: '+1', sublabel: 'Free Throw', points: 1, actionType: 'FT', description: 'Free Throw (+1)' },
      { label: '+2', sublabel: 'Field Goal', points: 2, actionType: 'Field', description: '2-Point Field Goal (+2)' },
      { label: '+3', sublabel: '3-Pointer', points: 3, actionType: 'Triple', description: '3-Point Field Goal (+3)' },
    ],
    deductibleValues: [1, 2, 3],
    teamFoulBonusThreshold: 5,
    defaultTimeouts: 3,
    defaultPeriodMinutes: 10,
    onCourtPlayerCount: 5,
  },
  Soccer: {
    sport: 'Soccer',
    pointUnit: 'GOALS',
    periods: ['1st Half', '2nd Half', 'Extra Time (ET)', 'Penalties (PK)'],
    actions: [
      { label: '+1', sublabel: 'Field Goal', points: 1, actionType: 'Goal', description: 'Goal from open play (+1)' },
      { label: '+1', sublabel: 'Penalty Kick', points: 1, actionType: 'Penalty', description: 'Penalty Kick Goal (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 0,
    defaultPeriodMinutes: 45,
    onCourtPlayerCount: 11,
  },
  Football: {
    sport: 'Football',
    pointUnit: 'GOALS',
    periods: ['1st Half', '2nd Half', 'Extra Time (ET)', 'Penalties (PK)'],
    actions: [
      { label: '+1', sublabel: 'Field Goal', points: 1, actionType: 'Goal', description: 'Goal from open play (+1)' },
      { label: '+1', sublabel: 'Penalty Kick', points: 1, actionType: 'Penalty', description: 'Penalty Kick Goal (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 0,
    defaultPeriodMinutes: 45,
    onCourtPlayerCount: 11,
  },
  Futsal: {
    sport: 'Futsal',
    pointUnit: 'GOALS',
    periods: ['1st Half', '2nd Half', 'Extra Time'],
    actions: [
      { label: '+1', sublabel: 'Field Goal', points: 1, actionType: 'Goal', description: 'Futsal Goal (+1)' },
      { label: '+1', sublabel: 'Penalty Kick', points: 1, actionType: 'Penalty', description: 'Penalty Goal (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 5,
    defaultTimeouts: 1,
    defaultPeriodMinutes: 20,
    onCourtPlayerCount: 5,
  },
  Volleyball: {
    sport: 'Volleyball',
    pointUnit: 'PTS',
    periods: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Deciding Set 5'],
    actions: [
      { label: '+1', sublabel: 'Kill / Attack', points: 1, actionType: 'Kill', description: 'Spike / Attack Kill (+1)' },
      { label: '+1', sublabel: 'Service Ace', points: 1, actionType: 'Ace', description: 'Direct Service Ace (+1)' },
      { label: '+1', sublabel: 'Block Point', points: 1, actionType: 'Block', description: 'Defensive Block Point (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 2,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 6,
  },
  'Sepak Takraw': {
    sport: 'Sepak Takraw',
    pointUnit: 'PTS',
    periods: ['Set 1 (Regu)', 'Set 2 (Regu)', 'Tie-Break Set 3'],
    actions: [
      { label: '+1', sublabel: 'Roll Spike', points: 1, actionType: 'Spike', description: 'Overhead Roll Spike (+1)' },
      { label: '+1', sublabel: 'Service Ace', points: 1, actionType: 'Ace', description: 'Tekong Service Ace (+1)' },
      { label: '+1', sublabel: 'Block Point', points: 1, actionType: 'Block', description: 'Net Block Point (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 1,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 3,
  },
  Baseball: {
    sport: 'Baseball',
    pointUnit: 'RUNS',
    periods: ['Inning 1', 'Inning 2', 'Inning 3', 'Inning 4', 'Inning 5', 'Inning 6', 'Inning 7', 'Inning 8', 'Inning 9', 'Extra Inning'],
    actions: [
      { label: '+1', sublabel: 'Run / RBI', points: 1, actionType: 'Run', description: 'Single Run / RBI (+1)' },
      { label: '+2', sublabel: '2-Run HR', points: 2, actionType: '2-Run', description: '2-Run Home Run (+2)' },
      { label: '+3', sublabel: '3-Run HR', points: 3, actionType: '3-Run', description: '3-Run Home Run (+3)' },
      { label: '+4', sublabel: 'Grand Slam', points: 4, actionType: 'GrandSlam', description: 'Grand Slam (+4)' },
    ],
    deductibleValues: [1, 2, 3, 4],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 0,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 9,
  },
  Softball: {
    sport: 'Softball',
    pointUnit: 'RUNS',
    periods: ['Inning 1', 'Inning 2', 'Inning 3', 'Inning 4', 'Inning 5', 'Inning 6', 'Inning 7', 'Extra Inning'],
    actions: [
      { label: '+1', sublabel: 'Run / RBI', points: 1, actionType: 'Run', description: 'Single Run / RBI (+1)' },
      { label: '+2', sublabel: '2-Run HR', points: 2, actionType: '2-Run', description: '2-Run Home Run (+2)' },
      { label: '+3', sublabel: '3-Run HR', points: 3, actionType: '3-Run', description: '3-Run Home Run (+3)' },
      { label: '+4', sublabel: 'Grand Slam', points: 4, actionType: 'GrandSlam', description: 'Grand Slam (+4)' },
    ],
    deductibleValues: [1, 2, 3, 4],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 0,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 9,
  },
  Pickleball: {
    sport: 'Pickleball',
    pointUnit: 'PTS',
    periods: ['Game 1', 'Game 2', 'Deciding Game 3'],
    actions: [
      { label: '+1', sublabel: 'Rally Point', points: 1, actionType: 'Point', description: 'Rally Point (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 2,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 2,
  },
  'Table Tennis': {
    sport: 'Table Tennis',
    pointUnit: 'PTS',
    periods: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
    actions: [
      { label: '+1', sublabel: 'Point', points: 1, actionType: 'Point', description: 'Point Winner (+1)' },
    ],
    deductibleValues: [1],
    teamFoulBonusThreshold: 0,
    defaultTimeouts: 1,
    defaultPeriodMinutes: 0,
    onCourtPlayerCount: 1,
  },
};

const DEFAULT_PROFILE: SportScoringProfile = {
  sport: 'General Ball Game',
  pointUnit: 'PTS',
  periods: ['Period 1', 'Period 2', 'Period 3', 'Period 4'],
  actions: [
    { label: '+1', sublabel: 'Point', points: 1, actionType: 'FT', description: '1 Point (+1)' },
    { label: '+2', sublabel: 'Field Goal', points: 2, actionType: 'Field', description: '2 Points (+2)' },
    { label: '+3', sublabel: '3-Pointer', points: 3, actionType: 'Triple', description: '3 Points (+3)' },
  ],
  deductibleValues: [1, 2, 3],
  teamFoulBonusThreshold: 5,
  defaultTimeouts: 3,
  defaultPeriodMinutes: 10,
  onCourtPlayerCount: 5,
};

export const getSportScoringProfile = (sportName?: string | null): SportScoringProfile => {
  if (!sportName) return DEFAULT_PROFILE;
  const normalized = sportName.toLowerCase();
  for (const [key, profile] of Object.entries(SPORT_SCORING_PROFILES)) {
    if (normalized.includes(key.toLowerCase())) return profile;
  }
  return DEFAULT_PROFILE;
};
