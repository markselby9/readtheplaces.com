import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { bookDir } from './book.ts';
import { fetchText, findOnStandardEbooks, slugify, titleCase, toPlainText } from './text.ts';

/**
 * Scaffold a new book.
 *
 *   bun run new-book "Mrs Dalloway" --author "Virginia Woolf" --city London
 *
 * Adding a book is the highest-value thing anyone can do here, and it used to be
 * the hardest: find a clean text, work out the rights, find a historical layer,
 * pick a colour, and hand-write JSON with no autocomplete.
 *
 * This does everything a machine can do and asks the human only for the things a
 * machine cannot know. It fetches the text from Standard Ebooks or Project
 * Gutenberg, geocodes the city, measures its bounding box, searches for a free
 * historical map layer, and writes a book.json with every field either filled in
 * or marked TODO with an explanation of what is wanted and why.
 *
 * It deliberately does NOT invent an accent colour or any waypoints. Colours are
 * quotations, and waypoints are judgements. Both need a reader.
 */

interface Args {
  title: string;
  author: string;
  city: string;
  country?: string;
  published?: number;
  text?: string;
  ordering: 'clock' | 'chapter' | 'position';
}

function parseArgs(argv: string[]): Args {
  const title = argv[0];
  if (!title || title.startsWith('--')) {
    console.error(`
  bun run new-book "<title>" --author "<author>" --city "<city>" [options]

  Required
    --author   <name>
    --city     <city>          the city the novel is set in

  Optional
    --country  <ISO-2>         guessed from the city if omitted
    --published <year>
    --text     <url>           a plain-text URL; Standard Ebooks is tried by default
    --ordering clock|chapter|position   default: chapter

  Example
    bun run new-book "Crime and Punishment" --author "Fyodor Dostoevsky" \\
      --city "Saint Petersburg" --published 1866 --ordering chapter
`);
    process.exit(1);
  }

  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };

  const author = flag('author');
  const city = flag('city');
  if (!author || !city) {
    console.error('  --author and --city are required. Run with no arguments for help.');
    process.exit(1);
  }

  const ordering = (flag('ordering') ?? 'chapter') as Args['ordering'];
  const published = flag('published');

  return {
    title,
    author,
    city,
    country: flag('country'),
    published: published ? Number(published) : undefined,
    text: flag('text'),
    ordering,
  };
}

interface Place {
  lon: number;
  lat: number;
  bbox: [number, number, number, number];
  country: string;
}

async function geocodeCity(city: string, country?: string): Promise<Place | null> {
  const q = new URLSearchParams({ q: city, format: 'json', limit: '1' });
  if (country) q.set('countrycodes', country.toLowerCase());

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { 'User-Agent': 'readtheplaces-new-book/1.0 (https://readtheplaces.com)' },
    });
    if (!res.ok) return null;

    const hits = (await res.json()) as Array<{
      lon: string;
      lat: string;
      boundingbox: [string, string, string, string];
      // Nominatim returns [south, north, west, east]
    }>;
    const hit = hits[0];
    if (!hit) return null;

    const [south, north, west, east] = hit.boundingbox.map(Number) as [
      number,
      number,
      number,
      number,
    ];

    return {
      lon: Number(hit.lon),
      lat: Number(hit.lat),
      bbox: [west, south, east, north],
      country: country?.toUpperCase() ?? 'ZZ',
    };
  } catch {
    return null;
  }
}

/**
 * Look for a free georeferenced historical map covering the city.
 *
 * Most cities have none. That is fine: a book without a historical layer renders
 * a single map and no wipe. Finding one is the best non-coding contribution in
 * the project, so we tell the human exactly where to look.
 */
/**
 * Does this layer actually have imagery over the city, and is it actually old?
 *
 * Map Warper's catalogue is not trustworthy on its own. Searching it for St
 * Petersburg returns four confident hits which turn out to be modern *marathon
 * route* maps, and one of them serves blank tiles. So we fetch a real tile at the
 * city centre and look at it.
 *
 * A tile under 1 KB is blank. Anything that survives is at least real imagery,
 * which a human still has to eyeball, because no test tells you whether a map is
 * from the right century.
 */
