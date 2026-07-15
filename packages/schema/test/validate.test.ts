import { describe, expect, it } from 'vitest';
import { contrast, normalise, validateBook, type Book, type Waypoint } from '../src/index.ts';

/**
 * Tests for the contract.
 *
 * CONTRIBUTING.md promises contributors that the build will tell them if they
 * got the quote wrong. That promise is only worth something if the thing making
 * it is tested to *fail* when it should. A validator that never says no is
 * decoration.
 */

const TEXT =
  'Mrs. Dalloway said she would buy the flowers herself. ' +
  'There! Out it boomed. The leaden circles dissolved in the air. ' +
  'She had reached the Park gates. ' +
  "…twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed, " +
  'and the Warren Smiths walked down Harley Street. ' +
  'The sky was above everything.';

const BOOK: Book = {
  id: 'test',
  title: 'Test',
  author: 'Test',
  orderingKey: 'clock',
  sourcing: 'sourced',
  center: [-0.14, 51.51],
  zoom: 13,
  setting: { city: 'London', country: 'GB', bbox: [-0.25, 51.44, -0.02, 51.58] },
  rights: { textSource: 'Standard Ebooks' },
  palette: { accent: '#40634A', accentSourceQuote: 'laid her green dress on her bed' },
  characters: {
    clarissa: {
      name: 'Clarissa Dalloway',
      color: '#45704F',
      colorSourceQuote: 'laid her green dress on her bed',
    },
    septimus: { name: 'Septimus Warren Smith', color: '#2F5D8C', colorSourceQuote: 'The sky' },
  },
};

function wp(over: Partial<Waypoint> = {}): Waypoint {
  return {
    id: 'park-gates',
    name: 'The Park gates',
    progressLabel: '10:15',
    character: 'clarissa',
    coords: [-0.1348, 51.5025],
    placeCertainty: 'explicit',
    quoteAnchor: 'She had reached the Park gates',
    passage: 'She had reached the Park gates.',
    note: 'The threshold of the walk.',
    sources: [{ kind: 'passage', ref: 'part 1' }],
    editorialStatus: 'reviewed',
    ...over,
  };
}

const errs = (waypoints: Waypoint[], book: Book = BOOK): string[] =>
  validateBook(book, waypoints, TEXT).errors;

const matching = (e: string[], s: string) => e.some((x) => x.includes(s));

describe('the quote must be in the book', () => {
  it('accepts a good waypoint', () => {
    expect(errs([wp()])).toEqual([]);
  });

  it('rejects an invented quote', () => {
    const e = errs([
      wp({ quoteAnchor: 'She had reached the pub', passage: 'She had reached the pub.' }),
    ]);
    expect(matching(e, 'not found in source.txt')).toBe(true);
  });

  it('rejects a quote that matches more than once', () => {
    const text = `${TEXT} She had reached the Park gates.`;
    const { errors } = validateBook(BOOK, [wp()], text);
    expect(matching(errors, 'ambiguous')).toBe(true);
  });

  it('requires the passage to contain its own anchor', () => {
    const e = errs([wp({ passage: 'Something else entirely.' })]);
    expect(matching(e, 'does not contain its own quoteAnchor')).toBe(true);
  });

  it('derives position from the text rather than trusting the author', () => {
    const { built } = validateBook(BOOK, [wp()], TEXT);
    const expected =
      normalise(TEXT).indexOf('She had reached the Park gates') / normalise(TEXT).length;
    expect(built[0]!.position).toBeCloseTo(expected, 3);
  });

  it('treats curly and straight apostrophes as the same quote', () => {
    const e = errs([
      wp({
        quoteAnchor: 'twelve o’clock struck',
        passage: '…twelve o’clock struck as Clarissa Dalloway laid her green dress on her bed',
      }),
    ]);
    expect(e).toEqual([]);
  });

  it('rejects a duplicate id', () => {
    expect(matching(errs([wp(), wp()]), 'duplicate id')).toBe(true);
  });
});

describe('uncertainty must be declared', () => {
  it('rejects a guess with no explanation', () => {
    expect(matching(errs([wp({ placeCertainty: 'inferred' })]), 'requires a certaintyNote')).toBe(
      true,
    );
  });

  it('accepts a guess that explains itself', () => {
    expect(
      errs([wp({ placeCertainty: 'inferred', certaintyNote: 'Woolf gives no address.' })]),
    ).toEqual([]);
  });

  it('accepts a disputed placement that explains the dispute', () => {
    expect(
      errs([
        wp({
          placeCertainty: 'disputed',
          certaintyNote: 'Scholars disagree; two candidate buildings.',
        }),
      ]),
    ).toEqual([]);
  });
});

