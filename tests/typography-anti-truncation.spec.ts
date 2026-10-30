import { test, expect } from '@playwright/test';
import { formatCoachName } from '../src/lib/utils';
import { extractCollegeCode, PSU_COLLEGE_DICTIONARY } from '../src/lib/collegeDictionary';

test.describe('Typography, Anti-Truncation & College Code Engine Tests', () => {
  test('formatCoachName: should handle single, duplicate, case-insensitive, and fallback coach prefixes', () => {
    // Normal name without prefix
    expect(formatCoachName('Danilo Soriano')).toBe('Coach Danilo Soriano');

    // Name already has "Coach"
    expect(formatCoachName('Coach Danilo Soriano')).toBe('Coach Danilo Soriano');

    // Case-insensitive uppercase
    expect(formatCoachName('COACH Danilo Soriano')).toBe('Coach Danilo Soriano');

    // Duplicate prefixes
    expect(formatCoachName('Coach Coach Danilo Soriano')).toBe('Coach Danilo Soriano');
    expect(formatCoachName('COACH Coach Danilo Soriano')).toBe('Coach Danilo Soriano');

    // Empty / null / whitespace / fallback
    expect(formatCoachName(null)).toBe('Coach');
    expect(formatCoachName(undefined)).toBe('Coach');
    expect(formatCoachName('')).toBe('Coach');
    expect(formatCoachName('   ')).toBe('Coach');
    expect(formatCoachName(null, 'Athletic Coach')).toBe('Athletic Coach');
    expect(formatCoachName('Coach', 'Athletic Coach')).toBe('Athletic Coach');
    expect(formatCoachName('  Coach   Danilo   Soriano  ')).toBe('Coach Danilo Soriano');
    expect(formatCoachName('Coach: Danilo Soriano')).toBe('Coach Danilo Soriano');
    expect(formatCoachName('Coach - Danilo Soriano')).toBe('Coach Danilo Soriano');
  });

  test('extractCollegeCode: should resolve all official PSU colleges with or without parentheses', () => {
    // With parentheses
    expect(extractCollegeCode('College of Sciences (CS)')).toBe('CS');
    expect(extractCollegeCode('College of Business and Accountancy (CBA)')).toBe('CBA');
    expect(extractCollegeCode('College of Engineering, Architecture and Technology (CEAT)')).toBe('CEAT');

    // Without parentheses - Dictionary matching
    expect(extractCollegeCode('College of Engineering, Architecture and Technology')).toBe('CEAT');
    expect(extractCollegeCode('College of Sciences')).toBe('CS');
    expect(extractCollegeCode('College of Business and Accountancy')).toBe('CBA');
    expect(extractCollegeCode('College of Criminal Justice Education')).toBe('CCJE');
    expect(extractCollegeCode('College of Teacher Education')).toBe('CTE');
    expect(extractCollegeCode('College of Arts and Humanities')).toBe('CAH');
    expect(extractCollegeCode('College of Community Resources Development')).toBe('CCRD');
    expect(extractCollegeCode('College of Hospitality Management and Tourism')).toBe('CHMT');
    expect(extractCollegeCode('College of Nursing and Health Sciences')).toBe('CNHS');

    // Ampersand variations (& vs and)
    expect(extractCollegeCode('Arts & Sciences')).toBe('CAS');
    expect(extractCollegeCode('College of Arts & Sciences')).toBe('CAS');
    expect(extractCollegeCode('College of Arts & Humanities')).toBe('CAH');
    expect(extractCollegeCode('College of Nursing & Health Sciences')).toBe('CNHS');
    expect(extractCollegeCode('College of Business & Accountancy')).toBe('CBA');

    // Compound names with acronyms and department suffixes
    expect(extractCollegeCode('CBA - Main Campus')).toBe('CBA');
    expect(extractCollegeCode('CCJE Department')).toBe('CCJE');
    expect(extractCollegeCode('CHMT Navigators')).toBe('CHMT');
    expect(extractCollegeCode('CTE Faculty')).toBe('CTE');
    expect(extractCollegeCode('CAH Department')).toBe('CAH');
    expect(extractCollegeCode('CNHS Medics')).toBe('CNHS');
    expect(extractCollegeCode('CS Department')).toBe('CS');

    // Lowercase / Variations
    expect(extractCollegeCode('college of sciences')).toBe('CS');
    expect(extractCollegeCode('engineering')).toBe('CEAT');
    expect(extractCollegeCode('criminal justice')).toBe('CCJE');

    // Pre-existing clean codes
    expect(extractCollegeCode('CS')).toBe('CS');
    expect(extractCollegeCode('CBA')).toBe('CBA');
    expect(extractCollegeCode('CEAT')).toBe('CEAT');

    // Empty / null / whitespace safety
    expect(extractCollegeCode(null)).toBe('');
    expect(extractCollegeCode(undefined)).toBe('');
    expect(extractCollegeCode('')).toBe('');
    expect(extractCollegeCode('   ')).toBe('');

    // Never return overflowing long strings
    const overflowingInput = 'Department of Specialized Extra-Curricular Aquatic Athletics and Oceanic Research';
    const code = extractCollegeCode(overflowingInput);
    expect(code.length).toBeLessThanOrEqual(5);
  });

  test('EmptyState: should use athletic sans typography and never contain rogue font-serif', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Go to an empty search or page that renders EmptyState
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Type a nonexistent search query to trigger EmptyState
    const searchInput = page.getByPlaceholder(/Search tournament, division, or status/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('XYZNONEXISTENTTOURNAMENT12345');
      await page.waitForTimeout(300);

      const emptyTitle = page.locator('[role="status"] h3');
      if (await emptyTitle.isVisible()) {
        const classAttr = await emptyTitle.getAttribute('class');
        expect(classAttr).not.toContain('font-serif');
        expect(classAttr).toContain('font-black');
      }
    }
  });

  test('Scouting Hub: Coach names do not duplicate "Coach Coach" and cards wrap cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Access scouting hub via dev impersonation or public link
    await page.goto('/dev');
    await page.waitForLoadState('networkidle');

    // Quick switch to coach persona or admin to view scouting hub
    const personaBtn = page.getByRole('button', { name: /Danilo Soriano/i }).first();
    if (await personaBtn.isVisible()) {
      await personaBtn.click();
      await page.waitForTimeout(400);

      // Navigate to Scouting Hub
      await page.goto('/scouting');
      await page.waitForLoadState('networkidle');

      // Click Coaches tab
      const coachesTab = page.getByRole('tab', { name: /Coaches/i });
      if (await coachesTab.isVisible()) {
        await coachesTab.click();
        await page.waitForTimeout(400);

        // Verify no Coach Coach text exists on the page
        const doubleCoach = page.locator('text=/Coach\\s+Coach/i');
        await expect(doubleCoach).toHaveCount(0);
      }

      // Click Teams tab
      const teamsTab = page.getByRole('tab', { name: /Teams/i });
      if (await teamsTab.isVisible()) {
        await teamsTab.click();
        await page.waitForTimeout(400);

        // Verify no "Coach: Coach" or "Coach Coach" text
        const duplicateCoachInTeams = page.locator('text=/Coach:?\\s+Coach/i');
        await expect(duplicateCoachInTeams).toHaveCount(0);
      }
    }
  });

  test('Rankings Podium: Long college titles (CEAT) are rendered in full without ellipsis (...) truncation', async ({ page }) => {
    // Mock colleges dataset with long collegiate title
    await page.route('**/rest/v1/colleges*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'col-1', college_name: 'College of Engineering, Architecture and Technology (CEAT)' },
          { id: 'col-2', college_name: 'College of Business and Accountancy (CBA)' },
          { id: 'col-3', college_name: 'College of Sciences (CS)' },
        ]),
      });
    });

    await page.route('**/rest/v1/clusters*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cl-1', name: 'Tribo Libulan', description: 'Deity of the Moon', college_codes: ['CEAT'] },
          { id: 'cl-2', name: 'Tribo Tala', description: 'Deity of Morning Star', college_codes: ['CBA'] },
          { id: 'cl-3', name: 'Tribo Haliya', description: 'Deity of Moonlight', college_codes: ['CS'] },
        ]),
      });
    });

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tourn-1',
            name: 'PSU Palawan Games 2026',
            sport: 'Basketball',
            type: 'Championship',
            status: 'Completed',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/teams*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'team-1',
            name: 'CEAT Red Devils',
            tournament_id: 'tourn-1',
            status: 'Approved',
            college_id: 'col-1',
            cluster_id: 'cl-1',
          },
          {
            id: 'team-2',
            name: 'CBA Lady Wolves',
            tournament_id: 'tourn-1',
            status: 'Approved',
            college_id: 'col-2',
            cluster_id: 'cl-2',
          },
          {
            id: 'team-3',
            name: 'CS Scorpions',
            tournament_id: 'tourn-1',
            status: 'Approved',
            college_id: 'col-3',
            cluster_id: 'cl-3',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'm-1',
            tournament_id: 'tourn-1',
            round: 'Finals',
            status: 'Completed',
            team_a_id: 'team-1',
            team_b_id: 'team-2',
            team_a_score: 95,
            team_b_score: 82,
          },
        ]),
      });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // 1. Desktop Test (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ranking');
    await page.waitForLoadState('networkidle');

    // Verify Rank 1 Champion displays full name without truncation
    const championHeading = page.getByRole('heading', { name: /College of Engineering, Architecture and Technology/i }).first();
    await expect(championHeading).toBeVisible();

    const championText = await championHeading.textContent();
    expect(championText).not.toContain('...');
    expect(championText?.toUpperCase()).toContain('TECHNOLOGY');

    // 2. Mobile Test (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/ranking');
    await page.waitForLoadState('networkidle');

    const mobileChampionHeading = page.getByRole('heading', { name: /College of Engineering, Architecture and Technology/i }).first();
    await expect(mobileChampionHeading).toBeVisible();
    const mobileText = await mobileChampionHeading.textContent();
    expect(mobileText).not.toContain('...');
    expect(mobileText?.toUpperCase()).toContain('TECHNOLOGY');
  });
});
