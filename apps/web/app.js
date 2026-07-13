// Read the Places — Mrs Dalloway prototype.
//
// Two synced maps: the modern city beneath, the 1890s Ordnance Survey above,
// revealed by a draggable wipe. The clock along the top of the reader is the
// index into the book: pick an hour and you are put where the novel is at that
// hour — in two places at once, when the novel is in two places at once.

const BOOK = "../../books/mrs-dalloway";

const basemap = (tiles, attribution) => ({
  version: 8,
  sources: { base: { type: "raster", tiles, tileSize: 256, attribution } },
  layers: [{ id: "base", type: "raster", source: "base" }],
});

const MODERN = basemap(
  ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'
);

// Street View as an outbound link, never an embed. A plain hyperlink to
// google.com/maps is not a Maps Platform API call, so it carries none of the
// "No Use With Non-Google Maps" restrictions that would otherwise forbid
// showing Google imagery beside an OpenStreetMap basemap.
const streetView = ([lon, lat]) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

const $ = (sel) => document.querySelector(sel);

async function main() {
  const [book, waypoints] = await Promise.all([
    fetch(`${BOOK}/book.json`).then((r) => r.json()),
    fetch(`${BOOK}/waypoints.built.json`).then((r) => r.json()),
  ]);

  const colorOf = (id) => book.characters[id].color;
  const nameOf = (id) => book.characters[id].name;

  // Waypoints are grouped by clock time. A group is usually one stop; at noon
  // it is two, in different postcodes. The group — not the waypoint — is the
  // unit the reader moves through.
  const times = [...new Set(waypoints.map((w) => w.clock))].sort();
  const groups = times.map((t) => waypoints.filter((w) => w.clock === t));
  let cursor = 0;

  // ---------------------------------------------------------------- maps

  const view = { center: book.center, zoom: book.zoom, attributionControl: false };
  const now = new maplibregl.Map({ container: "map-now", style: MODERN, ...view });
  now.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  // "Then vs now" is a per-book capability, not a platform guarantee. A free
  // georeferenced historical layer exists for London (National Library of
  // Scotland) and for Bogotá (Map Warper); it does not yet exist for Moscow or
  // Shanghai. A book without one is not broken — it simply has no second era to
  // show, and the wipe disappears rather than presenting an empty grey pane.
  //
  // The gap is contributable: georeferencing a public-domain map on Allmaps or
  // Map Warper is a bounded, non-coding task that yields exactly the XYZ URL
  // this field wants.
  const historical = book.layers?.historical ?? null;
  let then = null;

  if (historical) {
    then = new maplibregl.Map({
      container: "map-then",
      style: basemap([historical.tiles], historical.attribution),
      ...view,
      interactive: false,
    });
    now.on("move", () => {
      then.jumpTo({
        center: now.getCenter(),
        zoom: now.getZoom(),
        bearing: now.getBearing(),
        pitch: now.getPitch(),
      });
    });
  } else {
    document.body.classList.add("no-historical");
  }

  // ---------------------------------------------------------------- wipe

  const stage = $("#stage");
  const handle = $("#wipe-handle");
  const setWipe = (pct) => {
    const v = Math.min(94, Math.max(6, pct));
    stage.style.setProperty("--wipe", `${v}%`);
  };
  setWipe(52);

  const drag = (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    setWipe((x / r.width) * 100);
  };
  const stop = () => {
    window.removeEventListener("pointermove", drag);
    window.removeEventListener("pointerup", stop);
  };
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    window.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", stop);
  });

  // ---------------------------------------------------------------- pins

  // A marker lives inside its own map's container, and #map-then paints above
  // #map-now — so a pin added only to `now` disappears wherever the historical
  // map covers it. Each waypoint therefore gets a pin on *both* maps; the
  // wipe's clip-path reveals whichever side you're looking at, and the pin
  // reads as one continuous marker across the seam.
  const pins = new Map();
  for (const w of waypoints) {
    const twins = [now, then].filter(Boolean).map((map) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.style.setProperty("--c", colorOf(w.character));
      el.title = `${w.clock} — ${w.name}`;
      el.addEventListener("click", () => go(times.indexOf(w.clock)));
      new maplibregl.Marker({ element: el }).setLngLat(w.coords).addTo(map);
      return el;
    });
    pins.set(w.id, twins);
  }

  // --------------------------------------------------------------- clock

  const clock = $("#clock");
  groups.forEach((group, i) => {
    const b = document.createElement("button");
    b.className = "tick";
    b.setAttribute("role", "tab");
    b.innerHTML =
      `${group[0].clock}<div class="dots">` +
      group.map((w) => `<span class="dot" style="--c:${colorOf(w.character)}"></span>`).join("") +
      `</div>`;
    b.addEventListener("click", () => go(i));
    clock.appendChild(b);
  });

  // --------------------------------------------------------------- cards

  // A clock tick can hold several stops simply because they happen around the
  // same time (Clarissa's doorstep and Big Ben, at ten). That is not the same
  // thing as Woolf deliberately holding two places in one sentence. Only the
  // latter — declared in the data as `simultaneous_with` — earns the banner.
  const isSimultaneous = (group) =>
    group.length > 1 && group.some((w) => (w.simultaneous_with || []).length > 0);

  const render = (group) => {
    const banner = isSimultaneous(group)
      ? `<div class="simul-banner">Woolf puts these <b>two places in one sentence</b>, at one stroke of the clock.
         They are ${distance(group[0].coords, group[1].coords)} apart. The characters never meet.</div>`
      : "";

    $("#stops").innerHTML =
      banner +
      group
        .map(
          (w) => `
      <article class="stop" style="--c:${colorOf(w.character)}">
        <div class="who">${nameOf(w.character)}</div>
        <h2>${w.name}</h2>
        <div class="when">${w.clock} · ${Math.round(w.position * 100)}% through the novel</div>
        <blockquote>${w.passage}</blockquote>
        <div class="note">${w.note}</div>
        <div class="certainty">
          <span class="chip ${w.place_certainty}">${w.place_certainty}</span>
          <span>${w.certainty_note || "Named directly in the text."}</span>
        </div>
        <div class="actions">
          <a class="btn" href="${streetView(w.coords)}" target="_blank" rel="noopener">Open in Street View ↗</a>
        </div>
      </article>`
        )
        .join("");
    $("#stops").scrollTop = 0;
  };

  // ---------------------------------------------------------------- move

  // The map is an illustration of the text, so the text must never wait for it.
  // If WebGL is slow, blocked, or absent, the reader still reads.
  let mapReady = false;
  now.on("load", () => {
    mapReady = true;
    camera(groups[cursor]);
  });

  function camera(group) {
    if (!mapReady) return;
    if (group.length > 1) {
      // Frame both at once. The gap between them is the point.
      const b = group.reduce(
        (acc, w) => acc.extend(w.coords),
        new maplibregl.LngLatBounds(group[0].coords, group[0].coords)
      );
      now.fitBounds(b, { padding: 110, duration: 1600, maxZoom: 14.4 });
    } else {
      now.flyTo({ center: group[0].coords, zoom: 15.6, duration: 1500, essential: true });
    }
  }

  function go(i) {
    cursor = Math.min(groups.length - 1, Math.max(0, i));
    const group = groups[cursor];

    clock.querySelectorAll(".tick").forEach((t, j) => {
      t.setAttribute("aria-selected", String(j === cursor));
    });
    clock.children[cursor]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });

    const live = new Set(group.map((w) => w.id));
    const seen = new Set(groups.slice(0, cursor).flat().map((w) => w.id));
    pins.forEach((twins, id) => {
      for (const el of twins) {
        el.classList.toggle("active", live.has(id));
        el.classList.toggle("paired", live.has(id) && isSimultaneous(group));
        el.classList.toggle("visited", !live.has(id) && seen.has(id));
      }
    });

    camera(group);
    render(group);
    $("#prev").disabled = cursor === 0;
    $("#next").disabled = cursor === groups.length - 1;
    $("#next").textContent = cursor === groups.length - 1 ? "The end" : "Next stop →";
  }

  $("#prev").addEventListener("click", () => go(cursor - 1));
  $("#next").addEventListener("click", () => go(cursor + 1));
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(cursor + 1);
    if (e.key === "ArrowLeft") go(cursor - 1);
  });

  $("#masthead .book").textContent = book.title;
  $("#masthead .byline").textContent =
    `${book.author} · ${book.setting.note}`;
  if (historical) $(".era-tag.then").textContent = historical.name;

  go(0);
}

// Rough great-circle distance, good enough to say "two and a half miles apart".
function distance([lon1, lat1], [lon2, lat2]) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(a));
  return `${miles.toFixed(1)} miles`;
}

main();
