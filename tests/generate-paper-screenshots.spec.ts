import { test, expect, type Page } from '@playwright/test';

// Standardized Dev Personas
const ADMIN_PERSONA = {
  id: '95f03009-c970-4840-9e90-5116237f0b5d',
  full_name: 'Dr. Ramon Bautista',
  email: 'sports.director@psu.palawan.edu.ph',
  role: 'admin',
  is_verified: true,
  department: 'University Sports Development Office',
  employee_id: 'EMP-2024-0001',
  persona_label: 'Admin (Sports Director)',
};

const COACH_PERSONA = {
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
};

const FACILITATOR_PERSONA = {
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
};

const PLAYER_PERSONA = {
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
};

// Helper: Setup Match Mock Data
async function setupMatchMock(page: Page, matchId: string = 'demo-match-101') {
  await page.route('**/rest/v1/matches*', async (route) => {
    const url = route.request().url();
    if (url.includes('id=eq.') || url.includes('/match/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Semifinals',
          status: 'Ongoing',
          team_a_score: 68,
          team_b_score: 65,
          team_a_id: 'team-scorpions',
          team_b_id: 'team-enforcers',
          active_scorekeeper_id: FACILITATOR_PERSONA.id,
          team_a: { name: 'CEAT RED SCORPIONS', college_id: 'col-ceat' },
          team_b: { name: 'CCJE LAW ENFORCERS', college_id: 'col-ccje' },
          tournament_id: 'tourn-binturangan-2026',
          tournament: {
            id: 'tourn-binturangan-2026',
            name: "PSU BINTURUNGAN 2026 - MEN'S BASKETBALL TOURNAMENT",
            sport: 'Basketball',
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: matchId,
            round: 'Semifinals',
            status: 'Ongoing',
            team_a_score: 68,
            team_b_score: 65,
            team_a_id: 'team-scorpions',
            team_b_id: 'team-enforcers',
            active_scorekeeper_id: FACILITATOR_PERSONA.id,
            team_a: { name: 'CEAT RED SCORPIONS', college_id: 'col-ceat' },
            team_b: { name: 'CCJE LAW ENFORCERS', college_id: 'col-ccje' },
            tournament_id: 'tourn-binturangan-2026',
            designated_facilitator_id: FACILITATOR_PERSONA.id,
          },
        ]),
      });
    }
  });

  await page.route('**/rest/v1/match_events*', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'evt-1',
          match_id: matchId,
          description: 'Tip-off won by CEAT Red Scorpions starting center.',
          created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        },
        {
          id: 'evt-2',
          match_id: matchId,
          description: '3-pointer drained from deep corner by CEAT Scorpions #7 Marco Garcia!',
          created_at: new Date(Date.now() - 10 * 60000).toISOString(),
        },
        {
          id: 'evt-3',
          match_id: matchId,
          description: 'CCJE Law Enforcers — #23 Crispus Allen Perez answers with a mid-range jumper (+2 PTS)!',
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          id: 'evt-4',
          match_id: matchId,
          description: 'Defensive steal by CEAT Red Scorpions #1 Ezekiel Santos leading to fast-break layup (+2 PTS)!',
          created_at: new Date(Date.now() - 1 * 60000).toISOString(),
        },
      ]),
    });
  });

  await page.route('**/rest/v1/team_roster*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'r1', team_id: 'team-scorpions', player_id: 'p1', jersey_number: 1, is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Santos' } },
        { id: 'r2', team_id: 'team-scorpions', player_id: 'p2', jersey_number: 3, is_starter: true, status: 'Approved', users: { full_name: 'Carlo Mendoza' } },
        { id: 'r3', team_id: 'team-scorpions', player_id: 'p3', jersey_number: 5, is_starter: true, status: 'Approved', users: { full_name: 'Janzen Cruz' } },
        { id: 'r4', team_id: 'team-scorpions', player_id: 'p4', jersey_number: 7, is_starter: true, status: 'Approved', users: { full_name: 'Marco Garcia' } },
        { id: 'r5', team_id: 'team-scorpions', player_id: 'p5', jersey_number: 8, is_starter: true, status: 'Approved', users: { full_name: 'Daniel Ramos' } },
        { id: 'r6', team_id: 'team-enforcers', player_id: 'p6', jersey_number: 23, is_starter: true, status: 'Approved', users: { full_name: 'Crispus Allen Perez' } },
        { id: 'r7', team_id: 'team-enforcers', player_id: 'p7', jersey_number: 11, is_starter: true, status: 'Approved', users: { full_name: 'Joshua Alcantara' } },
      ]),
    });
  });
}

