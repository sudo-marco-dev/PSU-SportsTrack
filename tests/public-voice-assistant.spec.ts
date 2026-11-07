/**
 * Public Voice Assistant Automated Test Suite
 * PSU SportsTrack - Universal Speech & Search Queries
 */

import { test, expect } from '@playwright/test';
import { parsePublicVoiceQuery } from '../src/lib/publicVoiceAssistant';

test.describe('Public Voice Assistant Query Parser Unit Tests', () => {
  test('1. Accurately parses "search for upcoming games this week"', () => {
    const query = parsePublicVoiceQuery('search for upcoming games this week');
    expect(query.queryType).toBe('upcoming_games');
    expect(query.targetRoute).toBe('/tournaments');
    expect(query.spokenResponse).toContain('upcoming games');
    expect(query.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('2. Accurately parses "search for players with highest stars"', () => {
    const query = parsePublicVoiceQuery('search for players with highest stars');
    expect(query.queryType).toBe('highest_stars');
    expect(query.targetRoute).toBe('/rankings');
    expect(query.spokenResponse).toContain('star leaderboard');
  });

  test('3. Accurately parses player search ("search for player Dela Cruz")', () => {
    const query = parsePublicVoiceQuery('search for player Dela Cruz');
    expect(query.queryType).toBe('player_search');
    expect(query.searchTerm?.toLowerCase()).toContain('dela cruz');
    expect(query.targetRoute).toBe('/scouting');
  });

  test('4. Accurately parses sport schedule queries ("show basketball")', () => {
    const query = parsePublicVoiceQuery('show basketball games');
    expect(query.queryType).toBe('sport_schedule');
    expect(query.sport).toBe('basketball');
  });

  test('5. Accurately parses direct navigation ("go to rankings")', () => {
    const query = parsePublicVoiceQuery('go to rankings');
    expect(query.queryType).toBe('navigation');
    expect(query.targetRoute).toBe('/rankings');
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
});
