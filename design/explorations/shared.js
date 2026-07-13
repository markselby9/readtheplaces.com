// Shared plumbing for the three art directions, so they differ only in design.

const BOOK = '../../books/mrs-dalloway';

export async function loadBook() {
  const [book, waypoints] = await Promise.all([
    fetch(`${BOOK}/book.json`).then(r => r.json()),
    fetch(`${BOOK}/waypoints.built.json`).then(r => r.json()),
  ]);
  return { book, waypoints };
}

export function stopGroups(waypoints) {
  const times = [...new Set(waypoints.map(w => w.clock))].sort();
  return times.map(t => waypoints.filter(w => w.clock === t));
}

// Hyperlinks, never embeds — see spec §4.2. A link to google.com/maps is not a
// Maps Platform API call, so it carries none of the "No Use With Non-Google
// Maps" restrictions that would otherwise forbid the historical layer.
//
// Street View has holes (no mainland China, partial India). Google Maps does
// not. So the Maps link is the one we always show; Street View is offered on
// top of it, and a stop is never left without a way to go and look.
export const streetView = ([lon, lat]) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

export const googleMaps = ([lon, lat]) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

const raster = (tiles, attribution) => ({
  version: 8,
  sources: { s: { type: 'raster', tiles: [tiles], tileSize: 256, attribution } },
  layers: [{ id: 's', type: 'raster', source: 's' }],
});

// Near-monochrome. The CSS filter in tokens.css does the ink-on-paper work;
// positron is the least opinionated raster style to start from. In production
// this becomes a hand-authored Protomaps vector style.
export const MODERN = raster(
  'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © CARTO'
);

export const historic = book => raster(
  book.layers.historical.tiles,
  book.layers.historical.attribution
);

/** A small, non-interactive map plate for one waypoint. */
export function plateMap(w, book, opts = {}) {
  const el = document.getElementById(`map-${w.id}`);
  if (!el) return null;
  const map = new maplibregl.Map({
    container: el,
    style: opts.historic ? historic(book) : MODERN,
    center: w.coords,
    zoom: opts.zoom ?? 15.4,
    interactive: false,
    attributionControl: false,
  });
  const pin = document.createElement('div');
  pin.className = 'pin on';
  pin.style.setProperty('--c', book.characters[w.character].color);
  new maplibregl.Marker({ element: pin }).setLngLat(w.coords).addTo(map);
  return map;
}
