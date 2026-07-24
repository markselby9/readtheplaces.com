import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../src/lib/structured-data.ts';

/**
 * JSON-LD is written into an inline <script> with set:html, so JSON.stringify
 * alone is not safe: a "</script>" buried in contributor-authored data (a note,
 * a title, a certaintyNote) closes the script early and everything after it is
 * parsed as HTML. That is stored XSS on a project whose whole model is merging
 * strangers' data. The serializer must neutralise it.
 */
describe('serializeJsonLd', () => {
  it('escapes < so a </script> in contributor data cannot break out', () => {
    const out = serializeJsonLd({ name: 'Nasty</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
  });

  it('still parses back to the original object', () => {
    const obj = { a: 1, name: 'x</script>y', nested: { b: '<b>note</b>' } };
    expect(JSON.parse(serializeJsonLd(obj))).toEqual(obj);
  });
});
