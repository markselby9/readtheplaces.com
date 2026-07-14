import { describe, expect, it } from 'vitest';
import { deg2num, tileUrl } from '../src/tiles.ts';
import { findPlaces } from '../src/places.ts';
import { toPlainText } from '../src/text.ts';

describe('deg2num', () => {
  it('is monotonic in longitude', () => {
    expect(deg2num(51.5, -0.2, 16)[0]).toBeLessThan(deg2num(51.5, -0.1, 16)[0]);
  });

  it('increases y as latitude falls', () => {
    expect(deg2num(51.6, -0.1, 16)[1]).toBeLessThan(deg2num(51.4, -0.1, 16)[1]);
  });

  it('puts Greenwich at the centre of the world at z0', () => {
    const [x, y] = deg2num(0, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(1, 5);
  });

  it('doubles resolution per zoom level', () => {
    const [x8] = deg2num(51.5, -0.14, 8);
    const [x9] = deg2num(51.5, -0.14, 9);
    expect(x9).toBeCloseTo(x8 * 2, 5);
  });
});

describe('tileUrl', () => {
  it('substitutes z/x/y and the retina suffix', () => {
    expect(tileUrl('https://t/{z}/{x}/{y}{r}.png', 16, 1, 2, true)).toBe('https://t/16/1/2@2x.png');
    expect(tileUrl('https://t/{z}/{x}/{y}{r}.png', 16, 1, 2, false)).toBe('https://t/16/1/2.png');
  });
});

describe('findPlaces', () => {
  const TEXT =
    "She walked up Bond Street and into Regent's Park. " +
    'Bond Street fascinated her. ' +
    'Later, at Hatchards, she read. ' +
    'The court was empty and the house was still.';

  const found = findPlaces(TEXT, ['Hatchards']);
  const byName = (n: string) => found.find((c) => c.name === n);

  it('finds a street by its place word', () => {
    expect(byName('Bond Street')?.mentions).toBe(2);
  });

  it('finds a bare place from the gazetteer', () => {
    expect(byName('Hatchards')).toBeDefined();
  });

  it('does not mistake a lone place word for a place', () => {
    // "the court", "the house": no capitalised name in front, so not places.
    expect(found.map((c) => c.name)).not.toContain('court');
    expect(found.map((c) => c.name)).not.toContain('The court');
    expect(found.map((c) => c.name)).not.toContain('house');
  });

  it('reports where in the text the place first appears', () => {
    const c = byName('Bond Street')!;
    expect(c.firstPosition).toBeGreaterThan(0);
    expect(c.firstPosition).toBeLessThan(1);
  });

  it('proposes the sentence containing the mention', () => {
    expect(byName('Hatchards')?.proposedPassage).toContain('Hatchards');
  });

  it('normalises curly apostrophes so places match across editions', () => {
    expect(findPlaces('She entered Regent’s Park.').some((c) => c.name === "Regent's Park")).toBe(
      true,
    );
  });
});

describe('extractBodyMatter', () => {
  // Standard Ebooks nests chapter sections inside part sections. A non-greedy
  // <section>…</section> match stops at the first nested close, which silently
  // kept one chapter per part: 185k characters of Crime and Punishment instead
  // of 1.1M. Every position derived from that text would have been wrong, and
  // nothing would have failed.
  const HTML = `
    <body>
      <section id="titlepage" epub:type="frontmatter titlepage"><p>Boilerplate.</p></section>
      <section id="imprint" epub:type="frontmatter imprint"><p>Standard Ebooks volunteers.</p></section>
      <section id="part-1" epub:type="bodymatter part">
        <section id="ch-1" epub:type="chapter"><p>FIRST CHAPTER.</p></section>
        <section id="ch-2" epub:type="chapter"><p>SECOND CHAPTER.</p></section>
      </section>
      <section id="part-2" epub:type="bodymatter part">
        <section id="ch-3" epub:type="chapter"><p>THIRD CHAPTER.</p></section>
      </section>
      <section id="colophon" epub:type="backmatter colophon"><p>Colophon.</p></section>
    </body>`;

  const text = toPlainText(HTML);

  it('keeps every chapter, not just the first of each part', () => {
    expect(text).toContain('FIRST CHAPTER');
    expect(text).toContain('SECOND CHAPTER');
    expect(text).toContain('THIRD CHAPTER');
  });

  it('drops the front matter, so a quote cannot match the boilerplate', () => {
    expect(text).not.toContain('Boilerplate');
    expect(text).not.toContain('Standard Ebooks volunteers');
  });

  it('drops the back matter, so position is not skewed by the colophon', () => {
    expect(text).not.toContain('Colophon');
  });
});
