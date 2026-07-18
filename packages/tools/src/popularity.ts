import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Snapshot each book's fame as a sortable number.
 *
 *   bun run popularity            refresh every book
 *   bun run popularity dracula    one book
 *
 * The metric is the last twelve months of English Wikipedia pageviews for the
 * book's own article, via the official Wikimedia REST API (no scraping, no key).
 * It is a snapshot: we store the number and the article we counted, so the choice
 * is auditable and a bad match is a one-line override away.
 *
 * Matching a title to the right article is the hard part — "Dracula Bram Stoker"
 * finds the 1992 film first — so we search by title, then prefer the candidate
 * that looks like the book (its description says novel/book, or names the author).
 * books/popularity-overrides.json (slug -> exact article title) wins over all of it.
 */

const BOOKS = new URL('../../../books/', import.meta.url);
const OUT = new URL('../../../apps/web/src/data/popularity.json', import.meta.url);
const OVERRIDES = new URL('popularity-overrides.json', BOOKS);

interface Row {
  article: string;
  views: number;
}

const UA = 'ReadThePlaces/1.0 (https://readtheplaces.com; contact via GitHub)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchPage {
  title: string;
  description?: string;
  index?: number;
}
interface SearchResp {
  query?: { pages?: Record<string, SearchPage> };
}
interface PageviewsResp {
  items?: Array<{ views?: number }>;
}

/** Fetch JSON, retrying a couple of times: the pageviews API rate-limits bursts. */
async function j<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return (await r.json()) as T;
    // 429 is rate-limiting; a transient 404/5xx clears on retry too.
    if ((r.status === 429 || r.status === 404 || r.status >= 500) && attempt < 2) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    throw new Error(`${r.status} ${url}`);
  }
}

/** Pick the Wikipedia article most likely to be the book itself. */
async function resolveArticle(title: string, author: string): Promise<string | null> {
  const last = author.split(/\s+/).pop()!.toLowerCase();
  const api =
    `https://en.wikipedia.org/w/api.php?format=json&action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(title)}&gsrlimit=6&prop=description`;
  const data = await j<SearchResp>(api).catch(() => null);
  const pages: SearchPage[] = data?.query?.pages ? Object.values(data.query.pages) : [];
  if (pages.length === 0) return null;
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  const score = (p: SearchPage): number => {
    const t = p.title.toLowerCase();
    const d = (p.description ?? '').toLowerCase();
    let s = 0;
    if (t === title.toLowerCase()) s += 3;
    if (t === `${title.toLowerCase()} (novel)`) s += 4;
    if (t.includes(`${last} novel`) || t.includes('novel') || t.includes('(book)')) s += 2;
    if (/\bnovel\b|\bbook\b|memoir|novella|short story/.test(d)) s += 3;
    if (d.includes(last)) s += 2;
    if (/\bfilm\b|\btv series\b|\balbum\b|\bband\b|video game/.test(d)) s -= 4;
    return s;
  };

  const best = [...pages].sort((a, b) => score(b) - score(a))[0]!;
  return score(best) > 0 ? best.title : pages[0]!.title;
}

/**
 * Sum twelve months of human pageviews for an article.
 *
 * The window ends at the last complete month, but some articles have gaps in the
 * most recent months (a Wikimedia data-timing quirk that 404s the whole range),
 * so we step the window back a month at a time until one returns data. agent=user
 * excludes bots, which is both a better fame proxy and more reliably present than
 * all-agents.
 */
async function pageviews(article: string): Promise<number> {
  const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, '')}00`;
  const enc = encodeURIComponent(article.replace(/ /g, '_'));

  for (let back = 1; back <= 6; back++) {
    const end = new Date();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() - back);
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 11);
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia` +
      `/all-access/user/${enc}/monthly/${fmt(start)}/${fmt(end)}`;
    const data = await j<PageviewsResp>(url).catch(() => null);
    if (data?.items?.length) {
      return data.items.reduce((n, it) => n + (it.views ?? 0), 0);
    }
  }
  return 0;
}

const overrides: Record<string, string> = existsSync(OVERRIDES)
  ? JSON.parse(readFileSync(OVERRIDES, 'utf8'))
  : {};

function booksToDo(): string[] {
  const arg = process.argv[2];
  if (arg) return [arg];
  return readdirSync(BOOKS)
    .filter((s) => existsSync(new URL(`${s}/book.json`, BOOKS)))
    .sort();
}

const out: Record<string, Row> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

for (const slug of booksToDo()) {
  const book = JSON.parse(readFileSync(new URL(`${slug}/book.json`, BOOKS), 'utf8'));
  try {
    const article = overrides[slug] ?? (await resolveArticle(book.title, book.author));
    if (!article) {
      console.log(`${slug}: no article found`);
      continue;
    }
    const views = await pageviews(article);
    out[slug] = { article, views };
    console.log(`${slug}: ${views.toLocaleString()} — ${article}`);
  } catch (e) {
    console.log(`${slug}: ${(e as Error).message}`);
  }
  await sleep(150); // be a courteous API citizen
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(dirname(OUT.pathname), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nWrote ${Object.keys(sorted).length} rows to ${OUT.pathname}`);
