/**
 * Smart Conversational Voice Query & NLU E2E Test Suite
 * PSU SportsTrack - Multimodal Public Access Interface
 * 
 * Validates:
 * 1. Semantic sentence parsing & intent extraction (temporal, questions, sports)
 * 2. Question-answering execution (Who won, highest rated college, highest MVP, win rate)
 * 3. Levenshtein fuzzy matching and auto-correction
 * 4. UI Direct Answer AI Highlight Cards in Voice HUD & /search Hub
 * 5. Smart Temporal Fallbacks
 */

import { test, expect } from '@playwright/test';
import {
  parseNaturalVoiceQuery,
  findBestFuzzyMatch,
  levenshteinDistance,
  resolveTemporalWindow,
  ALL_SPORTS,
} from '../src/lib/smartVoiceQueryEngine';

test.describe('Smart Natural Language Understanding Unit Tests', () => {
  test('Calculates Levenshtein distance correctly', () => {
    expect(levenshteinDistance('basketball', 'basketball')).toBe(0);
    expect(levenshteinDistance('besketball', 'basketball')).toBe(1);
    expect(levenshteinDistance('volyball', 'volleyball')).toBe(2);
    expect(levenshteinDistance('cruz', 'kruz')).toBe(1);
  });

  test('Finds best fuzzy match within threshold', () => {
    const match = findBestFuzzyMatch('besketball', ALL_SPORTS, 2);
    expect(match).not.toBeNull();
    expect(match?.match).toBe('basketball');
  });

  test('Resolves temporal windows from conversational phrases', () => {
    const thisWeek = resolveTemporalWindow('search for basketball games this week');
    expect(thisWeek?.type).toBe('this_week');
    expect(thisWeek?.label).toBe('This Week');

    const lastWeek = resolveTemporalWindow('who won last week');
    expect(lastWeek?.type).toBe('last_week');
    expect(lastWeek?.expectedStatus).toBe('Completed');

    const thisMonth = resolveTemporalWindow('search for upcoming games this month');
    expect(thisMonth?.type).toBe('this_month');

    const lastYear = resolveTemporalWindow('search past game last year');
    expect(lastYear?.type).toBe('last_year');
    expect(lastYear?.expectedStatus).toBe('Completed');
  });

  test('Parses conversational interrogative queries into analytical intents', () => {
    const q1 = parseNaturalVoiceQuery('Who won last week?');
    expect(q1.intent).toBe('question_winner');
    expect(q1.temporalWindow?.type).toBe('last_week');

    const q2 = parseNaturalVoiceQuery('Who is the highest rated college right now?');
    expect(q2.intent).toBe('question_top_college');

    const q3 = parseNaturalVoiceQuery('Search for highest MVP');
    expect(q3.intent).toBe('question_highest_mvp');

    const q4 = parseNaturalVoiceQuery('Search for player with highest win rate');
    expect(q4.intent).toBe('question_highest_win_rate');
  });

  test('Auto-corrects phonetic speech typos (besketball, volybal)', () => {
    const typo1 = parseNaturalVoiceQuery('search for besketball games this week');
    expect(typo1.sport).toBe('basketball');
    expect(typo1.fuzzyCorrection?.original).toBe('besketball');
    expect(typo1.fuzzyCorrection?.corrected).toBe('basketball');

    const typo2 = parseNaturalVoiceQuery('volybal schedule');
    expect(typo2.sport).toBe('volleyball');
    expect(typo2.fuzzyCorrection?.corrected).toBe('volleyball');
  });
});

test.describe('Smart Voice Query UI Integration Tests', () => {
  test('Question "Who won last week?" displays Direct Answer card on /search', async ({ page }) => {
    await page.goto('/search?q=Who%20won%20last%20week%3F', { waitUntil: 'domcontentloaded' });

    // Expect search page to load cleanly without 404
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible({ timeout: 10000 });

    // Expect the AI Direct Answer Card to appear
    const directCard = page.locator('[data-testid="page-direct-answer-card"]');
    await expect(directCard).toBeVisible({ timeout: 10000 });

    // Should indicate Winner
    await expect(directCard).toContainText(/Winner|Defeated|Championship/i);
  });

  test('Question "Who is the highest rated college right now?" displays Standings leader card', async ({ page }) => {
    await page.goto('/search?q=Who%20is%20the%20highest%20rated%20college%20right%20now%3F', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible({ timeout: 10000 });

    const directCard = page.locator('[data-testid="page-direct-answer-card"]');
    await expect(directCard).toBeVisible({ timeout: 10000 });
    await expect(directCard).toContainText(/Highest Rated College|Standings/i);
  });

  test('Fuzzy query displays Auto-Correction notice on /search', async ({ page }) => {
    await page.goto('/search?q=besketball', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible({ timeout: 10000 });

    const fuzzyNotice = page.locator('[data-testid="page-fuzzy-notice"]');
    await expect(fuzzyNotice).toBeVisible({ timeout: 8000 });
    await expect(fuzzyNotice).toContainText(/Showing results for.*basketball/i);
  });

  test('Temporal sentence displays active context badges', async ({ page }) => {
    await page.goto('/search?q=Search%20for%20basketball%20games%20this%20week', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible({ timeout: 10000 });

    const badgesContainer = page.locator('[data-testid="page-active-context-badges"]');
    await expect(badgesContainer).toBeVisible({ timeout: 8000 });
    await expect(badgesContainer).toContainText(/Sport: basketball/i);
    await expect(badgesContainer).toContainText(/Period: This Week/i);
  });

  test('Universal Voice Assistant HUD renders Direct Answer card for conversational queries', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open floating voice assistant HUD
    const voiceButton = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await expect(voiceButton).toBeVisible({ timeout: 10000 });
    await voiceButton.click();

    // Type query in manual bar inside dialog
    const manualInput = page.locator('[data-testid="input-public-voice-search"]');
    await expect(manualInput).toBeVisible({ timeout: 6000 });
    await manualInput.fill('Who won last week?');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // Direct answer card inside modal should render
    const hudAnswerCard = page.locator('[data-testid="hud-direct-answer-card"]');
    await expect(hudAnswerCard).toBeVisible({ timeout: 10000 });

    // Click "View Details" on the direct answer card
    const viewBtn = page.locator('[data-testid="btn-hud-direct-answer-view"]');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();

    // Should navigate without 404
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });
});
