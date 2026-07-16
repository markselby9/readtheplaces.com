import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { findOnStandardEbooks, slugify } from '../packages/tools/src/text.ts';

/**
 * Seed the catalogue with books this project can actually serve.
 *
 *   bun run scripts/seed-catalogue.ts
 *
 * Every one of these was checked against Standard Ebooks before it was listed,
 * and chosen on geography rather than on fame. A novel is suitable here if its
 * places are real, dense and walkable. That rules out a great deal of great
 * literature: Moby Dick happens at sea, Walden happens at a pond, Middlemarch
 * happens in a town George Eliot invented. None of them belong on a map.
 *
 * These are written as stubs: rights, city and bounding box, but no waypoints,
 * no colour and no text. Whoever adopts a book chooses its colour (and has to
 * cite the line in the novel that justifies it) and writes the places. The text
 * arrives with `bun run fetch-text <slug>`, because a megabyte per book for
 * novels nobody has started would bloat the repo for nothing.
 */

interface Seed {
  title: string;
  author: string;
  published: number;
  city: string;
  country: string;
  ordering: 'clock' | 'chapter' | 'position';
  /** Why this book, and not another. Shown on the site. */
  why: string;
}

const CATALOGUE: Seed[] = [
  // Dublin. The city with the strongest existing literary-map culture anywhere.
  {
    title: 'Ulysses',
    author: 'James Joyce',
    published: 1922,
    city: 'Dublin',
    country: 'ie',
    ordering: 'chapter',
    why: 'One day, 16 June 1904, mapped street by street. Joyce said he wanted Dublin rebuildable from the book, and people have been walking it every Bloomsday since. The most obvious book in the world for this project, and the hardest to do well.',
  },
  {
    title: 'Dubliners',
    author: 'James Joyce',
    published: 1914,
    city: 'Dublin',
    country: 'ie',
    ordering: 'chapter',
    why: 'Fifteen stories, fifteen corners of one city, each with a real address. A gentler way into Joyce’s Dublin than Ulysses, and a natural first book for a new contributor.',
  },

  // London. Restricted to five, or it would swallow the catalogue.
  {
    title: 'A Christmas Carol',
    author: 'Charles Dickens',
    published: 1843,
    city: 'London',
    country: 'gb',
    ordering: 'chapter',
    why: 'Short, famous, and a single night’s journey through the City. The Royal Exchange, Cornhill and Bob Cratchit’s Camden Town are named outright; the exact houses, Scrooge’s counting house and the Cratchits’ door, are reconstructions, which makes it an honest test of the certainty labels.',
  },
  {
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    published: 1890,
    city: 'London',
    country: 'gb',
    ordering: 'chapter',
    why: 'Mayfair drawing rooms and the opium dens of the docks, a few miles and an entire moral universe apart. Wilde is precise about the geography of respectability.',
  },
  {
    title: 'The Secret Agent',
    author: 'Joseph Conrad',
    published: 1907,
    city: 'London',
    country: 'gb',
    ordering: 'chapter',
    why: 'Built around a real event: the 1894 attempt to bomb the Greenwich Observatory. Conrad walks his anarchists across a London he names honestly, and the Observatory is still standing.',
  },
  {
    title: 'The Strange Case of Dr. Jekyll and Mr. Hyde',
    author: 'Robert Louis Stevenson',
    published: 1886,
    city: 'London',
    country: 'gb',
    ordering: 'chapter',
    why: 'A door in a back street in Soho, and a respectable house around the corner that turns out to be the same building. The whole novella is an argument about a floor plan.',
  },
  {
    title: 'Oliver Twist',
    author: 'Charles Dickens',
    published: 1838,
    city: 'London',
    country: 'gb',
    ordering: 'chapter',
    why: 'Jacob’s Island, Saffron Hill, Clerkenwell. Dickens was writing about slums that existed and were demolished within his lifetime, which makes the historical map layer do real work.',
  },

  // Paris.
  {
    title: 'Les Misérables',
    author: 'Victor Hugo',
    published: 1862,
    city: 'Paris',
    country: 'fr',
    ordering: 'chapter',
    why: 'The barricade of the Rue de la Chanvrerie, the sewers, the convent. Hugo stops the novel for fifty pages to describe Paris, which is either a flaw or the point.',
  },
  {
    title: 'Notre-Dame de Paris',
    author: 'Victor Hugo',
    published: 1831,
    city: 'Paris',
    country: 'fr',
    ordering: 'chapter',
    why: 'A novel written to save a building, and it worked. Hugo’s Paris of 1482 is reconstructed street by street, and the cathedral has burned and been rebuilt since he wrote it.',
  },
  {
    title: 'The Phantom of the Opera',
    author: 'Gaston Leroux',
    published: 1910,
    city: 'Paris',
    country: 'fr',
    ordering: 'chapter',
    why: 'The Palais Garnier is real, and so is the water beneath it: a cistern built to hold back the groundwater, which Leroux turned into an underground lake. He insisted the whole thing was true and gave enough addresses to check.',
  },
  {
    title: 'The Belly of Paris',
    author: 'Émile Zola',
    published: 1873,
    city: 'Paris',
    country: 'fr',
    ordering: 'chapter',
    why: 'Set entirely inside Les Halles, the great iron market that fed Paris for eight hundred years and was demolished in 1971. There is nothing there now. That absence is exactly what the historical layer is for.',
  },

  // Russia.
  {
    title: 'The Idiot',
    author: 'Fyodor Dostoevsky',
    published: 1869,
    city: 'Saint Petersburg',
    country: 'ru',
    ordering: 'chapter',
    why: 'Dostoevsky’s other Petersburg, moving between Pavlovsk and the city. A companion to Crime and Punishment, and a chance to test whether two books can share a city and still feel distinct.',
  },
  {
    title: 'Anna Karenina',
    author: 'Leo Tolstoy',
    published: 1878,
    city: 'Moscow',
    country: 'ru',
    ordering: 'chapter',
    why: 'Moscow, Petersburg, and the railway between them. Anna arrives by train, past a man crushed at the station, and dies under one before her story ends. The line between the two cities is the most important place in the book.',
  },
  // Bulgakov's Russian is public domain but every English translation is still
  // in copyright, so Standard Ebooks has no produced edition and the seed now
  // skips this title. The cited book (sourcing: "cited", locations only) was
  // authored by hand. See books/the-master-and-margarita.
  {
    title: 'The Master and Margarita',
    author: 'Mikhail Bulgakov',
    published: 1967,
    city: 'Moscow',
    country: 'ru',
    ordering: 'chapter',
    why: 'Patriarch’s Ponds, where the devil sits down on a bench in chapter one. Moscow readers still go there. The Russian text is public domain, but every English translation is still in copyright, so this is mapped as a cited book: locations only, no passages stored.',
  },

  // The United States.
  {
    title: 'The Age of Innocence',
    author: 'Edith Wharton',
    published: 1920,
    city: 'New York',
    country: 'us',
    ordering: 'chapter',
    why: 'Gilded Age Manhattan, where an address is a verdict. Wharton is exact about which streets are respectable and which are not, and half of the buildings are gone.',
  },
  {
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    published: 1925,
    city: 'New York',
    country: 'us',
    ordering: 'chapter',
    why: 'West Egg and East Egg are invented, the Valley of Ashes is Corona, and the Plaza is the Plaza. A book that will exercise inspired_by harder than any other on this list.',
  },
  {
    title: 'The House of Mirth',
    author: 'Edith Wharton',
    published: 1905,
    city: 'New York',
    country: 'us',
    ordering: 'chapter',
    why: 'Lily Bart falls through New York one address at a time, from Fifth Avenue to a boarding house. The plot is a map, read downwards.',
  },
  {
    title: 'The Jungle',
    author: 'Upton Sinclair',
    published: 1906,
    city: 'Chicago',
    country: 'us',
    ordering: 'chapter',
    why: 'Packingtown and the Union Stock Yards, which Sinclair reported from directly. The yards are gone, Chicago has fourteen georeferenced historical maps, and the two facts belong together.',
  },
  {
    title: 'The Awakening',
    author: 'Kate Chopin',
    published: 1899,
    city: 'New Orleans',
    country: 'us',
    ordering: 'chapter',
    why: 'The French Quarter and Grand Isle, and a woman walking out of one life into the sea. Short, precise, and set in a city that has since been remade twice by water.',
  },

  // Elsewhere.
  {
    title: 'Death in Venice',
    author: 'Thomas Mann',
    published: 1912,
    city: 'Venice',
    country: 'it',
    ordering: 'chapter',
    why: 'The Lido, the lagoon, and an Asiatic cholera the city hushes up to protect the season. Short enough to do properly, and the geography is a single hotel and the water in front of it.',
  },
  {
    title: 'Kim',
    author: 'Rudyard Kipling',
    published: 1901,
    city: 'Lahore',
    country: 'pk',
    ordering: 'chapter',
    why: 'It opens on the gun Zam-Zammah outside the Lahore Museum, both of which are still there, and then walks the length of the Grand Trunk Road. A test of whether this works outside Europe, where Street View is thin and historical layers are thinner.',
  },
  {
    title: 'A Passage to India',
    author: 'E. M. Forster',
    published: 1924,
    city: 'Bankipore',
    country: 'in',
    ordering: 'chapter',
    why: 'Chandrapore is invented, but Forster built it from Bankipore, and the Marabar Caves are the Barabar Caves. Almost every place will be inspired_by, which is worth having in the catalogue on purpose.',
  },
  {
    title: 'Kidnapped',
    author: 'Robert Louis Stevenson',
    published: 1886,
    city: 'Edinburgh',
    country: 'gb',
    ordering: 'chapter',
    why: 'Begins near Edinburgh, at the House of Shaws by Cramond, then crosses the Highlands after a real murder, the Appin killing of 1752. Stevenson tracked the route on maps and it can be walked.',
  },
  {
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    published: 1899,
    city: 'Kinshasa',
    country: 'cd',
    ordering: 'chapter',
    why: 'Conrad went up the Congo himself in 1890 and the novella follows his own journey. It will have almost no Street View, no historical layer, and the places are named obliquely. If the design survives this book it survives anything.',
  },

  // A second wave: new cities, and two countries the atlas did not reach before.
  {
    title: 'McTeague',
    author: 'Frank Norris',
    published: 1899,
    city: 'San Francisco',
    country: 'us',
    ordering: 'chapter',
    why: 'Polk Street, block by block, above a dental parlour. Norris pins his characters to specific corners of San Francisco, most of which the 1906 earthquake erased a few years after he wrote them.',
  },
  {
    title: 'The Bostonians',
    author: 'Henry James',
    published: 1886,
    city: 'Boston',
    country: 'us',
    ordering: 'chapter',
    why: 'Beacon Hill, the Back Bay, and a decaying house out on Cape Cod. James fixes the exact social altitude of every address in a city that still keeps the same streets.',
  },
  {
    title: 'A Room with a View',
    author: 'E. M. Forster',
    published: 1908,
    city: 'Florence',
    country: 'it',
    ordering: 'chapter',
    why: 'The Piazza della Signoria, Santa Croce, and the Arno, where a killing in the square changes everything. Half the book then moves to an invented corner of Surrey, so its certainty labels will earn their keep.',
  },
  {
    title: 'Dracula',
    author: 'Bram Stoker',
    published: 1897,
    city: 'Whitby',
    country: 'gb',
    ordering: 'chapter',
    why: 'The abbey steps and the harbour at Whitby, where the ship runs aground, are exact and still walkable. Transylvania is drawn from maps Stoker never travelled and Carfax is invented, which is precisely what the labels are for.',
  },
  {
    title: 'Anne of Green Gables',
    author: 'L. M. Montgomery',
    published: 1908,
    city: 'Cavendish',
    country: 'ca',
    ordering: 'chapter',
    why: 'Avonlea is invented, but Montgomery built it from Cavendish on Prince Edward Island, where the farmhouse she had in mind is now the most visited place on the island. The first book here set in Canada.',
  },
  {
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    published: 1846,
    city: 'Marseille',
    country: 'fr',
    ordering: 'chapter',
    why: 'It begins in the harbour at Marseille and the island prison of the Château d’If, which is real and reached by boat. The novel then crosses the Mediterranean, so a contributor chooses the anchors that carry it.',
  },
  {
    title: 'Frankenstein',
    author: 'Mary Shelley',
    published: 1818,
    city: 'Geneva',
    country: 'ch',
    ordering: 'chapter',
    why: 'Geneva, the Mer de Glace above Chamonix, and a laboratory in Ingolstadt. Shelley wanders from the Alps to the Arctic, but the lake at the centre is precise, and it brings Switzerland into the atlas.',
  },

  // A third wave, one book at a time.
  {
    title: 'The House of the Seven Gables',
    author: 'Nathaniel Hawthorne',
    published: 1851,
    city: 'Salem',
    country: 'us',
    ordering: 'chapter',
    why: 'The gabled house is real, still standing on Turner Street in Salem and now a museum. Hawthorne built the novel around a house he could see, in the town he grew up in and later fled.',
  },
  {
    title: 'Zuleika Dobson',
    author: 'Max Beerbohm',
    published: 1911,
    city: 'Oxford',
    country: 'gb',
    ordering: 'chapter',
    why: 'Oxford in a single doomed summer term: the High, the river Isis, the Emperors’ heads outside the Sheldonian. Beerbohm invents a college but keeps the city exact, and it brings Oxford into the atlas.',
  },
  {
    title: 'Hunger',
    author: 'Knut Hamsun',
    published: 1890,
    city: 'Oslo',
    country: 'no',
    ordering: 'chapter',
    why: 'Kristiania, now Oslo, paced in a fever of starvation down Karl Johan and along the harbour. Hamsun keeps to real streets a hungry man can still walk, and it brings Norway into the atlas.',
  },
  {
    title: 'The Scarlet Letter',
    author: 'Nathaniel Hawthorne',
    published: 1850,
    city: 'Boston',
    country: 'us',
    ordering: 'chapter',
    why: 'Puritan Boston in the 1640s, most of it long gone: the scaffold in the market-place, the prison on its lane, the forest at the edge of town. Almost everything here will be inferred, which is exactly the test the certainty labels are for. It pairs with The Bostonians, the same city two centuries on.',
  },
  {
    title: 'Buddenbrooks',
    author: 'Thomas Mann',
    published: 1901,
    city: 'Lübeck',
    country: 'de',
    ordering: 'chapter',
    why: 'A Hanseatic merchant family declines over four generations in a Lübeck Mann rebuilds house by house. The Buddenbrookhaus on Mengstraße is real and now a museum, and it brings Germany into the atlas.',
  },
  {
    title: 'Quo Vadis',
    author: 'Henryk Sienkiewicz',
    published: 1896,
    city: 'Rome',
    country: 'it',
    ordering: 'chapter',
    why: 'Nero’s Rome, and the fire: the Palatine, the Circus, the Mamertine prison, the catacombs where the first Christians hide. Sienkiewicz builds the ancient city from the monuments that still stand, and it brings Rome into the atlas at last.',
  },
  {
    title: 'Villette',
    author: 'Charlotte Brontë',
    published: 1853,
    city: 'Brussels',
    country: 'be',
    ordering: 'chapter',
    why: 'Brussels, thinly disguised as Villette: the boarding school on the Rue d’Isabelle where Brontë herself taught, the park, the old Flemish streets. She mapped her own two years into it, and it brings Belgium into the atlas.',
  },
  {
    title: 'Madame Bovary',
    author: 'Gustave Flaubert',
    published: 1857,
    city: 'Rouen',
    country: 'fr',
    ordering: 'chapter',
    why: 'Emma’s world is the fictional village of Yonville, but her escapes are to a real Rouen: the cathedral, the theatre, and the closed cab that scandalised France, circling the city with its blinds down. That drive can be walked.',
  },
  {
    title: 'Washington Square',
    author: 'Henry James',
    published: 1880,
    city: 'New York',
    country: 'us',
    ordering: 'chapter',
    why: 'A single square, mapped to the door: Dr Sloper’s house on Washington Square North, the Row still standing, the Bowery a world away. James fixes the whole novel to a few blocks of Greenwich Village, which is exactly what this project is for.',
  },
  {
    title: 'The Red Room',
    author: 'August Strindberg',
    published: 1879,
    city: 'Stockholm',
    country: 'se',
    ordering: 'chapter',
    why: 'Stockholm skewered: the newspaper offices, the government bureaus, and the Red Room of the Berns Salonger where the young cynics drink, a room that is still there. Strindberg walks a real city he despised, and it brings Sweden into the atlas.',
  },
];

