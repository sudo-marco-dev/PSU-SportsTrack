/**
 * Adversarial Voice Search & Route Integrity Verification Suite
 * PSU SportsTrack - Empirical Challenger
 *
 * Stress-tests:
 * 1. Unusual capitalization, excessive whitespace, punctuation, pathological inputs.
 * 2. Combined and ambiguous trigger phrases.
 * 3. Graceful degradation of executePublicVoiceDataQuery under edge-case queries.
 * 4. Route alias integrity: direct visits and programmatic redirects without 404 Arena Navigation Error.
 * 5. HUD adversarial input handling, empty state rendering, and preview navigation links.
 * 6. Search page URL parameter handling, invalid types, and XSS safety.
 */

import { test, expect } from '@playwright/test';
import { parsePublicVoiceQuery, executePublicVoiceDataQuery } from '../src/lib/publicVoiceAssistant';
import { supabase } from '../src/lib/supabase';

test.describe('Adversarial Trigger Parsing Stress Tests', () => {
  test('A1. Handles extreme capitalization variants', () => {
    // All-caps triggers
    const q1 = parsePublicVoiceQuery('UPCOMING GAMES THIS WEEK');
    expect(q1.queryType).toBe('upcoming_games');
    expect(q1.targetRoute).toBe('/explorer');

    const q2 = parsePublicVoiceQuery('VOLLEYBALL SCHEDULE');
    expect(q2.queryType).toBe('sport_schedule');
    expect(q2.sport).toBe('volleyball');

    const q3 = parsePublicVoiceQuery('HIGHEST STARS');
    expect(q3.queryType).toBe('highest_stars');
    expect(q3.targetRoute).toBe('/ranking');

    // Mixed/alternating case triggers
    const q4 = parsePublicVoiceQuery('sHoW pLaYeRs DeLa CrUz');
    expect(q4.queryType).toBe('player_search');
    expect(q4.searchTerm?.toLowerCase()).toContain('dela cruz');

    const q5 = parsePublicVoiceQuery('cEt StAnDiNgS');
    expect(q5.queryType).toBe('college_search');
    expect(q5.searchTerm).toBe('CET');

    const q6 = parsePublicVoiceQuery('mAtChEs AnD gAmEs');
    expect(q6.queryType).toBe('match_search');
  });

  test('A2. Handles excessive whitespace, newlines, and tabs', () => {
    const q1 = parsePublicVoiceQuery('   upcoming    games    this    week   ');
    expect(q1.queryType).toBe('upcoming_games');
    expect(q1.targetRoute).toBe('/explorer');

    const q2 = parsePublicVoiceQuery('\t\nbasketball\t\tschedule\r\n');
    expect(q2.queryType).toBe('sport_schedule');
    expect(q2.sport).toBe('basketball');

    const q3 = parsePublicVoiceQuery('   who    is    Santos   ');
    expect(q3.queryType).toBe('player_search');
    expect(q3.searchTerm?.toLowerCase()).toBe('santos');

    const q4 = parsePublicVoiceQuery('   go     to     rankings    ');
    expect(q4.queryType).toBe('navigation');
    expect(q4.targetRoute).toBe('/ranking');
  });

  test('A3. Handles heavy punctuation, symbols, and conversational noise', () => {
    const q1 = parsePublicVoiceQuery('upcoming games?!?!');
    expect(q1.queryType).toBe('upcoming_games');

    const q2 = parsePublicVoiceQuery('who is Dela Cruz???');
    expect(q2.queryType).toBe('player_search');
    expect(q2.searchTerm?.toLowerCase()).toContain('dela cruz');

    const q3 = parsePublicVoiceQuery('show CET... standings?!');
    expect(q3.queryType).toBe('college_search');

    const q4 = parsePublicVoiceQuery('highest stars #1!!!');
    expect(q4.queryType).toBe('highest_stars');

    const q5 = parsePublicVoiceQuery('"basketball" / "futsal" schedule?');
    expect(q5.queryType).toBe('sport_schedule');
  });

  test('A4. Handles boundary and pathological inputs without throwing', () => {
    // Empty string
    const qEmpty = parsePublicVoiceQuery('');
    expect(qEmpty.queryType).toBe('general_search');
    expect(qEmpty.targetRoute).toBe('/search?q=');
    expect(qEmpty.spokenResponse).toBeTruthy();
    expect(qEmpty.confidence).toBeGreaterThan(0);

    // Whitespace only
    const qSpaces = parsePublicVoiceQuery('     ');
    expect(qSpaces.queryType).toBe('general_search');
    expect(qSpaces.targetRoute).toBe(`/search?q=${encodeURIComponent('     ')}`);

    // Punctuation only
    const qPunct = parsePublicVoiceQuery('!@#$%^&*()_+-=~`');
    expect(qPunct.queryType).toBe('general_search');
    expect(qPunct.spokenResponse).toBeTruthy();

    // 1000 characters long input
    const longInput = 'basketball '.repeat(100);
    const qLong = parsePublicVoiceQuery(longInput);
    expect(qLong.queryType).toBe('sport_schedule');
    expect(qLong.sport).toBe('basketball');

    // XSS injection payload
    const qXss = parsePublicVoiceQuery('<script>alert("xss")</script>');
    expect(qXss.targetRoute).toBe(`/search?q=${encodeURIComponent('<script>alert("xss")</script>')}`);

    // SQL injection payload
    const qSql = parsePublicVoiceQuery("' OR 1=1 --");
    expect(qSql.spokenResponse).toBeTruthy();
  });

  test('A5. Handles compound, ambiguous, and combined trigger phrases', () => {
    // Sport + Matches
    const q1 = parsePublicVoiceQuery('basketball matches');
    expect(['sport_schedule', 'match_search']).toContain(q1.queryType);
    expect(q1.targetRoute).toContain('/search');

    // College + Sport
    const q2 = parsePublicVoiceQuery('CET basketball tournament');
    expect(['college_search', 'sport_schedule']).toContain(q2.queryType);
    expect(q2.targetRoute).toContain('/search');

    // Highest stars + Sport
    const q3 = parsePublicVoiceQuery('highest stars in football');
    expect(['highest_stars', 'sport_schedule']).toContain(q3.queryType);
    expect(q3.targetRoute).toBeTruthy();

    // Direct nav + fixtures
    const q4 = parsePublicVoiceQuery('go to tournaments and view fixtures');
    expect(q4.queryType).toBe('navigation');
    expect(q4.targetRoute).toBe('/explorer');

    // Direct nav + standings
    const q5 = parsePublicVoiceQuery('take me to standings');
    expect(q5.queryType).toBe('navigation');
    expect(q5.targetRoute).toBe('/ranking');

    // Open dedicated search hub
    const q6 = parsePublicVoiceQuery('open search hub');
    expect(q6.queryType).toBe('navigation');
    expect(q6.targetRoute).toBe('/search');
  });

  test('A6. Invariant check: all parsed results have valid routes and spoken feedback', () => {
    const testPhrases = [
      'games',
      'matches',
      'fixtures',
      'players',
      'athlete',
      'colleges',
      'cet',
      'cba',
      'cas',
      'highest',
      'mvp',
      'star leaders',
      'basketball',
      'volleyball',
      'football',
      'futsal',
      'chess',
      'pickleball',
      'schedules',
      'brackets',
      'home',
      'rankings',
      'help',
      'random unrecognized text 12345',
    ];

    for (const phrase of testPhrases) {
      const res = parsePublicVoiceQuery(phrase);
      expect(res.spokenResponse.length).toBeGreaterThan(0);
      expect(res.confidence).toBeGreaterThanOrEqual(0);
      expect(res.confidence).toBeLessThanOrEqual(1);
      if (res.targetRoute) {
        expect(res.targetRoute.startsWith('/')).toBe(true);
      }
    }
  });
});

