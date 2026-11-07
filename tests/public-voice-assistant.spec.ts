/**
 * Public Voice Assistant Automated Test Suite
 * PSU SportsTrack - Universal Speech & Search Queries
 */

import { test, expect } from '@playwright/test';
import { parsePublicVoiceQuery, executePublicVoiceDataQuery } from '../src/lib/publicVoiceAssistant';

test.describe('Public Voice Assistant Query Parser Unit Tests', () => {
  test('0. executePublicVoiceDataQuery returns live college records from database without errors', async () => {
    const res = await executePublicVoiceDataQuery({
      rawTranscript: 'colleges',
      queryType: 'college_search',
      searchTerm: 'colleges',
      spokenResponse: '',
      confidence: 0.95,
    });

    expect((res as any).error).toBeFalsy();
    expect(res.type).toBe('college_search');
    expect(res.items).toBeInstanceOf(Array);
    expect(res.items.length).toBeGreaterThanOrEqual(1);
    expect(res.items[0]).toHaveProperty('id');
    expect(res.items[0]).toHaveProperty('college_name');
  });

  test('1. Accurately parses "search for upcoming games this week"', () => {
    const query = parsePublicVoiceQuery('search for upcoming games this week');
    expect(query.queryType).toBe('upcoming_games');
    expect(query.targetRoute).toBe('/explorer');
    expect(query.spokenResponse).toContain('upcoming games');
    expect(query.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('2. Accurately parses "search for players with highest stars"', () => {
    const query = parsePublicVoiceQuery('search for players with highest stars');
    expect(query.queryType).toBe('highest_stars');
    expect(query.targetRoute).toBe('/ranking');
    expect(query.spokenResponse).toContain('star leaderboard');
  });

  test('3. Accurately parses player search ("search for player Dela Cruz")', () => {
    const query = parsePublicVoiceQuery('search for player Dela Cruz');
    expect(query.queryType).toBe('player_search');
    expect(query.searchTerm?.toLowerCase()).toContain('dela cruz');
    expect(query.targetRoute).toBe('/athletics');
  });

  test('4. Accurately parses sport schedule queries ("show basketball")', () => {
    const query = parsePublicVoiceQuery('show basketball games');
    expect(query.queryType).toBe('sport_schedule');
    expect(query.sport).toBe('basketball');
  });

  test('5. Accurately parses direct navigation ("go to rankings")', () => {
    const query = parsePublicVoiceQuery('go to rankings');
    expect(query.queryType).toBe('navigation');
    expect(query.targetRoute).toBe('/ranking');
  });

  test('6. Accurately parses plural and general player triggers ("players", "athletes")', () => {
    const q1 = parsePublicVoiceQuery('show players');
    expect(q1.queryType).toBe('player_search');

    const q2 = parsePublicVoiceQuery('athletes');
    expect(q2.queryType).toBe('player_search');

    const q3 = parsePublicVoiceQuery('who is Dela Cruz');
    expect(q3.queryType).toBe('player_search');
    expect(q3.searchTerm?.toLowerCase()).toContain('dela cruz');
  });

  test('7. Accurately parses college queries and acronyms ("CET", "colleges", "CBA")', () => {
    const q1 = parsePublicVoiceQuery('search colleges');
    expect(q1.queryType).toBe('college_search');
    expect(q1.targetRoute).toContain('/search');

    const q2 = parsePublicVoiceQuery('show CET standings');
    expect(q2.queryType).toBe('college_search');
    expect(q2.searchTerm).toBe('CET');

    const q3 = parsePublicVoiceQuery('CBA campus');
    expect(q3.queryType).toBe('college_search');
  });

  test('8. Accurately parses matches, games, and fixtures triggers', () => {
    const q1 = parsePublicVoiceQuery('search for matches');
    expect(q1.queryType).toBe('match_search');
    expect(q1.targetRoute).toContain('/search');

    const q2 = parsePublicVoiceQuery('fixtures today');
    expect(q2.queryType).toBe('match_search');
  });

  test('9. Accurately parses extended sports catalog (volleyball, soccer, futsal, pickleball)', () => {
    const q1 = parsePublicVoiceQuery('volleyball schedule');
    expect(q1.queryType).toBe('sport_schedule');
    expect(q1.sport).toBe('volleyball');

    const q2 = parsePublicVoiceQuery('soccer tournament');
    expect(q2.queryType).toBe('sport_schedule');
    expect(q2.sport).toBe('soccer');

    const q3 = parsePublicVoiceQuery('pickleball');
    expect(q3.queryType).toBe('sport_schedule');
    expect(q3.sport).toBe('pickleball');
  });

  test('10. Accurately distinguishes direct navigation vs voice search commands', () => {
    const nav1 = parsePublicVoiceQuery('open tournaments');
    expect(nav1.queryType).toBe('navigation');
    expect(nav1.targetRoute).toBe('/explorer');

    const nav2 = parsePublicVoiceQuery('go to athletics');
    expect(nav2.queryType).toBe('navigation');
    expect(nav2.targetRoute).toBe('/athletics');

    const nav3 = parsePublicVoiceQuery('home');
    expect(nav3.queryType).toBe('navigation');
    expect(nav3.targetRoute).toBe('/');

    const searchCmd = parsePublicVoiceQuery('search for basketball matches');
    expect(searchCmd.targetRoute).toContain('/search');
  });
});

test.describe('Public Voice Assistant UI Integration Tests', () => {
  test('Universal floating voice assistant button mounts on public layout', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await expect(voiceBtn).toBeVisible({ timeout: 10000 });
  });

  test('Clicking voice assistant opens dialogue with search input', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('HUD renders informative empty state when no matching records found', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await searchInput.fill('xyznonexistentrecords987654');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // Verify empty state is rendered and NOT a blank container
    const emptyState = page.locator('[data-testid="hud-empty-state"]');
    await expect(emptyState).toBeVisible({ timeout: 8000 });
    await expect(emptyState).toContainText('No matching athletic records found');

    // Verify dedicated search hub button is present
    const openSearchBtn = page.locator('[data-testid="btn-hud-open-search"]');
    await expect(openSearchBtn).toBeVisible();
  });

  test('HUD executes college search and renders college preview cards with working navigation', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 1. Open HUD
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    // 2. Search for colleges
    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await searchInput.fill('search colleges');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // 3. Assert preview results appear (not empty state)
    await expect(page.locator('text=Preview Results')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="hud-empty-state"]')).not.toBeVisible();

    // 4. Assert at least one college preview card is rendered in the DOM
    const collegePreviewBtn = page.locator('[data-testid^="btn-preview-view-college-"]').first();
    await expect(collegePreviewBtn).toBeVisible();
    await expect(collegePreviewBtn).toHaveText('View Standings');

    // 5. Click "View Standings" and assert navigation to /ranking without 404
    await collegePreviewBtn.click();
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });
});

test.describe('404 Arena Navigation Prevention Route Aliases Tests', () => {
  test('/tournaments redirects to /explorer without 404', async ({ page }) => {
    await page.goto('/tournaments', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/explorer/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    await expect(page.locator('text=404')).not.toBeVisible();
  });

  test('/rankings redirects to /ranking without 404', async ({ page }) => {
    await page.goto('/rankings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    await expect(page.locator('text=404')).not.toBeVisible();
  });

  test('/live/:matchId redirects to /match/:matchId without 404', async ({ page }) => {
    await page.goto('/live/test-match-alias-123', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/match\/test-match-alias-123/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    await expect(page.locator('text=404')).not.toBeVisible();
  });

  test('/brackets redirects to /explorer without 404', async ({ page }) => {
    await page.goto('/brackets', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/explorer/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('/standings redirects to /ranking without 404', async ({ page }) => {
    await page.goto('/standings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('/fixtures redirects to /explorer without 404', async ({ page }) => {
    await page.goto('/fixtures', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/explorer/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('/query redirects to /search without 404', async ({ page }) => {
    await page.goto('/query', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });
});
