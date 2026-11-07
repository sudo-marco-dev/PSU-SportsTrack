import { test, expect } from '@playwright/test';
import { parsePublicVoiceQuery, executePublicVoiceDataQuery } from '@/lib/publicVoiceAssistant';

/**
 * EMPIRICAL CHALLENGER VERIFICATION SUITE: COLLEGES QUERY & NAVIGATION INTEGRITY
 *
 * Requirements from Orchestrator:
 * 1. "search colleges", "colleges", "college", "show colleges", "CET", "CEAT", "CBA", "CS", "CTE"
 * 2. Verify that all active collegiate units render their cards in the DOM.
 * 3. Verify that clicking "View Standings" navigates to /ranking without 404.
 * 4. Verify that there are ZERO PGRST200 warnings in browser console logs.
 */

const CANONICAL_GENERIC_QUERIES = ['colleges', 'college'];
const COMPOUND_GENERIC_QUERIES = ['search colleges', 'show colleges'];

const ACRONYM_QUERIES = [
  { term: 'CET', expectedSubstr: 'Engineering' },
  { term: 'CEAT', expectedSubstr: 'Engineering' },
  { term: 'CBA', expectedSubstr: 'Business' },
  { term: 'CS', expectedSubstr: 'Sciences' },
  { term: 'CTE', expectedSubstr: 'Teacher Education' },
];

test.describe('Challenger Suite 1: Query Parser Trigger Normalization & Invariants', () => {
  for (const query of [...CANONICAL_GENERIC_QUERIES, ...COMPOUND_GENERIC_QUERIES]) {
    test(`P1. Parser resolves generic query "${query}" to college_search and /search route`, () => {
      const parsed = parsePublicVoiceQuery(query);
      expect(parsed.queryType).toBe('college_search');
      expect(parsed.targetRoute).toContain('/search');
      expect(parsed.targetRoute).toContain('type=colleges');
      expect(parsed.spokenResponse).toBeTruthy();
    });
  }

  for (const { term } of ACRONYM_QUERIES) {
    test(`P2. Parser resolves acronym query "${term}" to college_search with searchTerm ${term}`, () => {
      const parsed = parsePublicVoiceQuery(term);
      expect(parsed.queryType).toBe('college_search');
      expect(parsed.searchTerm?.toUpperCase()).toBe(term.toUpperCase());
      expect(parsed.targetRoute).toContain('/search');
      expect(parsed.targetRoute).toContain('type=colleges');
    });
  }
});

test.describe('Challenger Suite 2: Supabase Colleges Data Query Engine & In-Memory Join', () => {
  for (const query of CANONICAL_GENERIC_QUERIES) {
    test(`D1. executePublicVoiceDataQuery for "${query}" retrieves all 9 colleges with zero error`, async () => {
      const parsed = parsePublicVoiceQuery(query);
      const res = await executePublicVoiceDataQuery(parsed);

      expect((res as any).error).toBeFalsy();
      expect(res.type).toBe('college_search');
      expect(res.items).toBeInstanceOf(Array);
      expect(res.items.length).toBe(9);

      for (const item of res.items) {
        expect(item.id).toBeTruthy();
        expect(item.college_name).toBeTruthy();
        expect(typeof item.college_name).toBe('string');
        expect(item.college_name.toLowerCase()).toContain('college');
        if (item.cluster) {
          expect(item.cluster.name).toBeTruthy();
        }
      }
    });
  }

  for (const query of COMPOUND_GENERIC_QUERIES) {
    test(`D1-Compound. Voice flow for "${query}" resolves via parser to 9 colleges in data engine`, async () => {
      const parsed = parsePublicVoiceQuery(query);
      // Parser normalizes "search colleges" -> searchTerm: 'colleges'
      const res = await executePublicVoiceDataQuery(parsed);
      expect((res as any).error).toBeFalsy();
      expect(res.items.length).toBe(9);
    });
  }

  for (const { term, expectedSubstr } of ACRONYM_QUERIES) {
    test(`D2. executePublicVoiceDataQuery for acronym "${term}" resolves to "${expectedSubstr}"`, async () => {
      const parsed = parsePublicVoiceQuery(term);
      const res = await executePublicVoiceDataQuery(parsed);

      expect((res as any).error).toBeFalsy();
      expect(res.type).toBe('college_search');
      expect(res.items).toBeInstanceOf(Array);
      expect(res.items.length).toBeGreaterThanOrEqual(1);

      const matching = res.items.find((c: any) =>
        c.college_name.toLowerCase().includes(expectedSubstr.toLowerCase())
      );
      expect(
        matching,
        `Expected acronym ${term} to find college containing "${expectedSubstr}"`
      ).toBeDefined();
      expect(matching.cluster).toBeDefined();
    });
  }
});

