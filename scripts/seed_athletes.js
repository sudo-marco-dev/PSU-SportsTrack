import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read environment variables
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_LEGACY_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const collegePrograms = {
  CEAT: ['BS Civil Engineering', 'BS Mechanical Engineering', 'BS Electrical Engineering', 'BS Architecture'],
  CS: ['BS Computer Science', 'BS Information Technology', 'BS Biology', 'BS Environmental Science'],
  CBA: ['BS Accountancy', 'BS Business Administration', 'BS Management Accounting', 'BS Entrepreneurship'],
  CTE: ['B Secondary Education', 'B Elementary Education', 'B Physical Education', 'B Early Childhood Education'],
  CAH: ['BA Communication', 'BA Political Science', 'BA English Language', 'BA Fine Arts'],
  CNHS: ['BS Nursing', 'BS Medical Technology', 'BS Midwifery', 'BS Nutrition and Dietetics'],
  CCJE: ['BS Criminology', 'BS Law Enforcement Administration', 'BS Forensic Science', 'BS Security Management'],
  CHMT: ['BS Hospitality Management', 'BS Tourism Management', 'BS Culinary Management', 'BS Hotel and Restaurant Administration'],
  CCRD: ['BS Rural Development', 'BS Agriculture', 'BS Fisheries', 'BS Forestry']
};

const athleteNamesByCollege = {
  CEAT: [
    'Rafael Ramos', 'Ezekiel Castro', 'Kurt Alcantara', 'Carlo Villanueva',
    'Cedric Aquino', 'Janzen Morales', 'Renzo Gutierrez', 'Renz Valenzuela',
    'Aldrin Navarro', 'Dave Bautista', 'Kian Marasigan', 'Sean Patrick Lim',
    'Giancarlo Perez', 'Marc Anthony Solis', 'Lorenzo Cruz', 'Dominic Alarcon'
  ],
  CS: [
    'Gabriel Vance', 'Jiro Mendoza', 'Nathaniel Diaz', 'Dominic Flores',
    'Mark Bautista', 'Joshua Dalisay', 'Adrian Del Rosario', 'Kenjiro Tan',
    'Miguel Soriano', 'Bryan Ocampo', 'Justin Mercado', 'Francis Pineda',
    'Kyle Navarro', 'Vincent Legaspi', 'Jerome Salazar', 'Christian Cruz'
  ],
  CBA: [
    'Aris Thorne', 'Angelo Santos', 'Paolo Reyes', 'Marcus Sterling',
    'Julian De Leon', 'Vince Madrigal', 'Carlos Imperial', 'Enzo Falcon',
    'Patrick Roxas', 'Lance Sterling', 'Matthew Zobel', 'Dexter Ayala',
    'Nico Montelibano', 'Alfonso Araneta', 'Lucas Cojuangco', 'Santino Romualdez'
  ],
  CTE: [
    'Ramon Magsaysay Jr.', 'Emilio Aguinaldo IV', 'Jose Rizal III', 'Andres Bonifacio Jr.',
    'Apolinario Mabini II', 'Marcelo Del Pilar', 'Antonio Luna V', 'Melchora Aquino II',
    'Juan Luna IV', 'Gregorio Del Pilar II', 'Diego Silang III', 'Lapu-Lapu Cruz',
    'Francisco Balagtas', 'Claro M. Recto Jr.', 'Manuel Quezon III', 'Sergio Osmeña IV'
  ],
  CAH: [
    'Vincent Van Gogh Reyes', 'Pablo Picasso Santos', 'Leonardo Da Vinci Cruz', 'Claude Monet Diaz',
    'Salvador Dali Bautista', 'Michelangelo Ramos', 'Rembrandt Castro', 'Donatello Morales',
    'Raphael Sanzio Aquino', 'Henri Matisse Ocampo', 'Gustav Klimt Pineda', 'Frida Kahlo Mercado',
    'Andy Warhol Salazar', 'Johannes Vermeer Lim', 'Edvard Munch Perez', 'Paul Cezanne Solis'
  ],
  CNHS: [
    'Florence Nightingale Santos', 'Alexander Fleming Reyes', 'Louis Pasteur Cruz', 'Edward Jenner Diaz',
    'Robert Koch Bautista', 'Joseph Lister Ramos', 'Jonas Salk Castro', 'Antonie van Leeuwenhoek',
    'Ignaz Semmelweis Aquino', 'William Harvey Morales', 'Andreas Vesalius Ocampo', 'Hippocrates Pineda',
    'Galen Mercado', 'Clara Barton Salazar', 'Elizabeth Blackwell Lim', 'Marie Curie Perez'
  ],
  CCJE: [
    'Victor Stone Cruz', 'Bruce Wayne Santos', 'Clark Kent Reyes', 'Barry Allen Diaz',
    'Arthur Curry Bautista', 'Oliver Queen Ramos', 'Hal Jordan Castro', 'John Stewart Morales',
    'Dick Grayson Aquino', 'Jason Todd Ocampo', 'Tim Drake Pineda', 'Damian Wayne Mercado',
    'Jim Gordon Salazar', 'Harvey Bullock Lim', 'Crispus Allen Perez', 'Renee Montoya Solis'
  ],
  CHMT: [
    'Gordon Ramsay Santos', 'Marco Pierre White Reyes', 'Anthony Bourdain Cruz', 'Wolfgang Puck Diaz',
    'Alain Ducasse Bautista', 'Thomas Keller Ramos', 'Heston Blumenthal Castro', 'Ferran Adria Morales',
    'Massimo Bottura Aquino', 'Joel Robuchon Ocampo', 'Daniel Boulud Pineda', 'Emeril Lagasse Mercado',
    'Guy Fieri Salazar', 'Bobby Flay Lim', 'Jamie Oliver Perez', 'Roy Choi Solis'
  ],
  CCRD: [
    'John Muir Santos', 'Aldo Leopold Reyes', 'Rachel Carson Cruz', 'Gifford Pinchot Diaz',
    'George Washington Carver', 'Norman Borlaug Ramos', 'Gregor Mendel Castro', 'Charles Darwin Morales',
    'Alexander von Humboldt Aquino', 'David Attenborough Ocampo', 'Jane Goodall Pineda', 'Jacques Cousteau Mercado',
    'E.O. Wilson Salazar', 'Carl Sagan Lim', 'Chico Mendes Perez', 'Wangari Maathai Solis'
  ]
};

