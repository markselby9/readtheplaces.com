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
   * Crime and Punishment. Presentation only. Never used for ordering — see
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
   */
  quoteAnchor: z.string().min(12),
  passage: z.string().min(1),
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
  author: z.string(),
  published: z.number().optional(),

  /** Presentation only: how to render the progress rail. */
  orderingKey: z.enum(['clock', 'chapter', 'position']),

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

  /** A book's accent is a quotation from its own text, and the build checks it. */
  palette: z.object({
    accent: z.string().regex(HEX),
    accentSourceQuote: z.string().optional(),
    note: z.string().optional(),
  }),

  characters: z.record(z.string(), characterSchema),

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

export { contrast, PAPER } from './contrast.ts';
export { normalise } from './normalise.ts';
export { validateBook } from './validate.ts';
