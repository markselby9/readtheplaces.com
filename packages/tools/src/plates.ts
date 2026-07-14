import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { loadBook } from './book.ts';
import { renderPlate } from './tiles.ts';

/**
 * Render the static map plates the walk pages use.
 *
 *   bun run plates                  every book that has places
 *   bun run plates mrs-dalloway     just one
 *
 * Output goes to apps/web/public/plates/<slug>/, which is gitignored. It is
 * derived, and rebuilding it is one command.
 */

const MODERN = 'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';

const BOOKS = new URL('../../../books/', import.meta.url);

/** With no argument, render every book that has places. A stub has none. */
function booksToRender(): string[] {
  const arg = process.argv[2];
  if (arg) return [arg];

  return readdirSync(BOOKS)
    .filter((slug) => {
      try {
        const raw = readFileSync(new URL(`${slug}/waypoints.json`, BOOKS), 'utf8');
        return (JSON.parse(raw) as unknown[]).length > 0;
      } catch {
        return false;
      }
    })
    .sort();
}

const slugs = booksToRender();
if (slugs.length === 0) {
  console.log('No books have places yet. Nothing to render.');
  process.exit(0);
}

let bytes = 0;

for (const slug of slugs) {
  const { book, waypoints } = loadBook(slug);
  const historical = book.layers?.historical;

  const out = new URL(`../../../apps/web/public/plates/${slug}/`, import.meta.url);
  mkdirSync(out, { recursive: true });

  const eras: Array<['now' | 'then', string, boolean]> = [['now', MODERN, true]];
  if (historical) eras.push(['then', historical.tiles, false]);

  console.log(`\n${slug}: ${waypoints.length} places, ${eras.length} era(s)`);
  if (!historical) {
    console.log('  no historical layer for this city, so no "then" plates');
  }

  for (const wp of waypoints) {
    const [lon, lat] = wp.coords;
    const pin = book.characters[wp.character]!.color;

    for (const [era, template, ink] of eras) {
      const buf = await renderPlate({
        // Measured on the built page: a plate displays at 399x249 CSS pixels, so
        // at DPR 2 it needs about 800x500. We were shipping 1280x800, which is
        // more pixels than any screen can use, on the LCP element.
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
    }
  }

  console.log(`  ${waypoints.length * eras.length} plates`);
}

console.log(
  `\n  ${(bytes / 1024).toFixed(0)} KB total. No WebGL, no context limit, no JavaScript.\n`,
);
