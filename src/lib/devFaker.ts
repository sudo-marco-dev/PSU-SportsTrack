import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/context/AuthContext';
import { formatErrorMessage, type ScenarioResult } from './devScenarios';

export interface FakerGenerationParams {
  role: UserRole | 'mixed';
  count: number;
  confidencePreset: 'high' | 'medium' | 'low' | 'mixed';
  autoGenerateClearanceDocs: boolean;
}

const FIRST_NAMES = [
  'Joshua', 'Angelo', 'John Paul', 'Christian', 'Gabriel', 'Mark',
  'Maria', 'Nicole', 'Bea', 'Alyssa', 'Princess', 'Angelica',
  'Jerome', 'Rafael', 'Danica', 'Paolo', 'Rica', 'Kim',
  'Samantha', 'Jayson', 'Kaye', 'Mica', 'Aljon', 'Gwen'
];

const LAST_NAMES = [
  'Santos', 'Reyes', 'Dela Cruz', 'Bautista', 'Mendoza', 'Garcia',
  'Ramos', 'Aquino', 'Flores', 'Soriano', 'Villanueva', 'Navarro',
  'Castillo', 'Torres', 'Mercado', 'Valdez', 'Morales', 'Pascual'
];

const COLLEGE_CONFIGS = [
  { code: 'CAS', name: 'College of Arts and Sciences', programs: ['BS Information Technology', 'BA Communication', 'BS Environmental Science'] },
  { code: 'CBA', name: 'College of Business and Accountancy', programs: ['BS Accountancy', 'BS Business Administration', 'BS Management Accounting'] },
  { code: 'CEAT', name: 'College of Engineering, Architecture and Technology', programs: ['BS Civil Engineering', 'BS Mechanical Engineering', 'BS Electrical Engineering'] },
  { code: 'CTE', name: 'College of Teacher Education', programs: ['Bachelor of Secondary Education', 'Bachelor of Elementary Education'] },
  { code: 'CCJE', name: 'College of Criminal Justice Education', programs: ['BS Criminology', 'BS Law Enforcement Administration'] },
  { code: 'CNHS', name: 'College of Nursing and Health Sciences', programs: ['BS Nursing', 'BS Medical Technology'] },
  { code: 'CHMT', name: 'College of Hospitality Management and Tourism', programs: ['BS Hospitality Management', 'BS Tourism Management'] },
  { code: 'CS', name: 'College of Sciences', programs: ['BS Computer Science', 'BS Biology', 'BS Marine Biology'] },
];

const STAFF_DEPARTMENTS = [
  'General Services & Maintenance',
  'University Registrar Office',
  'Information & Communications Technology Division (ICTD)',
  'Human Resource Management Office (HRMO)',
  'Sports Development Office',
  'University Library Services',
  'Campus Security Services',
];

const FACULTY_DEPARTMENTS = [
  'Mathematics & Natural Sciences',
  'Physical Education & Athletics',
  'Languages & Humanities',
  'Social Sciences & Philosophy',
  'Engineering Sciences',
  'Accountancy & Finance',
];

/**
 * Role-Adaptive Faker User & Clearance Queue Generator
 * Generates realistic PSU personas across all 5 roles with mock COR PDFs and
 * Employee ID cards with configurable OCR match confidence scores.
 */