async function seedAthletes() {
  console.log('====================================================');
  console.log('  SEEDING FULL STUDENT ATHLETE POOL PER COLLEGE');
  console.log('====================================================\n');

  const { data: colleges, error: colErr } = await supabase.from('colleges').select('id, college_name');
  if (colErr || !colleges) {
    console.error('Failed to fetch colleges:', colErr);
    process.exit(1);
  }

  const getCode = (name) => {
    const match = name.match(/\(([^)]+)\)/);
    return match ? match[1] : name.slice(0, 4).toUpperCase();
  };

  const collegeMap = {};
  colleges.forEach(c => {
    const code = getCode(c.college_name);
    collegeMap[code] = c;
  });

  const { data: existingUsers } = await supabase.from('users').select('id, email, full_name, college_id, role');
  const existingByEmail = new Map();
  (existingUsers || []).forEach(u => existingByEmail.set(u.email.toLowerCase(), u));

  let totalCreated = 0;
  let totalExisting = 0;

  for (const [code, col] of Object.entries(collegeMap)) {
    const athleteNames = athleteNamesByCollege[code] || athleteNamesByCollege['CS'];
    const programs = collegePrograms[code] || ['Bachelor of Science'];
    console.log(`\n🏛️ Processing College: ${code} (${col.college_name})`);

    for (let i = 0; i < athleteNames.length; i++) {
      const name = athleteNames[i];
      const email = `athlete.${code.toLowerCase()}.${i + 1}@psu.palawan.edu.ph`;
      const program = programs[i % programs.length];
      const yearLevel = `${(i % 4) + 1}st Year`;
      const studentNumber = `2024-8-${code.slice(0, 2)}-${String(100 + i).padStart(3, '0')}`;

      let userId = null;
      const existing = existingByEmail.get(email.toLowerCase());

      if (existing) {
        userId = existing.id;
        totalExisting++;
        // Ensure profile is up to date
        await supabase.from('users').update({
          full_name: `${name} (${code})`,
          role: 'player_student',
          college_id: col.id,
          student_number: studentNumber,
          program: program,
          year_level: yearLevel,
          is_verified: true,
          account_status: 'active'
        }).eq('id', userId);
      } else {
        // Create in auth.users
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: {
            full_name: `${name} (${code})`,
            role: 'player_student'
          }
        });

        if (authErr) {
          // If auth user already exists in auth but not in public.users, fetch by listing
          console.warn(`Auth warning for ${email}:`, authErr.message);
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = (listData?.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
          if (found) userId = found.id;
        } else if (authUser?.user?.id) {
          userId = authUser.user.id;
        }

        if (userId) {
          // Upsert into public.users
          const { error: pubErr } = await supabase.from('users').upsert({
            id: userId,
            full_name: `${name} (${code})`,
            email: email,
            role: 'player_student',
            college_id: col.id,
            student_number: studentNumber,
            program: program,
            year_level: yearLevel,
            is_verified: true,
            account_status: 'active'
          });

          if (pubErr) {
            console.error(`Error inserting profile for ${email}:`, pubErr.message);
          } else {
            totalCreated++;
          }
        }
      }
    }
    console.log(`✅ ${code} has ${athleteNames.length} student athletes provisioned.`);
  }

  console.log('\n====================================================');
  console.log(`🎉 COMPLETED! Created: ${totalCreated}, Updated/Existing: ${totalExisting}`);
  console.log('====================================================\n');
}

seedAthletes();
