#!/usr/bin/env python3
"""Validate a book's waypoints against its source text.

The point of this script: every claim a waypoint makes about the book must be
checkable against the book. A waypoint's `quote_anchor` is a verbatim string
that must appear exactly once in source.txt. From its offset we derive
`position` (0.0-1.0 through the text), which is how waypoints are ordered.

Position, not chapter number, is the ordering key. Chapter and part numbering
varies between editions and translations; a quote anchor does not. A translated
edition supplies its own source.txt and its own anchors in that language, and
the same code produces the same 0.0-1.0 spine.

Exit non-zero on any failure, so CI rejects unverifiable data.
"""

import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
CERTAINTIES = {"explicit", "inferred", "inspired_by", "disputed"}
STATUSES = {"draft", "reviewed", "verified"}
CLOCK_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def normalise(s: str) -> str:
    """Match the text the same way regardless of quote style or whitespace."""
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("—", "-").replace("–", "-").replace("‑", "-")
    return re.sub(r"\s+", " ", s).strip()


PAPER = (0xF5, 0xF2, 0xEA)  # --paper


def _luminance(rgb: tuple[int, int, int]) -> float:
    def chan(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (chan(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(hex_colour: str, bg: tuple[int, int, int] = PAPER) -> float:
    h = hex_colour.lstrip("#")
    fg = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    a, b = sorted((_luminance(fg), _luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def check_palette(book: dict, text: str) -> list[str]:
    """A book's colours must be quotations, and they must be legible.

    The accent is not chosen from a palette — it is taken from the novel, and
    it has to be citable. Mrs Dalloway is green because she "laid her green
    dress on her bed". Crime and Punishment will be Petersburg yellow. If the
    quote that justifies a colour is not in the book, the colour is decoration,
    and the build should say so.
    """
    errors: list[str] = []

    claims = []
    palette = book.get("palette", {})
    if palette:
        claims.append(("palette.accent", palette.get("accent"),
                       palette.get("accent_source_quote")))
    for cid, c in book.get("characters", {}).items():
        claims.append((f"characters.{cid}", c.get("color"), c.get("color_source_quote")))

    for label, colour, quote in claims:
        if not colour:
            errors.append(f"{label}: colour is required")
            continue
        if not quote:
            errors.append(f"{label}: colour needs a color_source_quote — colours are quotations")
            continue
        if normalise(quote) not in text:
            errors.append(
                f"{label}: colour quote not found in source.txt — "
                f"the colour is decoration, not a quotation: {quote!r}"
            )
        # Character names and accents are set as text on paper; they must be readable.
        ratio = contrast(colour)
        if ratio < 4.5:
            errors.append(
                f"{label}: {colour} has {ratio:.2f}:1 contrast on paper — WCAG AA needs 4.5:1"
            )

    return errors


def validate_data(book: dict, waypoints: list[dict], text: str) -> tuple[list[str], list[dict]]:
    """The contract, as a pure function: (errors, enriched waypoints).

    Kept free of the filesystem so it can be tested directly — see
    tools/test_validate.py. This function is what CI actually enforces, and an
    unverified enforcement mechanism is not one.
    """
    errors: list[str] = []
    text = normalise(text)

    if not book.get("rights", {}).get("text_source"):
        errors.append("book.json: rights.text_source is required")

    errors += check_palette(book, text)

    bbox = book.get("setting", {}).get("bbox")

    ids: set[str] = set()
    enriched = []

    for wp in waypoints:
        wid = wp.get("id", "<missing id>")

        if wid in ids:
            errors.append(f"{wid}: duplicate id")
        ids.add(wid)

        # The core check: does the book actually say this?
        anchor = normalise(wp.get("quote_anchor", ""))
        if not anchor:
            errors.append(f"{wid}: quote_anchor is required")
            continue

        hits = [m.start() for m in re.finditer(re.escape(anchor), text)]
        if not hits:
            errors.append(f"{wid}: quote_anchor not found in source.txt: {anchor[:60]!r}")
            continue
        if len(hits) > 1:
            errors.append(
                f"{wid}: quote_anchor is ambiguous, matches {len(hits)}x — lengthen it: {anchor[:60]!r}"
            )
            continue

        wp["position"] = round(hits[0] / len(text), 5)

        # The passage we display must itself be honest: it has to contain the anchor.
        if anchor not in normalise(wp.get("passage", "")):
            errors.append(f"{wid}: passage does not contain its own quote_anchor")

        if wp.get("place_certainty") not in CERTAINTIES:
            errors.append(f"{wid}: place_certainty must be one of {sorted(CERTAINTIES)}")

        # Anything not explicitly in the text must say why it is where it is.
        if wp.get("place_certainty") != "explicit" and not wp.get("certainty_note"):
            errors.append(f"{wid}: non-explicit placement requires a certainty_note")

        if wp.get("editorial_status") not in STATUSES:
            errors.append(f"{wid}: editorial_status must be one of {sorted(STATUSES)}")

        if not CLOCK_RE.match(wp.get("clock", "")):
            errors.append(f"{wid}: clock must be HH:MM 24-hour, got {wp.get('clock')!r}")

        lon, lat = (wp.get("coords") or [None, None])[:2]
        if not (isinstance(lon, (int, float)) and isinstance(lat, (int, float))):
            errors.append(f"{wid}: coords must be [lon, lat]")
        elif not (-180 <= lon <= 180 and -90 <= lat <= 90):
            errors.append(f"{wid}: coords out of range — is it [lat, lon] by mistake?")
        elif bbox and not wp.get("outside_setting"):
            # A range check alone will not catch a transposition that happens to
            # land somewhere plausible, nor a geocoder that confidently returns
            # the wrong city. The extractor once placed Bourton — the Dalloways'
            # country house — in Hillingdon. So a book declares where it is set,
            # and anything outside must say so on purpose.
            x0, y0, x1, y1 = bbox
            if not (x0 <= lon <= x1 and y0 <= lat <= y1):
                errors.append(
                    f"{wid}: {lat},{lon} is outside the book's setting "
                    f"({book['setting'].get('city', 'bbox')}). If that is deliberate, "
                    f'set "outside_setting": true and explain it in certainty_note. '
                    f"If not: transposed coordinates, or a geocoder that guessed."
                )

        if wp.get("character") not in book.get("characters", {}):
            errors.append(f"{wid}: character {wp.get('character')!r} not declared in book.json")

        if not wp.get("sources"):
            errors.append(f"{wid}: at least one source is required")

        enriched.append(wp)

    # Simultaneity must be mutual, and must actually be simultaneous.
    by_id = {w["id"]: w for w in enriched}
    for wp in enriched:
        for other_id in wp.get("simultaneous_with", []):
            other = by_id.get(other_id)
            if not other:
                errors.append(f"{wp['id']}: simultaneous_with unknown id {other_id!r}")
            elif wp["id"] not in other.get("simultaneous_with", []):
                errors.append(f"{wp['id']}: simultaneous_with {other_id!r} is not reciprocated")
            elif wp["clock"] != other["clock"]:
                errors.append(
                    f"{wp['id']}: simultaneous_with {other_id!r} but clocks differ "
                    f"({wp['clock']} vs {other['clock']})"
                )

    enriched.sort(key=lambda w: (w["clock"], w["position"]))
    return errors, enriched


def validate_book(slug: str) -> list[str]:
    book_dir = REPO / "books" / slug

    book = json.loads((book_dir / "book.json").read_text())
    waypoints = json.loads((book_dir / "waypoints.json").read_text())
    text = (book_dir / "source.txt").read_text()

    errors, enriched = validate_data(book, waypoints, text)

    if not errors:
        # Validation IS the build. The app reads waypoints.built.json, which only
        # exists once every quote in it has been checked against the novel — so
        # you cannot obtain the data without the data having been verified.
        out = book_dir / "waypoints.built.json"
        out.write_text(json.dumps(enriched, indent=2, ensure_ascii=False) + "\n")

        print(f"  {len(enriched)} waypoints verified against source.txt")
        print(f"  wrote {out.relative_to(REPO)}")
        print()
        print("  clock   position  certainty  waypoint")
        print("  " + "-" * 62)
        for w in enriched:
            bar = "#" * int(w["position"] * 22)
            print(
                f"  {w['clock']}   {w['position']:.3f}  {w['place_certainty'][:9]:<9}  "
                f"{w['name'][:30]:<30} {bar}"
            )

    return errors


def main() -> int:
    slugs = sys.argv[1:] or [p.name for p in (REPO / "books").iterdir() if p.is_dir()]
    failed = False

    for slug in slugs:
        print(f"\n{slug}")
        errors = validate_book(slug)
        for e in errors:
            print(f"  FAIL  {e}")
            failed = True

    print()
    if failed:
        print("VALIDATION FAILED")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