// Helper: Set Persona Impersonation
async function setPersona(page: Page, persona: any | null) {
  if (persona) {
    await page.addInitScript((p) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(p));
    }, persona);
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem('psu_dev_impersonated_persona');
    });
  }
}

// Helper: Capture paired Desktop and Mobile shots
async function captureDualViews(page: Page, fileBase: string, path: string, options?: { fullPage?: boolean; delayMs?: number }) {
  const delay = options?.delayMs ?? 1000;

  // 1. Desktop View (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(delay);
  await page.screenshot({
    path: `docs/paper-screenshots/desktop/${fileBase}.png`,
    fullPage: options?.fullPage ?? false,
  });

  // 2. Mobile View (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(delay);
  await page.screenshot({
    path: `docs/paper-screenshots/mobile/${fileBase}.png`,
    fullPage: options?.fullPage ?? false,
  });
}

test.describe('Paper Documentation System Screen Capture Suite', () => {

  test('01: Player & Public Dashboard', async ({ page }) => {
    await captureDualViews(page, '01-player-dashboard', '/');
  });

  test('02: Tournament & Match Explorer', async ({ page }) => {
    await captureDualViews(page, '02-match-explorer', '/explorer');
  });

  test('03: Rankings & Medal Standings Tally', async ({ page }) => {
    await captureDualViews(page, '03-standings-rankings', '/ranking');
  });

  test('04: Athletics & Scouting Hub', async ({ page }) => {
    await captureDualViews(page, '04-athletics-scouting', '/athletics');
  });

  test('05: Legal, Privacy & Terms of Service', async ({ page }) => {
    await captureDualViews(page, '05-legal-privacy', '/legal');
  });

  test('06: Authentication Portal Dialog', async ({ page }) => {
    // Desktop View
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?login=true');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/paper-screenshots/desktop/06-auth-login-modal.png' });

    // Mobile View
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?login=true');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/paper-screenshots/mobile/06-auth-login-modal.png' });
  });

  test('07: Athlete & Faculty Registration', async ({ page }) => {
    await captureDualViews(page, '07-register-flow', '/register');
  });

  test('08: Live Matchroom Center', async ({ page }) => {
    await setupMatchMock(page, 'demo-match-101');
    await captureDualViews(page, '08-live-matchroom', '/match/demo-match-101');
  });

  test('09: Courtside Facilitator Scoring Kiosk', async ({ page }) => {
    await setPersona(page, FACILITATOR_PERSONA);
    await setupMatchMock(page, 'demo-match-101');
    await captureDualViews(page, '09-courtside-facilitator-kiosk', '/match/demo-match-101/kiosk');
  });

  test('10: Arena Stadium Jumbotron Display', async ({ page }) => {
    await setupMatchMock(page, 'demo-match-101');
    // Desktop 1920x1080 display
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/match/demo-match-101/display');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/paper-screenshots/desktop/10-stadium-display-jumbotron.png' });

    // Mobile/Tablet 844x390 landscape or 390x844
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/match/demo-match-101/display');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/paper-screenshots/mobile/10-stadium-display-jumbotron.png' });
  });

  test('11: Admin Command Center', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    await captureDualViews(page, '11-admin-overview', '/admin');
  });

  test('12: Tournament Management & Bracket Operations', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    await captureDualViews(page, '12-tournament-management', '/admin/tournaments');
  });

  test('13: Facilitator Operations & Officials Hub', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    
    // Desktop View
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');
    const officialsTabDesktop = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    if (await officialsTabDesktop.isVisible()) {
      await officialsTabDesktop.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: 'docs/paper-screenshots/desktop/13-facilitator-operations-hub.png' });

    // Mobile View
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');
    const officialsTabMobile = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    if (await officialsTabMobile.isVisible()) {
      await officialsTabMobile.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: 'docs/paper-screenshots/mobile/13-facilitator-operations-hub.png' });
  });

  test('14: Athlete Verifications & Clearance Queue', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    await captureDualViews(page, '14-clearance-verifications', '/admin/verifications');
  });

  test('15: Institutional Audit Logs', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    await captureDualViews(page, '15-audit-logs', '/admin/audit-logs');
  });

  test('16: Institutional Reports & Exports', async ({ page }) => {
    await setPersona(page, ADMIN_PERSONA);
    await captureDualViews(page, '16-institutional-reports', '/admin/reports');
  });

  test('17: Coach Roster & Squad Management', async ({ page }) => {
    await setPersona(page, COACH_PERSONA);
    await captureDualViews(page, '17-coach-roster-management', '/coach/teams');
  });

  test('18: Verified Athlete Profile & Clearances', async ({ page }) => {
    await setPersona(page, PLAYER_PERSONA);
    await captureDualViews(page, '18-athlete-profile', '/profile');
  });

});