test.describe('Challenger Suite 3: E2E Search Page DOM Rendering, 404 Prevention & Console Purity', () => {
  for (const query of CANONICAL_GENERIC_QUERIES) {
    test(`E1. Generic query "${query}" renders all 9 college cards in DOM and View Standings navigates to /ranking`, async ({
      page,
    }) => {
      const pgrstLogs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('PGRST200') || text.includes('Could not find a relationship')) {
          pgrstLogs.push(text);
        }
      });

      await page.goto(`/search?q=${encodeURIComponent(query)}&type=colleges`, {
        waitUntil: 'domcontentloaded',
      });

      const tabColleges = page.locator('[data-testid="tab-filter-colleges"]');
      await expect(tabColleges).toBeVisible({ timeout: 8000 });
      await expect(tabColleges).toContainText('9');

      const collegeSection = page.locator('[data-testid="section-colleges-results"]');
      await expect(collegeSection).toBeVisible({ timeout: 8000 });
      await expect(collegeSection).toContainText('Colleges & Campuses (9)');

      const collegeCards = collegeSection.locator('button:has-text("View Standings")');
      await expect(collegeCards).toHaveCount(9);

      // Verify specific colleges render in DOM
      await expect(collegeSection).toContainText('College of Engineering, Architecture and Technology');
      await expect(collegeSection).toContainText('College of Business and Accountancy');
      await expect(collegeSection).toContainText('College of Sciences');
      await expect(collegeSection).toContainText('College of Teacher Education');

      // Click "View Standings" on the first college card
      const firstViewBtn = collegeCards.first();
      await firstViewBtn.click();

      // Navigation verification: reaches /ranking without 404
      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await expect(page.locator('text=Fixture Not Found')).not.toBeVisible();
      await expect(page.locator('text=Attempted route:')).not.toBeVisible();

      // Console purity check: ZERO PGRST200 errors or warnings
      expect(pgrstLogs, `PGRST200 errors detected in console for query "${query}": ${pgrstLogs.join('; ')}`).toEqual([]);
    });
  }

  for (const query of COMPOUND_GENERIC_QUERIES) {
    test(`E1-VoiceCompound. Voice assistant navigation for "${query}" renders all 9 college cards in DOM`, async ({
      page,
    }) => {
      const pgrstLogs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('PGRST200') || text.includes('Could not find a relationship')) {
          pgrstLogs.push(text);
        }
      });

      const parsed = parsePublicVoiceQuery(query);
      await page.goto(parsed.targetRoute!, {
        waitUntil: 'domcontentloaded',
      });

      const collegeSection = page.locator('[data-testid="section-colleges-results"]');
      await expect(collegeSection).toBeVisible({ timeout: 8000 });
      const collegeCards = collegeSection.locator('button:has-text("View Standings")');
      await expect(collegeCards).toHaveCount(9);

      expect(pgrstLogs).toEqual([]);
    });

    test(`E1-DirectEdgeCase. Adversarial stress check: Direct URL search with "?q=${query}" surfaces prefix filtering defect`, async ({
      page,
    }) => {
      await page.goto(`/search?q=${encodeURIComponent(query)}&type=colleges`, {
        waitUntil: 'domcontentloaded',
      });

      const tabColleges = page.locator('[data-testid="tab-filter-colleges"]');
      await expect(tabColleges).toBeVisible({ timeout: 8000 });

      // EMPIRICAL OBSERVATION:
      // VoiceQuerySearch.tsx line 178 only bypasses filtering for 'colleges' and 'college'.
      // For "${query}", it sends .ilike('college_name', '%${query}%') to Supabase, returning 0 rows.
      const tabText = await tabColleges.textContent();
      const hasZeroColleges = tabText?.includes('0') || false;
      console.log(`[Adversarial Discovery] Direct URL ?q=${query} yields tab text: "${tabText?.trim()}" (hasZeroColleges: ${hasZeroColleges})`);
      expect(hasZeroColleges, `Direct query for "${query}" without prefix stripping returns 0 colleges`).toBe(true);
    });
  }

  for (const { term, expectedSubstr } of ACRONYM_QUERIES) {
    test(`E2. Acronym query "${term}" renders "${expectedSubstr}" card in DOM with working View Standings link`, async ({
      page,
    }) => {
      const pgrstLogs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('PGRST200') || text.includes('Could not find a relationship')) {
          pgrstLogs.push(text);
        }
      });

      await page.goto(`/search?q=${encodeURIComponent(term)}&type=colleges`, {
        waitUntil: 'domcontentloaded',
      });

      const collegeSection = page.locator('[data-testid="section-colleges-results"]');
      await expect(collegeSection).toBeVisible({ timeout: 8000 });
      await expect(collegeSection).toContainText(expectedSubstr);

      const viewBtn = collegeSection.locator('button:has-text("View Standings")').first();
      await expect(viewBtn).toBeVisible();
      await viewBtn.click();

      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await expect(page.locator('text=Fixture Not Found')).not.toBeVisible();

      expect(pgrstLogs, `PGRST200 errors detected in console for acronym "${term}": ${pgrstLogs.join('; ')}`).toEqual([]);
    });
  }
});

test.describe('Challenger Suite 4: Public Voice Assistant HUD Colleges Flow', () => {
  test('H1. Querying "colleges" via HUD modal renders preview cards and navigates to /ranking', async ({
    page,
  }) => {
    const pgrstLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('PGRST200') || text.includes('Could not find a relationship')) {
        pgrstLogs.push(text);
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const input = page.locator('[data-testid="input-public-voice-search"]');
    await input.fill('colleges');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    const previewBtn = page.locator('[data-testid="btn-preview-view-college-0"]');
    await expect(previewBtn).toBeVisible({ timeout: 8000 });
    await expect(previewBtn).toContainText('View Standings');

    await previewBtn.click();
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();

    expect(pgrstLogs).toEqual([]);
  });

  test('H2. Querying acronym "CET" via HUD modal resolves to CEAT preview with working navigation', async ({
    page,
  }) => {
    const pgrstLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('PGRST200') || text.includes('Could not find a relationship')) {
        pgrstLogs.push(text);
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const input = page.locator('[data-testid="input-public-voice-search"]');
    await input.fill('CET');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    const previewBtn = page.locator('[data-testid="btn-preview-view-college-0"]');
    await expect(previewBtn).toBeVisible({ timeout: 8000 });

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText('Engineering');

    await previewBtn.click();
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();

    expect(pgrstLogs).toEqual([]);
  });
});
