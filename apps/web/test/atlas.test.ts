import { describe, expect, it } from 'vitest';
import { waypointsFeatureCollection } from '../src/lib/atlas.ts';
import type { LoadedBook } from '../src/lib/books.ts';

// A minimal LoadedBook: only the fields the GeoJSON builder reads. Cast rather
// than construct the full schema types — the builder touches a handful of keys.
function loaded(over: {
  slug: string;
  title?: string;
  author?: string;
  city?: string;
  accent?: string;
  waypoints?: { coords: [number, number]; name: string; certainty?: string }[];
}): LoadedBook {
  return {
    slug: over.slug,
    book: {
      title: over.title ?? 'A Book',
      author: over.author ?? 'An Author',
      setting: { city: over.city ?? 'London' },
      palette: over.accent ? { accent: over.accent } : undefined,
    },
    waypoints: (over.waypoints ?? []).map((w) => ({
      coords: w.coords,
      name: w.name,
      placeCertainty: w.certainty ?? 'explicit',
    })),
  } as unknown as LoadedBook;
}

describe('waypointsFeatureCollection', () => {
  it('emits one Point feature per waypoint across every book', () => {
    const fc = waypointsFeatureCollection([
      loaded({ slug: 'a', waypoints: [{ coords: [-0.1, 51.5], name: 'Bond Street' }] }),
      loaded({
        slug: 'b',
        waypoints: [
          { coords: [-0.2, 51.4], name: 'Kew' },
          { coords: [2.3, 48.8], name: 'Paris' },
        ],
      }),
    ]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(3);
    expect(fc.features.every((f) => f.geometry.type === 'Point')).toBe(true);
  });

  it('skips books with no waypoints (stubs) rather than emitting empty features', () => {
    const fc = waypointsFeatureCollection([
      loaded({ slug: 'stub' }),
      loaded({ slug: 'real', waypoints: [{ coords: [0, 0], name: 'Null Island' }] }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties.slug).toBe('real');
  });

  it('carries the coordinates and a reader deep-link in each feature', () => {
    const fc = waypointsFeatureCollection([
      loaded({
        slug: 'mrs-dalloway',
        title: 'Mrs Dalloway',
        author: 'Virginia Woolf',
        city: 'London',
        waypoints: [{ coords: [-0.1435, 51.5079], name: 'Bond Street', certainty: 'inferred' }],
      }),
    ]);
    const f = fc.features[0]!;
    expect(f.geometry.coordinates).toEqual([-0.1435, 51.5079]);
    expect(f.properties).toMatchObject({
      name: 'Bond Street',
      slug: 'mrs-dalloway',
      title: 'Mrs Dalloway',
      author: 'Virginia Woolf',
      city: 'London',
      certainty: 'inferred',
      href: '/mrs-dalloway/read/',
    });
  });

  it("uses the book's accent colour when it has one", () => {
    const fc = waypointsFeatureCollection([
      loaded({ slug: 'a', accent: '#8b1a1a', waypoints: [{ coords: [0, 0], name: 'X' }] }),
    ]);
    expect(fc.features[0]!.properties.color).toBe('#8b1a1a');
  });

  it('omits colour when the book has no accent, leaving the map to supply a default', () => {
    const fc = waypointsFeatureCollection([
      loaded({ slug: 'a', waypoints: [{ coords: [0, 0], name: 'X' }] }),
    ]);
    expect('color' in fc.features[0]!.properties).toBe(false);
  });
});
