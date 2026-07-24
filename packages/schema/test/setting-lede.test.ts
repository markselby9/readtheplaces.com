import { describe, expect, it } from 'vitest';
import { settingLede } from '../src/index.ts';

/**
 * Every book page, tab title, SERP snippet and share card leads with
 * "The {place} of {book}". A place is usually a proper noun ("Dublin"), but
 * some are phrases that already open with an article ("The Sundarbans",
 * "the Mississippi", "a northern Italian abbey"). Blindly prepending "The"
 * gives "The The Sundarbans …" / "The a northern Italian abbey …". settingLede
 * strips a leading article first, so the lede reads naturally either way.
 */

describe('settingLede', () => {
  it('prepends "The" to a proper-noun place', () => {
    expect(settingLede('Dublin')).toBe('The Dublin');
  });

  it('does not double an existing capitalised "The"', () => {
    expect(settingLede('The Sundarbans')).toBe('The Sundarbans');
  });

  it('lifts a lowercase "the" to open the lede', () => {
    expect(settingLede('the Mississippi')).toBe('The Mississippi');
  });

  it('replaces a leading "a" with "The"', () => {
    expect(settingLede('a northern Italian abbey')).toBe('The northern Italian abbey');
  });

  it('replaces a leading "an" with "The"', () => {
    expect(settingLede('an old mill town')).toBe('The old mill town');
  });

  it('leaves a lowercase phrase that is not an article alone', () => {
    expect(settingLede('provincial Russia')).toBe('The provincial Russia');
  });
});
