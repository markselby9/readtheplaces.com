<div align="center">

# Read the Places

**Not a map of books — a book you can walk through.**

An open, contributor-driven atlas of the real places in novels,
presented in the order the story happens.

[Design](docs/DESIGN.md) · [Contributing](CONTRIBUTING.md) · [Licence](LICENSE)

</div>

---

## The idea

The unit is not a pin. It is a **waypoint**: a place, at a position in the
narrative, with the passage that puts it there, and an honest statement of how
sure we are that it is the right place.

Narrative **order** is the spine. That is the whole difference. A map with a
chapter filter is a pin map, and pin maps already exist.

Here is what an ordered one can do, and a pin map cannot. *Mrs Dalloway*, at
noon:

> …twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed,
> **and the Warren Smiths walked down Harley Street.**

One sentence. One stroke of the clock. **Two places 1.7 miles apart**, two people
who never meet, one of whom will be dead within six hours. Click 12:00 and the
map holds both.

## Run it

```sh
python3 tools/validate.py          # checks every quote, and builds the data
python3 -m http.server 8420
open http://localhost:8420/apps/web/index.html
```

No build step, no API key, no account.

The first command is not optional: the app reads `waypoints.built.json`, which
is **derived** and therefore not committed. Validation *is* the build — you
cannot get the data without every quote in it having been checked against the
novel first. That is on purpose.

*(This is the prototype. The Astro rewrite is next — see
[`docs/DESIGN.md`](docs/DESIGN.md) §7.)*

## Verify it

Every claim a waypoint makes about a book is checked against the book.

```sh
python3 -m unittest discover -s tools -p 'test_*.py'
```

Each waypoint carries a `quote_anchor` — a verbatim string that must appear
**exactly once** in `source.txt`. From its offset we derive `position`, how far
through the novel the waypoint falls.

**Position, not chapter, is the ordering key.** Chapter numbering varies between
editions and translations; a quote does not. A Russian or Chinese edition brings
its own text and its own anchors in its own language, and the same code produces
the same 0.0–1.0 spine. That is what makes *any book, any country* tractable
rather than aspirational.

The build also fails if a book's accent colour is not a real quotation from its
own text, or if it misses WCAG AA. *Mrs Dalloway* is green because she "laid her
green dress on her bed."

## Find work

```sh
python3 tools/extract.py mrs-dalloway --geocode
```

Mines the novel for every place it mentions and hands you a queue — 57 for
*Mrs Dalloway*, with the sentence, the position, and suggested coordinates.

It never writes a waypoint. It writes a **worklist**. Its top suggestion for
*Mrs Dalloway* is Bourton, the Dalloways' country house — which the geocoder
confidently placed in *Hillingdon*. Only a reader catches that.

**We automate discovery. We never automate assertion.**

## How it's built

| | |
|---|---|
| Base map | MapLibre GL + OpenStreetMap. Free, keyless, global, forkable. |
| Historical | Per book, optional. Free NLS tiles for Britain; Allmaps / Map Warper elsewhere. |
| Street view | An outbound **link** to Google — never an embed ([why](docs/DESIGN.md#42-street-view-is-a-link-and-that-is-a-legal-requirement)). |
| Walk pages | **Static map plates.** Browsers cap WebGL contexts at ~16 ([why](docs/DESIGN.md#44-the-walk-page-uses-no-webgl-and-this-is-not-a-preference)). |
| Type | Literata (for the novel) · Atkinson Hyperlegible (for the apparatus). |
| Text | [Standard Ebooks](https://standardebooks.org), public domain. |

## Books

- ***Mrs Dalloway*** — Woolf, 1925. London, one day, kept by clocks. 15 waypoints.
- ***Crime and Punishment*** — Dostoevsky, 1866. *Next.* Chosen to break every
  assumption the pilot makes: not English, not clock-ordered, and full of
  Dostoevsky's censored addresses ("S— Place") that force the `disputed` label.

If both render with no book-specific code, the design is general. That is the
acceptance test.

## Contributing

**You do not need to code to do the most valuable work here.** The software is a
weekend; the dataset is the asset.

You will never be asked to upload a photograph. You write data — a coordinate, a
verbatim quote, a source, and an honest label saying how sure you are.

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), or take one of the
[historical-map issues](.github/ISSUE_TEMPLATE/historical-map.md) — Moscow,
Shanghai and St Petersburg have no historical layer at all, and closing that gap
needs no code and gives a whole novel a second era.

## Status

Prototype. One book, 15 waypoints, reviewed by nobody but its author. Nothing
here is settled.

## Licence

Code [MIT](LICENSE). Book data [CC BY-SA 4.0](LICENSE) — share-alike,
deliberately: the dataset should stay open even if someone builds a better
interface than ours.

Texts, translations and map imagery are separate rights objects; see each book's
`rights` block. We say **rights-reviewed**, never "licence-clean".
