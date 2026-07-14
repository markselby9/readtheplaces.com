import { contrast } from './contrast.ts';
import { normalise } from './normalise.ts';
import type { Book, BuiltWaypoint, Waypoint } from './index.ts';

/**
 * The contract.
 *
 * Every claim a waypoint makes about a book must be checkable against the book.
 * This runs at build time, so data the novel does not support cannot ship.
 */

function occurrences(haystack: string, needle: string): number[] {
  const hits: number[] = [];
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) {
    hits.push(i);
  }
  return hits;
}

/**
 * A book's colours must be quotations, and they must be legible.
 *
 * Mrs Dalloway is green because she "laid her green dress on her bed". Crime and
 * Punishment is Petersburg yellow. If the quote justifying a colour is not in
 * the book, the colour is decoration, and the build says so.
 */
function checkPalette(book: Book, text: string): string[] {
  const errors: string[] = [];

  // A stub has no colour yet. Nothing to check, and nothing wrong.
  if (!book.palette) return errors;

  const claims: Array<[string, string | undefined, string | undefined]> = [
    ['palette.accent', book.palette.accent, book.palette.accentSourceQuote],
    ...Object.entries(book.characters ?? {}).map(
      ([id, c]) =>
        [`characters.${id}`, c.color, c.colorSourceQuote] as [
          string,
          string | undefined,
          string | undefined,
        ],
    ),
  ];

  for (const [label, colour, quote] of claims) {
    if (!colour) {
      errors.push(`${label}: colour is required`);
      continue;
    }
    if (!quote) {
      errors.push(`${label}: colour needs a source quote. Colours are quotations, not decoration.`);
      continue;
    }
    if (!text.includes(normalise(quote))) {
      errors.push(
        `${label}: colour quote not found in source.txt, so the colour is decoration: ${JSON.stringify(quote)}`,
      );
    }
    const ratio = contrast(colour);
    if (ratio < 4.5) {
      errors.push(`${label}: ${colour} is ${ratio.toFixed(2)}:1 on paper. WCAG AA needs 4.5:1.`);
    }
  }

  return errors;
}

export function validateBook(
  book: Book,
  waypoints: Waypoint[],
  rawText: string,
): { errors: string[]; built: BuiltWaypoint[] } {
  const text = normalise(rawText);
  const errors: string[] = checkPalette(book, text);
  const bbox = book.setting?.bbox;

  const seen = new Set<string>();
  const built: BuiltWaypoint[] = [];

  for (const wp of waypoints) {
    if (seen.has(wp.id)) errors.push(`${wp.id}: duplicate id`);
    seen.add(wp.id);

    // Does the book actually say this?
    const anchor = normalise(wp.quoteAnchor);
    const hits = occurrences(text, anchor);

    if (hits.length === 0) {
      errors.push(
        `${wp.id}: quoteAnchor not found in source.txt: ${JSON.stringify(anchor.slice(0, 60))}`,
      );
      continue;
    }
    if (hits.length > 1) {
      errors.push(
        `${wp.id}: quoteAnchor is ambiguous, ${hits.length} matches. Lengthen it: ${JSON.stringify(anchor.slice(0, 60))}`,
      );
      continue;
    }

    const position = Math.round((hits[0]! / text.length) * 1e5) / 1e5;

    // The passage we display must be honest: it has to contain its own anchor.
    if (!normalise(wp.passage).includes(anchor)) {
      errors.push(`${wp.id}: passage does not contain its own quoteAnchor`);
    }

    // Anything not explicitly in the text must say why it is where it is.
    if (wp.placeCertainty !== 'explicit' && !wp.certaintyNote) {
      errors.push(`${wp.id}: non-explicit placement requires a certaintyNote`);
    }

    if (!(wp.character in (book.characters ?? {}))) {
      errors.push(`${wp.id}: character ${JSON.stringify(wp.character)} not declared in book.json`);
    }

    // A range check alone cannot catch a transposition that lands somewhere
    // plausible, nor a geocoder that returns the wrong city. The extractor once
    // placed Bourton, the Dalloways' country house, in Hillingdon. So a book
    // declares where it is set, and anything outside must say so on purpose.
    const [lon, lat] = wp.coords;
    if (bbox && !wp.outsideSetting) {
      const [x0, y0, x1, y1] = bbox;
      if (!(lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1)) {
        errors.push(
          `${wp.id}: ${lat},${lon} is outside the book's setting (${book.setting.city}). ` +
            'If deliberate, set outsideSetting: true and explain it in certaintyNote. ' +
            'If not: transposed coordinates, or a geocoder that guessed.',
        );
      }
    }

    built.push({ ...wp, position });
  }

  // Several waypoints sharing a label are usually just "about the same time".
  // Deliberate simultaneity is declared, mutual, and shares a label.
  const byId = new Map(built.map((w) => [w.id, w]));
  for (const wp of built) {
    for (const otherId of wp.simultaneousWith ?? []) {
      const other = byId.get(otherId);
      if (!other) {
        errors.push(`${wp.id}: simultaneousWith unknown id ${JSON.stringify(otherId)}`);
      } else if (!(other.simultaneousWith ?? []).includes(wp.id)) {
        errors.push(`${wp.id}: simultaneousWith ${JSON.stringify(otherId)} is not reciprocated`);
      } else if (other.progressLabel !== wp.progressLabel) {
        errors.push(
          `${wp.id}: simultaneousWith ${JSON.stringify(otherId)} but labels differ ` +
            `(${wp.progressLabel} vs ${other.progressLabel})`,
        );
      }
    }
  }

  // Position, derived from the text, is the ordering key.
  built.sort((a, b) => a.position - b.position);

  return { errors, built };
}
