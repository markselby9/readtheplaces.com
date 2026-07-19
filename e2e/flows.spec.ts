import { expect, test } from '@playwright/test';

/**
 * The flows a visitor actually walks: find a book, add one, report a problem.
 *
 * Search is progressive enhancement, so it is tested with JavaScript on. The
 * contribute and correction paths are plain links and must exist regardless.
 */

test('the homepage search narrows the catalogue and counts matches', async ({ page }) => {
  await page.goto('/');

  const box = page.getByRole('searchbox');
  await expect(box).toBeVisible();

  await box.fill('paris');
  await expect(page.locator('#search-count')).toContainText(/of \d+ books/);

  // The Paris novels stay; a London one drops out.
  await expect(page.getByRole('link', { name: /Les Misérables/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Mrs Dalloway/ })).toBeHidden();

  // Clearing restores the full list.
  await box.fill('');
  await expect(page.getByRole('link', { name: /Mrs Dalloway/ })).toBeVisible();
});

test('a search with no matches shows an empty state, not a blank page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('zzzzz');
  await expect(page.locator('.no-results')).toBeVisible();
});

test('the catalogue is the full list when JavaScript is off', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  // The dead search box is hidden without its script; every book is still there.
  await expect(page.locator('.search')).toBeHidden();
  await expect(page.getByRole('link', { name: /Mrs Dalloway/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Les Misérables/ })).toBeVisible();
  await context.close();
});

test('nav and footer point Add a book at the in-site page, not raw GitHub', async ({ page }) => {
  await page.goto('/');
  const navLink = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
    name: 'Add a book',
  });
  await expect(navLink).toHaveAttribute('href', '/contribute/');
  await navLink.click();
  await expect(page).toHaveURL(/\/contribute\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Add a book');
});

test('the contribute page names both paths and the cited option', async ({ page }) => {
  await page.goto('/contribute/');
  await expect(page.getByRole('heading', { name: /Adopt a book already listed/ })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Propose a book that is not here/ }),
  ).toBeVisible();
  // The in-copyright path links to the cited proof, Harry Potter.
  await expect(page.getByRole('link', { name: 'Harry Potter' })).toHaveAttribute(
    'href',
    /harry-potter/,
  );
});

test('a mapped book offers correction and add-a-place paths', async ({ page }) => {
  await page.goto('/mrs-dalloway/');

  const correction = page.getByRole('link', { name: /suggest a correction/i });
  await expect(correction).toBeVisible();
  await expect(correction).toHaveAttribute('href', /issues\/new.*Correction/);

  const addPlace = page.getByRole('link', { name: /add a missing place/i });
  await expect(addPlace).toBeVisible();
  await expect(addPlace).toHaveAttribute('href', /issues\/new.*Waypoint/);
});
