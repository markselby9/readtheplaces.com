import { describe, expect, it } from 'vitest';
import { bookSchema, wikivoyageUrl } from '../src/index.ts';

/**
 * A reader who wants to actually visit gets one destination-level link, built
 * from an editor-supplied Wikivoyage title. These pin the URL shape and the
 * optional schema field so neither drifts.
 */

describe('wikivoyageUrl', () => {
  it('builds an article URL from a title', () => {
    expect(wikivoyageUrl('Dublin')).toBe('https://en.wikivoyage.org/wiki/Dublin');
  });

  it('joins words with underscores, the way Wikivoyage titles do', () => {
    expect(wikivoyageUrl('Ho Chi Minh City')).toBe(
      'https://en.wikivoyage.org/wiki/Ho_Chi_Minh_City',
    );
  });

  it('keeps disambiguation parentheses intact', () => {
    expect(wikivoyageUrl('Cambridge (Massachusetts)')).toBe(
      'https://en.wikivoyage.org/wiki/Cambridge_(Massachusetts)',
    );
  });
});

describe('bookSchema setting.wikivoyage', () => {
  const raw = {
    id: 'test',
    title: 'Test',
    author: 'Test',
    orderingKey: 'clock' as const,
    center: [-0.14, 51.51] as [number, number],
    zoom: 13,
    setting: { city: 'Dublin', country: 'IE' },
    rights: { textSource: 'Standard Ebooks' },
  };

  it('retains an optional Wikivoyage title', () => {
    const parsed = bookSchema.parse({ ...raw, setting: { ...raw.setting, wikivoyage: 'Dublin' } });
    expect(parsed.setting.wikivoyage).toBe('Dublin');
  });

  it('is optional — a book without it still validates', () => {
    const parsed = bookSchema.parse(raw);
    expect(parsed.setting.wikivoyage).toBeUndefined();
  });
});
