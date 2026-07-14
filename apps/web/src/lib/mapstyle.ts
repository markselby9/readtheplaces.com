import type { StyleSpecification } from 'maplibre-gl';

/**
 * Ink on warm paper.
 *
 * Default OSM styling (blue water, yellow motorways, green parks) fights the
 * page on every tile. Filtered down to near-monochrome, the only colour in the
 * frame comes from the historical survey beneath the wipe and the character
 * pins. The city recedes and the book advances.
 *
 * This mirrors the ink filter applied to the static plates in @rtp/tools, so the
 * two surfaces match.
 */

const OSM = 'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';

export function modernStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      modern: {
        type: 'raster',
        tiles: [OSM],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: 'modern', type: 'raster', source: 'modern' }],
  };
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