test.describe('Public Voice Assistant Data Query Engine Fault Tolerance', () => {
  test('B1. executePublicVoiceDataQuery survives zero-match and edge-case queries gracefully', async () => {
    // 1. Unknown query
    const resUnknown = await executePublicVoiceDataQuery({
      rawTranscript: 'bogus query',
      queryType: 'unknown',
      spokenResponse: '',
      confidence: 0.5,
    });
    expect(resUnknown.items).toBeInstanceOf(Array);

    // 2. Non-existent player
    const resPlayer = await executePublicVoiceDataQuery({
      rawTranscript: 'who is non_existent_athlete_xyz_999',
      queryType: 'player_search',
      searchTerm: 'non_existent_athlete_xyz_999',
      spokenResponse: '',
      confidence: 0.9,
    });
    expect(resPlayer.items).toBeInstanceOf(Array);
    expect(resPlayer.items.length).toBe(0);

    // 3. Non-existent college
    const resCollege = await executePublicVoiceDataQuery({
      rawTranscript: 'college of non_existent_dept_999',
      queryType: 'college_search',
      searchTerm: 'non_existent_dept_999',
      spokenResponse: '',
      confidence: 0.9,
    });
    expect(resCollege.items).toBeInstanceOf(Array);
    expect(resCollege.items.length).toBe(0);

    // 4. Non-existent sport schedule
    const resSport = await executePublicVoiceDataQuery({
      rawTranscript: 'underwater_basket_weaving schedule',
      queryType: 'sport_schedule',
      sport: 'underwater_basket_weaving',
      spokenResponse: '',
      confidence: 0.9,
    });
    expect(resSport.items).toBeInstanceOf(Array);
    expect(resSport.items.length).toBe(0);

    // 5. Match search with non-existent keyword
    const resMatch = await executePublicVoiceDataQuery({
      rawTranscript: 'match non_existent_team_xyz_999',
      queryType: 'match_search',
      searchTerm: 'non_existent_team_xyz_999',
      spokenResponse: '',
      confidence: 0.9,
    });
    expect(resMatch.items).toBeInstanceOf(Array);
    expect(resMatch.items.length).toBe(0);

    // 6. General search with special characters
    const resGeneral = await executePublicVoiceDataQuery({
      rawTranscript: '***special---chars***',
      queryType: 'general_search',
      searchTerm: '***special---chars***',
      spokenResponse: '',
      confidence: 0.7,
    });
    expect(resGeneral.items).toBeInstanceOf(Array);
  });

  test('B2. executePublicVoiceDataQuery retrieves records for existing entities', async () => {
    const resGames = await executePublicVoiceDataQuery({
      rawTranscript: 'upcoming games',
      queryType: 'upcoming_games',
      spokenResponse: '',
      confidence: 0.95,
    });
    expect(resGames.items).toBeInstanceOf(Array);

    const resStars = await executePublicVoiceDataQuery({
      rawTranscript: 'highest stars',
      queryType: 'highest_stars',
      spokenResponse: '',
      confidence: 0.96,
    });
    expect(resStars.items).toBeInstanceOf(Array);

    const resSport = await executePublicVoiceDataQuery({
      rawTranscript: 'basketball',
      queryType: 'sport_schedule',
      sport: 'basketball',
      spokenResponse: '',
      confidence: 0.9,
    });
    expect(resSport.items).toBeInstanceOf(Array);

    const resColleges = await executePublicVoiceDataQuery({
      rawTranscript: 'colleges',
      queryType: 'college_search',
      searchTerm: 'colleges',
      spokenResponse: '',
      confidence: 0.92,
    });
    expect(resColleges.items).toBeInstanceOf(Array);
    expect(resColleges.items.length).toBeGreaterThan(0);
    expect((resColleges as any).error).toBeFalsy();
    console.log('B2 Colleges query result count:', resColleges.items.length, 'has error:', (resColleges as any).error);
  });

  test('B3. Direct Supabase entity querying check', async () => {
    const qMatches = await supabase
      .from('matches')
      .select('id, status, round, venue, match_time, team_a_score, team_b_score, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), tournament:tournaments!matches_tournament_id_fkey(name, sport)')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('Matches check:', qMatches.error ? qMatches.error.message : `${qMatches.data?.length} records`);
    expect(qMatches.error).toBeNull();

    const qUsers = await supabase
      .from('users')
      .select('id, full_name, role, is_verified, primary_position, college:colleges!users_college_id_fkey(college_name)')
      .in('role', ['player_student', 'player_faculty', 'player_staff', 'Player', 'coach'])
      .limit(5);
    console.log('Users check:', qUsers.error ? qUsers.error.message : `${qUsers.data?.length} records`);
    expect(qUsers.error).toBeNull();

    const qStars = await supabase
      .from('player_stars')
      .select('id, star_type, user:users!player_stars_player_id_fkey(id, full_name, college:colleges!users_college_id_fkey(college_name))')
      .limit(5);
    console.log('Stars check:', qStars.error ? qStars.error.message : `${qStars.data?.length} records`);
    expect(qStars.error).toBeNull();

    const qTourn = await supabase
      .from('tournaments')
      .select('id, name, sport, type, status, start_date, end_date')
      .order('start_date', { ascending: false })
      .limit(5);
    console.log('Tournaments check:', qTourn.error ? qTourn.error.message : `${qTourn.data?.length} records`);
    expect(qTourn.error).toBeNull();

    // Plain colleges query succeeds
    const qCollegesPlain = await supabase.from('colleges').select('id, college_name').limit(5);
    console.log('Colleges plain check:', qCollegesPlain.error ? qCollegesPlain.error.message : `${qCollegesPlain.data?.length} records`);
    expect(qCollegesPlain.error).toBeNull();
    expect(qCollegesPlain.data?.length).toBeGreaterThan(0);

    // Foreign key join cluster:clusters(id, name, color) fails with PGRST200
    const qCollegesWithCluster = await supabase.from('colleges').select('id, college_name, cluster:clusters(id, name, color)').limit(5);
    console.log('Colleges with cluster check code:', qCollegesWithCluster.error?.code, 'message:', qCollegesWithCluster.error?.message);
    expect(qCollegesWithCluster.error).not.toBeNull();
    expect(qCollegesWithCluster.error?.code).toBe('PGRST200');
  });
});