export async function generateFakerUsers(
  supabase: SupabaseClient,
  params: FakerGenerationParams
): Promise<ScenarioResult> {
  try {
    const { role, count, confidencePreset, autoGenerateClearanceDocs } = params;

    // Fetch existing colleges from database to ensure valid foreign keys if present
    const { data: dbColleges } = await supabase.from('colleges').select('id, college_name');
    const collegeMap = new Map((dbColleges || []).map((c) => [c.college_name, c.id]));

    const usersToInsert = [];
    const rolesList: UserRole[] =
      role === 'mixed'
        ? ['player_student', 'player_student', 'player_faculty', 'player_staff', 'coach', 'facilitator']
        : [role];

    for (let i = 0; i < count; i++) {
      const assignedRole = rolesList[i % rolesList.length];
      const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const fullName = `[DEV] ${fn} ${ln}`;
      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${uniqueSuffix}@psu.palawan.edu.ph`;

      const colConfig = COLLEGE_CONFIGS[Math.floor(Math.random() * COLLEGE_CONFIGS.length)];
      const collegeId = collegeMap.get(colConfig.name) || null;
      const program = colConfig.programs[Math.floor(Math.random() * colConfig.programs.length)];
      const yearLevel = `${Math.floor(1 + Math.random() * 4)}th Year`;

      const studentNumber = assignedRole === 'player_student' ? `2024-8-${uniqueSuffix}` : null;
      const employeeId = assignedRole !== 'player_student' ? `EMP-2024-${uniqueSuffix}` : null;
      const department =
        assignedRole === 'player_staff'
          ? STAFF_DEPARTMENTS[Math.floor(Math.random() * STAFF_DEPARTMENTS.length)]
          : assignedRole === 'player_faculty'
          ? FACULTY_DEPARTMENTS[Math.floor(Math.random() * FACULTY_DEPARTMENTS.length)]
          : assignedRole === 'coach'
          ? 'Varsity Coaching Staff'
          : assignedRole === 'facilitator'
          ? 'Technical Officials Committee'
          : null;

      // Verification initial status
      const isVerified = autoGenerateClearanceDocs ? false : true;

      usersToInsert.push({
        full_name: fullName,
        email,
        role: assignedRole,
        is_verified: isVerified,
        college_id: collegeId,
        student_number: studentNumber,
        employee_id: employeeId,
        department,
        program: assignedRole === 'player_student' ? program : null,
        year_level: assignedRole === 'player_student' ? yearLevel : null,
        account_status: 'active',
      });
    }

    const { data: insertedUsers, error: userErr } = await supabase
      .from('users')
      .insert(usersToInsert)
      .select('id, full_name, role, student_number, employee_id, program, year_level, department');

    if (userErr || !insertedUsers) {
      throw userErr || new Error('Failed to insert faker users ledger');
    }

    // Step 2: Generate Mock Clearance Documents for Queue
    if (autoGenerateClearanceDocs) {
      const docsToInsert = [];

      for (let i = 0; i < insertedUsers.length; i++) {
        const u = insertedUsers[i];
        let confidenceScore = 95;
        if (confidencePreset === 'medium') confidenceScore = 80;
        else if (confidencePreset === 'low') confidenceScore = 45;
        else if (confidencePreset === 'mixed') {
          const presets = [96, 88, 79, 48, 92, 42];
          confidenceScore = presets[i % presets.length];
        }

        const isStudent = u.role === 'player_student';
        const docType = isStudent ? 'COR' : u.role === 'player_faculty' ? 'FACULTY_ID' : 'STAFF_ID';
        const storagePath = isStudent
          ? `mock_cor_${u.id.slice(0, 8)}.pdf`
          : `mock_id_${u.id.slice(0, 8)}.jpg`;

        docsToInsert.push({
          user_id: u.id,
          document_type: docType,
          storage_path: storagePath,
          status: 'Pending',
          confidence_score: confidenceScore,
          extracted_full_name: u.full_name.replace('[DEV] ', ''),
          extracted_student_no: u.student_number || '2024-8-0000',
          extracted_college: isStudent ? 'CAS' : null,
          extracted_program: u.program || null,
          extracted_year_level: u.year_level || null,
        });
      }

      const { error: docErr } = await supabase
        .from('verification_documents')
        .insert(docsToInsert);

      if (docErr) throw docErr;
    }

    return {
      success: true,
      message: `Generated ${insertedUsers.length} realistic PSU personas (${role}) ${
        autoGenerateClearanceDocs ? 'and populated pending Admin clearance verification queue.' : 'with verified active accounts.'
      }`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: 'Failed to generate faker users',
      error: formatErrorMessage(err),
    };
  }
}

/**
 * 1-Tap Preset: Populates mixed Admin Clearance Queue with 5 Student CORs and 3 Employee IDs
 * having high (95%), medium (80%), and low (45%) OCR confidence scores.
 */
export async function generateClearanceQueueBatch(
  supabase: SupabaseClient
): Promise<ScenarioResult> {
  return generateFakerUsers(supabase, {
    role: 'mixed',
    count: 8,
    confidencePreset: 'mixed',
    autoGenerateClearanceDocs: true,
  });
}
