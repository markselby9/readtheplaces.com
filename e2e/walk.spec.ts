import { expect, test } from '@playwright/test';

/**
 * The walk page is the surface that has to be found, read and shared. These
 * tests guard the two properties that make that possible, and that a careless
 * change would silently destroy.
 */

test('ships no live map, and no JavaScript that would need one', async ({ page }) => {
  // Browsers cap simultaneous WebGL contexts at about sixteen. Fifteen stops
  // across two eras is thirty-one; the prototype measured 16 alive, 15 dead.
  // The plates are composited at build time precisely so this page needs none.
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url());
  });

  await page.goto('/mrs-dalloway/');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(scripts.filter((s) => s.includes('maplibre'))).toHaveLength(0);
});

test('renders every passage into the HTML, for search engines and for sharing', async ({
  page,
}) => {
  await page.goto('/mrs-dalloway/');

  await expect(page.getByText('buy the flowers herself')).toBeVisible();
  await expect(page.getByText('the Warren Smiths walked down Harley Street').first()).toBeVisible();
  await expect(page.locator('.stop')).toHaveCount(15);
});

test('links out to Google rather than embedding it', async ({ page }) => {
  // Google Maps Platform ToS §3.2.3(e) forbids displaying Street View imagery
  // and a non-Google map on the same screen. A hyperlink is not an API call.
  await page.goto('/mrs-dalloway/');

  const html = await page.content();
  expect(html).not.toContain('maps.googleapis.com');
  expect(html).not.toMatch(/<iframe[^>]*google/i);

  await expect(page.getByRole('link', { name: /Open in Google Maps/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Street View/ }).first()).toBeVisible();
});

test('every stop shows a modern map, and only the first one is eager', async ({ page }) => {
  await page.goto('/mrs-dalloway/');

  const modern = page.locator('.plates img[src$="-now.webp"]');
  await expect(modern).toHaveCount(15);

  // The first plate is the largest thing above the fold, so it is the LCP
  // element. Lazy-loading it means the browser does not begin fetching it until
  // layout, which is the worst thing to do to the one image that decides the
  // score.
  const first = modern.first();
  await expect(first).toHaveAttribute('loading', 'eager');
  await expect(first).toHaveAttribute('fetchpriority', 'high');

  // Everything below the fold is lazy, and nothing else gets high priority.
  for (const img of (await modern.all()).slice(1)) {
    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(img).not.toHaveAttribute('fetchpriority', 'high');
  }
});

test('shows the reader when a place is a guess, and does not when it is not', async ({ page }) => {
  await page.goto('/mrs-dalloway/');

  // Clarissa's house: Woolf never gives an address, so it is marked inferred.
  await expect(page.locator('.place-name[data-certainty="inferred"]').first()).toBeVisible();
  // Big Ben: named directly in the text.
  await expect(page.locator('.place-name[data-certainty="explicit"]').first()).toBeVisible();
});

test('the noon simultaneity is presented as one moment', async ({ page }) => {
  await page.goto('/mrs-dalloway/');

  const fork = page.locator('.hour[data-paired]');
  await expect(fork).toHaveCount(1);
  await expect(fork.locator('.stop')).toHaveCount(2);
  await expect(fork.getByText(/Two places, [\d.]+ miles apart/)).toBeVisible();

  // And a stop group that merely shares a label is not treated as simultaneous:
  // Clarissa's doorstep and Big Ben are both at ten, and that means nothing.
  await expect(page.locator('.hour:not([data-paired])')).not.toHaveCount(0);
});
