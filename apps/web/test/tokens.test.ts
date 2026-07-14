import { readFileSync } from 'node:fs';
import { contrast } from '@rtp/schema';
import { describe, expect, it } from 'vitest';

/**
 * The design tokens must pass the same bar we impose on contributors.
 *
 * The build refuses a book whose accent colour misses WCAG AA, and meanwhile the
 * site's own --ink-3 was shipping at 3.63:1 and failing on eight elements. The
 * validator was policing everyone except the people who wrote it.
 */

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const m = css.match(new RegExp(`\\s${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!m) throw new Error(`token ${name} not found in tokens.css`);
  return m[1]!;
}

const PAPER = token('--paper');
const PAPER_2 = token('--paper-2');

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

describe('design tokens', () => {
  // Every token used for text, on both paper tones.
  const textTokens = ['--ink', '--ink-2', '--ink-3', '--accent'];

  for (const name of textTokens) {
    it(`${name} passes WCAG AA on paper`, () => {
      const ratio = contrast(token(name), rgb(PAPER));
      expect(ratio, `${name} is ${token(name)} at ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    });

    it(`${name} passes WCAG AA on raised paper`, () => {
      const ratio = contrast(token(name), rgb(PAPER_2));
      expect(ratio, `${name} is ${token(name)} at ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }
});
