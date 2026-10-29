import type { UserRole } from '@/context/AuthContext';

export interface DevPersona {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  college_id?: string | null;
  college_name?: string | null;
  cluster_id?: string | null;
  cluster_name?: string | null;
  student_number?: string | null;
  employee_id?: string | null;
  department?: string | null;
  program?: string | null;
  year_level?: number | string | null;
  preferred_sports?: string[];
  primary_position?: string | null;
  account_status?: 'active' | 'inactive' | 'archived' | 'soft_deleted';
  persona_label: string;
  description: string;
  badge_color: string;
}

export const PRESET_PERSONAS: DevPersona[] = [
  {
    id: '95f03009-c970-4840-9e90-5116237f0b5d',
    full_name: 'Dr. Ramon Bautista',
    email: 'sports.director@psu.palawan.edu.ph',
    role: 'admin',
    is_verified: true,
    department: 'University Sports Development Office',
    employee_id: 'EMP-2024-0001',
    persona_label: 'Admin (Sports Director)',
    description: 'Full administrative clearance approvals, bracket generation, user account permissions, and recovery center.',
    badge_color: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400',
  },
  {
    id: '8932be90-4547-4935-9cb6-f80f1c5fc80c',
    full_name: 'Coach Danilo Soriano',
    email: 'danilo.soriano@psu.palawan.edu.ph',
    role: 'coach',
    is_verified: true,
    college_name: 'College of Business and Accountancy (CBA)',
    department: 'Business Administration',
    employee_id: 'EMP-2024-0104',
    preferred_sports: ['Volleyball', 'Basketball'],
    persona_label: 'CBA Lady Wolves Coach',
    description: 'Manage collegiate squad roster, starters vs bench rotation, uniform jersey assignments, and tactical setups.',
    badge_color: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  },
  {
    id: '3360bc90-c1eb-4ef9-8349-19e1ccdc3134',
    full_name: 'Engr. Patrick Manalo',
    email: 'patrick.manalo@psu.palawan.edu.ph',
    role: 'facilitator',
    is_verified: true,
    college_name: 'College of Engineering, Architecture and Technology (CEAT)',
    department: 'Civil Engineering',
    employee_id: 'EMP-2024-0211',
    preferred_sports: ['Basketball', 'Sepak Takraw'],
    persona_label: 'Courtside Facilitator Scorekeeper',
    description: 'Dedicated courtside kiosk operator with scorekeeper write authority, game clock controls, and live commentary.',
    badge_color: 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400',
  },
  {
    id: '90c2dc25-d13c-4464-9992-bf561e1ce9d2',
    full_name: 'Juan Dela Cruz',
    email: 'jdelacruz2024@psu.palawan.edu.ph',
    role: 'player_student',
    is_verified: true,
    college_name: 'College of Arts and Sciences (CAS)',
    program: 'BS Information Technology',
    year_level: '3rd Year',
    student_number: '2024-8-0284',
    preferred_sports: ['Basketball'],
    primary_position: 'Point Guard',
    persona_label: 'Verified Student Athlete',
    description: 'Active collegiate varsity player eligible for tournament lineups, stat tracking, and university medal standings.',
    badge_color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
  },
  {
    id: '8785501d-cfd8-41c7-a4f3-1e87858392d4',
    full_name: 'Mark Mendoza',
    email: 'mmendoza2024@psu.palawan.edu.ph',
    role: 'player_student',
    is_verified: false,
    college_name: 'College of Sciences (CS)',
    program: 'BS Computer Science',
    year_level: '1st Year',
    student_number: '2024-8-0912',
    preferred_sports: ['Table Tennis'],
    persona_label: 'Unverified Student (Clearance Pending)',
    description: 'Freshman student athlete with pending Certificate of Registration (COR) upload awaiting admin clearance review.',
    badge_color: 'bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400',
  },
  {
    id: '643bc8a1-4ef8-4153-a78b-8135c9ed3198',
    full_name: 'Prof. Elena Fernandez',
    email: 'elena.fernandez@psu.palawan.edu.ph',
    role: 'player_faculty',
    is_verified: true,
    college_name: 'College of Teacher Education (CTE)',
    department: 'Secondary Education',
    employee_id: 'EMP-2024-0042',
    preferred_sports: ['Pickleball', 'Table Tennis'],
    persona_label: 'Faculty Athlete',
    description: 'University faculty competitor participating in Inter-Faculty ballgames and employee wellness divisions.',
    badge_color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400',
  },
  {
    id: 'b0786737-4091-40e8-8638-71e1c37c112a',
    full_name: 'Kuya Roberto Dalisay',
    email: 'roberto.dalisay@psu.palawan.edu.ph',
    role: 'player_staff',
    is_verified: true,
    department: 'General Services & Campus Maintenance',
    employee_id: 'EMP-2024-0188',
    preferred_sports: ['Sepak Takraw', 'Basketball'],
    persona_label: 'Staff Athlete (Maintenance)',
    description: 'Campus non-teaching personnel participating in Staff athletic division and university recreation games.',
    badge_color: 'bg-teal-500/10 text-teal-600 border-teal-500/30 dark:text-teal-400',
  },
  {
    id: '4af94002-41b0-4629-8950-e38263f28fb6',
    full_name: 'Platform Dev Admin',
    email: 'dev@psu.palawan.edu.ph',
    role: 'dev',
    is_verified: true,
    department: 'SportsTrack Core Engineering',
    employee_id: 'DEV-2024-0001',
    persona_label: 'Platform Developer',
    description: 'Unrestricted access to developer orchestration sandbox, live score bot, table health metrics, and scenario injectors.',
    badge_color: 'bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300',
  },
];