describe('geography must be sane', () => {
  it('catches transposed lat/lon via the bbox', () => {
    // [51.5025, -0.1348] instead of [-0.1348, 51.5025]. Both are valid numbers;
    // only the setting reveals the mistake.
    const e = errs([wp({ coords: [51.5025, -0.1348] })]);
    expect(matching(e, "outside the book's setting")).toBe(true);
  });

  it('catches a geocoder guessing the wrong place', () => {
    // Nominatim's real answer for "Bourton": Bourton Close, Hillingdon.
    const e = errs([wp({ coords: [-0.40995, 51.51103] })]);
    expect(matching(e, "outside the book's setting")).toBe(true);
  });

  it('allows a deliberate excursion that says so', () => {
    const e = errs([
      wp({
        coords: [-1.7553, 51.8797],
        outsideSetting: true,
        placeCertainty: 'inspired_by',
        certaintyNote: "Clarissa's girlhood home. Outside London by design.",
      }),
    ]);
    expect(e).toEqual([]);
  });

  it('accepts a waypoint inside the setting', () => {
    expect(errs([wp()])).toEqual([]);
  });

  it('rejects an unknown character', () => {
    expect(matching(errs([wp({ character: 'mrs-hilbery' })]), 'not declared in book.json')).toBe(
      true,
    );
  });
});

describe('simultaneity must be declared and mutual', () => {
  const pair = (over: Partial<Waypoint> = {}): Waypoint[] => [
    wp({
      id: 'noon-westminster',
      progressLabel: '12:00',
      quoteAnchor: 'Clarissa Dalloway laid her green dress on her bed',
      passage: "…twelve o'clock struck as Clarissa Dalloway laid her green dress on her bed",
      simultaneousWith: ['noon-harley'],
    }),
    wp({
      id: 'noon-harley',
      progressLabel: '12:00',
      character: 'septimus',
      quoteAnchor: 'the Warren Smiths walked down Harley Street',
      passage: 'and the Warren Smiths walked down Harley Street.',
      simultaneousWith: ['noon-westminster'],
      ...over,
    }),
  ];

  it('accepts a declared pair', () => {
    expect(errs(pair())).toEqual([]);
  });

  it('rejects one-sided simultaneity', () => {
    expect(matching(errs(pair({ simultaneousWith: [] })), 'not reciprocated')).toBe(true);
  });

  it('rejects a pair whose labels differ', () => {
    expect(matching(errs(pair({ progressLabel: '15:00' })), 'labels differ')).toBe(true);
  });

  it('rejects a pointer to a waypoint that does not exist', () => {
    expect(matching(errs([wp({ simultaneousWith: ['ghost'] })]), 'unknown id')).toBe(true);
  });
});

