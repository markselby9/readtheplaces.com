# Contributing

There are two ways in, and they are genuinely separate. You do not need to be
able to code to do the most valuable work here.

---

## Adding a place (no code required)

**This is the work that matters.** The software is a weekend; the dataset is the
asset.

You do not need to find places from scratch. Run the extractor and it hands you a
queue: every place the book mentions, with the sentence it appears in and where
it falls in the text.

```sh
bun run extract mrs-dalloway --geocode
```

For *Mrs Dalloway* that produces 57 candidates. Your job is to take one and
answer the questions a machine cannot:

| The machine gives you | You decide |
|---|---|
| the place name and every mention | **is this actually a place, or a red herring** |
| the exact sentence | **where it really is**. Confirm the pin, or move it |
| where it falls in the book | **how sure we are**, and why |
| suggested coordinates | **why it matters**. Two sentences |

Then add it to `books/<slug>/waypoints.json` and open a pull request. CI will
tell you if you got the quote wrong.

Your editor will help: `schema/waypoint.schema.json` gives you autocomplete,
field descriptions and enum hints on `waypoints.json` (wired up for VS Code in
`.vscode/settings.json`; point any other editor at the same file).

### Why we never trust the machine

The extractor's top suggestion for *Mrs Dalloway* is **Bourton**: the Dalloways'
country house, the place Clarissa remembers being eighteen, the emotional origin
of the whole novel.

The geocoder confidently returned *"Bourton Close, Hayes, London Borough of
Hillingdon."*

Bourton is a country house, and it is not in London at all. Only someone who has
read the book catches that.

**We automate discovery. We never automate assertion.** That is why every
waypoint needs a person.

### The rules, and why they exist

**Every claim must be checkable against the book.** Each waypoint carries a
`quoteAnchor`, a verbatim string that must appear exactly once in the novel.
CI finds it and derives the waypoint's position in the text. If your quote is not
in the book, the build fails. You cannot merge a place the book does not support.

**Say when you are guessing.** Literary geography is full of guesses, and hiding
them is what makes a pin map. Every waypoint declares one of:

- `explicit`: the author named this place;
- `inferred`: you worked it out, and you say how;
- `inspired_by`: a real place behind a fictional one;
- `disputed`: scholars disagree, and we show the disagreement.

Anything that is not `explicit` **must** carry a `certaintyNote` explaining the
guess. CI enforces this. Clarissa's house is `inferred`. Woolf never gives an address, and we say so on
the card, where the reader can see it.

That disclosure is the whole difference between a gazetteer and a pin map.

**We never ask you to upload a photograph.** Not one, ever. It is an unbounded ask
and a rights minefield. You write data: a coordinate, a quote, a source, an
honest label. The imagery comes from open map layers and a link to Street View.

### Adding a historical map (the best non-coding task)

"Then vs now" only works for books whose city has a georeferenced historical map.
London has one and Bogotá has 58. **Moscow, Shanghai and St Petersburg have
none.**

That gap is a job, not a permanent defect.

Take a public-domain historical map of the city, georeference it on
[Allmaps](https://allmaps.org) or [Map Warper](https://mapwarper.net), and you
get an XYZ tile URL. Drop it into the book's `layers.historical` and a whole era
appears under the modern city.

No code. Real craft. Enormous payoff.

---

## Contributing code

```sh
git clone …  &&  cd readtheplaces.com
bun install
bun run plates mrs-dalloway   # composite the static map images
bun dev
```

Node 22+ and Bun 1.2+. No API key, no account.

Read [`docs/DESIGN.md`](docs/DESIGN.md) first. It records decisions with the
measurements behind them, and it will save you from proposing things we have
already tested and rejected:

- **Why Street View is a link, not an embed.** Google's Maps Platform terms
  §3.2.3(e) forbid displaying "Street View imagery and non-Google Maps on the
  same screen." An embedded panorama beside our OpenStreetMap basemap is named,
  explicitly, as prohibited. A plain hyperlink is not an API call and carries
  none of that.
- **Why the walk page has no live maps.** Browsers cap simultaneous WebGL
  contexts at ~16. Fifteen stops across two eras is 31 maps; we measured 16 alive
  and 15 dead canvases. The walk page uses static images, composited by
  `bun run plates`.
- **Why the basemap is not Google's.** It would require every contributor to set
  up a *billed* Google Cloud project just to run the repo, and it has coverage
  gaps in mainland China.
- **Why colours are quotations.** A book's accent must be citable in its own text.
  *Mrs Dalloway* is green because she "laid her green dress on her bed". The build
  fails if the quote is not there, or if the colour misses WCAG AA.

### Branching

GitHub Flow. `main` is always deployable.

```
main ← PR ← your-branch
```

Short-lived branches, one PR, squash merge. CI must pass. A merged waypoint goes
live within a minute, which is the point: contributors should see their place
appear.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org), enforced by a git
hook and again in CI, so it holds even if you edit a file in the GitHub web UI
and never ran `bun install`.

```
data(books): add Somerset House to Mrs Dalloway
feat(reader): pin waypoints on both maps so they survive the wipe
fix(schema): reject a quote that matches more than once
docs: explain why Street View is a link and not an embed
```

Types: `feat` `fix` `data` `docs` `style` `refactor` `perf` `test` `build` `ci`
`chore` `revert`.
Scopes: `schema` `tools` `web` `reader` `books` `seo` `a11y` `deps` `repo`.

`data` exists because book data and software are reviewed by different people,
and you should be able to tell which a commit touched from the subject line
alone.

Because we squash-merge, **the PR title becomes the commit on `main`**, so the
title is the thing that has to be conventional. CI checks it.

### Hooks

`bun install` installs them. They are deliberately fast:

| Hook | Runs |
|---|---|
| `commit-msg` | commitlint |
| `pre-commit` | Biome lint, Prettier check, the schema's own tests |
| `pre-push` | typecheck, and the build (which is the data validator) |

Anything slow, the full E2E suite, lives in CI. A hook that takes thirty seconds
is a hook people disable, and a disabled hook protects nothing.

### Before you open a PR

```sh
bun run test        # the contract's own tests
bun run typecheck
bun run build       # the schema is the gate; it fails on data the novel does not support
bun run e2e
```

The contract has its own test suite, written to prove it **fails** when it should.
A validator that never says no is decoration.

---

## Reviewing

Book maintainers own a book's queue. CI has already checked everything
mechanical: the quote exists, it is unambiguous, the guess is explained, the
coordinates are not transposed, the colour is legible.

So a review only ever asks two questions:

1. **Is the pin right?**
2. **Is the note good?**

That should take thirty seconds. If it is taking fifteen minutes, CI is missing a
check. Open an issue about the check, not about the PR.

---

## Licensing your contribution

Code is MIT. Book data is CC BY-SA 4.0, share-alike, deliberately: the dataset
should stay open even if someone builds a better interface than ours. By
contributing you agree to license your work under those terms. See
[`LICENSE`](LICENSE).
