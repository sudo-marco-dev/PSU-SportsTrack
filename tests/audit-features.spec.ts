import { test, expect, type Page } from '@playwright/test';

async function setupSuperAdminSession(page: Page, adminId = '11111111-1111-1111-1111-111111111111') {
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
  const mockUser = {
    id: adminId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@psu.palawan.edu.ph',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Administrator' },
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'fake-admin-token-valid-for-tests',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: futureExpiresAt,
    user: mockUser,
  };

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    }
  });

  await page.route('**/rest/v1/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: adminId,
        full_name: 'Administrator',
        role: 'admin',
        is_verified: true,
        account_status: 'active',
      }),
    });
  });

  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
  }, { session: mockSession });
}

async function setupPlayerSession(
  page: Page,
  role: 'player_faculty' | 'player_student' | 'player_staff' = 'player_faculty',
  playerId = '22222222-2222-2222-2222-222222222222'
) {
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
  const mockUser = {
    id: playerId,
    aud: 'authenticated',
    role: 'authenticated',
    email: role === 'player_student' ? 'student@psu.palawan.edu.ph' : 'faculty@psu.palawan.edu.ph',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: role === 'player_student' ? 'Student Athlete' : 'Prof. Faculty Athlete' },
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'fake-player-token-valid-for-tests',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: futureExpiresAt,
    user: mockUser,
  };

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    }
  });

  await page.route('**/rest/v1/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: playerId,
        full_name: role === 'player_student' ? 'Student Athlete' : 'Prof. Faculty Athlete',
        role: role,
        is_verified: true,
        account_status: 'active',
        employee_id: role !== 'player_student' ? 'EMP-2024-999' : null,
        student_number: role === 'player_student' ? '2024-12345' : null,
      }),
    });
  });

  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
  }, { session: mockSession });
}