// ---------------------------------------------------------------------------

interface Place {
  lon: number;
  lat: number;
  bbox: [number, number, number, number];
}

async function geocode(city: string, cc: string): Promise<Place | null> {
  const q = new URLSearchParams({
    q: city,
    format: 'json',
    limit: '1',
    countrycodes: cc,
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { 'User-Agent': 'readtheplaces-seed/1.0 (https://readtheplaces.com)' },
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as Array<{
      lon: string;
      lat: string;
      boundingbox: [string, string, string, string];
    }>;
    const hit = hits[0];
    if (!hit) return null;
    const [s, n, w, e] = hit.boundingbox.map(Number) as [number, number, number, number];
    return { lon: Number(hit.lon), lat: Number(hit.lat), bbox: [w, s, e, n] };
  } catch {
    return null;
  }
}

const BOOKS = new URL('../books/', import.meta.url);
let added = 0;
let skipped = 0;

for (const seed of CATALOGUE) {
  const slug = slugify(seed.title);
  const dir = new URL(`${slug}/`, BOOKS);

  if (existsSync(dir)) {
    console.log(`  skip   ${slug} (already exists)`);
    skipped++;
    continue;
  }

  const edition = await findOnStandardEbooks(seed.title, seed.author);
  if (!edition) {
    console.log(`  MISS   ${slug}: not on Standard Ebooks. Not listing a book we cannot source.`);
    continue;
  }

  const place = await geocode(seed.city, seed.country);
  if (!place) {
    console.log(`  MISS   ${slug}: could not locate ${seed.city}`);
    continue;
  }

  mkdirSync(dir, { recursive: true });

  const book = {
    id: slug,
    title: seed.title,
    author: seed.author,
    published: seed.published,
    orderingKey: seed.ordering,
    center: [Number(place.lon.toFixed(4)), Number(place.lat.toFixed(4))],
    zoom: 12.5,
    setting: {
      city: seed.city,
      country: seed.country.toUpperCase(),
      note: seed.why,
      bbox: place.bbox.map((n) => Number(n.toFixed(3))),
    },
    rights: {
      originalWork: `TODO: confirm. ${seed.author} published this in ${seed.published}.`,
      translation: edition.translator
        ? `Translated by ${edition.translator.replace(/-/g, ' ')}. TODO: confirm the translator's death date. The translation is a separate rights object from the work.`
        : null,
      textSource: 'Standard Ebooks (public domain dedication)',
      textSourceUrl: `https://standardebooks.org${edition.path}`,
      territoryNotes:
        'TODO: public domain is jurisdiction-specific. Say where you checked before publishing waypoints.',
      attribution: `${seed.author}, ${seed.title} (${seed.published}).`,
    },
  };

  writeFileSync(new URL('book.json', dir), `${JSON.stringify(book, null, 2)}\n`);
  writeFileSync(new URL('waypoints.json', dir), '[]\n');

  console.log(
    `  added  ${slug.padEnd(38)} ${seed.city}${edition.translator ? '  [translated]' : ''}`,
  );
  added++;

  // Nominatim asks for no more than one request a second.
  await new Promise((r) => setTimeout(r, 1200));
}

console.log(`\n  ${added} added, ${skipped} already present.\n`);
