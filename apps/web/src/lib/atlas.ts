import type { LoadedBook } from './books';

/**
 * Every waypoint in the corpus as one GeoJSON FeatureCollection.
 *
 * This is what the all-places map at /map draws. The plates are baked per book,
 * so a combined view cannot reuse them; it needs the raw points instead. Two
 * readers asked for exactly this on the launch thread, independently.
 *
 * A book's accent is baked into the feature where it has one. Where it does not,
 * the property is left off and the map's paint expression supplies the default,
 * so the fallback colour lives in one place (the layer) rather than two.
 */

export interface WaypointFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name: string;
    slug: string;
    title: string;
    author: string;
    city: string;
    certainty: string;
    href: string;
    color?: string;
  };
}

export interface WaypointCollection {
  type: 'FeatureCollection';
  features: WaypointFeature[];
}

export function waypointsFeatureCollection(books: LoadedBook[]): WaypointCollection {
  const features: WaypointFeature[] = [];
  for (const { slug, book, waypoints } of books) {
    for (const w of waypoints) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: w.coords },
        properties: {
          name: w.name,
          slug,
          title: book.title,
          author: book.author,
          city: book.setting.city,
          certainty: w.placeCertainty,
          href: `/${slug}/read/`,
          ...(book.palette?.accent ? { color: book.palette.accent } : {}),
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
