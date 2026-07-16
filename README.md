<div align="center">

# Read the Places

**A book you can walk through.**

An open, contributor-driven atlas of the real places in novels,
presented in the order the story happens.

**[readtheplaces.com](https://readtheplaces.com)** · [Design](docs/DESIGN.md) · [Contributing](CONTRIBUTING.md) · [Licence](LICENSE)

</div>

---

## The idea

A **waypoint** is a place, at a position in the narrative, with the passage that
puts it there, and an honest statement of how sure we are that it is the right
place.

Narrative **order** is the spine, and that is the whole difference. A map with a
chapter filter is a map of pins, and those already exist. Here is what an ordered
one can do that they cannot. *Mrs Dalloway*, at noon:

> …twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed,
> **and the Warren Smiths walked down Harley Street.**

One sentence. One stroke of the clock. Two places 1.7 miles apart, two people who
never meet, one of whom will be dead within six hours. Click 12:00 and the map
holds both.

## Run it

```sh
bun install
bun run plates                # composite the static map images
bun dev
```

No API key. No account. Node 22+ and [Bun](https://bun.sh) 1.2+.

## The build is the contract

Every claim a waypoint makes about a book is checked against the book, at build
time. `bun run build` fails if a waypoint:

- quotes something the novel does not say, or something it says more than once;
- shows a passage that does not contain its own quote;
- guesses at a location without explaining the guess;
- sits outside the book's declared setting, which catches a transposed coordinate
  or a geocoder that returned the wrong city;
- claims a simultaneity the other waypoint does not claim back;
- uses an accent colour with no quotation behind it, or one that fails WCAG AA.

**You cannot ship a place the book does not support.**

### Position, not chapter, is the ordering key

Each waypoint carries a `quoteAnchor`: a verbatim string that must appear
**exactly once** in `source.txt`. From its offset we derive `position`, how far
through the novel the waypoint falls.

Chapter numbering varies between editions and translations. A quote does not. A
Russian or Chinese edition brings its own text and its own anchors in its own
language, and the same code produces the same 0.0–1.0 spine. That is what makes
*any book, any country* tractable rather than aspirational.

### A book's colour is a quotation

*Mrs Dalloway* is green because she "laid her green dress on her bed". *Crime and
Punishment* will be Petersburg yellow. The colour is declared alongside the line
that justifies it, and the build checks the line is really there.

```jsonc
"palette": {
  "accent": "#40634A",
  "accentSourceQuote": "laid her green dress on her bed"
}
```

## Add a book

```sh
bun run new-book "Crime and Punishment" \
  --author "Fyodor Dostoevsky" --city "Saint Petersburg" --published 1866
```

Searches Standard Ebooks, fetches the text, locates the city, measures its
bounding box, looks for a free historical map layer, and writes a `book.json`
with everything a machine can know already filled in.

It never invents a colour or a waypoint. Those are judgements, and they need a
reader.

**Books still in copyright** (Harry Potter, most modern fiction) are mapped as
**cited books**: locations only, no text stored, no passages quoted. Locations
are facts and the notes are our own writing, so this is the same footing as any
literary-location guide.

```sh
bun run new-book "Harry Potter and the Philosopher's Stone" \
  --author "J. K. Rowling" --city London --cited
```

## Adopt a book

```sh
bun run fetch-text ulysses     # 1.5M characters of Joyce
bun run extract ulysses        # 108 place candidates, with sentences and coordinates
```

Then take one candidate, look at the pin on a map, and write two sentences about
why the place matters to the novel. That is a waypoint.

## Find work

```sh
bun run extract mrs-dalloway --geocode
```

Mines the novel for every place it mentions and hands you a queue: 57 for *Mrs
Dalloway*, with the sentence, the position in the text, and suggested
coordinates.

It never writes a waypoint. It writes a **worklist**. Its top candidate for *Mrs
Dalloway* is Bourton, the Dalloways' country house and the emotional origin of
the whole novel, which the geocoder confidently placed in *Hillingdon*. Only
someone who has read the book catches that.

**Automate discovery. Never automate assertion.**

## How it's built

| Layer | Choice |
|---|---|
| Site | Astro 7. Every walk page is static and ships **zero JavaScript**. |
| Reader | One Svelte 5 island, the only place MapLibre loads. |
| Walk pages | **Static map images**, composited at build time. Browsers cap WebGL contexts at about sixteen, and fifteen stops across two eras needs thirty-one ([why](docs/DESIGN.md#44-the-walk-page-uses-no-webgl-and-this-is-not-a-preference)). |
| Base map | OpenStreetMap. Free, keyless, global, forkable. |
| Historical | Per book, optional. Free [NLS](https://maps.nls.uk/) tiles for Britain, [Allmaps](https://allmaps.org) elsewhere. |
| Street view | An outbound **link** to Google, never an embed ([why](docs/DESIGN.md#42-street-view-is-a-link-and-that-is-a-legal-requirement)). |
| Type | Literata for the novel, Atkinson Hyperlegible for the apparatus. |
| Text | [Standard Ebooks](https://standardebooks.org), public domain. |

## Contributing

**You do not need to code to do the most valuable work here.** The software is a
weekend; the dataset is the asset.

You will never be asked to upload a photograph. You write data: a coordinate, a
verbatim quote, a source, and an honest label saying how sure you are.

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), or take a
[historical-map issue](.github/ISSUE_TEMPLATE/historical-map.md). Moscow,
Shanghai and St Petersburg have no historical layer at all. Closing that gap
needs no code and gives a whole novel a second era.

## Licence

Code [MIT](LICENSE). Book data [CC BY-SA 4.0](LICENSE), share-alike, deliberately:
the dataset should stay open even if someone builds a better interface than ours.

Texts, translations and map imagery are separate rights objects; see each book's
`rights` block. We say **rights-reviewed**, never "licence-clean".
