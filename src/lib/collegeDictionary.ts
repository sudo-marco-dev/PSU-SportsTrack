/**
 * Official Palawan State University College & Department lookup dictionary.
 * Maps full institutional names and common variations to clean 2-4 character acronym badges.
 */
export const PSU_COLLEGE_DICTIONARY: Record<string, string> = {
  // CEAT
  'college of engineering, architecture and technology': 'CEAT',
  'college of engineering architecture and technology': 'CEAT',
  'engineering, architecture and technology': 'CEAT',
  'engineering': 'CEAT',

  // CS
  'college of sciences': 'CS',
  'sciences': 'CS',

  // CBA
  'college of business and accountancy': 'CBA',
  'college of business administration': 'CBA',
  'business and accountancy': 'CBA',
  'business administration': 'CBA',

  // CCJE
  'college of criminal justice education': 'CCJE',
  'criminal justice education': 'CCJE',
  'criminal justice': 'CCJE',

  // CTE
  'college of teacher education': 'CTE',
  'teacher education': 'CTE',
  'education': 'CTE',

  // CAH
  'college of arts and humanities': 'CAH',
  'arts and humanities': 'CAH',

  // CCRD
  'college of community resources development': 'CCRD',
  'community resources development': 'CCRD',

  // CHMT
  'college of hospitality management and tourism': 'CHMT',
  'college of hospitality and tourism': 'CHMT',
  'hospitality management and tourism': 'CHMT',
  'hospitality and tourism': 'CHMT',

  // CNHS
  'college of nursing and health sciences': 'CNHS',
  'nursing and health sciences': 'CNHS',

  // CAS (Historic / Cluster variant)
  'college of arts and sciences': 'CAS',
  'arts and sciences': 'CAS',

  // CIT / COE
  'college of industrial technology': 'CIT',
  'college of information technology': 'CIT',
  'college of engineering': 'COE',

  // Law & Medicine
  'school of law': 'SOL',
  'school of medicine': 'SOM',
};

/**
 * Extracts short college code from full college name, e.g.:
 * "College of Sciences (CS)" -> "CS"
 * "College of Engineering, Architecture and Technology" -> "CEAT"
 */
export function extractCollegeCode(collegeName?: string | null): string {
  if (!collegeName) return '';
  const trimmed = collegeName.trim();
  if (!trimmed) return '';

  // 1. Check for explicit parenthesis abbreviation: e.g. "College of Sciences (CS)"
  const match = trimmed.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim().toUpperCase();
  }

  // Normalize: lower-case, normalize '&' to 'and', collapse spaces
  const normalized = trimmed
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ');

  // 2. Check exact dictionary match on normalized lowercase string
  if (PSU_COLLEGE_DICTIONARY[normalized]) {
    return PSU_COLLEGE_DICTIONARY[normalized];
  }

  // 3. Keyword and acronym-boundary fuzzy lookup against PSU colleges
  if (normalized.includes('engineering') || /\bceat\b/i.test(normalized)) return 'CEAT';
  if (normalized.includes('nursing') || normalized.includes('health science') || /\bcnhs\b/i.test(normalized)) return 'CNHS';
  if (normalized.includes('criminal justice') || normalized.includes('criminology') || /\bccje\b/i.test(normalized)) return 'CCJE';
  if (normalized.includes('hospitality') || normalized.includes('tourism') || /\bchmt\b/i.test(normalized)) return 'CHMT';
  if (normalized.includes('teacher') || normalized.includes('education') || /\bcte\b/i.test(normalized)) return 'CTE';
  if (normalized.includes('humanities') || normalized.includes('arts and humanities') || /\bcah\b/i.test(normalized)) return 'CAH';
  if (normalized.includes('community resource') || /\bccrd\b/i.test(normalized)) return 'CCRD';
  if (normalized.includes('business') || normalized.includes('accountancy') || /\bcba\b/i.test(normalized)) return 'CBA';
  if (normalized.includes('arts and science') || /\bcas\b/i.test(normalized)) return 'CAS';
  if (/\bcs\b/i.test(normalized) || (!normalized.includes('arts') && normalized.includes('science'))) return 'CS';
  if (normalized.includes('law') || /\bsol\b/i.test(normalized)) return 'SOL';
  if (normalized.includes('medicine') || /\bsom\b/i.test(normalized)) return 'SOM';

  // 4. If short acronym already (e.g., "CS", "CBA", "CTE"), return uppercase
  if (trimmed.length <= 6 && !trimmed.includes(' ')) {
    return trimmed.toUpperCase();
  }

  // 5. Acronym generation fallback: take first letter of major title words
  const acronym = trimmed
    .split(/\s+/)
    .filter((w) => !['of', 'and', '&', 'the', 'for', 'in', '-'].includes(w.toLowerCase()))
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return acronym.slice(0, 5) || trimmed.slice(0, 4).toUpperCase();
}
