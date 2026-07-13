#!/usr/bin/env python3
"""Tests for the contract.

CONTRIBUTING.md promises contributors that "CI will tell you if you got the
quote wrong". CI enforces that with tools/validate.py. An unverified enforcement
mechanism is not one — so every rule the project promises is tested here, both
that it passes when it should and, more importantly, that it FAILS when it
should. A validator that never says no is decoration.

    python3 -m unittest discover -s tools -p 'test_*.py' -v

Standard library only, so a contributor can run it without installing anything.
"""

import unittest

from validate import contrast, normalise, validate_data

TEXT = (
    "Mrs. Dalloway said she would buy the flowers herself. "
    "There! Out it boomed. The leaden circles dissolved in the air. "
    "She had reached the Park gates. "
    "…twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed, "
    "and the Warren Smiths walked down Harley Street. "
    "The sky was above everything."
)

BOOK = {
    "rights": {"text_source": "Standard Ebooks"},
    "palette": {
        "accent": "#40634A",
        "accent_source_quote": "laid her green dress on her bed",
    },
    "characters": {
        "clarissa": {
            "name": "Clarissa Dalloway",
            "color": "#45704F",
            "color_source_quote": "laid her green dress on her bed",
        },
        "septimus": {
            "name": "Septimus Warren Smith",
            "color": "#2F5D8C",
            "color_source_quote": "The sky",
        },
    },
}


def waypoint(**over):
    wp = {
        "id": "park-gates",
        "name": "The Park gates",
        "clock": "10:15",
        "character": "clarissa",
        "coords": [-0.1348, 51.5025],
        "place_certainty": "explicit",
        "quote_anchor": "She had reached the Park gates",
        "passage": "She had reached the Park gates.",
        "note": "The threshold of the walk.",
        "sources": [{"kind": "passage", "ref": "part 1"}],
        "editorial_status": "reviewed",
    }
    wp.update(over)
    return wp


def run(waypoints, book=None, text=TEXT):
    return validate_data(book or BOOK, waypoints, text)[0]


class TheQuoteMustBeInTheBook(unittest.TestCase):
    """The central promise: you cannot merge a place the book does not support."""

    def test_a_good_waypoint_passes(self):
        self.assertEqual(run([waypoint()]), [])

    def test_invented_quote_is_rejected(self):
        errs = run([waypoint(
            quote_anchor="She had reached the pub",
            passage="She had reached the pub.",
        )])
        self.assertTrue(any("not found in source.txt" in e for e in errs), errs)

    def test_ambiguous_quote_is_rejected(self):
        # "the" appears many times — a position derived from it would be arbitrary.
        errs = run([waypoint(quote_anchor="the", passage="the")])
        self.assertTrue(any("ambiguous" in e for e in errs), errs)

    def test_passage_must_contain_its_own_anchor(self):
        # Guards against quoting one thing and displaying another.
        errs = run([waypoint(passage="Something else entirely.")])
        self.assertTrue(any("does not contain its own quote_anchor" in e for e in errs), errs)

    def test_position_is_derived_from_the_text_not_authored(self):
        _, built = validate_data(BOOK, [waypoint()], TEXT)
        pos = built[0]["position"]
        self.assertTrue(0.0 < pos < 1.0)
        self.assertAlmostEqual(pos, TEXT.index("She had reached the Park gates") / len(TEXT), places=4)

    def test_curly_and_straight_apostrophes_are_the_same_quote(self):
        # A contributor pasting from a different edition must not be punished.
        errs = run(
            [waypoint(
                quote_anchor="twelve o’clock struck",
                passage="…twelve o’clock struck as Clarissa Dalloway laid her green dress on her bed",
            )]
        )
        self.assertEqual(errs, [])


class UncertaintyMustBeDeclared(unittest.TestCase):
    """Hiding a guess is what makes a pin map."""

    def test_a_guess_without_an_explanation_is_rejected(self):
        errs = run([waypoint(place_certainty="inferred")])
        self.assertTrue(any("requires a certainty_note" in e for e in errs), errs)

    def test_a_guess_with_an_explanation_passes(self):
        errs = run([waypoint(
            place_certainty="inferred",
            certainty_note="Woolf gives no address; sited near Dean's Yard.",
        )])
        self.assertEqual(errs, [])

    def test_made_up_certainty_level_is_rejected(self):
        errs = run([waypoint(place_certainty="probably")])
        self.assertTrue(any("place_certainty must be one of" in e for e in errs), errs)

    def test_a_waypoint_needs_a_source(self):
        errs = run([waypoint(sources=[])])
        self.assertTrue(any("at least one source" in e for e in errs), errs)


SET_IN_LONDON = {**BOOK, "setting": {"city": "London", "bbox": [-0.25, 51.44, -0.02, 51.58]}}


