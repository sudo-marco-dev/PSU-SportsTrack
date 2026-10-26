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

