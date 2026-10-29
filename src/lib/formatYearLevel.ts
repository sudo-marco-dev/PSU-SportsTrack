/**
 * Utility functions for year level formatting and parsing.
 * The backend stores year_level as an integer (1 to 5).
 * The frontend formats them as "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year".
 */

export const YEAR_LEVEL_OPTIONS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
  { value: 5, label: '5th Year' },
] as const;

/**
 * Formats an integer (or string representation of an integer/text) to human-readable year level.
 * Example:
 * 1 -> "1st Year"
 * 2 -> "2nd Year"
 * 3 -> "3rd Year"
 * 4 -> "4th Year"
 * 5 -> "5th Year"
 */
export function formatYearLevel(year: number | string | null | undefined): string {
  if (year === null || year === undefined || year === '') return '';

  const num = typeof year === 'number' ? year : parseInt(String(year).replace(/\D/g, ''), 10);
  if (isNaN(num)) {
    // If it's pure word like 'first' or already contains Year
    const s = String(year).trim();
    if (/first/i.test(s)) return '1st Year';
    if (/second/i.test(s)) return '2nd Year';
    if (/third/i.test(s)) return '3rd Year';
    if (/fourth/i.test(s)) return '4th Year';
    if (/fifth/i.test(s)) return '5th Year';
    return s;
  }

  switch (num) {
    case 1:
      return '1st Year';
    case 2:
      return '2nd Year';
    case 3:
      return '3rd Year';
    case 4:
      return '4th Year';
    case 5:
      return '5th Year';
    default:
      return `${num}th Year`;
  }
}

/**
 * Parses user input (string or number) into a strict integer (1-5) or null.
 */
export function parseYearLevelInt(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return val >= 1 && val <= 5 ? Math.floor(val) : null;
  }

  const str = String(val).trim().toLowerCase();
  const digitMatch = str.match(/\d+/);
  if (digitMatch) {
    const parsed = parseInt(digitMatch[0], 10);
    return parsed >= 1 && parsed <= 5 ? parsed : null;
  }

  if (str.includes('first') || str.includes('1st')) return 1;
  if (str.includes('second') || str.includes('2nd')) return 2;
  if (str.includes('third') || str.includes('3rd')) return 3;
  if (str.includes('fourth') || str.includes('4th')) return 4;
  if (str.includes('fifth') || str.includes('5th')) return 5;

  return null;
}