test.describe('PSU SportsTrack Comprehensive Feature & Audit Suite', () => {
  test('Strict 9 Ballgames Scope Verification in Explorer', async ({ page }) => {
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Expected 9 official ballgame disciplines
    const officialBallgames = [
      'Basketball',
      'Volleyball',
      'Soccer',
      'Futsal',
      'Sepak Takraw',
      'Baseball',
      'Softball',
      'Pickleball',
      'Table Tennis',
    ];

    for (const sport of officialBallgames) {
      const sportBtn = page.locator('button').filter({ hasText: new RegExp(sport, 'i') }).first();
      await expect(sportBtn).toBeVisible();
    }

    // STRICT PROHIBITIONS: No esports, chess, swimming, athletics, badminton
    const prohibitedSports = ['Esports', 'Chess', 'Swimming', 'Athletics', 'Badminton'];
    for (const prohibited of prohibitedSports) {
      const btn = page.locator('button').filter({ hasText: new RegExp(`^${prohibited}$`, 'i') });
      await expect(btn).toHaveCount(0);
    }
  });

  test('Explorer Division & Category Filter Selection', async ({ page }) => {
    await setupSuperAdminSession(page);
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Locate Division select trigger
    const divisionSelect = page.getByRole('combobox').filter({ hasText: /All Divisions|Friendly Games|Binturungan|Inter-Collegiate/i }).first();
    await expect(divisionSelect).toBeVisible();

    // Open division selector
    await divisionSelect.click();

    // Verify all division options are visible
    await expect(page.getByRole('option', { name: 'All Divisions' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Friendly Games' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Binturungan' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Inter-Collegiate' })).toBeVisible();

    // Select Friendly Games
    await page.getByRole('option', { name: 'Friendly Games' }).click();
    await expect(divisionSelect).toContainText(/Friendly Games/i);

    // Switch to Binturungan
    await divisionSelect.click();
    await page.getByRole('option', { name: 'Binturungan' }).click();
    await expect(divisionSelect).toContainText(/Binturungan/i);
  });

  test('Ranking Page - Tournament Category Options including Friendly Games', async ({ page }) => {
    await setupSuperAdminSession(page);
    await page.goto('/ranking');
    await page.waitForLoadState('networkidle');

    // Click Filters button to expand filters
    const filterBtn = page.getByRole('button', { name: /^Filters/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
    }

    // Tournament category select
    const categorySelect = page.getByRole('combobox').filter({ hasText: /Championship|All Competitions|Binturungan/i }).first();
    await expect(categorySelect).toBeVisible();
    await categorySelect.click();

    // Check categories exist
    await expect(page.getByRole('option', { name: 'Championship Competitions' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'All Competitions' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Binturungan' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Inter-Collegiate League' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'STRASUC' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Friendly Match' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Faculty & Staff Friendly Games' })).toBeVisible();

    // Close selector
    await page.keyboard.press('Escape');

    // Check ballgame discipline select
    const disciplineSelect = page.getByRole('combobox').filter({ hasText: /All Ballgames|Basketball/i }).first();
    await expect(disciplineSelect).toBeVisible();
    await disciplineSelect.click();

    await expect(page.getByRole('option', { name: 'Basketball' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Volleyball' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Soccer / Football' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Sepak Takraw' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Pickleball' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Table Tennis' })).toBeVisible();
  });

  test('Admin Verifications View with Mocked Admin Session', async ({ page }) => {
    await setupSuperAdminSession(page);

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'doc-student-1',
            user_id: 'user-std-1',
            status: 'Pending',
            document_type: 'COR',
            storage_path: 'user-std-1/doc1.pdf',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            confidence_score: 95,
            users: {
              full_name: 'Dela Cruz, Juan',
              email: 'juan@psu.palawan.edu.ph',
              role: 'player_student',
              student_number: '2023-10001',
              department: 'BSCS',
              colleges: { college_name: 'College of Sciences' },
            },
          },
          {
            id: 'doc-staff-1',
            user_id: 'user-stf-1',
            status: 'Pending',
            document_type: 'STAFF_ID',
            storage_path: 'user-stf-1/id1.jpg',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            confidence_score: 88,
            users: {
              full_name: 'Santos, Maria',
              email: 'maria@psu.palawan.edu.ph',
              role: 'player_faculty',
              employee_id: 'EMP-2021-089',
              department: 'ICTD',
              colleges: null,
            },
          },
        ]),
      });
    });

    await page.goto('/admin/verifications');
    await page.waitForLoadState('networkidle');

    // Verify System Verifications page loads
    await expect(page.getByRole('heading', { name: /COR CLEARANCE SYSTEM/i })).toBeVisible();

    // Verify Affiliation filter tabs
    await expect(page.getByRole('button', { name: /All Submissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Students • COR/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Staff & Faculty • Employee ID/i })).toBeVisible();

    // Verify Sort Dropdown exists
    const sortDropdown = page.getByRole('combobox').filter({ hasText: /Newest First|Students First|Staff/i }).first();
    await expect(sortDropdown).toBeVisible();

    // Click sort dropdown to verify options
    await sortDropdown.click();
    await expect(page.getByRole('option', { name: 'Students First' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Staff & Faculty First' })).toBeVisible();
    await expect(page.getByRole('option', { name: /Confidence: High to Low/i })).toBeVisible();

    // Select "Staff & Faculty First"
    await page.getByRole('option', { name: 'Staff & Faculty First' }).click();
    await expect(sortDropdown).toContainText(/Staff & Faculty First/i);

    // Filter by Staff & Faculty affiliation tab
    const staffTab = page.getByRole('button', { name: /Staff & Faculty • Employee ID/i });
    await staffTab.click();

    // Verify filtered submission shows Maria Santos in table
    await expect(page.getByRole('table').getByText('Santos, Maria')).toBeVisible();
    // Juan Dela Cruz should be filtered out
    await expect(page.getByRole('table').getByText('Dela Cruz, Juan')).toHaveCount(0);
  });

  test('Tournament Management Creation Modal Categories and Full Friendly Form Submission', async ({ page }) => {
    await setupSuperAdminSession(page);

    let insertedTournamentPayload: any = null;

    await page.route('**/rest/v1/tournaments*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        insertedTournamentPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'mock-friendly-tourn-id',
              name: insertedTournamentPayload?.name || 'PSU Friendly Games 2026',
              sport: insertedTournamentPayload?.sport || 'Basketball',
              type: insertedTournamentPayload?.type || 'Friendly',
              status: 'Draft',
              start_date: insertedTournamentPayload?.start_date || '2026-11-01',
              end_date: insertedTournamentPayload?.end_date || '2026-11-05',
            },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.route('**/rest/v1/teams*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');

    // Click "Host Event" button
    const createBtn = page.getByRole('button', { name: /Host Event/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Modal dialog should open
    await expect(page.getByRole('heading', { name: /Host Tournament/i })).toBeVisible();

    // Switch to Single Tournament mode
    const singleModeBtn = page.getByRole('button', { name: /Custom Single Ballgame/i });
    await expect(singleModeBtn).toBeVisible();
    await singleModeBtn.click();

    // Open Tournament Category select
    const categorySelect = page.getByRole('combobox').filter({ hasText: /Binturungan|Inter-Collegiate|Friendly/i }).first();
    await expect(categorySelect).toBeVisible();
    await categorySelect.click();

    // Verify all supported tournament types are present in the dropdown
    await expect(page.getByRole('option', { name: /Binturungan \(Tribal Fest\)/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Inter-Collegiate League/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Friendly Match/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Faculty & Staff Friendly Games/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /STRASUC Regional Meet/i })).toHaveCount(0);

    // Select Friendly Match
    await page.getByRole('option', { name: /Friendly Match/i }).click();
    await expect(categorySelect).toContainText(/Friendly Match/i);

    // Set Dates
    const kickoffInput = page.locator('input[type="date"]').first();
    const finalsInput = page.locator('input[type="date"]').nth(1);
    await kickoffInput.fill('2026-11-01');
    await finalsInput.fill('2026-11-05');

    // Submit form by clicking Launch Ballgame Event (Draft) and await POST request
    const submitBtn = page.getByRole('button', { name: /Launch Ballgame Event \(Draft\)/i });
    await expect(submitBtn).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/rest/v1/tournaments') && req.method() === 'POST'),
      submitBtn.click(),
    ]);

    await expect(page.getByText(/created in Draft mode/i)).toBeVisible();

    // Assert that the intercepted POST request to Supabase contains valid type = 'Friendly'
    const postData = request.postDataJSON();
    expect(postData).toBeTruthy();
    expect(postData.type).toBe('Friendly');
    expect(postData.sport).toBe('Basketball');
    expect(postData.status).toBe('Draft');
  });

  test('Player Dashboard Role-Adaptive Division Views for Faculty and Student Athletes', async ({ page }) => {
    // 1. Test as Faculty Athlete
    await setupPlayerSession(page, 'player_faculty');

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 't-friendly-1',
            name: 'PSU Faculty Friendly Cup',
            sport: 'Basketball',
            type: 'Friendly',
            status: 'Draft',
            start_date: '2026-11-01',
          },
          {
            id: 't-binturungan-1',
            name: 'PSU Binturungan 2026 - Basketball',
            sport: 'Basketball',
            type: 'Binturungan',
            status: 'Draft',
            start_date: '2026-11-10',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/player');
    await page.waitForLoadState('networkidle');

    // Faculty should see division switcher with Friendly Games active by default
    const friendlyDivisionBtn = page.getByRole('button', { name: /Friendly Games \(Staff & Faculty\)/i });
    await expect(friendlyDivisionBtn).toBeVisible();

    // Should see PSU Faculty Friendly Cup
    await expect(page.getByText('PSU Faculty Friendly Cup')).toBeVisible();

    // Switch to Binturungan
    const binturunganDivisionBtn = page.getByRole('button', { name: /Binturungan \(Tribal Fest\)/i });
    await binturunganDivisionBtn.click();
    await expect(page.getByText('PSU Binturungan 2026 - Basketball')).toBeVisible();
  });

  test('Verification Document Upload rejects files exceeding 5MB limit to prevent storage overflow', async ({ page }) => {
    await setupPlayerSession(page, 'player_student');

    // Route /rest/v1/users* to return unverified student
    await page.route('**/rest/v1/users*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '22222222-2222-2222-2222-222222222222',
          full_name: 'Unverified Student',
          role: 'player_student',
          is_verified: false,
          account_status: 'active',
          student_number: '2024-55555',
        }),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/player');
    await page.waitForLoadState('networkidle');

    // Check file input exists
    const fileInput = page.locator('input#cor');
    await expect(fileInput).toBeVisible();

    // Create a 6MB dummy buffer (6 * 1024 * 1024 bytes)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

    // Attempt to upload file exceeding 5MB
    await fileInput.setInputFiles({
      name: 'large_document.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });

    // Verify rejection toast appears with 5MB limit notice
    await expect(page.getByText(/File exceeds 5MB limit/i)).toBeVisible();
  });
});
