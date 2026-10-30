/**
 * Official Palawan State University (PSU) Campuses Directory.
 * Covers the university system's main campus and provincial community campuses.
 */
export const PSU_CAMPUSES = [
  'PSU Main Campus (Puerto Princesa)',
  'PSU Araceli',
  'PSU Balabac',
  'PSU Bataraza',
  'PSU Brooke\'s Point',
  'PSU Coron',
  'PSU Cuyo',
  'PSU Dumaran',
  'PSU El Nido',
  'PSU Linapacan',
  'PSU Narra',
  'PSU Quezon',
  'PSU Rizal',
  'PSU Roxas',
  'PSU San Rafael',
  'PSU San Vicente',
  'PSU Sofronio Española',
  'PSU Taytay',
] as const;

export type PsuCampus = typeof PSU_CAMPUSES[number];

export const DEFAULT_PSU_CAMPUS: PsuCampus = 'PSU Main Campus (Puerto Princesa)';

/**
 * Returns clean short campus name for display chips (e.g. "Main", "Narra", "Coron").
 */
export function formatCampusShort(campus?: string | null): string {
  if (!campus) return 'PSU Main';
  return campus
    .replace(/^PSU\s+/i, '')
    .replace(/\s*\(Puerto Princesa\)/i, '')
    .trim() || 'Main';
}
