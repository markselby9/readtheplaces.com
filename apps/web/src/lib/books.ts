import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getCollection } from 'astro:content';
import { validateBook, type Book, type BuiltWaypoint } from '@rtp/schema';

/**
 * Book data lives at the repo root, outside the app, so it is usable without it.
 *
 * Found by walking up from the working directory rather than by a relative URL:
 * this module is bundled during the build, so `import.meta.url` points at the
 * bundle and not at this file.
 */
function findBooksDir(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'books');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not find the books/ directory above ${process.cwd()}`);
}

const BOOKS = findBooksDir();

export interface LoadedBook {
  slug: string;
  book: Book;
  waypoints: BuiltWaypoint[];
}

/** The default ink accent, for a book nobody has chosen a colour for yet. */
export const DEFAULT_ACCENT = '#4a453d';

/**
 * A stub is a book that has been listed but not adopted: rights, a city and a
 * bounding box, but no waypoints, no colour and no text. It appears on the site
 * as open for adoption, which is the point of listing it.
 */
export function isStub(b: LoadedBook): boolean {
  return b.waypoints.length === 0;
}

export function accentOf(book: Book): string {
  return book.palette?.accent ?? DEFAULT_ACCENT;
}

/**
 * Load a book and derive every waypoint's position from the novel itself.
 *
 * Throws at build time if the data does not hold up, which is the point: you
 * cannot ship a place the book does not support.
 */
export async function loadBook(slug: string): Promise<LoadedBook> {
  const books = await getCollection('books');
  const all = await getCollection('waypoints');

  const book = books.find((b) => b.id.startsWith(`${slug}/`))?.data;
  const raw = all.find((w) => w.id.startsWith(`${slug}/`))?.data;
  if (!book || !raw) throw new Error(`No such book: ${slug}`);

  // A stub is a book that has been listed but not yet adopted: rights, a city
  // and a bounding box, but no waypoints, no colour, and no text. It appears on
  // the site as open for adoption. Nothing to validate, because it claims
  // nothing about the novel yet.
  if (raw.length === 0) {
    return { slug, book, waypoints: [] };
  }

  // A cited book stores no text, so there is nothing to read or check against.
  // Its waypoints are validated by reference and order, not by quotation.
  if (book.sourcing === 'cited') {
    const { errors, built } = validateBook(book, raw, '');
    if (errors.length > 0) {
      throw new Error(`${slug} failed validation:\n  ${errors.join('\n  ')}`);
    }
    return { slug, book, waypoints: built };
  }

  const source = join(BOOKS, slug, 'source.txt');
  if (!existsSync(source)) {
    throw new Error(
      `${slug} has ${raw.length} waypoint(s) but no source.txt. ` +
        'Every quote is checked against the text, so the text has to be committed. ' +
        'Run: bun run fetch-text ' +
        slug,
    );
  }

  const { errors, built } = validateBook(book, raw, readFileSync(source, 'utf8'));
  if (errors.length > 0) {
    throw new Error(`${slug} failed validation:\n  ${errors.join('\n  ')}`);
  }
  return { slug, book, waypoints: built };
}

export async function allBooks(): Promise<LoadedBook[]> {
  const books = await getCollection('books');
  const slugs = books.map((b) => b.id.split('/')[0]!);
  return Promise.all(slugs.map(loadBook));
}

/**
 * Waypoints sharing a progressLabel form one stop.
 *
 * At noon, Mrs Dalloway has two, in different postcodes. The group, not the
 * waypoint, is the unit the reader moves through.
 */
export function stopGroups(waypoints: BuiltWaypoint[]): BuiltWaypoint[][] {
  const groups = new Map<string, BuiltWaypoint[]>();
  for (const w of waypoints) {
    const g = groups.get(w.progressLabel) ?? [];
    g.push(w);
    groups.set(w.progressLabel, g);
  }
  return [...groups.values()].sort((a, b) => a[0]!.position - b[0]!.position);
}

/**
 * True only where the author deliberately holds two places in one moment.
 *
 * Several waypoints at the same label usually means nothing: Clarissa's doorstep
 * and Big Ben are both at ten, same person, two hundred metres apart. Only the
 * data saying so earns the paired treatment.
 */
export function isSimultaneous(group: BuiltWaypoint[]): boolean {
  return group.length > 1 && group.some((w) => (w.simultaneousWith ?? []).length > 0);
}

/** Rough great-circle distance, good enough to say "1.7 miles apart". */
export function milesApart(a: [number, number], b: [number, number]): string {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return `${(2 * R * Math.asin(Math.sqrt(h))).toFixed(1)} miles`;
}
