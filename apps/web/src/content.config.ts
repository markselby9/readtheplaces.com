import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { bookSchema, waypointSchema } from '@rtp/schema';

/**
 * The schema is the build gate.
 *
 * Book data lives in /books as plain JSON, useful without this interface. Astro
 * validates it with Zod at build time, so `bun run build` fails on a book whose
 * data does not hold up. The deeper checks run in `lib/books.ts`, which also
 * fails the build: the quote actually appearing in the novel, the colour being a
 * real quotation, the coordinates falling inside the book's setting.
 */

const books = defineCollection({
  loader: glob({ pattern: '*/book.json', base: '../../books' }),
  schema: bookSchema,
});

const waypoints = defineCollection({
  loader: glob({ pattern: '*/waypoints.json', base: '../../books' }),
  schema: waypointSchema.array(),
});

export const collections = { books, waypoints };
