import { expect, test } from '@playwright/test';

/**
 * The nav and footer are the site's spine of internal links.
 *
 * They carry the wordmark, the primary routes, and the contribute path on every
 * page a reader lands on, which is what lets a single shared walk lead anywhere
 * else. The one exception is the reader, which is full-screen by design.
 */

test('every ordinary page carries the nav and footer', async ({ page }) => {
  for (const path of ['/', '/mrs-dalloway/', '/places/london/']) {
    await page.goto(path);

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Books' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Cities' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Add a book' })).toBeVisible();

    await expect(page.locator('.site-foot')).toBeVisible();
  }
});

test('the wordmark links home from a deep page', async ({ page }) => {
  await page.goto('/mrs-dalloway/');
  await page.locator('.site-nav .brand').click();
  await expect(page).toHaveURL(/\/$/);
});

test('nav routes reach the homepage sections they name', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Cities' })
    .click();
  await expect(page).toHaveURL(/#by-city$/);
  await expect(page.locator('#by-city')).toBeVisible();
});

test('the footer offers the contribute path', async ({ page }) => {
  await page.goto('/');
  const foot = page.locator('.site-foot');
  await expect(foot.getByRole('link', { name: 'Add a book' })).toHaveAttribute(
    'href',
    '/contribute/',
  );
  await expect(foot.getByRole('link', { name: 'Source on GitHub' })).toBeVisible();
});

test('the reader hides the site chrome so the map fills the screen', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');
  await page.waitForSelector('.reader');

  await expect(page.locator('.site-nav')).toBeHidden();
  await expect(page.locator('.site-foot')).toBeHidden();
});
