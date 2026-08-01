import { describe, expect, it } from 'vitest';
import { compareBuild } from '../src/freshness.ts';

const expected = { commit: 'a'.repeat(40), books: 427 };

describe('compareBuild', () => {
  it('is fresh when the live stamp matches the commit and the book count', () => {
    const r = compareBuild(expected, { commit: 'a'.repeat(40), books: 427, builtAt: 'now' });
    expect(r.fresh).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('is stale when the live commit is behind, and names both commits', () => {
    const r = compareBuild(expected, { commit: 'b'.repeat(40), books: 427, builtAt: 'now' });
    expect(r.fresh).toBe(false);
    expect(r.reasons.join(' ')).toContain('bbbbbbb');
    expect(r.reasons.join(' ')).toContain('aaaaaaa');
  });

  it('is stale when the book count is behind, and names both counts', () => {
    const r = compareBuild(expected, { commit: 'a'.repeat(40), books: 392, builtAt: 'now' });
    expect(r.fresh).toBe(false);
    expect(r.reasons.join(' ')).toContain('392');
    expect(r.reasons.join(' ')).toContain('427');
  });

  // The failure that prompted this check: production served a build from the
  // previous commit, so the homepage said 392 books while the repo held 427.
  it('reports both mismatches at once rather than stopping at the first', () => {
    const r = compareBuild(expected, { commit: 'b'.repeat(40), books: 392, builtAt: 'now' });
    expect(r.fresh).toBe(false);
    expect(r.reasons).toHaveLength(2);
  });

  // A missing stamp means the live build predates this check, which is itself
  // proof it is not the current build.
  it('treats an absent stamp as stale', () => {
    const r = compareBuild(expected, null);
    expect(r.fresh).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/no build stamp/i);
  });

  // Only Cloudflare's builder knows the commit. A local `bun run build` cannot,
  // so an unknown commit must not be read as a mismatch: the count still checks.
  it('skips the commit comparison when the live build did not know its commit', () => {
    const r = compareBuild(expected, { commit: 'unknown', books: 427, builtAt: 'now' });
    expect(r.fresh).toBe(true);
  });

  it('still catches a count mismatch when the commit is unknown', () => {
    const r = compareBuild(expected, { commit: 'unknown', books: 392, builtAt: 'now' });
    expect(r.fresh).toBe(false);
    expect(r.reasons).toHaveLength(1);
  });
});
