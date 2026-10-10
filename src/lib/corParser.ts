import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker source for pdfjs-dist
try {
  // Try using local worker or unpkg CDN as fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ParsedPsuCor {
  isParsable: boolean;
  studentNo: string | null;
  fullName: string | null;
  college: string | null;
  program: string | null;
  schoolYear: string | null;
  yearLevel: string | null;
  gender: string | null;
  age: number | null;
  totalUnits: string | null;
  rawText: string;
  confidenceScore: number; // 0 - 100
  confidenceLevel: 'High' | 'Moderate' | 'Low' | 'Non-Parsable';
  matchDetails: {
    nameMatch: 'Exact' | 'Partial' | 'Mismatch' | 'Unknown';
    nameSimilarity: number; // 0 - 1
    collegeMatch: 'Exact' | 'Partial' | 'Mismatch' | 'Unassigned';
    emailMatch: 'Exact' | 'Partial' | 'Mismatch' | 'Non-Corporate' | 'Unknown';
    isPsuEmail: boolean;
    isOfficialPsu: boolean;
    isCurrentTerm: boolean;
  };
  errorMessage?: string;
}

/**
 * Extract plain text from an uploaded PDF file using pdfjs-dist.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Normalizes text for comparison by removing accents, special punctuation, and excess spaces.
 */
function cleanText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Computes token and structure-based similarity between user's registered name and extracted name.
 * Handles both "LastName, FirstName" and "FirstName LastName" formats gracefully.
 */
function computeNameSimilarity(registeredName: string, extractedName: string): {
  similarity: number;
  match: 'Exact' | 'Partial' | 'Mismatch';
} {
  const regClean = cleanText(registeredName);
  const extClean = cleanText(extractedName);

  if (!regClean || !extClean) {
    return { similarity: 0, match: 'Mismatch' };
  }

  // 1. Direct exact match
  if (regClean === extClean) {
    return { similarity: 1.0, match: 'Exact' };
  }

  // 2. Structured Last Name, First Name check if comma is present in either or both
  if (registeredName.includes(',') && extractedName.includes(',')) {
    const [regLast, ...regFirstRest] = registeredName.split(',').map((s) => cleanText(s));
    const [extLast, ...extFirstRest] = extractedName.split(',').map((s) => cleanText(s));
    const regFirst = regFirstRest.join(' ').trim();
    const extFirst = extFirstRest.join(' ').trim();

    const isLastMatch = regLast === extLast || extLast.includes(regLast) || regLast.includes(extLast);
    const isFirstMatch = regFirst === extFirst || extFirst.includes(regFirst) || regFirst.includes(extFirst);

    if (isLastMatch && isFirstMatch) {
      return { similarity: 1.0, match: 'Exact' };
    }
  }

  // 3. Token-based overlap
  const regTokens = regClean.split(' ').filter((t) => t.length > 1);
  const extTokens = extClean.split(' ').filter((t) => t.length > 1);

  if (regTokens.length === 0 || extTokens.length === 0) {
    return { similarity: 0, match: 'Mismatch' };
  }

  // Count how many tokens in registered name appear in extracted name
  let matchCount = 0;
  for (const token of regTokens) {
    if (extTokens.includes(token)) {
      matchCount++;
    }
  }

  const coverage = matchCount / regTokens.length;

  if (coverage >= 0.85 || (matchCount >= 2 && coverage >= 0.75)) {
    return { similarity: coverage, match: 'Exact' };
  } else if (coverage >= 0.45 || matchCount >= 1) {
    return { similarity: coverage, match: 'Partial' };
  }
  return { similarity: coverage, match: 'Mismatch' };
}

/**
 * Evaluates match between user's registered university corporate email and extracted student number.
 * Official PSU student email format: <clean_student_number>@psu.palawan.edu.ph
 * e.g., Student No: "2023-8-0284" -> Corporate Email: "202380284@psu.palawan.edu.ph"
 */
function computeEmailStudentIdMatch(
  registeredEmail?: string | null,
  extractedStudentNo?: string | null
): {
  match: 'Exact' | 'Partial' | 'Mismatch' | 'Non-Corporate';
  isPsuDomain: boolean;
  score: number;
} {
  if (!registeredEmail || !extractedStudentNo) {
    return { match: 'Mismatch', isPsuDomain: false, score: 0 };
  }

  const emailLower = registeredEmail.toLowerCase().trim();
  const isPsuDomain =
    emailLower.endsWith('@psu.palawan.edu.ph') ||
    emailLower.endsWith('psu.palawan.edu.ph');
  const emailPrefix = emailLower.split('@')[0].replace(/[^0-9a-z]/g, '');
  const cleanId = extractedStudentNo.replace(/[^0-9a-z]/g, '').toLowerCase();

  // Exact Match: email prefix is identical to cleaned student number (e.g. 202380284 === 202380284)
  if (cleanId.length >= 5 && emailPrefix === cleanId) {
    return {
      match: 'Exact',
      isPsuDomain,
      score: isPsuDomain ? 25 : 15,
    };
  }

  // Partial Match: email prefix contains student ID or vice versa
  if (cleanId.length >= 5 && (emailPrefix.includes(cleanId) || cleanId.includes(emailPrefix))) {
    return {
      match: 'Partial',
      isPsuDomain,
      score: isPsuDomain ? 18 : 10,
    };
  }

  // Official PSU domain email, but prefix differs (e.g., faculty/coach or legacy accounts)
  if (isPsuDomain) {
    return {
      match: 'Partial',
      isPsuDomain: true,
      score: 10,
    };
  }

  return {
    match: 'Non-Corporate',
    isPsuDomain: false,
    score: 0,
  };
}

