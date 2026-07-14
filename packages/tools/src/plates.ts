import { mkdirSync, writeFileSync } from 'node:fs';
import { loadBook } from './book.ts';
import { renderPlate } from './tiles.ts';

/**
 * Render the static map plates the walk pages use.
 *
 *   bun run plates mrs-dalloway
 *
 * Output goes to apps/web/public/plates/<slug>/, which is gitignored: it is
 * derived, and rebuilding it is one command.
 */

const MODERN = 'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: bun run plates <book-slug>');
  process.exit(1);
}

const { book, waypoints } = loadBook(slug);
const historical = book.layers?.historical;

const out = new URL(`../../../apps/web/public/plates/${slug}/`, import.meta.url);
mkdirSync(out, { recursive: true });

const eras: Array<['now' | 'then', string, boolean]> = [['now', MODERN, true]];
if (historical) eras.push(['then', historical.tiles, false]);

console.log(`${slug}: ${waypoints.length} waypoints × ${eras.length} eras`);
if (!historical) {
  console.log('  no historical layer for this book, so no "then" plates.');
}

let bytes = 0;

for (const wp of waypoints) {
  const [lon, lat] = wp.coords;
  const pin = book.characters[wp.character]!.color;

  for (const [era, template, ink] of eras) {
    const buf = await renderPlate({
      // Measured on the built page: the plate displays at 399x249 CSS pixels, so
      // at DPR 2 it needs about 800x500. Shipping 1280x800 was 1.6x more pixels
      // than any screen could use, and it was the LCP element.
      lat,
      lon,
      zoom: 16,
      width: 512,
      height: 320,
      template,
      ink,
      pin,
    });

    writeFileSync(new URL(`${wp.id}-${era}.webp`, out), buf);
    bytes += buf.length;
    console.log(`  ${wp.id}-${era}.webp  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

console.log(
  `\n  ${(bytes / 1024).toFixed(0)} KB total. No WebGL, no context limit, no JavaScript.`,
);
