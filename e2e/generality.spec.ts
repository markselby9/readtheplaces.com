import { expect, test } from '@playwright/test';

/**
 * The acceptance test for the whole design.
 *
 * Mrs Dalloway is English, ordered by clocks, set in a city with a free
 * historical map layer, and its places are mostly named outright. Crime and
 * Punishment is a translation, ordered by chapters, set in a city with no
 * historical layer at all, and Dostoevsky censored his own street names so most
 * of its places are scholarly reconstructions.
 *
 * If both render with no book-specific code, the schema is general. If they do
 * not, it was tuned to Woolf and the project does not travel.
 */

test('a translated, chapter-ordered book renders with no special casing', async ({ page }) => {
  await page.goto('/crime-and-punishment/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Saint Petersburg');
  await expect(page.locator('.stop')).toHaveCount(12);

  // The progress rail takes a chapter label as happily as a clock.
  await expect(page.locator('.strike .label').first()).toHaveText('Part 1, ch. 1');
});

test('a city with no historical layer degrades to one map, with no empty pane', async ({
  page,
}) => {
  // St Petersburg has no free georeferenced historical map. Measured, not assumed.
  await page.goto('/crime-and-punishment/');

  await expect(page.locator('.plates img[src$="-now.webp"]')).toHaveCount(12);
  await expect(page.locator('.plates img[src$="-then.webp"]')).toHaveCount(0);
  await expect(page.locator('.plates figcaption').first()).toHaveText('Saint Petersburg today');
});

test('censored addresses are shown as disputed, not asserted as fact', async ({ page }) => {
  // Dostoevsky wrote "S⸺ Place" to dodge the censor. Scholars reconstructed it
  // as Stolyarny Lane. We show the reconstruction and say it is one.
  await page.goto('/crime-and-punishment/');

  await expect(page.locator('.place-name[data-certainty="disputed"]').first()).toBeVisible();
  await expect(page.getByText('Stolyarny Lane').first()).toBeVisible();
});

test('the accent colour is a quotation from the novel', async ({ page }) => {
  await page.goto('/crime-and-punishment/');
  await expect(
    page.getByText('the little yellow room that was like a cupboard or a box'),
  ).toBeVisible();
});

test('the reader works for a book with no historical layer', async ({ page }) => {
  await page.goto('/crime-and-punishment/read/');
  await page.waitForSelector('.pin');

  // One map, so one pin per waypoint rather than two.
  await expect(page.locator('.pin')).toHaveCount(12);
  // No wipe handle, because there is nothing to wipe to.
  await expect(page.locator('#wipe-handle')).toHaveCount(0);
});
