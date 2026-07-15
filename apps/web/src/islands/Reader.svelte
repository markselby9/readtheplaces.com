<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Book, BuiltWaypoint } from '@rtp/schema';
  import { historicalStyle, modernStyle } from '../lib/mapstyle';
  import { googleMaps, streetView } from '../lib/links';

  interface Props {
    book: Book;
    groups: BuiltWaypoint[][];
  }
  const { book, groups }: Props = $props();

  let cursor = $state(0);
  let wipe = $state(52);
  let ready = $state(false);

  const group = $derived(groups[cursor]!);
  const paired = $derived(
    group.length > 1 && group.some((w) => (w.simultaneousWith ?? []).length > 0),
  );

  const historical = book.layers?.historical ?? null;
  const cited = book.sourcing === 'cited';

  let now: maplibregl.Map | undefined;
  let then: maplibregl.Map | undefined;
  const pins = new Map<string, HTMLElement[]>();

  function frame(g: BuiltWaypoint[]) {
    if (!ready || !now) return;
    if (g.length > 1) {
      // Frame both at once. The distance between them is the point.
      const bounds = g.reduce(
        (acc, w) => acc.extend(w.coords),
        new maplibregl.LngLatBounds(g[0]!.coords, g[0]!.coords),
      );
      now.fitBounds(bounds, { padding: 110, duration: 1600, maxZoom: 14.4 });
    } else {
      now.flyTo({ center: g[0]!.coords, zoom: 15.6, duration: 1500 });
    }
  }

  onMount(() => {
    const view = { center: book.center, zoom: book.zoom, attributionControl: false as const };

    now = new maplibregl.Map({ container: 'map-now', style: modernStyle(), ...view });
    now.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    if (historical) {
      then = new maplibregl.Map({
        container: 'map-then',
        style: historicalStyle(historical.tiles, historical.attribution),
        ...view,
        interactive: false,
      });
      now.on('move', () =>
        then!.jumpTo({
          center: now!.getCenter(),
          zoom: now!.getZoom(),
          bearing: now!.getBearing(),
          pitch: now!.getPitch(),
        }),
      );
    }

    // A marker lives inside its own map's container, and #map-then paints above
    // #map-now. A pin added only to the modern map disappears wherever the
    // historical map covers it, so every waypoint gets one on both. The wipe
    // then reveals whichever is appropriate and the pin reads as continuous.
    for (const w of groups.flat()) {
      const maps = [now, then].filter((m): m is maplibregl.Map => m !== undefined);
      const twins = maps.map((map) => {
        const el = document.createElement('div');
        el.className = 'pin';
        el.style.setProperty('--c', book.characters[w.character]!.color);
        el.title = `${w.progressLabel} · ${w.name}`;
        el.addEventListener('click', () => {
          cursor = groups.findIndex((g) => g.some((x) => x.id === w.id));
        });
        new maplibregl.Marker({ element: el }).setLngLat(w.coords).addTo(map);
        return el;
      });
      pins.set(w.id, twins);
    }

    now.on('load', () => {
      ready = true;
      frame(group);
    });
  });

  onDestroy(() => {
    now?.remove();
    then?.remove();
  });

  // The map is an illustration of the text. The text must never wait for it, so
  // pin state and camera are a reaction to the cursor, never a gate on it.
  $effect(() => {
    const live = new Set(group.map((w) => w.id));
    const seen = new Set(
      groups
        .slice(0, cursor)
        .flat()
        .map((w) => w.id),
    );

    for (const [id, els] of pins) {
      for (const el of els) {
        el.classList.toggle('active', live.has(id));
        el.classList.toggle('paired', live.has(id) && paired);
        el.classList.toggle('visited', !live.has(id) && seen.has(id));
      }
    }
    frame(group);
  });

  function startDrag(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const stage = document.getElementById('stage')!;

    const move = (ev: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      wipe = Math.min(94, Math.max(6, ((ev.clientX - r.left) / r.width) * 100));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') cursor = Math.min(groups.length - 1, cursor + 1);
    if (e.key === 'ArrowLeft') cursor = Math.max(0, cursor - 1);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="reader">
  <section id="stage" style={`--wipe:${wipe}%`}>
    <div id="map-now" class="map"></div>

    {#if historical}
      <div id="map-then" class="map"></div>
      <span class="era now">Today</span>
      <span class="era then">{historical.name}</span>
      <div
        id="wipe-handle"
        role="slider"
        tabindex="0"
        aria-label="Compare the modern map with the historical one"
        aria-valuemin="6"
        aria-valuemax="94"
        aria-valuenow={Math.round(wipe)}
        onpointerdown={startDrag}
        onkeydown={(e) => {
          if (e.key === 'ArrowLeft') wipe = Math.max(6, wipe - 4);
          if (e.key === 'ArrowRight') wipe = Math.min(94, wipe + 4);
        }}
      >
        <span class="grip">THEN ⟷ NOW</span>
      </div>
    {/if}
  </section>

  <aside class="panel">
    <header>
      <p class="kicker"><a href={`/${book.id}/`}>{book.title}</a></p>
      <p class="byline">{book.setting.note}</p>
    </header>

    <nav class="strip" aria-label="Progress through the novel">
      {#each groups as g, i (g[0]!.id)}
        <button
          class="tick"
          aria-current={i === cursor ? 'true' : undefined}
          onclick={() => (cursor = i)}
        >
          {g[0]!.progressLabel}
          <span class="dots">
            {#each g as w (w.id)}
              <span class="dot" style={`--c:${book.characters[w.character]!.color}`}></span>
            {/each}
          </span>
        </button>
      {/each}
    </nav>

    <div class="stops">
      {#if paired}
        <p class="simul">
          The novel holds <strong>two places in one sentence</strong>, at one stroke of the clock.
          The characters never meet.
        </p>
      {/if}

      {#each group as w (w.id)}
        <article class="stop" style={`--c:${book.characters[w.character]!.color}`}>
          <span class="who">{book.characters[w.character]!.name}</span>
          <h2 class="place-name" data-certainty={w.placeCertainty}>{w.name}</h2>
          <p class="when">
            {w.progressLabel}{cited ? '' : ` · ${Math.round(w.position * 100)}% through the novel`}
          </p>
          {#if w.passage}
            <blockquote>{w.passage}</blockquote>
          {/if}
          <p class="note">{w.note}</p>
          {#if cited && w.reference}
            <p class="reference">{w.reference}</p>
          {/if}
          <p class="certainty">
            <span class="certainty-tag">{w.placeCertainty.replace('_', ' ')}</span>
            <span
              >{w.certaintyNote ??
                (cited ? 'Named in the book.' : 'Named directly in the text.')}</span
            >
          </p>
          <p class="actions">
            <a href={googleMaps(w.coords)} target="_blank" rel="noopener">Google Maps ↗</a>
            <a href={streetView(w.coords)} target="_blank" rel="noopener">Street View ↗</a>
          </p>
        </article>
      {/each}
    </div>

    <footer class="nav">
      <button disabled={cursor === 0} onclick={() => cursor--}>← Back</button>
      <button class="primary" disabled={cursor === groups.length - 1} onclick={() => cursor++}>
        {cursor === groups.length - 1 ? 'The end' : 'Next stop →'}
      </button>
    </footer>
  </aside>
</div>

<style>
  .reader {
    display: grid;
    grid-template-columns: 1fr 30rem;
    height: 100dvh;
  }

  #stage {
    position: relative;
    overflow: hidden;
    background: var(--paper-3);
  }

  :global(.map) {
    position: absolute;
    inset: 0;
  }

  /* Two synced maps and a clip-path beat an opacity blend: you read this street
     then, and this street now, rather than a muddy average of the two. */
  #map-then {
    clip-path: inset(0 0 0 var(--wipe, 50%));
  }

  /* The map is an illustration. Filtered to ink on paper so the only colour in
     the frame is the historical survey and the pins. */
  :global(#map-now canvas) {
    filter: grayscale(1) sepia(0.16) brightness(1.06) contrast(0.9);
  }
  :global(#map-then canvas) {
    filter: sepia(0.26) contrast(1.05);
  }

  #wipe-handle {
    position: absolute;
    inset-block: 0;
    left: var(--wipe, 50%);
    width: 2px;
    background: var(--paper);
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.15),
      0 0 22px rgb(0 0 0 / 0.2);
    cursor: ew-resize;
    touch-action: none;
    z-index: 5;
  }
  #wipe-handle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 46px;
    height: 46px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: var(--paper);
    box-shadow: 0 2px 14px rgb(0 0 0 / 0.28);
  }
  #wipe-handle .grip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
    font-family: var(--sans);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    color: var(--ink-2);
    white-space: nowrap;
    pointer-events: none;
  }

  .era {
    position: absolute;
    top: var(--s4);
    z-index: 4;
    padding: 0.3rem 0.6rem;
    font-family: var(--sans);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--ink-2);
    background: rgb(245 242 234 / 0.9);
    border: 1px solid var(--rule);
    pointer-events: none;
  }
  .era.now {
    left: var(--s4);
  }
  .era.then {
    right: var(--s4);
  }

  :global(.pin) {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 2.5px solid var(--paper);
    background: var(--ink-3);
    box-shadow: 0 1px 5px rgb(0 0 0 / 0.32);
    cursor: pointer;
    transition:
      transform 0.25s var(--ease),
      background 0.25s var(--ease);
  }
  :global(.pin:hover) {
    transform: scale(1.35);
  }
  :global(.pin.visited) {
    background: var(--c);
    opacity: 0.55;
  }
  :global(.pin.active) {
    background: var(--c);
    transform: scale(1.5);
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--c) 22%, transparent),
      0 2px 10px rgb(0 0 0 / 0.35);
  }
  /* At a declared simultaneity, two pins are live at once. They pulse together,
     because that is the argument. */
  :global(.pin.active.paired) {
    animation: pulse 1.9s var(--ease) infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 24%, transparent);
    }
    50% {
      box-shadow: 0 0 0 15px color-mix(in srgb, var(--c) 0%, transparent);
    }
  }

  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--paper-2);
    border-left: 1px solid var(--rule);
  }
  .panel header {
    flex: none;
    padding: var(--s5) var(--s5) var(--s4);
    border-bottom: 1px solid var(--rule);
  }
  .panel header .kicker a {
    text-decoration: none;
  }
  .byline {
    margin-top: var(--s2);
    font-family: var(--sans);
    font-size: 11px;
    color: var(--ink-3);
  }

  .strip {
    flex: none;
    display: flex;
    gap: 0.3rem;
    padding: var(--s3) var(--s5);
    overflow-x: auto;
    border-bottom: 1px solid var(--rule);
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .tick {
    flex: none;
    min-width: 3.4rem;
    padding: 0.4rem 0.25rem 0.45rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .tick:hover {
    color: var(--ink);
  }
  .tick[aria-current] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 3px;
    margin-top: 0.3rem;
  }
  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--c);
  }

  .stops {
    flex: 1;
    overflow-y: auto;
    padding: var(--s5);
  }
  .simul {
    margin-bottom: var(--s5);
    padding: 0.65rem 0.8rem;
    border-left: 2px solid var(--accent);
    background: var(--accent-soft);
    font-family: var(--sans);
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--ink-2);
  }
  .simul strong {
    color: var(--ink);
  }
  .stop + .stop {
    margin-top: var(--s6);
    padding-top: var(--s6);
    border-top: 1px solid var(--rule);
  }
  .stops :global(blockquote) {
    font-size: var(--step-0);
  }
  .stops .reference {
    margin-top: var(--s2);
    font-family: var(--sans);
    font-size: var(--step--1);
    font-style: italic;
    color: var(--ink-3);
  }

  .nav {
    flex: none;
    display: flex;
    gap: var(--s2);
    padding: var(--s4) var(--s5);
    border-top: 1px solid var(--rule);
    background: var(--paper);
  }
  .nav button {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--rule);
    background: var(--paper-2);
    color: var(--ink-2);
    font-family: var(--sans);
    font-size: 12px;
    cursor: pointer;
  }
  .nav button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .nav .primary {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }

  @media (max-width: 900px) {
    .reader {
      grid-template-columns: 1fr;
      grid-template-rows: 45dvh 1fr;
    }
    .panel {
      border-left: none;
      border-top: 1px solid var(--rule);
    }
  }
</style>
