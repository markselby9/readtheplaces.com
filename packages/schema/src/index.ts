import { z } from 'zod';

export const CERTAINTIES = ['explicit', 'inferred', 'inspired_by', 'disputed'] as const;
export const STATUSES = ['draft', 'reviewed', 'verified'] as const;

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const sourceSchema = z.object({
  kind: z.enum([
    'passage',
    'scholarly',
    'historical-map',
    'heritage',
    'author',
    'guide',
    'external',
    'inference',
  ]),
  ref: z.string().min(1),
  url: z.url().optional(),
});

export const waypointSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),

  /**
   * The human-facing marker: "12:00" for Mrs Dalloway, "Part 1, ch. 6" for
   * Crime and Punishment. Presentation only. Ordering uses
   * `position`, which is derived from the text itself.
   */
  progressLabel: z.string().min(1),

  character: z.string().min(1),

  /** [longitude, latitude]. GeoJSON order. */
  coords: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),

  /** Set only for a deliberate excursion beyond the book's setting. */
  outsideSetting: z.boolean().optional(),

  placeCertainty: z.enum(CERTAINTIES),
  certaintyNote: z.string().optional(),

  /**
   * Verbatim from source.txt, appearing exactly once. The build finds it and
   * derives the waypoint's position in the novel. If the book does not say it,
   * the build fails.
   *
   * Sourced books only. A cited book maps an in-copyright novel, so it stores no
   * text and reproduces no passage; it uses `reference` and `order` instead.
   */
  quoteAnchor: z.string().min(12).optional(),
  passage: z.string().min(1).optional(),

  /**
   * Cited books only. Where the scene is, for citation and ordering, e.g.
   * "Chapter 6" or "Book 4, ch. 20". We never reproduce the author's words, so
   * this is a pointer, not a quotation.
   */
  reference: z.string().min(1).optional(),

  /**
   * Cited books only. An explicit sequence number, because there is no text to
   * derive a position from. The build ranks these into the 0.0-1.0 spine.
   */
  order: z.number().optional(),

  /** Our own editorial prose. On a cited book this is all the reader sees. */
  note: z.string().min(1),

  /** Other waypoints the author deliberately holds in the same moment. */
  simultaneousWith: z.array(z.string()).optional(),

  sources: z.array(sourceSchema).min(1),
  editorialStatus: z.enum(STATUSES),
});

export const characterSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(HEX),
  colorSourceQuote: z.string().optional(),
});

export const historicalLayerSchema = z.object({
  name: z.string(),
  tiles: z.string(),
  minzoom: z.number(),
  maxzoom: z.number(),
  attribution: z.string(),
  licence: z.string().optional(),
  note: z.string().optional(),
});

export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),

  /** The title in the work's original language, when that is not English, e.g.
   *  "Анна Каренина" for Anna Karenina. Presentation only; optional. */
  titleOriginal: z.string().optional(),

  author: z.string(),
  published: z.number().optional(),

  /** Presentation only: how to render the progress rail. */
  orderingKey: z.enum(['clock', 'chapter', 'position']),

  /**
   * How the book's places are grounded in the text.
   *
   * "sourced": a public-domain novel. We store the full text and every waypoint
   * quotes it verbatim, so the build can verify each claim and derive its
   * position. This is the default.
   *
   * "cited": a novel still in copyright. Locations are facts and our notes are
   * our own writing, so we can map where scenes happen without reproducing the
   * author's words. A cited book stores no text and no verbatim passages; its
   * waypoints cite the scene by `reference` and are ordered by `order`.
   */
  sourcing: z.enum(['sourced', 'cited']).default('sourced'),

  center: z.tuple([z.number(), z.number()]),
  zoom: z.number(),

  setting: z.object({
    city: z.string(),
    country: z.string().length(2),
    date: z.string().optional(),
    note: z.string().optional(),
    /** [minLon, minLat, maxLon, maxLat]. Catches transposed coordinates, and
     *  geocoders that confidently return the wrong city. */
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    /** Wikivoyage article title, for a reader who wants to actually visit, e.g.
     *  "Dublin" or "Cambridge (Massachusetts)". Destination-level only, and
     *  editor-supplied: omit it for fictional or ahistorical settings (Macondo,
     *  Middlemarch) so we never point somewhere that isn't a real place. */
    wikivoyage: z.string().min(1).optional(),
  }),

  /** The work, the translation, the transcription and the imagery are separate
   *  rights objects. We say rights-reviewed, never "licence-clean". */
  rights: z.object({
    textSource: z.string().min(1),
    originalWork: z.string().optional(),
    translation: z.string().nullable().optional(),
    textSourceUrl: z.string().optional(),
    territoryNotes: z.string().optional(),
    attribution: z.string().optional(),
  }),

  /**
   * A book's accent is a quotation from its own text, and the build checks it.
   *
   * Optional, because a book can be listed before anyone has adopted it. A stub
   * has rights, a city and a bounding box, but no colour and no waypoints, and
   * the site shows it as open for adoption. Whoever takes it chooses the colour,
   * and has to cite the line that justifies it.
   */
  palette: z
    .object({
      accent: z.string().regex(HEX),
      accentSourceQuote: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),

  /** Empty on a stub, for the same reason as palette. */
  characters: z.record(z.string(), characterSchema).default({}),

  /** Optional. Moscow, Shanghai and St Petersburg have no free historical layer;
   *  those books render a single map with no wipe. */
  layers: z.object({ historical: historicalLayerSchema.optional() }).optional(),
});

export type Source = z.infer<typeof sourceSchema>;
export type Character = z.infer<typeof characterSchema>;
export type HistoricalLayer = z.infer<typeof historicalLayerSchema>;
export type Waypoint = z.infer<typeof waypointSchema>;
export type Book = z.infer<typeof bookSchema>;

/** A waypoint whose position has been derived from the source text. */
export type BuiltWaypoint = Waypoint & { position: number };

/** The "The {place} of {book}" lede, minus the book — e.g. "The Dublin".
 *  Most places are proper nouns, but some already open with an article
 *  ("The Sundarbans", "the Mississippi", "a northern Italian abbey"). Strip a
 *  leading article before prepending "The" so the lede never doubles up. */
export const settingLede = (city: string): string => `The ${city.replace(/^(the|an?)\s+/i, '')}`;

/** Turn a `setting.wikivoyage` title into its article URL. Wikivoyage titles
 *  join words with underscores; parentheses (disambiguation) stay literal. */
export const wikivoyageUrl = (title: string): string =>
  `https://en.wikivoyage.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

export { contrast, PAPER } from './contrast.ts';
export { normalise } from './normalise.ts';
export { validateBook } from './validate.ts';
