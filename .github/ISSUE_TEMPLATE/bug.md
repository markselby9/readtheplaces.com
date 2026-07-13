---
name: Bug
about: Something is broken
labels: ['bug']
---

## What happened

## What you expected

## To reproduce

<!-- Which book, which stop, which browser. -->

## Before you file

A few things are working as intended, and are documented in `docs/DESIGN.md`:

- **Street View opens in a new tab instead of embedding.** Google's Maps
  Platform terms §3.2.3(e) forbid showing Street View beside a non-Google map.
  This is deliberate. (§4.2)
- **Some books have no "then vs now" wipe.** No free historical map layer exists
  for that city yet — Moscow, Shanghai and St Petersburg have none. That is a
  [good first issue](historical-map.md), not a bug. (§4.3)
- **A place is marked `inferred` rather than given an exact address.** The author
  did not give one, and we would rather say so. (§3.4)
