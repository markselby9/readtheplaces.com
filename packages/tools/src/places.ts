import { normalise } from '@rtp/schema';

/**
 * Mine a book for candidate waypoints.
 *
 *   bun run extract mrs-dalloway [--geocode]
 *
 * This exists to change what we ask a contributor to do.
 *
 * Authoring a waypoint from nothing is a research project: read the novel, spot
 * a place, find the passage, locate it, judge how certain the location is, write
 * a note. That is an hour, and almost nobody will do it.
 *
 * Triaging a candidate is a couple of minutes. The machine has already found the
 * mention, pulled the sentence, computed where it falls in the book, and
 * proposed coordinates. A person accepts or rejects it, corrects the pin, picks a
 * certainty, and writes two sentences.
 *
 * So this script never writes a waypoint. It writes a worklist.
 *
 * It cannot be trusted with more than that. Its top candidate for Mrs Dalloway
 * is Bourton, the Dalloways' country house and the emotional origin of the whole
 * novel. Nominatim confidently places it at "Bourton Close, Hayes, London Borough
 * of Hillingdon". Only someone who has read the book catches that.
 *
 * Automate discovery. Never automate assertion.
 */

const TAILS = [
  'Street',
  'Square',
  'Park',
  'Road',
  'Lane',
  'Gardens',
  'Garden',
  'Place',
  'Circus',
  'Bridge',
  'Palace',
  'Abbey',
  'Hall',
  'House',
  'Court',
  'Terrace',
  'Row',
  'Walk',
  'Yard',
  'Hill',
  'Gate',
  'Church',
  'Cathedral',
  'Station',
  'Market',
  'Avenue',
  'Crescent',
  'Embankment',
  'Quay',
  'Wharf',
  'Green',
  'Fields',
  'Field',
  'Common',
  'Heath',
].join('|');

/**
 * A capitalised run, then a place word. At least one capitalised word is
 * required, so a bare "the court" is not mistaken for a place. "St." may lead.
 */
const PLACE = new RegExp(String.raw`\b((?:St\.?\s+)?(?:[A-Z][\w'-]+\s+){1,3}(?:${TAILS}))\b`, 'g');

/**
 * Places with no tail word need a per-book gazetteer, because no rule separates
 * "Piccadilly" (a place) from "Clarissa" (a person). Extending this list is
 * itself a perfectly good first contribution.
 */
const GAZETTEER = [
  'Piccadilly',
  'Westminster',
  'Whitehall',
  'Bloomsbury',
  'Mayfair',
  'Hatchards',
  'Bourton',
  'Holborn',
  'Strand',
  'Soho',
  'Chelsea',
  'Kensington',
  'Greenwich',
  'Waterloo',
  'Marylebone',
  'Bayswater',
];

export interface Candidate {
  name: string;
  mentions: number;
  firstPosition: number;
  proposedPassage: string;
  alreadyCovered: boolean;
  /** Suggestions for a human to confirm. Never an answer. See Bourton. */
  coordSuggestions?: Array<{ coords: [number, number]; label: string }>;
}

function sentenceAround(text: string, i: number): string {
  const start = text.lastIndexOf('.', i - 1) + 1;
  const dot = text.indexOf('.', i);
  const end = dot === -1 ? text.length : dot + 1;
  return text.slice(Math.max(0, start), end).trim();
}

export function findPlaces(rawText: string, gazetteer: string[] = GAZETTEER): Candidate[] {
  const text = normalise(rawText);
  const hits = new Map<string, number[]>();

  const add = (name: string, at: number) => {
    const list = hits.get(name) ?? [];
    list.push(at);
    hits.set(name, list);
  };

  for (const m of text.matchAll(PLACE)) add(m[1]!.trim(), m.index);

  if (gazetteer.length > 0) {
    const escaped = gazetteer.map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    for (const m of text.matchAll(new RegExp(String.raw`\b(${escaped})\b`, 'g'))) {
      add(m[1]!, m.index);
    }
  }

  return [...hits.entries()]
    .map(([name, at]) => ({
      name,
      mentions: at.length,
      firstPosition: Math.round((at[0]! / text.length) * 1e5) / 1e5,
      proposedPassage: sentenceAround(text, at[0]!),
      alreadyCovered: false,
    }))
    .sort((a, b) => b.mentions - a.mentions);
}
