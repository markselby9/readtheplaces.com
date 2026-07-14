# Read the Places, design

**Not a map of books, a book you can walk through.**

Status: implemented 2026-07-13. Supersedes the "Bookwalk" research memo.

---

## 1. What this is

An open, contributor-driven atlas of the real places in novels, presented in the
order the story happens.

The unit is not a pin. It is a **waypoint**: a place, at a position in the
narrative, with the passage that puts it there, and an honest statement of how
sure we are that it is the right place.

### What it is not

- Not a walking-route app. We do **not** compute or draw a path between
 waypoints. The reader is shown a place and left to explore. "Walk" is a
 metaphor, not a feature.
- Not a map of books. A map with a chapter filter is a pin map, and pin maps
 already exist (The Book Trail; Placing Literature, dormant since ~2016).
- Not a consumer growth product. See §9.

### The one thing that makes it different

Narrative **order** is the spine. Dropping the path costs nothing; dropping the
order collapses the project into a pin map.

The proof is in the pilot. At noon in *Mrs Dalloway*:

> …twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed,
> **and the Warren Smiths walked down Harley Street.**

One sentence, one stroke of the clock, two places 1.7 miles apart, two people
who never meet. A pin map physically cannot express this. An ordered one can,
and the prototype does: both waypoints go live, both pins pulse, both passages
appear, the map frames the gap between them.

---

## 2. Goals and non-goals

**Goals** (in priority order, as stated by the owner):

1. Open source; a stranger can clone it, run it, and contribute.
2. Technically interesting.
3. Very good UX.
4. Street view wherever it exists.
5. Any book, any country. China, Colombia, Russia, India.

**Explicit non-goals:** demand validation, revenue, growth metrics, route
computation, GPS arrival triggers, user accounts.

**Success:** a stranger contributes a good waypoint to a book we did not seed.

---

## 3. The data model

Book data lives in `books/<slug>/` and is useful **without** this interface. The
app is a weekend; the dataset is the asset.

```
books/<slug>/
 book.json rights, characters, map layers, ordering key
 source.txt the public-domain text, as published
 waypoints.json hand-authored waypoints
 candidates.json machine-generated worklist (see §6)
```

### 3.1 Position, not chapter, is the ordering key

The research memo worried that chapter numbering varies by edition and
translation, breaking both ordering and spoiler-gating. So we do not use
chapters.

Every waypoint carries a **`quoteAnchor`**: a verbatim string that must appear
**exactly once** in `source.txt`. The Zod schema (§7.3) finds it and derives:

```
position = offset(quoteAnchor) / len(source.txt) # 0.0 … 1.0
```

This is edition-independent, machine-verifiable, and **language-independent**. A
Russian or Chinese edition supplies its own `source.txt` and its own anchors in
its own language; the same code produces the same 0.0–1.0 spine. No schema
change. This is what makes "any book, any country" tractable rather than
aspirational.

The build rejects any waypoint whose quote cannot be found, or which matches
more than once (ambiguous, lengthen it). **You cannot merge a place the book
does not support.**

### 3.2 The progress label is book-specific; the spine is not

*Mrs Dalloway* is ordered by clocks. *Crime and Punishment* is ordered by
chapters. The app must not hardcode either.

- `position` (derived, 0.0–1.0), **the universal spine.** Always present.
 Sorting, spoiler-gating and the progress strip all key off this.
- `progress_label` (authored, free text), what a human is shown: `"12:00"` for
 *Mrs Dalloway*, `"Part 1, ch. 6"` for *Crime and Punishment*.
- `book.orderingKey`, `"clock" | "chapter" | "position"`. Presentation only:
 it tells the UI how to render the strip and how to group ties.

Waypoints sharing a `progress_label` form one **stop group**, which is the unit
the reader moves through.

### 3.3 Simultaneity is declared, never inferred

