---
name: Add a historical map layer
about: Give a book its "then vs now", no code required
title: 'Historical layer: <city>'
labels: ['good first issue', 'data', 'historical-map']
---

## The gap

"Then vs now" only works where a georeferenced historical map exists as XYZ
tiles. Measured coverage today:

| Bogotá | Chicago | New York | London | Paris | **Moscow** | **Shanghai** | **St Petersburg** |
|---|---|---|---|---|---|---|---|
| 58 | 14 | 11 | 9 | 8 | **0** | **0** | **0** |

Books in cities with a zero ship without the wipe. Nothing is broken, there is
simply no second era to show. **Closing that gap is the best non-coding task in
this project.**

## What to do

1. Find a public-domain historical map of the city, from roughly the book's era.
 National libraries, university collections and the Internet Archive are the
 usual sources. (Beware: Map Warper's four "St Petersburg" maps turn out to be
 modern *marathon route* maps. Always look at the tiles, never trust the
 catalogue entry.)

2. Georeference it, pin points on the old map to the same points on a modern
 one, using either:
 - **[Allmaps](https://allmaps.org)**, for any map published via IIIF, which
 most major libraries now do. This is the one that scales.
 - **[Map Warper](https://mapwarper.net)**, upload a scan directly.

3. You get an XYZ tile URL. Check it actually serves tiles at the book's
 locations, at zoom 15–17.

4. Add it to `books/<slug>/book.json`:

```jsonc
"layers": {
 "historical": {
 "name": "…, 1860s",
 "tiles": "https://…/{z}/{x}/{y}.png",
 "minzoom": 10,
 "maxzoom": 20,
 "attribution": "…",
 "licence": "…",
 "note": "How far from the book's date is it, and does that matter?"
 }
}
```

5. Open a PR. Say in it how close the map's date is to the novel's, we disclose
 that on the page rather than papering over it. The *Mrs Dalloway* layer is
 1890s for a 1923 book, and the page says so.

## Book

<!-- which book, which city, which era -->

## Candidate map

<!-- link to the source scan, and its rights status -->