/**
 * Computes college matching between registered college name and extracted college.
 */
function computeCollegeMatch(
  registeredCollege?: string | null,
  extractedCollege?: string | null
): 'Exact' | 'Partial' | 'Mismatch' | 'Unassigned' {
  if (!registeredCollege) return 'Unassigned';
  if (!extractedCollege) return 'Mismatch';

  const reg = cleanText(registeredCollege).replace(/COLLEGE OF|COLLEGE/g, '').trim();
  const ext = cleanText(extractedCollege).replace(/COLLEGE OF|COLLEGE/g, '').trim();

  if (reg === ext || ext.includes(reg) || reg.includes(ext)) {
    return 'Exact';
  }

  // Check token intersection
  const regTokens = reg.split(' ').filter((t) => t.length > 2);
  const extTokens = ext.split(' ').filter((t) => t.length > 2);
  const hasCommon = regTokens.some((t) => extTokens.includes(t));

  return hasCommon ? 'Partial' : 'Mismatch';
}

/**
 * Parse raw text extracted from an official PSU Certificate of Registration (COR).
 */
export function parsePsuCor(
  rawText: string,
  registeredUser: { fullName: string; collegeName?: string | null; email?: string | null }
): ParsedPsuCor {
  const trimmed = rawText.trim();

  // 1. Check if the PDF has readable text and PSU markers
  const hasPsuMarker = /Palawan\s*State\s*University/i.test(trimmed);
  const hasCorMarker = /CERTIFICATE\s*OF\s*REGISTRATION/i.test(trimmed);
  const hasStudentMarker = /Student\s*No/i.test(trimmed);

  // If there are too few characters or no markers, document is likely a converted image / non-parsable
  if (trimmed.length < 50 || (!hasCorMarker && !hasStudentMarker)) {
    return {
      isParsable: false,
      studentNo: null,
      fullName: null,
      college: null,
      program: null,
      schoolYear: null,
      yearLevel: null,
      gender: null,
      age: null,
      totalUnits: null,
      rawText,
      confidenceScore: 0,
      confidenceLevel: 'Non-Parsable',
      matchDetails: {
        nameMatch: 'Mismatch',
        nameSimilarity: 0,
        collegeMatch: 'Mismatch',
        emailMatch: 'Unknown',
        isPsuEmail: false,
        isOfficialPsu: hasPsuMarker,
        isCurrentTerm: false,
      },
      errorMessage:
        'Non-parsable document: No readable digital text layers detected. This file appears to be a scanned image or photo converted to PDF. Please download the original digital PDF directly from the official PSU Student Portal (https://oes.psu.palawan.edu.ph/aims/students/).',
    };
  }

  // 2. Extract Student Number
  // Format: 2023-8-0284 or similar
  const studentNoMatch = trimmed.match(
    /Student\s*No[:.]?\s*([0-9]{4}-[0-9A-Za-z]+-[0-9A-Za-z]+|[0-9]{4}-[0-9]+|[0-9A-Z-]+)/i
  );
  const studentNo = studentNoMatch ? studentNoMatch[1].trim() : null;

  // 3. Extract Full Name
  // Format in COR: Name: DELA CRUZ, JUAN PEDRO
  const nameMatch = trimmed.match(
    /Name[:.]?\s*([A-Za-z\s,.'-]+?)(?=\s+(?:Program|College|School\s*Year|Major|Curriculum|Gender|Age|Year\s*Level|CODE)[:.]|$)/i
  );
  let fullName = nameMatch ? nameMatch[1].replace(/\s+/g, ' ').trim() : null;
  // Clean up trailing commas or colons
  if (fullName) {
    fullName = fullName.replace(/^[:\s]+|[:\s]+$/g, '');
  }

  // 4. Extract College
  // Format in COR: College: College of Sciences
  const collegeMatch = trimmed.match(
    /College[:.]?\s*([A-Za-z\s&'-]+?)(?=\s+(?:School\s*Year|Program|Curriculum|Major|Scholarship|Year\s*Level|CODE)[:.]|$)/i
  );
  let college = collegeMatch ? collegeMatch[1].replace(/\s+/g, ' ').trim() : null;
  if (college) {
    college = college.replace(/^[:\s]+|[:\s]+$/g, '');
  }

  // 5. Extract Degree Program
  // Format in COR: Program: Bachelor Of Science In Information Technology
  const programMatch = trimmed.match(
    /Program[:.]?\s*([A-Za-z\s&'-]+?)(?=\s+(?:Curriculum|Major|Scholarship|School\s*Year|Year\s*Level|CODE)[:.]|$)/i
  );
  let program = programMatch ? programMatch[1].replace(/\s+/g, ' ').trim() : null;
  if (program) {
    program = program.replace(/^[:\s]+|[:\s]+$/g, '');
  }

  // 6. Extract School Year & Semester
  // Format in COR: School Year: 2026-2027 1ST SEMESTER
  const schoolYearMatch = trimmed.match(
    /School\s*Year[:.]?\s*([0-9]{4}-[0-9]{4}(?:\s+[0-9A-Za-z\s]+?)?)(?=\r?\n|\s+(?:Name|Program|Curriculum|Major|Scholarship|Year\s*Level|CODE)|$)/i
  );
  let schoolYear = schoolYearMatch ? schoolYearMatch[1].replace(/\s+/g, ' ').trim() : null;
  if (schoolYear) {
    schoolYear = schoolYear.replace(/^[:\s]+|[:\s]+$/g, '');
  }

  // 7. Extract Year Level
  // Format in COR: Year Level: Fourth Year
  const yearLevelMatch = trimmed.match(
    /Year\s*Level[:.]?\s*([A-Za-z\s]+?)(?=\r?\n|\s+(?:CODE|Total|SUBJECT|Scholarship|RULES|Major)|$)/i
  );
  let yearLevel = yearLevelMatch ? yearLevelMatch[1].replace(/\s+/g, ' ').trim() : null;
  if (yearLevel) {
    yearLevel = yearLevel.replace(/^[:\s]+|[:\s]+$/g, '');
  }

  // 8. Extract Age
  const ageMatch = trimmed.match(/Age[:.]?\s*(\d{1,2})/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

  // 9. Extract Gender
  const genderMatch = trimmed.match(/Gender[:.]?\s*(MALE|FEMALE)/i);
  const gender = genderMatch ? genderMatch[1].toUpperCase() : null;

  // 10. Extract Total Units
  const unitsMatch = trimmed.match(/Total\s*Unit\(s\)[:.]?\s*([0-9.\s]+)/i);
  const totalUnits = unitsMatch ? unitsMatch[1].trim() : null;

  // 11. Run Match Calculations
  const nameComp = fullName
    ? computeNameSimilarity(registeredUser.fullName, fullName)
    : { similarity: 0, match: 'Mismatch' as const };

  const collegeComp = computeCollegeMatch(registeredUser.collegeName, college);

  const emailComp = computeEmailStudentIdMatch(registeredUser.email, studentNo);

  // Check current academic year (e.g. 2026-2027)
  const isCurrentTerm = schoolYear
    ? /2026-2027/i.test(schoolYear) || /2025-2026/i.test(schoolYear)
    : false;

  // 12. Compute Confidence Score (0 - 100)
  // Rebalanced 5-pillar verification formula:
  // 1. Corporate Email & Student ID Match: 25 points
  // 2. Student Full Name Match: 35 points
  // 3. College Department Match: 20 points
  // 4. Institutional Document Markers: 10 points
  // 5. Active Academic Term: 10 points
  let score = 0;

  // 1. Corporate Email & Student ID Match: up to 25 points
  score += emailComp.score;

  // 2. Name weight: up to 35 points
  if (nameComp.match === 'Exact') {
    score += 35;
  } else if (nameComp.match === 'Partial') {
    score += Math.round(35 * Math.max(0.5, nameComp.similarity));
  }

  // 3. College weight: up to 20 points
  if (collegeComp === 'Exact') {
    score += 20;
  } else if (collegeComp === 'Partial') {
    score += 14;
  } else if (collegeComp === 'Unassigned') {
    score += 8; // User hadn't chosen a college yet, provisional
  }

  // 4. Institutional markers: 10 points
  if (hasPsuMarker) score += 6;
  if (hasCorMarker) score += 4;

  // 5. Academic term: 10 points
  if (isCurrentTerm) {
    score += 10;
  } else if (schoolYear) {
    score += 4; // Has a school year, but older/different
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // Determine Confidence Level
  let confidenceLevel: 'High' | 'Moderate' | 'Low' | 'Non-Parsable';
  if (score >= 90) {
    confidenceLevel = 'High';
  } else if (score >= 60) {
    confidenceLevel = 'Moderate';
  } else if (score > 0) {
    confidenceLevel = 'Low';
  } else {
    confidenceLevel = 'Non-Parsable';
  }

  return {
    isParsable: true,
    studentNo,
    fullName,
    college,
    program,
    schoolYear,
    yearLevel,
    gender,
    age,
    totalUnits,
    rawText,
    confidenceScore: score,
    confidenceLevel,
    matchDetails: {
      nameMatch: nameComp.match,
      nameSimilarity: nameComp.similarity,
      collegeMatch: collegeComp,
      emailMatch: emailComp.match,
      isPsuEmail: emailComp.isPsuDomain,
      isOfficialPsu: hasPsuMarker,
      isCurrentTerm,
    },
  };
}
