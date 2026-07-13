<!-- Adding a place? The checklist below is the whole review. CI has already
     checked everything mechanical, so a maintainer only needs to ask: is the
     pin right, and is the note good? Help them answer that quickly. -->

## What this adds

<!-- One line. "Adds Somerset House to Mrs Dalloway." -->

---

## If this adds or changes a waypoint

- [ ] The `quote_anchor` is **verbatim** from `source.txt` and appears exactly once
      (`python3 tools/validate.py` passes)
- [ ] The coordinates are where the *book* means, not where a geocoder guessed
      <!-- The extractor once placed Bourton — the Dalloways' country house — in
           Hillingdon. Confidently. Please look at the pin on a map. -->
- [ ] `place_certainty` is honest, and anything not `explicit` explains itself in
      `certainty_note`
- [ ] The `note` says **why this place matters to the novel** — not what is there today
- [ ] At least one `source`

## If this changes the app

- [ ] `bun test` passes
- [ ] No live map added to the walk page
      <!-- Browsers cap WebGL contexts at ~16. The walk page uses static plates
           from tools/plates.py. See docs/DESIGN.md §4.4. -->
- [ ] No Google Maps content rendered beside our map
      <!-- Google's ToS §3.2.3(e) forbids it. Street View is a link. §4.2. -->

## Notes for the reviewer

<!-- Anything you were unsure about. Uncertainty is welcome here — this project
     would rather publish an honest "disputed" than a confident mistake. -->
