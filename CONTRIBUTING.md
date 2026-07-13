# Contributing

There are two ways in, and they are genuinely separate. You do not need to be
able to code to do the most valuable work here.

---

## Adding a place (no code required)

**This is the work that matters.** The software is a weekend; the dataset is the
asset.

You do not need to find places from scratch. Run the extractor and it hands you
a queue — every place the book mentions, with the sentence it appears in and
where it falls in the text:

```sh
python3 tools/extract.py mrs-dalloway --geocode
```

For *Mrs Dalloway* that produces 57 candidates. Your job is to take one and
answer the questions a machine cannot:

| The machine gives you | You decide |
|---|---|
| the place name and every mention | **is this actually a place, or a red herring** |
| the exact sentence | **where it really is** — confirm the pin or move it |
| where it falls in the book | **how sure we are** — and why |
| suggested coordinates | **why it matters** — two sentences |

Then add it to `books/<slug>/waypoints.json` and open a pull request. CI will
tell you if you got the quote wrong.

Your editor will help: `schema/waypoint.schema.json` gives you autocomplete,
field descriptions and enum hints on `waypoints.json` (wired up for VS Code in
`.vscode/settings.json`; point any other editor at the same file).

### Why we never trust the machine

The extractor's top suggestion for *Mrs Dalloway* is **Bourton** — the Dalloways'
country house, the place Clarissa remembers being eighteen, the emotional origin
of the whole novel.

The geocoder confidently returned *"Bourton Close, Hayes, London Borough of
Hillingdon."*

It is not a suburban close in Hillingdon. It is not in London at all. Only
someone who has read the book would ever catch that.

**We automate discovery. We never automate assertion.** That is why every
waypoint needs a person.

### The rules, and why they exist

**Every claim must be checkable against the book.** Each waypoint carries a
`quote_anchor` — a verbatim string that must appear *exactly once* in the novel.
CI finds it and derives the waypoint's position in the text. If your quote is not
in the book, the build fails. You cannot merge a place the book does not support.

**Say when you are guessing.** Literary geography is full of guesses, and hiding
them is what makes a pin map. Every waypoint declares one of:

- `explicit` — the author named this place;
- `inferred` — you worked it out, and you say how;
- `inspired_by` — a real place behind a fictional one;
- `disputed` — scholars disagree, and we show the disagreement.

Anything that is not `explicit` **must** carry a `certainty_note` explaining the
guess. CI enforces this. Clarissa's house is `inferred`: Woolf never gives an
address, and we say so on the card, where the reader can see it.

That disclosure is the whole difference between a gazetteer and a pin map.

**We never ask you to upload a photograph.** Not one, ever. It is an unbounded
ask and a rights minefield. You write data — a coordinate, a quote, a source, an
honest label. The imagery comes from open map layers and a link to Street View.

### Adding a historical map (the best non-coding task)

"Then vs now" only works for books whose city has a georeferenced historical map.
Today: London has one, Bogotá has 58 — **Moscow, Shanghai and St Petersburg have
none.**

That is not a permanent defect. It is a job.

Take a public-domain historical map of the city, georeference it on
[Allmaps](https://allmaps.org) or [Map Warper](https://mapwarper.net), and you
get an XYZ tile URL. Drop it into the book's `layers.historical` and a whole era
appears under the modern city.

No code. Real craft. Enormous payoff.

---

## Contributing code

```sh
git clone …  &&  cd readtheplaces.com
python3 tools/validate.py     # validation IS the build — it emits the data the app reads
python3 -m http.server 8420
open http://localhost:8420/apps/web/index.html
```

No install, no API key, no account.

> **This is the prototype**, and it is being rewritten. The target stack is
> Astro 7 + Svelte 5 + Bun, with the basemap self-hosted as PMTiles — see
> [`docs/DESIGN.md`](docs/DESIGN.md) §7. Until that lands, `bun install` will not
> do anything, because there is nothing to install yet. The data model, the
> validator and the extractor all carry over unchanged; only `apps/web` is being
> replaced.

Read [`docs/DESIGN.md`](docs/DESIGN.md) first. It is not a formality — it records
decisions with measurements behind them, and it will save you from proposing
things we have already tested and rejected:

- **Why Street View is a link, not an embed.** Google's Maps Platform terms
  §3.2.3(e) forbid displaying "Street View imagery and non-Google Maps on the
  same screen." An embedded panorama beside our OpenStreetMap basemap is named,
  explicitly, as prohibited. A plain hyperlink is not an API call and carries
  none of that.
- **Why the walk page has no live maps.** Browsers cap simultaneous WebGL
  contexts at ~16. Fifteen stops × two eras = 31 maps; we measured 16 alive and
  15 dead canvases. The walk page uses static plates, built by `tools/plates.py`.
- **Why the basemap is not Google's.** It would require every contributor to set
  up a *billed* Google Cloud project just to run the repo, and it has coverage
  gaps in mainland China.
- **Why colours are quotations.** A book's accent must be citable in its own
  text — *Mrs Dalloway* is green because she "laid her green dress on her bed" —
  and the build fails if the quote is not there, or if the colour misses WCAG AA.

### Branching

GitHub Flow. `main` is always deployable.

```
main ← PR ← your-branch
```

Short-lived branches, one PR, squash merge. CI must pass. A merged waypoint is
live within a minute, which is the point: contributors should see their place
appear.

### Before you open a PR

```sh
python3 -m unittest discover -s tools -p 'test_*.py'   # the contract's own tests
python3 tools/validate.py                              # every quote checked against the novel
```

The validator has 30 tests, standard library only — no install. It is the thing
CI points at and the thing this file promises you, so it is tested to *fail* when
it should, not merely to pass.

---

## Reviewing

Book maintainers own a book's queue. CI has already checked everything
mechanical — the quote exists, it is unambiguous, the guess is explained, the
coordinates are not transposed, the colour is legible.

So a review only ever asks two questions:

1. **Is the pin right?**
2. **Is the note good?**

That should take thirty seconds. If it is taking fifteen minutes, CI is missing a
check — open an issue about the check, not about the PR.

---

## Licensing your contribution

Code is MIT. Book data is CC BY-SA 4.0 — share-alike, deliberately, because the
dataset should stay open even if someone builds a better interface than ours. By
contributing you agree to license your work under those terms. See
[`LICENSE`](LICENSE).
