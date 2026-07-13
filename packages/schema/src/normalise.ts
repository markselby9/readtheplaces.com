/**
 * Match text the same way regardless of quote style or whitespace.
 *
 * Editions differ in typography, not in what the author wrote. A contributor
 * pasting a quote with curly apostrophes from one edition must not be rejected
 * because our transcription uses straight ones.
 */
export function normalise(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–‑]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
