# Design review: the flows

A pass over the site as a visitor, flow by flow, against how catalogue and
reference sites (library OPACs, Atlas Obscura, OpenStreetMap, Wikipedia) handle
the same jobs. What the visual system does well is settled: paper, ink, one
quoted accent, Literata for the novel. The gaps are in the flows, not the look.

## Read flow — mostly solid
Home → book → reader works. The book page leads with one clear action ("Open the
interactive map"). Kept. Small fixes folded into the changes below.

## Search flow — was missing
34 books across 20 cities and no way to search. A reader who wants "the Paris
books" had to scroll. Every catalogue site puts search near the top.
**Shipped:** a filter box on the homepage that narrows the book grids and the
city list by title, author, city or country as you type. Progressive
enhancement: with JavaScript off it is the full list, unchanged.

## Add-a-book flow — was half a flow
The per-stub "Adopt this book" page is good: real steps, a prefilled issue, a
link to CONTRIBUTING. But the nav and footer "Add a book" left the site for a
raw Markdown file on GitHub, which is a poor first impression for the project's
core invitation.
**Shipped:** an in-site `/contribute` page that names the two paths (adopt a
listed book, or propose a new one), explains sourced vs cited, and links the
issue templates. Nav and footer now point here.

## Report-issue flow — was missing
The whole project is an argument about being honest about certainty, yet a reader
who spotted a wrong coordinate or a place that should read "inferred" had nowhere
to say so. Wikipedia and OSM live on this affordance.
**Shipped:** a "Suggest a correction" link on every mapped book page, opening a
prefilled issue with the book already filled in.

## Bug found
`.github/ISSUE_TEMPLATE/config.yml` linked `github.com/markfeng/...`; the repo is
`markselby9/...`. Both contact links 404'd. Fixed.

## Second pass: the reader
The walk page holds up (plate images carry dimensions, lazy loading and real
alt text, so no layout shift and no missing labels). The reader, the one
interactive surface, had four accessibility gaps.

- **Reduced motion.** CSS zeroes the pin animation, but the map camera is
  JavaScript. A reader who asked for less motion still got a 1.5s flight on every
  step. The camera now moves instantly when `prefers-reduced-motion` is set.
- **Escape route.** The only way back to the book was a subtle title link. Added
  an explicit "← Back to the book", and made the title a real `h1`.
- **Orientation.** The chapter strip never said where you were overall. Added
  "Stop N of M" to the footer.
- **Touch targets.** The map pins were a 15px tap target, below the 44px minimum.
  An invisible ring extends the hit area to 44px without changing how they look.

Also fixed a recurring test flake: the wipe-handle test interacted before
hydration; it now waits for the map the way the sibling tests do.