test.describe('Route Alias Navigation & 404 Prevention Hardening', () => {
  const routesToVerify = [
    { path: '/tournaments', expectedTarget: '/explorer' },
    { path: '/rankings', expectedTarget: '/ranking' },
    { path: '/live', expectedTarget: '/explorer' },
    { path: '/live/match-adversarial-123', expectedTarget: '/match/match-adversarial-123' },
    { path: '/brackets', expectedTarget: '/explorer' },
    { path: '/standings', expectedTarget: '/ranking' },
    { path: '/fixtures', expectedTarget: '/explorer' },
    { path: '/query', expectedTarget: '/search' },
    { path: '/matches', expectedTarget: '/explorer' },
    { path: '/scouting', expectedTarget: '/athletics' },
    { path: '/search', expectedTarget: '/search' },
    { path: '/search?q=basketball&type=schedules', expectedTarget: '/search' },
  ];

  for (const route of routesToVerify) {
    test(`C1. Visiting ${route.path} resolves to ${route.expectedTarget} without Arena Navigation Error (404)`, async ({
      page,
    }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // Must be on expected target URL
      await expect(page).toHaveURL(new RegExp(route.expectedTarget.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')));

      // Absolutely zero 404 "Arena Navigation Error" indicators
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await expect(page.locator('text=Fixture Not Found')).not.toBeVisible();
      await expect(page.locator('text=Attempted route:')).not.toBeVisible();
    });
  }

  test('C2. Programmatic navigation via LiveMatchRedirect preserves matchId query and params', async ({ page }) => {
    const randomMatchId = `test-id-${Date.now()}`;
    await page.goto(`/live/${randomMatchId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/match/${randomMatchId}`));
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });
});

test.describe('HUD Adversarial Stress & Fallback State Tests', () => {
  test('D1. Submitting adversarial punctuation into HUD renders empty state safely without crashing', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open HUD
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    // Type special characters into HUD search input
    const input = page.locator('[data-testid="input-public-voice-search"]');
    await input.fill('!@#$%^&*()_+=~`');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // Should display non-blank empty state
    const emptyState = page.locator('[data-testid="hud-empty-state"]');
    await expect(emptyState).toBeVisible({ timeout: 8000 });
    await expect(emptyState).toContainText('No matching athletic records found');

    // Clicking "Open Dedicated Search Hub" in empty state navigates to /search
    const openSearchBtn = page.locator('[data-testid="btn-hud-open-search"]');
    await expect(openSearchBtn).toBeVisible();
    await openSearchBtn.click();

    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('D2. Submitting XSS string into HUD handles input safely without alert', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const input = page.locator('[data-testid="input-public-voice-search"]');
    await input.fill('<script>alert("xss")</script>');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // Confirm no JS alert dialog was executed
    expect(dialogTriggered).toBe(false);

    // Empty state or safe view rendered
    const emptyState = page.locator('[data-testid="hud-empty-state"]');
    await expect(emptyState).toBeVisible({ timeout: 8000 });
  });

  test('D3. HUD quick suggestion pills trigger queries without throwing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    // Click "College rankings" quick chip
    const rankingsChip = page.locator('button:has-text("College rankings")');
    await expect(rankingsChip).toBeVisible();
    await rankingsChip.click();

    // Spoken response or navigation trigger should be displayed
    await expect(page.locator('text=Navigating to College Standings and Medal Rankings.')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Dedicated Search Page Edge Cases & Filtering Hardening', () => {
  test('E1. Search page handles XSS search parameters safely', async ({ page }) => {
    let alertExecuted = false;
    page.on('dialog', async (dialog) => {
      alertExecuted = true;
      await dialog.dismiss();
    });

    await page.goto('/search?q=%3Cscript%3Ealert(%22xss%22)%3C%2Fscript%3E', {
      waitUntil: 'domcontentloaded',
    });

    const searchInput = page.locator('[data-testid="input-voice-search-page"]');
    await expect(searchInput).toBeVisible({ timeout: 8000 });
    expect(alertExecuted).toBe(false);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('E2. Search page handles invalid/bogus category type parameter gracefully', async ({ page }) => {
    await page.goto('/search?type=invalid_bogus_category_type', {
      waitUntil: 'domcontentloaded',
    });

    // Page mounts without 404 or throwing
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('E3. Rapid switching across all category filter tabs does not break router or state', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const tabs = [
      'tab-filter-matches',
      'tab-filter-players',
      'tab-filter-colleges',
      'tab-filter-rankings',
      'tab-filter-schedules',
      'tab-filter-all',
    ];

    for (const tabId of tabs) {
      const tabBtn = page.locator(`[data-testid="${tabId}"]`);
      await tabBtn.click();
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    }
  });

  test('E4. Clearing search query via interactive clear button resets URL parameter', async ({ page }) => {
    await page.goto('/search?q=basketball', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('[data-testid="input-voice-search-page"]');
    await expect(searchInput).toHaveValue('basketball');

    // Click clear button (X icon)
    const clearBtn = page.locator('button[title="Clear query"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Input should be empty and q param removed from URL
    await expect(searchInput).toHaveValue('');
    await expect(page).not.toHaveURL(/q=basketball/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('E5. Search page college search renders college records from database', async ({ page }) => {
    await page.goto('/search?q=CET&type=colleges', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible();

    const collegesSection = page.locator('[data-testid="section-colleges-results"]');
    await expect(collegesSection).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=College of Engineering')).toBeVisible();
    await expect(page.locator('text=No Matching Records Found')).not.toBeVisible();
  });

  test('E6. Verifies college badge count and college query failure in UI', async ({ page }) => {
    // Listen for console warnings
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/search?type=colleges', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible();

    // Check college tab badge text reflects 9 records
    const collegeTabBadge = page.locator('[data-testid="tab-filter-colleges"] div, [data-testid="tab-filter-colleges"] span').last();
    await expect(collegeTabBadge).toHaveText('9', { timeout: 10000 });

    // Check that NO PGRST200 query error was logged in console
    const queryErrorLog = consoleLogs.find((l) => l.includes('[VoiceQuerySearch] Query error') || l.includes('PGRST200'));
    expect(queryErrorLog).toBeUndefined();
  });
});
