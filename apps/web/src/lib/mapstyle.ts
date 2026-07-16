import type { StyleSpecification } from 'maplibre-gl';

/**
 * Ink on warm paper.
 *
 * The modern basemap is OpenFreeMap: OpenStreetMap data served free, with no
 * key, no account and no rate limit, so the only obligation is attribution to
 * OSM. Its canvas is filtered to near-monochrome in Reader.svelte, so the only
 * colour in the frame is the historical survey beneath the wipe and the
 * character pins. The city recedes and the book advances.
 *
 * MapLibre takes the hosted style URL directly, which carries its own vector
 * source, glyphs and sprite. See https://openfreemap.org.
 */

export const MODERN_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function modernStyle(): string {
  return MODERN_STYLE;
}

export function historicalStyle(tiles: string, attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      historical: { type: 'raster', tiles: [tiles], tileSize: 256, attribution },
    },
    layers: [{ id: 'historical', type: 'raster', source: 'historical' }],
  };
}