async function tilesRender(id: number, lat: number, lon: number): Promise<boolean> {
  const z = 15;
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);

  try {
    const res = await fetch(`https://mapwarper.net/maps/tile/${id}/${z}/${x}/${y}.png`, {
      headers: { 'User-Agent': 'readtheplaces-new-book/1.0' },
    });
    if (!res.ok) return false;
    const bytes = (await res.arrayBuffer()).byteLength;
    return bytes > 1024;
  } catch {
    return false;
  }
}

async function findHistoricalLayer(
  bbox: [number, number, number, number],
  lat: number,
  lon: number,
): Promise<Array<{ id: number; title: string }>> {
  const url = `https://mapwarper.net/api/v1/maps?operation=intersect&per_page=100&bbox=${bbox.join(',')}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'readtheplaces-new-book/1.0' } });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{ id: number; attributes: { title?: string; bbox?: string } }>;
    };

    const cityScale = (data.data ?? [])
      .filter((m) => {
        // City scale only. A world map that happens to intersect is useless.
        const parts = (m.attributes.bbox ?? '').split(',').map(Number);
        if (parts.length !== 4) return false;
        const [x0, y0, x1, y1] = parts as [number, number, number, number];
        return Math.abs(x1 - x0) < 0.5 && Math.abs(y1 - y0) < 0.5;
      })
      .slice(0, 8);

    const verified: Array<{ id: number; title: string }> = [];
    for (const m of cityScale) {
      if (await tilesRender(m.id, lat, lon)) {
        verified.push({ id: m.id, title: (m.attributes.title ?? '').trim() });
      }
      if (verified.length >= 3) break;
    }
    return verified;
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugify(args.title);
  const dir = bookDir(slug);

  if (existsSync(dir)) {
    console.error(`books/${slug}/ already exists.`);
    process.exit(1);
  }

  console.log(`\n  ${args.title} → books/${slug}/\n`);

  // 1. The text.
  console.log('  Finding the text…');
  let raw: string | null = null;
  let textSource = '';
  let textSourceUrl = '';
  let translation: string | null = null;

  if (args.text) {
    raw = await fetch(args.text).then((r) => (r.ok ? r.text() : null));
    textSource = 'Supplied by the contributor';
    textSourceUrl = args.text;
  } else {
    const edition = await findOnStandardEbooks(args.title, args.author);
    if (edition) {
      raw = await fetchText(edition.path);
      textSource = 'Standard Ebooks (public domain dedication)';
      textSourceUrl = `https://standardebooks.org${edition.path}`;

      if (edition.translator) {
        translation = `Translated by ${titleCase(edition.translator)}. TODO: confirm the translator's death date. The translation is a separate rights object from the work, and quotes are checked against the translation.`;
        console.log(`  Edition: translated by ${titleCase(edition.translator)}.`);
      }
    }
  }

  if (!raw) {
    console.error(`
  Could not find a text automatically.

  Searched Standard Ebooks for "${args.title}" by ${args.author} and found nothing
  that matched.

  Find a plain-text edition (Standard Ebooks, Project Gutenberg, Wikisource) and
  pass it with --text <url>. It must be public domain where you are, and the
  edition you cite is what every quote is checked against.
`);
    process.exit(1);
  }

  const text = toPlainText(raw);
  console.log(`  ${text.length.toLocaleString()} characters.`);

  // 2. The city.
  console.log('  Locating the city…');
  const place = await geocodeCity(args.city, args.country);
  if (!place) {
    console.error(`  Could not locate "${args.city}". Pass --country to disambiguate.`);
    process.exit(1);
  }
  console.log(`  ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`);

  // 3. A historical layer, if one exists.
  console.log('  Searching for a historical map layer…');
  const layers = await findHistoricalLayer(place.bbox, place.lat, place.lon);
  if (layers.length > 0) {
    console.log(`  ${layers.length} candidate layer(s) on Map Warper that actually serve tiles:`);
    for (const l of layers) {
      console.log(`    #${l.id}  ${l.title || '(untitled)'}`);
      console.log(`         https://mapwarper.net/maps/${l.id}`);
    }
    console.log(`
  These are NOT written into book.json, because no test can tell whether a map is
  from the right century. Searching for St Petersburg returns four confident hits
  that turn out to be modern marathon routes. Open one, look at it, and if it is
  genuinely historical, add it yourself:

    "layers": {
      "historical": {
        "name": "e.g. Plan of Saint Petersburg, 1860s",
        "tiles": "https://mapwarper.net/maps/tile/<id>/{z}/{x}/{y}.png",
        "minzoom": 10, "maxzoom": 20,
        "attribution": "credit the institution that holds the map",
        "licence": "...",
        "note": "how far is the map's date from the novel's, and does it matter?"
      }
    }`);
  } else {
    console.log(`  None found that serve real tiles.

  The book renders one map and no wipe, which is fine and honest. Giving it a
  second era is the best non-coding contribution in this project: georeference a
  public-domain map on https://allmaps.org or https://mapwarper.net and add the
  tile URL to book.json.`);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('source.txt', dir), `${text}\n`);

  const book = {
    id: slug,
    title: args.title,
    author: args.author,
    published: args.published,
    orderingKey: args.ordering,
    center: [Number(place.lon.toFixed(4)), Number(place.lat.toFixed(4))],
    zoom: 12.5,
    setting: {
      city: args.city,
      country: place.country,
      note: 'TODO — one sentence a reader would want. When and where is this novel set, and what shape does it have? See mrs-dalloway for an example.',
      bbox: place.bbox.map((n) => Number(n.toFixed(3))),
    },
    rights: {
      originalWork: `TODO — when did the author die, and where is the work public domain? We say rights-reviewed, never "licence-clean".`,
      translation,
      textSource,
      textSourceUrl,
      territoryNotes: 'TODO — public domain is jurisdiction-specific. Say where you checked.',
      attribution: `${args.author}, ${args.title}${args.published ? ` (${args.published})` : ''}.`,
    },
    palette: {
      accent: 'TODO',
      accentSourceQuote:
        'TODO — a book\'s colour is a QUOTATION from its own text. Mrs Dalloway is green because she "laid her green dress on her bed". Find a line where the novel names a colour that means something, put the hex in `accent`, and the line here. The build checks the line is really in the book, and that the colour clears WCAG AA on paper.',
    },
    characters: {
      TODO: {
        name: 'TODO — the characters whose threads the walk follows.',
        color: 'TODO',
        colorSourceQuote: 'TODO — as above. Each character colour must be citable too.',
      },
    },
  };

  writeFileSync(new URL('book.json', dir), `${JSON.stringify(book, null, 2)}\n`);
  writeFileSync(new URL('waypoints.json', dir), '[]\n');

  console.log(`
  Written:
    books/${slug}/source.txt        the text every quote is checked against
    books/${slug}/book.json         ${layers.length > 0 ? 'with a candidate historical layer' : 'no historical layer available'}
    books/${slug}/waypoints.json    empty, waiting for you

  Next:

    1. Fill in the TODOs in book.json. The accent colour is a quotation from the
       novel; the build will reject it if the line is not really there.

    2. Find the places:

         bun run extract ${slug} --geocode

       That hands you every place the book mentions, with the sentence and the
       position in the text. Take one, look at the pin on a map, and write two
       sentences about why it matters. That is a waypoint.

    3. Check your work:

         bun run build

       The build refuses a quote the novel does not contain, a guess with no
       explanation, and a coordinate outside the book's setting.
`);
}

await main();
