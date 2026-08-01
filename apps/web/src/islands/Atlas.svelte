<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { modernStyle } from '../lib/mapstyle';
  import type { WaypointCollection } from '../lib/atlas';

  // The whole corpus on one map. Unlike the reader, this draws every waypoint of
  // every book at once, so it cannot reuse the per-book baked plates; it loads
  // the raw points as a single clustered GeoJSON source instead.

  const PAPER = '#F5F2EA';
  const INK = '#4a453d';

  let count = $state<number | null>(null);

  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Our data is CI-verified, but a popup still builds HTML from strings, so escape.
  function esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  onMount(() => {
    let destroyed = false;

    // The map is created synchronously, the moment the container is laid out.
    // Creating it after an `await` (e.g. behind the data fetch) leaves it in a
    // broken sizing state during hydration and the 'load' event can be missed,
    // so the data is fetched in parallel and joined inside the load handler.
    const map = new maplibregl.Map({
      container: 'map-atlas',
      style: modernStyle(),
      center: [-2, 40],
      zoom: 2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // maplibre only tracks the window resize event, not the container's own size.
    // At hydration the container can still be mid-layout, so the map bakes a wrong
    // canvas size and never re-syncs — a dead strip on one side, and pins that
    // drift on zoom because the transform's size no longer matches the canvas.
    // A ResizeObserver fires an initial callback with the settled size and again
    // on every later change, keeping the canvas and transform in step.
    const container = document.getElementById('map-atlas')!;
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);

    const data = fetch('/waypoints.geojson').then((r) => r.json() as Promise<WaypointCollection>);
    data.then((fc) => {
      count = fc.features.length;
    });

    map.on('load', async () => {
      const fc = await data;
      if (destroyed) return;
      map.addSource('waypoints', {
        type: 'geojson',
        data: fc as unknown as GeoJSON.FeatureCollection,
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'waypoints',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': INK,
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': PAPER,
          'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24, 500, 32],
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'waypoints',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': PAPER },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'waypoints',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['coalesce', ['get', 'color'], INK],
          'circle-radius': 6,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': PAPER,
        },
      });

      // Open the corpus at a frame that holds every point.
      const bounds = new maplibregl.LngLatBounds();
      for (const f of fc.features) bounds.extend(f.geometry.coordinates as [number, number]);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });

      map.on('click', 'clusters', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        if (!f) return;
        const id = f.properties!.cluster_id as number;
        const src = map.getSource('waypoints') as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(id).then((zoom) => {
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
            duration: reduceMotion ? 0 : 500,
          });
        });
      });

      // A point is a place in a book; clicking it opens that book's reader.
      map.on('click', 'unclustered-point', (e) => {
        const href = e.features?.[0]?.properties?.href as string | undefined;
        if (href) window.location.href = href;
      });

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; title: string; city: string };
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<strong>${esc(p.name)}</strong><span>${esc(p.title)} · ${esc(p.city)}</span>`)
          .addTo(map);
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // Svelte runs the returned function on destroy. `destroyed` stops the async
    // load handler from touching a map that has already been torn down.
    return () => {
      destroyed = true;
      resize.disconnect();
      map.remove();
    };
  });
</script>

<div class="atlas">
  <div id="map-atlas"></div>
  <div class="caption">
    <a class="home" href="/">← Read the Places</a>
    <p>
      {#if count === null}
        Loading the whole atlas…
      {:else}
        {count.toLocaleString()} places across every mapped book. Click a pin to read its book.
      {/if}
    </p>
  </div>
</div>

<style>
  .atlas {
    position: fixed;
    inset: 0;
  }
  #map-atlas {
    position: absolute;
    inset: 0;
  }
  .caption {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    margin: var(--s3, 0.75rem);
    padding: var(--s2, 0.5rem) var(--s3, 0.75rem);
    max-width: min(28rem, calc(100vw - 2rem));
    background: color-mix(in srgb, #f5f2ea 92%, transparent);
    border: 1px solid rgba(74, 69, 61, 0.18);
    border-radius: 4px;
    backdrop-filter: blur(4px);
    font-family: var(--sans, system-ui);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }
  .caption .home {
    display: inline-block;
    font-weight: 600;
    color: var(--ink, #2b2822);
    text-decoration: none;
    margin-bottom: 0.15rem;
  }
  .caption .home:hover {
    text-decoration: underline;
  }
  .caption p {
    margin: 0;
    font-size: var(--step--1, 0.875rem);
    color: var(--ink-3, #4a453d);
    line-height: 1.3;
  }
  :global(.maplibregl-popup-content) {
    font-family: var(--sans, system-ui);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
  }
  :global(.maplibregl-popup-content strong) {
    display: block;
    font-size: 0.9rem;
    color: #2b2822;
  }
  :global(.maplibregl-popup-content span) {
    font-size: 0.78rem;
    color: #6b655c;
  }
</style>
