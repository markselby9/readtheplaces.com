import type { Book, BuiltWaypoint } from '@rtp/schema';
import type { LoadedBook } from './books';

/**
 * Structured data.
 *
 * Every waypoint is a real place with real coordinates, taken from a real book.
 * That is unusually rich for a search engine, and saying so in schema.org is the
 * cheapest and most durable SEO this project can do: it works in Google, in Bing,
 * in whatever comes next, and it does not depend on ranking tricks that rot.
 *
 * We only ever assert what the build has already verified. A place marked
 * `disputed` is not given coordinates in the structured data as though it were a
 * fact, because that would be lying to a machine in a machine-readable format,
 * which is worse than lying to a person.
 */

const SITE = 'https://readtheplaces.com';
const REPO = 'https://github.com/markselby9/readtheplaces.com';

type Json = Record<string, unknown>;

export function websiteSchema(bookCount: number, cityCount: number): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'Read the Places',
    description:
      'An open, contributor-driven atlas of the real places in books, presented in the order the story happens.',
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    codeRepository: REPO,
    // The nav search reads ?q= and filters the home page live. Declaring it lets
    // Google offer a sitelinks search box straight in the result.
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    about: [
      { '@type': 'Thing', name: 'Literary geography' },
      { '@type': 'Thing', name: 'Literary tourism' },
      { '@type': 'Thing', name: 'Public domain literature' },
    ],
    mainEntity: {
      '@type': 'Dataset',
      name: 'Read the Places waypoints',
      description: `${bookCount} books across ${cityCount} cities. Every place is anchored to a verbatim quotation from the text and labelled with how certain the identification is.`,
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'Read the Places contributors' },
      distribution: {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${REPO}/tree/main/books`,
      },
    },
  };
}

export function breadcrumbSchema(trail: Array<{ name: string; url: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: `${SITE}${step.url}`,
    })),
  };
}

/**
 * A waypoint as a Place.
 *
 * Coordinates are only asserted where the book actually supports them. For an
 * `inferred` or `disputed` place we still name it, but we do not hand a search
 * engine a precise latitude and longitude as though Woolf or Dostoevsky had
 * written one down.
 */
function placeSchema(wp: BuiltWaypoint, book: Book): Json {
  const certain = wp.placeCertainty === 'explicit';

  return {
    '@type': 'Place',
    name: wp.name,
    description: wp.note,
    ...(certain
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: wp.coords[1],
            longitude: wp.coords[0],
          },
          address: {
            '@type': 'PostalAddress',
            addressLocality: book.setting.city,
            addressCountry: book.setting.country,
          },
        }
      : {
          // Named, but not pinned. The identification is a reconstruction, and
          // the note says so.
          disambiguatingDescription: wp.certaintyNote ?? undefined,
        }),
  };
}

export function bookSchema(loaded: LoadedBook): Json {
  const { slug, book, waypoints } = loaded;
  const url = `${SITE}/${slug}/`;

  const work: Json = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': `${url}#book`,
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    datePublished: book.published ? String(book.published) : undefined,
    inLanguage: 'en',
    isAccessibleForFree: true,
    ...(book.rights.translation
      ? { translator: { '@type': 'Person', name: book.rights.translation.split('.')[0] } }
      : {}),
    contentLocation: {
      '@type': 'Place',
      name: book.setting.city,
      address: {
        '@type': 'PostalAddress',
        addressLocality: book.setting.city,
        addressCountry: book.setting.country,
      },
    },
    sameAs: book.rights.textSourceUrl,
  };

  if (waypoints.length === 0) return work;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      work,
      {
        '@type': 'ItemList',
        '@id': `${url}#places`,
        name: `The ${book.setting.city} of ${book.title}`,
        description: `${waypoints.length} real places from ${book.title}, in the order the novel visits them.`,
        numberOfItems: waypoints.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: waypoints.map((wp, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: placeSchema(wp, book),
        })),
      },
    ],
  };
}

export function citySchema(city: string, country: string, books: LoadedBook[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Literary places in ${city}`,
    description: `${books.length} novel${books.length === 1 ? '' : 's'} set in ${city}, with their real places mapped in narrative order.`,
    about: {
      '@type': 'City',
      name: city,
      address: { '@type': 'PostalAddress', addressCountry: country },
    },
    hasPart: books.map(({ slug, book }) => ({
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: book.author },
      url: `${SITE}/${slug}/`,
    })),
  };
}
