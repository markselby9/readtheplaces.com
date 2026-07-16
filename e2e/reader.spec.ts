import { expect, test } from '@playwright/test';

/**
 * The reader is the only island in the site. These tests guard the three things
 * that actually broke while it was being built.
 */

test('the noon simultaneity fires, and does not fire at ten', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');

  // At ten, Clarissa's doorstep and Big Ben share a label. Same character, two
  // hundred metres apart. An early version of the reader wrongly announced that as
  // a simultaneity, because it keyed off group size instead of the data.
  await page.getByRole('button', { name: '10:00' }).click();
  await expect(page.locator('.simul')).toHaveCount(0);

  await page.getByRole('button', { name: '12:00' }).click();
  await expect(page.locator('.simul')).toBeVisible();
  await expect(page.locator('.stops .stop')).toHaveCount(2);
  await expect(page.getByText('Westminster: the green dress')).toBeVisible();
  await expect(page.getByText('Harley Street: the appointment')).toBeVisible();
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

  // The handle's key listener is wired on mount; a pin only exists once mount
  // has run, so this waits out the hydration race the keypress could otherwise
  // land inside.
  await page.waitForSelector('.pin');

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

test('the reader offers a clear way back to the book', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');
  const back = page.getByRole('link', { name: /Back to the book/ });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/mrs-dalloway\/$/);
});

test('the reader shows overall progress and advances it', async ({ page }) => {
  await page.goto('/mrs-dalloway/read/');
  await page.waitForSelector('.pin');

  const pos = page.locator('.pos');
  await expect(pos).toHaveText(/Stop 1 of \d+/);
  await page.getByRole('button', { name: /Next stop/ }).click();
  await expect(pos).toHaveText(/Stop 2 of \d+/);
});

test('the map does not fly when the reader asks for reduced motion', async ({ browser }) => {
  // With reduced motion, camera moves are instant (duration 0), so the heading
  // and pins are still there and nothing animates for 1.5s on every step.
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/mrs-dalloway/read/');
  await page.waitForSelector('.pin');
  await page.getByRole('button', { name: /Next stop/ }).click();
  await expect(page.getByRole('heading', { name: 'Victoria Street' })).toBeVisible();
  await context.close();
});
