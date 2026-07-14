import { expect, test } from '@playwright/test';

/**
 * Search engines are the distribution channel.
 *
 * The project grows through individual shareable walks, so a walk page that is
 * invisible to search or ugly in a link preview is a walk nobody reads. These
 * tests guard the things that make it findable, and the one thing that makes it
 * honest.
 */

async function jsonLd(page: import('@playwright/test').Page): Promise<unknown[]> {
  return page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => JSON.parse(n.textContent ?? '{}')),
  );
}

test('every page has a unique title, a description and a canonical', async ({ page }) => {
  for (const path of ['/', '/mrs-dalloway/', '/places/london/', '/ulysses/']) {
    await page.goto(path);

    await expect(page).toHaveTitle(/.{20,70}/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,200}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
  }
});

test('a walk page describes itself as a Book and an ItemList of Places', async ({ page }) => {
  await page.goto('/mrs-dalloway/');
  const blocks = await jsonLd(page);

  const graph = (blocks.find((b) => '@graph' in (b as object)) as { '@graph': never[] })['@graph'];
  const types = graph.map((n: { '@type': string }) => n['@type']);

  expect(types).toContain('Book');
  expect(types).toContain('ItemList');

  const list = graph.find((n: { '@type': string }) => n['@type'] === 'ItemList') as {
    numberOfItems: number;
  };
  expect(list.numberOfItems).toBe(15);
});

test('coordinates are only asserted where the book actually gives them', async ({ page }) => {
  // Clarissa's house is inferred: Woolf never gives an address. Handing a search
  // engine a precise latitude for it would be lying in a format built for
  // machines to trust, which is worse than lying to a person.
  await page.goto('/mrs-dalloway/');
  const blocks = await jsonLd(page);

  const graph = (blocks.find((b) => '@graph' in (b as object)) as { '@graph': never[] })['@graph'];
  const list = graph.find((n: { '@type': string }) => n['@type'] === 'ItemList') as {
    itemListElement: Array<{ item: { name: string; geo?: unknown } }>;
  };

  const pinned = list.itemListElement.filter((e) => e.item.geo);
  const named = list.itemListElement.filter((e) => !e.item.geo);

  expect(pinned.length).toBeGreaterThan(0);
  expect(named.length).toBeGreaterThan(0);

  // Big Ben is named in the text, so it is pinned.
  expect(pinned.map((e) => e.item.name)).toContain('Big Ben');
  // Clarissa's house is not, so it is named but not pinned.
  expect(named.map((e) => e.item.name)).toContain("Clarissa's house, Westminster");
});

test('breadcrumbs link a book up to its city', async ({ page }) => {
  await page.goto('/mrs-dalloway/');

  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'London', exact: true })).toBeVisible();

  const blocks = await jsonLd(page);
  const crumbs = blocks.find((b) => (b as { '@type': string })['@type'] === 'BreadcrumbList') as {
    itemListElement: unknown[];
  };
  expect(crumbs.itemListElement).toHaveLength(3);
});

test('a city hub gathers every novel set there', async ({ page }) => {
  await page.goto('/places/london/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('London');
  // Mrs Dalloway is mapped; A Christmas Carol, Oliver Twist and the rest are stubs.
  await expect(page.getByRole('link', { name: /Mrs Dalloway/ })).toBeVisible();
  await expect(page.locator('.books li').first()).toBeVisible();
});

test('robots.txt points at the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain('Sitemap: https://readtheplaces.com/sitemap-index.xml');
});

test('the sitemap lists every book and city', async ({ request }) => {
  const res = await request.get('/sitemap-0.xml');
  const xml = await res.text();

  expect(xml).toContain('/mrs-dalloway/');
  expect(xml).toContain('/crime-and-punishment/');
  expect(xml).toContain('/ulysses/');
  expect(xml).toContain('/places/london/');
});
