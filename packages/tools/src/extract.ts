import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { normalise } from '@rtp/schema';
import { bookDir, loadBook } from './book.ts';
import { findPlaces } from './places.ts';

/**
 * Mine a book for candidate waypoints and write a worklist.
 *
 *   bun run extract mrs-dalloway [--geocode]
 *
 * See places.ts for why this never writes a waypoint.
 */

interface GeocodeHit {
  coords: [number, number];
  label: string;
}

async function geocode(
  name: string,
  city: string,
  country: string,
  cache: Record<string, GeocodeHit[]>,
): Promise<GeocodeHit[]> {
  const key = `${name}|${city}|${country}`;
  const cached = cache[key];
  if (cached) return cached;

  const q = new URLSearchParams({
    q: `${name}, ${city}`,
    format: 'json',
    limit: '3',
    countrycodes: country.toLowerCase(),
  });

  let hits: GeocodeHit[] = [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { 'User-Agent': 'readtheplaces-extract/1.0 (https://readtheplaces.com)' },
    });
    if (res.ok) {
      const raw = (await res.json()) as Array<{ lon: string; lat: string; display_name: string }>;
      hits = raw.map((h) => ({
        coords: [Number(h.lon), Number(h.lat)] as [number, number],
        label: h.display_name.slice(0, 90),
      }));
    }
  } catch {
    hits = [];
  }

  // Nominatim asks for no more than one request a second. Be a good citizen.
  await new Promise((r) => setTimeout(r, 1100));

  cache[key] = hits;
  return hits;
}

const slug = process.argv[2];
if (!slug) {
  console.error('usage: bun run extract <book-slug> [--geocode]');
  process.exit(1);
}
const wantGeocode = process.argv.includes('--geocode');

const { book, waypoints, text } = loadBook(slug);

const covered = new Set<string>();
for (const w of waypoints) {
  covered.add(normalise(w.name).toLowerCase());
  covered.add(normalise(w.quoteAnchor).toLowerCase());
}

const candidates = findPlaces(text).map((c) => ({
  ...c,
  alreadyCovered: [...covered].some((k) => k.includes(c.name.toLowerCase())),
}));

const dir = bookDir(slug);
const cachePath = new URL('.geocode-cache.json', dir);
const cache: Record<string, GeocodeHit[]> = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, 'utf8'))
  : {};

if (wantGeocode) {
  for (const c of candidates) {
    if (c.alreadyCovered) continue;
    c.coordSuggestions = await geocode(c.name, book.setting.city, book.setting.country, cache);
  }
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 1)}\n`);
}

writeFileSync(new URL('candidates.json', dir), `${JSON.stringify(candidates, null, 2)}\n`);

const todo = candidates.filter((c) => !c.alreadyCovered);
console.log(
  `${slug}: ${candidates.length} place candidates from ${text.length.toLocaleString()} chars`,
);
console.log(`  ${candidates.length - todo.length} already have a waypoint`);
console.log(`  ${todo.length} awaiting triage → books/${slug}/candidates.json\n`);
console.log('  mentions    at  place');
console.log(`  ${'-'.repeat(52)}`);
for (const c of todo.slice(0, 20)) {
  console.log(
    `  ${String(c.mentions).padStart(8)}  ${String(Math.round(c.firstPosition * 100)).padStart(3)}%  ${c.name}`,
  );
}
if (todo.length > 20) console.log(`${' '.repeat(17)}… and ${todo.length - 20} more`);