class GeographyMustBeSane(unittest.TestCase):
    """A range check alone is not enough. 51.5 is a valid longitude, so a
    transposition can land in the Indian Ocean and pass. The book therefore
    declares where it is set."""

    def test_out_of_range_coords_are_caught(self):
        errs = run([waypoint(coords=[51.5025, 181.0])])
        self.assertTrue(any("out of range" in e for e in errs), errs)

    def test_missing_coords_are_caught(self):
        errs = run([waypoint(coords=None)])
        self.assertTrue(any("coords must be [lon, lat]" in e for e in errs), errs)

    def test_transposed_lat_lon_is_caught_by_the_bbox(self):
        # [51.5025, -0.1348] instead of [-0.1348, 51.5025]. Both values are in
        # range; only the setting reveals it. Without a bbox this sails through.
        errs = run([waypoint(coords=[51.5025, -0.1348])], book=SET_IN_LONDON)
        self.assertTrue(any("outside the book's setting" in e for e in errs), errs)

    def test_a_geocoder_guessing_the_wrong_place_is_caught(self):
        # Nominatim's actual answer for "Bourton": Bourton Close, Hillingdon —
        # ~26 km from Westminster and nowhere near what Woolf meant.
        errs = run([waypoint(coords=[-0.40995, 51.51103])], book=SET_IN_LONDON)
        self.assertTrue(any("outside the book's setting" in e for e in errs), errs)

    def test_a_deliberate_excursion_must_say_so(self):
        # Bourton IS in the novel, and it IS outside London. That is allowed —
        # but only on purpose, never by accident.
        errs = run([waypoint(
            coords=[-1.7553, 51.8797],           # Bourton-on-the-Water, roughly
            outside_setting=True,
            place_certainty="inspired_by",
            certainty_note="Clarissa's girlhood home. Outside London by design.",
        )], book=SET_IN_LONDON)
        self.assertEqual(errs, [])

    def test_waypoints_inside_the_setting_pass(self):
        self.assertEqual(run([waypoint()], book=SET_IN_LONDON), [])


class SimultaneityMustBeMutual(unittest.TestCase):
    """The noon moment is the product. It must be declared, and declared honestly."""

    def _pair(self, **b_over):
        a = waypoint(
            id="noon-westminster", clock="12:00",
            quote_anchor="Clarissa Dalloway laid her green dress on her bed",
            passage="…twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed",
            simultaneous_with=["noon-harley"],
        )
        b = waypoint(
            id="noon-harley", clock="12:00", character="septimus",
            quote_anchor="the Warren Smiths walked down Harley Street",
            passage="and the Warren Smiths walked down Harley Street.",
            simultaneous_with=["noon-westminster"],
        )
        b.update(b_over)
        return [a, b]

    def test_a_declared_pair_passes(self):
        self.assertEqual(run(self._pair()), [])

    def test_one_sided_simultaneity_is_rejected(self):
        errs = run(self._pair(simultaneous_with=[]))
        self.assertTrue(any("not reciprocated" in e for e in errs), errs)

    def test_simultaneous_waypoints_must_share_a_clock(self):
        errs = run(self._pair(clock="15:00"))
        self.assertTrue(any("clocks differ" in e for e in errs), errs)

    def test_pointing_at_a_nonexistent_waypoint_is_rejected(self):
        errs = run([waypoint(simultaneous_with=["ghost"])])
        self.assertTrue(any("unknown id" in e for e in errs), errs)


class ColoursAreQuotations(unittest.TestCase):
    """A book's colour must be citable in its own text, and must be legible."""

    def test_a_colour_with_no_quote_is_rejected(self):
        book = {**BOOK, "palette": {"accent": "#EC4899"}}
        errs = run([waypoint()], book=book)
        self.assertTrue(any("colours are quotations" in e for e in errs), errs)

    def test_a_colour_whose_quote_is_not_in_the_book_is_rejected(self):
        book = {**BOOK, "palette": {
            "accent": "#40634A",
            "accent_source_quote": "her scarlet gown",   # Woolf wrote no such thing
        }}
        errs = run([waypoint()], book=book)
        self.assertTrue(any("not found in source.txt" in e for e in errs), errs)

    def test_an_illegible_colour_is_rejected(self):
        # The ochre originally chosen for Peter Walsh: 3.54:1, fails WCAG AA.
        book = {**BOOK}
        book["characters"] = {
            **BOOK["characters"],
            "clarissa": {
                "name": "Clarissa Dalloway",
                "color": "#A8762F",
                "color_source_quote": "laid her green dress on her bed",
            },
        }
        errs = run([waypoint()], book=book)
        self.assertTrue(any("WCAG AA needs 4.5:1" in e for e in errs), errs)

    def test_shipped_palette_is_legible(self):
        for c in ["#40634A", "#45704F", "#2F5D8C", "#8A5F1E"]:
            self.assertGreaterEqual(contrast(c), 4.5, f"{c} fails AA on paper")

    def test_contrast_maths(self):
        self.assertAlmostEqual(contrast("#FFFFFF", (0, 0, 0)), 21.0, places=1)
        self.assertAlmostEqual(contrast("#000000", (255, 255, 255)), 21.0, places=1)


class Housekeeping(unittest.TestCase):
    def test_duplicate_ids_are_rejected(self):
        errs = run([waypoint(), waypoint()])
        self.assertTrue(any("duplicate id" in e for e in errs), errs)

    def test_unknown_character_is_rejected(self):
        errs = run([waypoint(character="mrs-hilbery")])
        self.assertTrue(any("not declared in book.json" in e for e in errs), errs)

    def test_bad_clock_is_rejected(self):
        errs = run([waypoint(clock="noon")])
        self.assertTrue(any("clock must be HH:MM" in e for e in errs), errs)

    def test_book_must_declare_where_its_text_came_from(self):
        errs = run([waypoint()], book={**BOOK, "rights": {}})
        self.assertTrue(any("rights.text_source is required" in e for e in errs), errs)

    def test_normalise_is_idempotent(self):
        self.assertEqual(normalise(normalise("a ’ b")), normalise("a ’ b"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
