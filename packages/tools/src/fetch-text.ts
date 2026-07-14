import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bookSchema } from '@rtp/schema';
import { bookDir } from './book.ts';
import { fetchText, findOnStandardEbooks, toPlainText } from './text.ts';

/**
 * Download a stub book's text so it can be worked on.
 *
 *   bun run fetch-text the-picture-of-dorian-gray
 *
 * A stub is a book that has been listed but not yet adopted: it has rights, a
 * city and a bounding box, but no waypoints and no text. The text is a megabyte
 * per book, and committing twenty-odd of them for novels nobody has started
 * would bloat the repo for nothing.
 *
 * So the text arrives when someone adopts the book. Once a book has waypoints,
 * source.txt is committed, because every quote is checked against it and CI
 * needs it.
 */

const slug = process.argv[2];
if (!slug) {
  console.error('usage: bun run fetch-text <book-slug>');
  process.exit(1);
}

const dir = bookDir(slug);
const bookPath = new URL('book.json', dir);

if (!existsSync(bookPath)) {
  console.error(`No such book: books/${slug}/. Add it with: bun run new-book`);
  process.exit(1);
}

const book = bookSchema.parse(JSON.parse(readFileSync(bookPath, 'utf8')));
const source = new URL('source.txt', dir);

if (existsSync(source)) {
  const size = readFileSync(source, 'utf8').length;
  console.log(`books/${slug}/source.txt already exists (${size.toLocaleString()} characters).`);
  process.exit(0);
}

console.log(`\n  ${book.title}, ${book.author}\n`);
console.log('  Finding the text…');

const edition = await findOnStandardEbooks(book.title, book.author);
if (!edition) {
  console.error(`
  Standard Ebooks has no edition of this book.

  The book records its source as:
    ${book.rights.textSourceUrl ?? '(none recorded)'}

  Download a plain-text edition from there, save it as books/${slug}/source.txt,
  and trim it to the novel itself: no title page, no preface, no colophon. Every
  quote is checked against this file, and its length is the denominator for every
  waypoint's position, so anything that is not the novel skews the whole book.
`);
  process.exit(1);
}

const html = await fetchText(edition.path);
if (!html) {
  console.error(`  Failed to download https://standardebooks.org${edition.path}`);
  process.exit(1);
}

const text = toPlainText(html);
writeFileSync(source, `${text}\n`);

if (edition.translator) {
  console.log(`  Edition: translated by ${edition.translator.replace(/-/g, ' ')}.`);
}
console.log(`  ${text.length.toLocaleString()} characters → books/${slug}/source.txt`);
console.log(`
  Now find the places:

    bun run extract ${slug} --geocode

  Then fill in the palette in book.json. A book's accent colour is a quotation
  from its own text, and the build rejects it if the line is not really there.
`);