describe('colours are quotations', () => {
  it('rejects a colour with no source quote', () => {
    const book = { ...BOOK, palette: { accent: '#EC4899' } } as Book;
    expect(matching(errs([wp()], book), 'Colours are quotations')).toBe(true);
  });

  it('rejects a colour whose quote is not in the book', () => {
    const book = {
      ...BOOK,
      palette: { accent: '#40634A', accentSourceQuote: 'her scarlet gown' },
    } as Book;
    expect(matching(errs([wp()], book), 'not found in source.txt')).toBe(true);
  });

  it('rejects an illegible colour', () => {
    // The ochre first chosen for Peter Walsh: 3.54:1, fails AA.
    const book: Book = {
      ...BOOK,
      characters: {
        ...BOOK.characters,
        clarissa: {
          name: 'Clarissa Dalloway',
          color: '#A8762F',
          colorSourceQuote: 'laid her green dress on her bed',
        },
      },
    };
    expect(matching(errs([wp()], book), 'WCAG AA needs 4.5:1')).toBe(true);
  });

  it('confirms the shipped palette is legible', () => {
    for (const c of ['#40634A', '#45704F', '#2F5D8C', '#8A5F1E']) {
      expect(contrast(c)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('computes contrast correctly', () => {
    expect(contrast('#FFFFFF', [0, 0, 0])).toBeCloseTo(21, 1);
    expect(contrast('#000000', [255, 255, 255])).toBeCloseTo(21, 1);
  });
});

const CITED_BOOK: Book = {
  id: 'cited',
  title: 'A Book Still In Copyright',
  author: 'A Living Author',
  orderingKey: 'chapter',
  sourcing: 'cited',
  center: [-0.14, 51.51],
  zoom: 13,
  setting: { city: 'London', country: 'GB', bbox: [-0.25, 51.44, -0.02, 51.58] },
  rights: { textSource: 'In copyright; locations only, no text stored' },
  // A cited book's accent is not a quotation, because there is no text to quote.
  palette: { accent: '#40634A' },
  characters: { harry: { name: 'Harry', color: '#7C3B2C' } },
};

function cited(over: Partial<Waypoint> = {}): Waypoint {
  return {
    id: 'kings-cross',
    name: "King's Cross, Platform 9¾",
    progressLabel: 'Chapter 6',
    character: 'harry',
    coords: [-0.1237, 51.5308],
    placeCertainty: 'explicit',
    reference: 'Chapter 6',
    order: 1,
    note: 'Where Harry first boards the Hogwarts Express, through a barrier between platforms nine and ten.',
    sources: [{ kind: 'author', ref: 'Chapter 6' }],
    editorialStatus: 'reviewed',
    ...over,
  };
}

const citedErrs = (waypoints: Waypoint[], book: Book = CITED_BOOK): string[] =>
  // A cited book has no text, so the validator is given none.
  validateBook(book, waypoints, '').errors;

describe('a cited book maps locations without reproducing the text', () => {
  it('accepts a waypoint that cites the scene and describes it in our own words', () => {
    expect(citedErrs([cited()])).toEqual([]);
  });

  it('requires a reference, so the citation points somewhere', () => {
    const wp = cited();
    delete wp.reference;
    expect(citedErrs([wp]).some((e) => e.includes('reference'))).toBe(true);
  });

  it('requires an order, because there is no text to derive position from', () => {
    const wp = cited();
    delete wp.order;
    expect(citedErrs([wp]).some((e) => e.includes('order'))).toBe(true);
  });

  it('refuses a verbatim passage, so we never reproduce the author', () => {
    const errs = citedErrs([cited({ passage: 'It was a bright cold day in April.' })]);
    expect(errs.some((e) => e.includes('must not reproduce'))).toBe(true);
  });

  it('refuses a verbatim quoteAnchor for the same reason', () => {
    const errs = citedErrs([cited({ quoteAnchor: 'a verbatim string from the book' })]);
    expect(errs.some((e) => e.includes('must not reproduce'))).toBe(true);
  });

  it('derives position from order, keeping the same 0.0-1.0 spine', () => {
    const { built } = validateBook(
      CITED_BOOK,
      [cited({ id: 'a', order: 3 }), cited({ id: 'b', order: 1 }), cited({ id: 'c', order: 2 })],
      '',
    );
    expect(built.map((w) => w.id)).toEqual(['b', 'c', 'a']);
    expect(built[0]!.position).toBeLessThan(built[2]!.position);
  });

  it('still enforces coordinates inside the setting', () => {
    const errs = citedErrs([cited({ coords: [2.35, 48.86] })]); // Paris
    expect(errs.some((e) => e.includes("outside the book's setting"))).toBe(true);
  });

  it('still enforces an honest certainty note on a guess', () => {
    const errs = citedErrs([cited({ placeCertainty: 'inferred' })]);
    expect(errs.some((e) => e.includes('certaintyNote'))).toBe(true);
  });

  it('still enforces a legible accent colour', () => {
    const book = { ...CITED_BOOK, palette: { accent: '#C9A227' } } as Book; // 2.16:1
    expect(citedErrs([cited()], book).some((e) => e.includes('WCAG AA'))).toBe(true);
  });

  it('does not demand the accent be a quotation, because there is no text', () => {
    // A sourced book would reject this; a cited book must not.
    expect(citedErrs([cited()])).toEqual([]);
  });
});

describe('normalise', () => {
  it('is idempotent', () => {
    expect(normalise(normalise('a ’ b'))).toBe(normalise('a ’ b'));
  });

  it('collapses whitespace', () => {
    expect(normalise('a \n  b')).toBe('a b');
  });
});
