#!/usr/bin/env python3
"""Mine a book's source text for candidate waypoints.

This exists to change what we ask a contributor to do.

Authoring a waypoint from nothing is a research project: read the novel, notice
a place, find the passage, locate it on a map, judge how certain the location
is, write a note. That is an hour of work and almost nobody will do it.

Triaging a candidate is a different job: the machine has already found the place
mention, pulled the exact sentence, computed where it falls in the book, and
proposed coordinates. The contributor accepts or rejects, corrects the pin,
picks a certainty, and writes two sentences. That is a couple of minutes, and
plenty of people will do it.

So: this script never writes a waypoint. It writes a *worklist*. Every candidate
must still be judged by a person, because the interesting questions — is this
place real, is it where the author meant, does the passage matter — are exactly
the ones a machine gets confidently wrong.
"""

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent

# Words that, as the tail of a capitalised phrase, make it a place in English
# prose. Deliberately conservative: a missed candidate costs nothing (a human
# can add it), while a flood of false positives makes the queue useless.
PLACE_TAILS = (
    "Street|Square|Park|Road|Lane|Gardens|Garden|Place|Circus|Bridge|Palace|Abbey|"
    "Hall|House|Court|Terrace|Row|Walk|Yard|Hill|Gate|Church|Cathedral|Station|"
    "Market|Avenue|Crescent|Embankment|Quay|Wharf|Green|Fields|Field|Common|Heath"
)

# Capitalised run, then a place-tail. "Bond Street", "Regent's Park",
# "Tottenham Court Road".
PLACE_RE = re.compile(
    r"\b((?:St\.?\s+)?(?:[A-Z][\w'-]+\s+){1,3}(?:" + PLACE_TAILS + r"))\b"
)

# Bare proper nouns that are places but carry no tail — these need a per-book
# gazetteer, because no rule distinguishes "Piccadilly" (a place) from
# "Clarissa" (a person). Contributors extend this list; that is itself a
# perfectly good first contribution.
BARE_PLACES_DEFAULT = [
    "Piccadilly", "Westminster", "Whitehall", "Bloomsbury", "Mayfair",
    "Hatchards", "Bourton", "Holborn", "Strand", "Soho", "Chelsea",
    "Kensington", "Greenwich", "Waterloo", "Marylebone", "Bayswater",
]

SENTENCE_END = re.compile(r"(?<=[.!?])\s")


def normalise(s: str) -> str:
    """Must match tools/validate.py, or the two disagree about the same place."""
    return s.replace("\u2019", "'").replace("\u2018", "'")


def sentence_around(text: str, i: int, span: int = 320) -> str:
    """The sentence containing offset i — the candidate's proposed passage."""
    lo = max(0, i - span)
    hi = min(len(text), i + span)
    window = text[lo:hi]
    local = i - lo

    starts = [m.end() for m in SENTENCE_END.finditer(window) if m.end() <= local]
    ends = [m.start() for m in SENTENCE_END.finditer(window) if m.start() > local]
    start = starts[-1] if starts else 0
    end = ends[0] + 1 if ends else len(window)
    return window[start:end].strip()


def geocode(name: str, city: str, country: str, cache: dict) -> list[dict]:
    """Propose coordinates. A suggestion for a human to confirm, never an answer.

    Nominatim will happily return a confident point for a place that does not
    exist, or the wrong 'Bond Street' in the wrong country. The viewbox keeps it
    honest-ish; the human keeps it honest.
    """
    key = f"{name}|{city}|{country}"
    if key in cache:
        return cache[key]

    q = urllib.parse.urlencode({
        "q": f"{name}, {city}",
        "format": "json",
        "limit": 3,
        "countrycodes": country.lower(),
        "addressdetails": 0,
    })
    url = f"https://nominatim.openstreetmap.org/search?{q}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "readtheplaces-extract/0.1 (https://readtheplaces.com)"
    })
    try:
        raw = json.load(urllib.request.urlopen(req, timeout=25))
    except Exception:
        raw = []
    time.sleep(1.1)  # Nominatim asks for <=1 req/sec. Be a good citizen.

    hits = [
        {
            "coords": [round(float(h["lon"]), 5), round(float(h["lat"]), 5)],
            "label": h.get("display_name", "")[:90],
            "osm_type": h.get("osm_type"),
        }
        for h in raw
    ]
    cache[key] = hits
    return hits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--geocode", action="store_true",
                    help="propose coordinates via Nominatim (slow, rate-limited)")
    ap.add_argument("--min-mentions", type=int, default=1)
    args = ap.parse_args()

    book_dir = REPO / "books" / args.slug
    book = json.loads((book_dir / "book.json").read_text())
    text = normalise((book_dir / "source.txt").read_text())
    N = len(text)

    existing = json.loads((book_dir / "waypoints.json").read_text())
    covered = {normalise(w["name"]).lower() for w in existing}
    covered |= {normalise(w["quote_anchor"]).lower() for w in existing}

    bare = book.get("gazetteer", BARE_PLACES_DEFAULT)
    bare_re = re.compile(r"\b(" + "|".join(map(re.escape, bare)) + r")\b")

    # Collect every mention of every candidate place.
    found: dict[str, list[int]] = {}
    for m in PLACE_RE.finditer(text):
        found.setdefault(m.group(1).strip(), []).append(m.start())
    for m in bare_re.finditer(text):
        found.setdefault(m.group(1).strip(), []).append(m.start())

    cache_path = book_dir / ".geocode-cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}

    candidates = []
    for name, hits in sorted(found.items(), key=lambda kv: -len(kv[1])):
        if len(hits) < args.min_mentions:
            continue

        first = hits[0]
        already = any(name.lower() in c for c in covered)

        cand = {
            "name": name,
            "mentions": len(hits),
            "first_position": round(first / N, 5),
            "proposed_passage": sentence_around(text, first),
            "already_covered": already,
            # Everything below is for a human to fill in. The machine has no
            # business guessing any of it.
            "coords": None,
            "place_certainty": None,
            "certainty_note": None,
            "character": None,
            "note": None,
        }

        if args.geocode and not already:
            cand["coord_suggestions"] = geocode(
                name, book["setting"]["city"], book["setting"]["country"], cache
            )

        candidates.append(cand)

    cache_path.write_text(json.dumps(cache, indent=1))

    out = book_dir / "candidates.json"
    out.write_text(json.dumps(candidates, indent=2, ensure_ascii=False) + "\n")

    todo = [c for c in candidates if not c["already_covered"]]
    print(f"{args.slug}: {len(candidates)} place candidates from {N:,} chars")
    print(f"  {len(candidates) - len(todo):>3} already have a waypoint")
    print(f"  {len(todo):>3} awaiting triage  →  {out.relative_to(REPO)}")
    print()
    print(f"  {'mentions':>8}  {'at':>5}  place")
    print("  " + "-" * 58)
    for c in todo[:22]:
        print(f"  {c['mentions']:>8}  {c['first_position']*100:>4.0f}%  {c['name']}")
    if len(todo) > 22:
        print(f"  {'':>8}         … and {len(todo) - 22} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
