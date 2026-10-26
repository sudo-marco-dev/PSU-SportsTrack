import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes and formats coach names, guaranteeing a single "Coach" title prefix
 * and preventing duplicate prefixes like "Coach Coach Danilo Soriano".
 */
export function formatCoachName(fullName?: string | null, fallback = 'Coach'): string {
  if (!fullName || !fullName.trim()) return fallback;
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const stripped = cleaned.replace(/^(?:coach\b[\s.:-]*)+/i, '').trim();
  if (!stripped) return fallback;
  return `Coach ${stripped}`;
}
/**
 * Normalizes and formats system and user role strings into official PSU SportsTrack human-readable titles.
 * Eliminates snake_case enums like `player_student` or `player_faculty`.
 */
export function formatRole(r?: string | null, fallback = 'Spectator'): string {
  if (!r || !r.trim()) return fallback;
  const lower = r.trim().toLowerCase();
  if (lower === 'player_student' || lower === 'player') return 'Student Athlete';
  if (lower === 'player_faculty' || lower === 'faculty') return 'Faculty Athlete';
  if (lower === 'player_staff' || lower === 'staff') return 'Staff Athlete';
  if (lower === 'coach') return 'Athletic Coach';
  if (lower === 'facilitator') return 'Facilitator';
  if (lower === 'super_admin' || lower === 'admin') return 'Super Admin';
  if (lower === 'official') return 'Match Official';
  if (lower === 'dev') return 'Developer';

  // If there are underscores, automatically convert snake_case to Title Case
  if (r.includes('_')) {
    return r
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  return r;
}

/**
 * Global SelectValue formatter that translates raw enums, role values, and snake_case strings
 * into clean, presentation-ready labels.
 */
export function formatSelectValue(val: any): any {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val !== 'string') return val;

  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();

  // 1. Roles
  if (
    lower === 'player_student' ||
    lower === 'player_faculty' ||
    lower === 'player_staff' ||
    lower === 'coach' ||
    lower === 'facilitator' ||
    lower === 'super_admin' ||
    lower === 'official' ||
    lower === 'dev'
  ) {
    return formatRole(trimmed);
  }

  // 2. Common status & tournament enums
  const ENUM_MAP: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    injured: 'Injured',
    benched: 'Benched',
    suspended: 'Suspended',
    archived: 'Archived',
    soft_deleted: 'Soft Deleted',
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    round_robin: 'Round Robin',
    best_of_1: 'Best of 1',
    best_of_3: 'Best of 3',
    best_of_5: 'Best of 5',
    pg: 'Point Guard (PG)',
    sg: 'Shooting Guard (SG)',
    sf: 'Small Forward (SF)',
    pf: 'Power Forward (PF)',
    c: 'Center (C)',
  };

  if (ENUM_MAP[lower]) {
    return ENUM_MAP[lower];
  }

  // 3. Any string containing underscores (e.g. unknown_role or other enums)
  if (trimmed.includes('_')) {
    return trimmed
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  return trimmed;
}