Two waypoints at the same label are usually just "about the same time"
(Clarissa's doorstep and Big Ben, at ten). That is *not* the same as an author
deliberately holding two places in one sentence.

Only `simultaneousWith: [<id>, …]`, mutual, and validated as mutual, earns
the paired treatment. The prototype originally keyed off group size and fired
the banner at 10:00, which was wrong. The data must say it.

### 3.4 Uncertainty is displayed, never hidden

```jsonc
"placeCertainty": "explicit" | "inferred" | "inspired_by" | "disputed",
"certaintyNote": "required unless explicit, why you placed it there"
```

Clarissa's house is `inferred`: Woolf never gives an address. We say so, on the
card, where the reader sees it. Dostoevsky censored his own street names ("S, 
Place", "K, Bridge") and scholars disagree about the reconstructions, those are
`disputed`, and the disagreement is shown rather than resolved.

This disclosure is the entire difference between a gazetteer and a pin map, and
it is enforced by CI, not by good intentions.

### 3.5 Rights are per-object, not per-book

The work, the translation, the transcription and the imagery are four separate
rights objects. `book.json.rights` records each. We say *rights-reviewed*, never
"licence-clean".

---

## 4. The reader

Mobile-first. The map is context; **the passage is the subject.**

Each stop shows: character, place name, progress label, position, the verbatim
passage, an editorial note, a certainty chip with its note, and a Street View
link. Primary action: *Next stop*.

**The text never waits for the map.** If WebGL is slow, blocked or absent, the
reader still reads. (The prototype originally gated the first render on the
map's `load` event; fixed.)

### 4.1 Maps and imagery

| Layer | Source | Notes |
|---|---|---|
| Base map | MapLibre GL + self-hosted PMTiles | Free, keyless, global, forkable (§7.4) |
| Historical | per book, optional | XYZ tiles; see §4.3 |
| Street view | Google, **as a link** | Never embedded; see §4.2 |
| Photographs | **none** | Contributors never upload images |

### 4.2 Street View is a link, and that is a legal requirement

Google Maps Platform ToS §3.2.3(e), *No Use With Non-Google Maps*:

> Customer will not use the Google Maps Core Services with or near a non-Google
> Map … For example, Customer will not … **display Street View imagery and
> non-Google Maps on the same screen**.

An embedded panorama beside our OSM map is named, explicitly, as prohibited.

A plain hyperlink to `google.com/maps` is **not a Core Services call**, no key,
no API, no agreement, no clause. So we deep-link:

```
https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}
```

This gets Street View's worldwide coverage without surrendering the open stack
and without forcing every contributor to create a billed Google Cloud project.

The alternative, an all-Google app, was rejected: it has no mainland China
coverage, it is metered, and it would make the repo un-runnable for anyone who
has not set up billing. That directly contradicts Goal 1.

### 4.3 "Then vs now" is per-book, not a platform promise

Measured coverage of free, city-scale georeferenced historical maps:

| Bogotá | Chicago | NYC | London | Paris | Moscow | Shanghai | St Petersburg |
|---|---|---|---|---|---|---|---|
| 58 | 14 | 11 | 9 | 8 | **0** | **0** | **0**\* |

\* Map Warper lists four for St Petersburg; on inspection they are modern
marathon route maps. Verify tiles, never trust a catalogue.

So `book.layers.historical` is **optional**. A book with a layer gets a
draggable wipe between eras. A book without one gets a single map, no wipe, no
empty pane, verified working. Nothing else changes.

Sources, all open, all XYZ: **national libraries** (NLS covers Britain free),
**Map Warper**, and **Allmaps** (georeference any IIIF map from any library, 
the one that scales).

**The gap is contributable.** "Moscow has no 1812 layer" is a good first issue,
not a permanent defect, and it is the best non-coding task in the project.

### 4.4 The walk page uses no WebGL, and this is not a preference

A walk has fifteen stops. A live MapLibre map on each, modern plus historical, 
is thirty WebGL contexts. **Browsers cap simultaneous WebGL contexts at about
sixteen and silently kill the rest.** Measured on the mockup: 31 requested, 16
alive, **15 dead canvases**.

So the walk page renders **static map plates**, composited at build time by
`bun run plates` from the same tile sources the live reader uses. A retina
640×400 plate is ~60–90 KB of WebP.

This is the right architecture regardless of the limit. It makes Astro's "zero
JS by default" literally true on the surface that must be indexed and shared; it
gives `<img>` lazy-loading, `srcset` and intrinsic sizing for free; there is no
layout shift and no map that fails to paint; and the plates double as the OG
images for link previews.

**Live MapLibre is reserved for the one genuinely interactive surface: the
reader.**

### 4.5 Every stop always shows a modern map

The modern plate is unconditional, a stop is never map-less. The historical
plate is **additive**, and absent for books that have no layer.

Every stop also carries **two outbound links**: *Open in Google Maps* and *Open
in Street View*. Maps is the one we can always offer; Street View has holes (no
mainland China, partial India), so it is offered on top rather than relied upon.
Both are hyperlinks, never embeds, see §4.2.

### 4.6 Type

- **Literata** (variable, optical size 7–72) for everything the author wrote.
 Commissioned for Google Play Books: a typeface designed to read novels on
 screens, whose letterforms adapt between a caption and a display line.
- **Atkinson Hyperlegible** for the apparatus, labels, progress rail,
 certainty, navigation. Built by the Braille Institute for legibility.

The pairing has a thesis: *the novel is set in a typeface made for reading; the
apparatus in one made for seeing.* Explicitly **not** Cormorant Garamond (the
default "literary" choice, and fragile at reading sizes) and **not** Inter.

### 4.7 A book's colour is a quotation

Not chosen from a palette, **taken from the text, and citable**.

```jsonc
"palette": {
 "accent": "#40634A",
 "accentSourceQuote": "laid her green dress on her bed"
}
```

*Mrs Dalloway* is green because she laid her green dress on her bed. *Crime and
Punishment* will be **Petersburg yellow**, Sonya's yellow passport, the
pawnbroker's yellow room, the faces "wasted" and jaundiced; yellow *is*
corruption in that novel, and the scholarship is unambiguous.

**The validator enforces both halves.** It fails the build if a colour's
justifying quote is not in the novel, the colour would be decoration, not a
quotation, and it fails the build if the colour does not clear **WCAG AA 4.5:1
on paper**. That second check immediately caught Peter Walsh's ochre at 3.54:1;
it was darkened to 5.02:1.

This is how a multi-book atlas lets each book feel like itself without the
product fragmenting: structure, type and layout are constant, and **only the
accent moves, only where the text licenses it.**

### 4.8 Certainty is set, not badged

`explicit` / `inferred` / `disputed` are typography, not coloured chips. An
inferred place name is set in *italic with a dotted underline*, its note in small
caps, the way a critical edition marks an emendation. At noon the reader sees
*“Westminster, the green dress”* (italic, inferred) beside *“Harley Street, the
appointment”* (upright, explicit) and reads the epistemology at a glance, with
no legend.

### 4.9 The map is an illustration, not a UI surface

Default OSM styling, blue water, yellow motorways, green parks, fights the page
on every tile. Both the plates and the live map are rendered **near-monochrome,
ink on warm paper**, so the only colour in the frame comes from the historical
survey and the character pins. The city recedes; the book advances.

### 4.10 Art direction

**The prose measure of a critical edition, on the spine of a timeline.** The
progress rail runs down the left margin with the label struck against it
(`12:00`, or `Part 1, ch. 6`, it takes either), a bead on the rule per stop, and
**the rule forks at a simultaneity**. Prose holds a ~66ch measure; the plate sits
beside it; certainty is a footnote.

Two directions were built and rejected:

- **The Atlas** (full-bleed historical survey as hero), beautiful, but it makes
 the historical layer *structural*, and Moscow, Shanghai and St Petersburg have
 none. It would look broken for exactly the books we care about. Fails §5's
 generality test.
- **The Hours** (the page darkens from morning to night as you scroll), the most
 original, and it only works for a novel spanning one day, so it cannot carry
 *Crime and Punishment*. It also produced a measured mid-transition state with
 **failing contrast** for ~900 ms. Its timeline spine was kept; the rest was not.

**Dark mode is deferred.** Historical maps are sepia photographic scans; they
cannot be inverted without becoming negatives. The stage stays on paper. Revisit
with a real solution, not a toggle.

---

## 5. Books

**Pilot: *Mrs Dalloway*** (Woolf, 1925). Built. 15 waypoints verified. Clock-
ordered, compact London, free NLS historical layer, PD in the US and UK.
Dalloway Day (third Wednesday of June, Virginia Woolf Society of Great Britain)
is a real annual audience and a launch moment.

**Book #2: *Crime and Punishment*** (Dostoevsky, 1866; Garnett translation).
Chosen to break the pilot's assumptions on purpose:

- **not English** → proves quote anchors cross languages;
- **chapter-ordered** → proves the spine is not a clock trick;
- **censored addresses** ("S, Place") → exercises `disputed`, which *Mrs
 Dalloway* never does;
- **real street numbers** (Griboyedov Canal 104, 73, 67; Stolyarny 19) and the
 famous **730 steps** from Raskolnikov's room to the pawnbroker's, which
 nobody can walk in 730 steps;
- ships **without** a historical wipe until someone georeferences a map.

If the app renders both books with no book-specific code, the design is general.
That is the acceptance test for the whole project.

---

## 6. Contribution: triage, not authoring

This is where the project lives or dies. The research memo scored content
production 5/10, its lowest score, and it was right to.

**Authoring** a waypoint from nothing is an hour of research. Almost nobody will
do it. **Triaging** a candidate is two minutes. Plenty of people will.

So `bun run extract` mines `source.txt` and produces a **worklist**, never a
waypoint:

| Field | Filled by | How |
|---|---|---|
| `name`, `mentions` | machine | regex + per-book gazetteer |
| `position` | machine | offset of the mention |
| `proposed_passage` | machine | the sentence containing it |
| `coord_suggestions` | machine | Nominatim, *suggestions only* |
| `coords` | **human** | confirm, or drag the pin |
| `placeCertainty` | **human** | explicit / inferred / inspired_by / disputed |
| `certaintyNote` | **human** | why you placed it there |
| `character` | **human** | whose thread |
| `note` | **human** | two sentences: why this place matters |

For *Mrs Dalloway* this produced **57 candidates**, 46 awaiting triage. That
queue is the contributor onboarding.

### 6.1 Why the machine is never trusted

The extractor's top candidate is **Bourton**, the Dalloways' country house, the
emotional origin of the novel. Nominatim confidently returned *"Bourton Close,
Hayes, London Borough of Hillingdon."*

Catastrophically wrong, and only a reader would ever catch it. **Automate
discovery; never automate assertion.**

### 6.2 The path from a stranger to a merged waypoint

```
in-app triage queue → drag pin, set certainty, write note → Submit
 → GitHub App opens the PR on their behalf (no git required)
 → CI runs the build; the Zod schema gates it (quote exists? unique?
 certainty note present? coords sane?), see §7.3
 → book maintainer reviews editorial quality only → merge
```

CI does **all** mechanical review, so a human reviewer only ever judges "is this
note good, and is this pin right?" That is 30 seconds, not 15 minutes, and it
is what makes review scale.

### 6.3 Scaling

- **Per-book maintainers.** Whoever brings a book owns its queue (Debian's
 model). Review capacity grows with the number of books instead of bottlenecking
 on one person.
- **Ship per-waypoint, not per-book.** `editorialStatus: draft | reviewed |
 verified`. A book goes live with 5 waypoints and grows. Nothing kills a
 contributor project faster than "the book isn't finished, so nothing is live."
- **Contributors write data, never images.** No uploads, ever, unbounded ask,
 rights minefield.

---

## 7. Architecture

### 7.1 Why not vanilla

The prototype is client-rendered vanilla JS with no build step, chosen so that
anyone could clone and run it. That reasoning was wrong, for two reasons.

**It defends a door that has moved.** The no-build-step rule existed so a
non-coding reader could contribute. The in-app triage queue (§6.2) serves that
person far better, they never touch the repo at all. The only people who run an
install are code contributors, who do not need protecting from `bun install`.

**And it forfeits the distribution channel.** The research memo was explicit that
this grows through *individual shareable walks*, not a homepage. A client-
rendered SPA has no server-rendered text, no per-walk URL and no OG image: it is
invisible to search engines and ugly in a link preview. That is a strategic
failure, not a stylistic one.

So: every walk is a **static, indexable page**, and the map is an island.

### 7.2 The stack

| Layer | Choice | Version |
|---|---|---|
| Runtime / package manager | **Bun** | 1.2 |
| Site framework | **Astro** | 7 |
| Interactive islands | **Svelte** (runes) | 5 |
| Map renderer | **MapLibre GL JS** | 5 |
| Basemap | **Protomaps / PMTiles** on Cloudflare R2 | pmtiles 4, @protomaps/basemaps 5 |
| Schema & validation | **Zod** via Astro content collections | 4 |
| Unit tests | **Vitest** | 4 |
| End-to-end | **Playwright** | 1.6x |
| Hosting | **Cloudflare** Pages + Workers |, |

```
readtheplaces/
 apps/web/ Astro
 src/pages/[book]/[stop].astro static, indexable, OG image per stop
 src/islands/Map.svelte the only shipped JS
 src/content.config.ts Zod schema, see 7.3
 packages/schema/ Zod → emitted JSON Schema (editor autocomplete on raw JSON)
 packages/tools/ extract · validate (TypeScript, run by Bun)
 books/<slug>/ book.json · source.txt · waypoints.json · candidates.json
 infra/pr-bot/ Cloudflare Worker + Octokit, opens PRs for the triage queue
```

**Rejected:** Next.js (React/RSC is the wrong tool for a content site), Leaflet
(superseded by MapLibre), Mapbox (proprietary), and **any database**. Git *is*
the database and the pull request *is* the editorial review workflow, that is
the contributor model, not an implementation detail.

### 7.3 The schema is the type system

Astro content collections validate with Zod at build time, so the waypoint
contract stops being a script that runs in CI and becomes the type system:

```ts
export const waypoint = z.object({ … }).superRefine((wp, ctx) => {
 const hits = occurrences(sourceText(wp.book), normalise(wp.quoteAnchor));
 if (hits === 0) ctx.addIssue({ code: "custom", message: "Not in the text." });
 if (hits > 1) ctx.addIssue({ code: "custom", message: "Ambiguous, lengthen it." });
});
```

**The build fails if you misquote Woolf.** `position` is derived in the same
pass and typed into every page. Contributors editing raw JSON get red squiggles
in their editor from the emitted JSON Schema. This replaces `the Zod schema`;
the *logic* carries over unchanged, the language does not.

### 7.4 Basemap

The planet ships as a **single PMTiles file** on Cloudflare R2, read directly by
MapLibre over HTTP range requests. No tile server, no per-tile billing, no CARTO
dependency, and forks can point at their own bucket or the public one.

The public OSM raster endpoint is never a production default. The prototype's
CARTO tiles are a development convenience and get removed.

### 7.5 Motion

Stop-to-stop navigation uses the native **View Transitions API**, no library.
The map flies while the passage cross-fades, which is the one place this project
should feel filmic rather than app-like.

---

## 8. Testing

- **The Zod schema is the contract** and runs on every build and every PR. It
 catches: quote not in text, ambiguous quote, passage not containing its own
 anchor, missing certainty note on a guess, transposed lat/lon, unknown
 character, non-reciprocal simultaneity, missing source.
- **Playwright** covers the three things that actually broke in the prototype:
 the noon simultaneity fires (and does *not* fire at 10:00), pins survive the
 wipe seam, and a book with no historical layer shows no empty pane.
- **Acceptance test for generality:** both books render with zero book-specific
 code.
- **Manual:** the reader renders with WebGL disabled; a book with no historical
 layer shows no wipe and no empty pane (both verified in the prototype).

---

## 9. What this is not, commercially

Per the research memo, and accepted: this is a cultural/open-source project, not
a venture-scale business. Do not put a literary-tourism TAM slide anywhere near
it. Plausible funding, if ever wanted: institutional grants, museum and
tourism-board commissions, publisher editions. Not subscriptions, not ads.

The open dataset will likely create more institutional value than the app
creates revenue. Build accordingly.

---

## 10. Open questions

- Spoiler-gating: designed (`position` supports it) but **not built**. The
 prototype assumes a post-read or never-read visitor, which is the honest
 default. Revisit only if readers actually ask.
- Audio: deferred. No LibriVox recording of *Mrs Dalloway* is confirmed.
- The pilot's historical layer is the 1890s OS survey, thirty years before the
 novel. Disclosed on the map, not papered over.

## 11. What carries over from the prototype

The prototype (vanilla JS, `tools/*.py`) is a proof, not a foundation. §7.1
replaces its UI layer entirely.

**Carries over, the expensive parts:**
- the data model and the 15 verified *Mrs Dalloway* waypoints;
- the validation *logic* (ported from Python to the Zod schema);
- the extractor logic and its per-book gazetteer;
- the wipe (two synced maps + `clip-path`), the Google Maps / Street View
 deep-links, the pins-on-both-maps fix, and graceful degradation with no
 historical layer;
- the design system in §4.4–4.10 and `design/tokens.css`: type, the
 book-sourced palette and its two validators, static plates, certainty-as-
 typography, and the ink-on-paper map treatment.

**Rebuilt:** `apps/web` (~600 lines of JS/CSS) in Astro + Svelte.

**Must change first:** the prototype hardcodes `clock` as the ordering field.
§3.2 replaces it with `position` + `progress_label` + `book.orderingKey`.
*Crime and Punishment* cannot be represented otherwise, so this is task one.

---

## 12. Deployment

Cloudflare Workers, serving static assets. There is no Worker script: the site is
43 static pages and some images, served from the edge.

Config lives in `wrangler.jsonc`. The build is:

```
bun install && bun run plates && bun run build
```

`bun run plates` composites the static map images. They are derived from the book
data and gitignored, so they are built on every deploy rather than committed.

**The build is the validator.** A book whose quotes are not in its novel fails
here, and nothing reaches the edge.

Deployment is Cloudflare's own git-connected Workers Build, configured in the
dashboard. There is deliberately no deploy workflow in this repo: two deploy
paths racing each other is worse than one, and the dashboard build needs no
secrets.

`_headers` and `_redirects` are in `apps/web/public/` and are natively supported
by Workers Static Assets. The www-to-apex redirect is also configured in the
Cloudflare dashboard; keeping it in the repo as well means a fork deploying
somewhere else gets the same canonical behaviour without having to know about it.
