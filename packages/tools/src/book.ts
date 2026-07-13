import { readFileSync } from 'node:fs';
import {
  bookSchema,
  validateBook,
  waypointSchema,
  type Book,
  type BuiltWaypoint,
} from '@rtp/schema';

/** Shared loader for the CLI tools. The web app has its own, via Astro content
 *  collections; both go through the same validator, so they cannot disagree. */

const BOOKS = new URL('../../../books/', import.meta.url);

export interface LoadedBook {
  slug: string;
  book: Book;
  waypoints: BuiltWaypoint[];
  text: string;
}

export function bookDir(slug: string): URL {
  return new URL(`${slug}/`, BOOKS);
}

export function loadBook(slug: string): LoadedBook {
  const dir = bookDir(slug);
  const read = (f: string) => readFileSync(new URL(f, dir), 'utf8');

  const book = bookSchema.parse(JSON.parse(read('book.json')));
  const raw = waypointSchema.array().parse(JSON.parse(read('waypoints.json')));
  const text = read('source.txt');

  const { errors, built } = validateBook(book, raw, text);
  if (errors.length > 0) {
    throw new Error(`${slug} failed validation:\n  ${errors.join('\n  ')}`);
  }

  return { slug, book, waypoints: built, text };
}
