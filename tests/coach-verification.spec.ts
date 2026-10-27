import { test, expect } from '@playwright/test';

test.describe('Athletic Coach Verification & Roster Clearance Suite', () => {
  const coachId = 'test-coach-id-999';
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;

  const mockCoachUser = {
    id: coachId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'coach.norman@psu.palawan.edu.ph',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Coach Norman' },
    created_at: new Date().toISOString(),
  };

  const mockCoachSession = {
    access_token: 'fake-coach-token-valid-for-tests',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: futureExpiresAt,
    user: mockCoachUser,
  };

  test('should show coach verification clearance prompt and block team enrollment for unverified coach', async ({ page }) => {
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachUser),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachSession),
        });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      const url = route.request().url();
      if (url.includes('role=in') || url.includes('role=eq.player') || url.includes('select=id%2Cfull_name') || url.includes('select=id,full_name')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: coachId,
            full_name: 'Coach Norman',
            role: 'coach',
            is_verified: false,
            account_status: 'active',
            college_id: 'col-1',
            college_name: 'College of Arts and Humanities',
          }),
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

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tourney-1',
            name: 'University Intramurals 2026',
            sport: 'Basketball',
            status: 'Draft',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockCoachSession });

    await page.goto('/coach');
    await page.waitForLoadState('networkidle');

    // 1. Verify unverified coach alert banner is displayed
    await expect(page.getByText('Submit Coach ID to Unlock Team Management')).toBeVisible();
    await expect(page.getByText(/university athletic regulations require coach verification/i)).toBeVisible();

    // 2. Verify "Apply Your Team Now" is replaced with "Verification Required"
    const lockButton = page.getByRole('button', { name: /Verification Required/i }).first();
    await expect(lockButton).toBeVisible();

    // 3. Clicking "Verification Required" shows guidance toast
    await lockButton.click();
    await expect(page.getByText(/Coach verification required before applying or managing teams/i).first()).toBeVisible();
  });

  test('should display restricted banner and disable new team creation on team management for unverified coach', async ({ page }) => {
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachUser),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachSession),
        });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      const url = route.request().url();
      if (url.includes('role=in') || url.includes('role=eq.player') || url.includes('select=id%2Cfull_name') || url.includes('select=id,full_name')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: coachId,
            full_name: 'Coach Norman',
            role: 'coach',
            is_verified: false,
            account_status: 'active',
            college_id: 'col-1',
            college_name: 'College of Arts and Humanities',
          }),
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

    await page.route('**/rest/v1/colleges*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'col-1', college_name: 'College of Arts and Humanities' }]),
      });
    });

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockCoachSession });

    await page.goto('/coach/teams');
    await page.waitForLoadState('networkidle');

    // 1. Verify Unverified Coach alert banner is visible
    await expect(page.getByText('Unverified Coach')).toBeVisible();
    await expect(page.getByText('Roster Management Restricted')).toBeVisible();

    // 2. Verify "New Team" button indicates Verification Required
    const newTeamBtn = page.getByRole('button', { name: /Verification Required/i }).first();
    await expect(newTeamBtn).toBeVisible();

    // 3. Attempting to click "Verification Required" warns coach
    await newTeamBtn.click();
    await expect(page.getByText(/Coach verification required to register new teams/i).first()).toBeVisible();
  });

  test('should enforce ID photo format (PNG, JPG, WEBP) and reject PDF for coach verification', async ({ page }) => {
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachUser),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCoachSession),
        });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      const url = route.request().url();
      if (url.includes('role=in') || url.includes('role=eq.player') || url.includes('select=id%2Cfull_name') || url.includes('select=id,full_name')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: coachId,
            full_name: 'Coach Norman',
            role: 'coach',
            is_verified: false,
            account_status: 'active',
            college_id: 'col-1',
            college_name: 'College of Arts and Humanities',
          }),
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

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockCoachSession });

    await page.goto('/coach');
    await page.waitForLoadState('networkidle');

    // 1. Verify Coach Clearance Badge & Instructions
    await expect(page.getByText('Athletic Coach Clearance')).toBeVisible();
    await expect(page.getByText(/Official PSU Coach \/ Employee ID Required/i)).toBeVisible();
    await expect(page.getByText(/Formats: PNG, JPG, WEBP/i)).toBeVisible();

    // 2. Reject PDF upload attempt
    const fileInput = page.locator('input#cor');
    await expect(fileInput).toBeVisible();

    await fileInput.setInputFiles({
      name: 'credential_letter.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock pdf content'),
    });

    await expect(page.getByText(/Coach athletic clearance requires an official coach \/ employee ID card photo/i).first()).toBeVisible();

    // 3. Accept PNG image upload
    await fileInput.setInputFiles({
      name: 'coach_id_photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock png bytes'),
    });

    await expect(page.getByText(/Selected Coach ID Photo Preview/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit Coach ID for Verification/i })).toBeVisible();
  });

  test('should allow admin to view coach submissions under Coaches tab and approve clearance', async ({ page }) => {
    const adminId = 'admin-user-001';
    const mockAdminUser = {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin.sports@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Sports Director' },
      created_at: new Date().toISOString(),
    };

    const mockAdminSession = {
      access_token: 'fake-admin-token-valid-for-tests',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: futureExpiresAt,
      user: mockAdminUser,
    };

    const pendingCoachDoc = {
      id: 'doc-coach-123',
      user_id: coachId,
      document_type: 'COACH_ID',
      storage_path: `${coachId}/coach_id_photo.png`,
      status: 'Pending',
      created_at: new Date().toISOString(),
      confidence_score: 100,
      extracted_student_no: 'EMP-2024-888',
      extracted_full_name: 'Coach Norman',
      extracted_college: 'College of Arts and Humanities',
      extracted_program: 'Athletics Department',
      ocr_raw_text: '[Coach ID Verification] Submitted by Coach Norman (College of Arts and Humanities)',
      auto_match_status: 'Manual Review',
      users: {
        full_name: 'Coach Norman',
        email: 'coach.norman@psu.palawan.edu.ph',
        role: 'coach',
        account_status: 'active',
        employee_id: 'EMP-2024-888',
        colleges: { college_name: 'College of Arts and Humanities' },
      },
    };

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAdminUser),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAdminSession),
        });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: adminId,
            full_name: 'Sports Director',
            role: 'admin',
            is_verified: true,
            account_status: 'active',
          }),
        });
      }
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...pendingCoachDoc, status: 'Approved' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([pendingCoachDoc]),
        });
      }
    });

    await page.route('**/rest/v1/audit_logs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockAdminSession });

    await page.goto('/admin/verifications');
    await page.waitForLoadState('networkidle');

    // 1. Verify "Coaches • Coach ID" filter tab exists
    const coachesTab = page.getByRole('button', { name: /Coaches • Coach ID/i });
    await expect(coachesTab).toBeVisible();

    // 2. Click Coaches tab
    await coachesTab.click();

    // 3. Verify coach clearance item is displayed in desktop table
    await expect(page.locator('table').getByText('Coach Norman').first()).toBeVisible();
    await expect(page.locator('table').getByText(/Coach ID • Manual Review/i).first()).toBeVisible();

    // 4. Click "Approve" button
    const approveBtn = page.locator('table').getByRole('button', { name: /^Approve$/i }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 5. Verify success toast notification
    await expect(page.getByText(/Clearance approved for Coach Norman/i).first()).toBeVisible();
  });
});
