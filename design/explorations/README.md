# Explorations

Three art directions, built with the real *Mrs Dalloway* data so they could be
judged as pages rather than as wireframes. **Two of them were rejected.** They
are kept because the reasons are load-bearing, and someone will propose them
again.

| | Verdict |
|---|---|
| `a-critical-edition.html` | **Adopted** as the base — prose measure, static plate, certainty as scholarly typography. |
| `c-the-hours.html` | **Partly adopted.** Its timeline spine was kept. Its darkening-day was cut. |
| `b-the-atlas.html` | **Rejected.** |

## Why The Atlas was rejected

It is the prettiest of the three, and it makes the historical map **structural** —
a full-bleed hero, with each stop framed against the survey.

But historical map coverage is not universal. Measured: Bogotá 58 layers, London
9 — **Moscow 0, Shanghai 0, St Petersburg 0.** A design that leans on the
historical layer looks broken for exactly the books this project most wants to
carry. It fails the generality test in `docs/DESIGN.md` §5.

## Why the darkening day was cut

`c-the-hours.html` re-tints the whole page as you scroll — morning, noon, dusk,
night — so the reader descends through the day. It is the most original idea of
the three and it thematically solves dark mode.

It was cut for two reasons:

1. **It only works for a novel that spans one day.** *Crime and Punishment*
   cannot use it, so it is not a system.
2. **It produced a measured mid-transition state with failing contrast** — the
   map had gone night-dark while the paper was still cream and the ink had faded
   to grey, for roughly 900 ms.

If it ever comes back, the era switch must be atomic.

## Note

These use live MapLibre maps, which is exactly what the shipped walk page must
*not* do — 15 stops × 2 eras = 31 WebGL contexts, and browsers cap them at ~16.
Building `b-the-atlas.html` is how we found that out (16 alive, 15 dead
canvases). See `docs/DESIGN.md` §4.4 and `tools/plates.py`.

```sh
python3 -m http.server 8420
open http://localhost:8420/design/explorations/a-critical-edition.html
```
