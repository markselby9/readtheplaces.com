import { expect, test } from '@playwright/test';

/**
 * Cited books map an in-copyright novel by location alone.
 *
 * The whole point is that they never reproduce the author's words: a place where
 * a scene happens is a fact, and the notes are our own. These tests guard that
 * line, because crossing it is a legal problem, not a cosmetic one.
 */

const HP = '/harry-potter-and-the-philosophers-stone/';

test('a cited walk page reproduces none of the book text', async ({ page }) => {
  await page.goto(HP);

  // A sourced book shows verbatim passages in blockquotes. A cited book must not.
  await expect(page.locator('blockquote')).toHaveCount(0);

  // It shows our own notes and cites the scene by reference instead.
  await expect(page.locator('.stop')).toHaveCount(4);
  await expect(page.locator('.reference').first()).toBeVisible();
});

test('cited waypoints are ordered and labelled by chapter, not by clock', async ({ page }) => {
  await page.goto(HP);

  await expect(page.locator('.strike .label').first()).toHaveText('Chapter 2');
  // The narrative order is Zoo, Leaky Cauldron, Diagon Alley, King's Cross.
  const names = await page.locator('.place-name').allTextContents();
  expect(names[0]).toContain('Reptile House');
  expect(names.at(-1)).toContain('Platform 9¾');
});

test('an invented place is still marked as inferred or inspired, honestly', async ({ page }) => {
  await page.goto(HP);

  // Diagon Alley does not exist; it is sited at its real-world model and said so.
  const diagon = page.locator('.place-name', { hasText: 'Diagon Alley' });
  await expect(diagon).toHaveAttribute('data-certainty', 'inspired_by');
});

test('a cited book still links out to the real place', async ({ page }) => {
  await page.goto(HP);
  await expect(page.getByRole('link', { name: /Google Maps/ }).first()).toBeVisible();
});

test('the reader works for a cited book', async ({ page }) => {
  await page.goto(`${HP}read/`);
  await page.waitForSelector('.pin');

  // Four places, one map (no historical layer for this book), so four pins.
  await expect(page.locator('.pin')).toHaveCount(4);

  // The reader shows the current stop only. It opens on the first, and reproduces
  // no verbatim text there either.
  await expect(page.getByRole('heading', { name: 'The Reptile House, London Zoo' })).toBeVisible();
  await expect(page.locator('.stops blockquote')).toHaveCount(0);

  // Jumping to the last chapter reaches the last place, still without a quote.
  await page.getByRole('button', { name: /Chapter 6/ }).click();
  await expect(page.getByRole('heading', { name: "King's Cross, Platform 9¾" })).toBeVisible();
  await expect(page.locator('.stops blockquote')).toHaveCount(0);
});
