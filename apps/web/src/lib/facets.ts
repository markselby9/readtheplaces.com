import type { LoadedBook } from './books';

/**
 * Browse facets: country, author and era.
 *
 * The home page and the per-city hubs answer "where". These group the same books
 * the other two ways a reader asks for them: who wrote it, and when. Each facet
 * gets its own landing page so there is a real URL to link and to rank.
 */

/** Slug for a free-text value (author name, era label). Cities have their own. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** ISO 3166-1 alpha-2 to an English country name, via the platform. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "1878" to "19th century". Ordinal handled for the centuries books fall in. */
export function centuryLabel(year: number): string {
  const c = Math.floor((year - 1) / 100) + 1;
  const suffix = c % 100 >= 11 && c % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][c % 10] ?? 'th');
  return `${c}${suffix} century`;
}

/** A century's sort key, so 19th sorts before 20th. */
export function centuryOrder(label: string): number {
  return parseInt(label, 10) || 0;
}

export interface Facet {
  /** URL-safe id used in the route. */
  slug: string;
  /** Human label shown to the reader. */
  label: string;
  books: LoadedBook[];
}

function collect(books: LoadedBook[], keyOf: (b: LoadedBook) => Array<[string, string]>): Facet[] {
  const groups = new Map<string, Facet>();
  for (const b of books) {
    for (const [slug, label] of keyOf(b)) {
      const g = groups.get(slug) ?? { slug, label, books: [] };
      g.books.push(b);
      groups.set(slug, g);
    }
  }
  return [...groups.values()];
}

export function byCountry(books: LoadedBook[]): Facet[] {
  return collect(books, (b) => {
    const code = b.book.setting.country;
    return [[code.toLowerCase(), countryName(code)]];
  }).sort((a, b) => a.label.localeCompare(b.label));
}

export function byAuthor(books: LoadedBook[]): Facet[] {
  return collect(books, (b) => [[slugify(b.book.author), b.book.author]]).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function byEra(books: LoadedBook[]): Facet[] {
  return collect(books, (b) => {
    if (!b.book.published) return [];
    const label = centuryLabel(b.book.published);
    return [[slugify(label), label]];
  }).sort((a, b) => centuryOrder(a.label) - centuryOrder(b.label));
}
