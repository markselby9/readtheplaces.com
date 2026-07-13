import { expect, test } from '@playwright/test';

/**
 * The reader is the only island in the site. These tests guard the three things
 * that actually broke while it was being built.
 */

test('the noon simultaneity fires, and does not fire at ten', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');

  // At ten, Clarissa's doorstep and Big Ben share a label. Same character, two
  // hundred metres apart. That is not simultaneity, and an early version of the
  // reader wrongly announced it as such because it keyed off group size.
  await page.getByRole('button', { name: '10:00' }).click();
  await expect(page.locator('.simul')).toHaveCount(0);

  await page.getByRole('button', { name: '12:00' }).click();
  await expect(page.locator('.simul')).toBeVisible();
  await expect(page.locator('.stops .stop')).toHaveCount(2);
  await expect(page.getByText('Westminster — the green dress')).toBeVisible();
  await expect(page.getByText('Harley Street — the appointment')).toBeVisible();
});

test('pins exist on both maps, so they survive the wipe seam', async ({ page }) => {
  // A marker lives inside its own map's container, and the historical map paints
  // above the modern one. A pin added only to the modern map vanishes wherever
  // the historical map covers it.
  await page.goto('/mrs-dalloway/read/');
  await page.waitForSelector('.pin');

  await expect(page.locator('.pin')).toHaveCount(30); // 15 waypoints × 2 maps
});

test('both pins pulse at a declared simultaneity', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');
  await page.waitForSelector('.pin');

  await page.getByRole('button', { name: '12:00' }).click();
  await expect(page.locator('.pin.active.paired')).toHaveCount(4); // 2 waypoints × 2 maps
});

test('the passage renders even when WebGL is unavailable', async ({ browser }) => {
  // The map is an illustration of the text. The text must never wait for it.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  const page = await context.newPage();
  await page.goto('/mrs-dalloway/read/');

  await expect(page.getByText('buy the flowers herself')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next stop →' })).toBeEnabled();

  await context.close();
});

test('the wipe handle is keyboard operable', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');

  const handle = page.getByRole('slider', { name: /Compare the modern map/ });
  await handle.focus();
  const before = await handle.getAttribute('aria-valuenow');

  await page.keyboard.press('ArrowLeft');
  await expect(handle).not.toHaveAttribute('aria-valuenow', before!);
});

test('arrow keys move through the novel', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');
  await expect(page.getByRole('heading', { name: "Clarissa's house, Westminster" })).toBeVisible();

  // The island's window key handler is attached on mount, and a pin only exists
  // once mount has run. Without this the keypress can land before hydration.
  await page.waitForSelector('.pin');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Victoria Street' })).toBeVisible();
});
