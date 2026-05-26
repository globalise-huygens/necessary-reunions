/**
 * Real-data payloads for the Build a Spatial Anchor explainer.
 *
 * The running example is the completed Coijlang chain on W37:
 * one textspotting annotation, one iconography annotation, and one linking
 * annotation from the necessary-reunions AnnoRepo container. The canonical
 * Place is Quilon/Kollam from the linked Gazetteer entry.
 */

export type StepId =
  | 'empty'
  | 'text'
  | 'icon'
  | 'link'
  | 'anchor'
  | 'thesaurus'
  | 'future';

export interface Step {
  id: StepId;
  label: string;
  title: string;
}

export const STEPS: Step[] = [
  {
    id: 'empty',
    label: 'Map',
    title: 'Step 0: W37 Detail',
  },
  {
    id: 'text',
    label: 'Textspotting',
    title: 'Step 1: Place Name',
  },
  {
    id: 'icon',
    label: 'Iconography',
    title: 'Step 2: Related Symbol',
  },
  {
    id: 'link',
    label: 'Linking',
    title: 'Step 3: Connect Targets',
  },
  {
    id: 'anchor',
    label: 'Spatial Anchor',
    title: 'Step 4: Pixel Anchor',
  },
  {
    id: 'thesaurus',
    label: 'Gazetteer Link',
    title: 'Step 5: Place + Coordinates',
  },
  {
    id: 'future',
    label: 'Georeference',
    title: 'Step 6: Ready For Georeferencing',
  },
];

/* Real reference data */

export const CANVAS_URI =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';

export const TEXT_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/f11fee02-3a4e-40d5-8f15-660b2ff45136';

export const ICON_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/dcda0449-2801-4521-be72-4847c451be5c';

export const LINKING_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/9beeb14e-5ee3-4517-bde4-54fcbd39dce6';

export const ALLMAPS_W37_MAP_ID =
  'https://annotations.allmaps.org/maps/53f31f0df01235d3';

export const ANCHOR_XY = { x: 3251, y: 9069 } as const;

export const PLACE_PONNANI = {
  '@context': 'https://linked.art/ns/v1/linked-art.json',
  id: 'https://necessaryreunions.org/gavoc/c/quilonkollam/8.88/76.58',
  type: 'Place',
  _label: 'Quilon/Kollam',
  glob_id: 'GAVOC_quilonkollam',
  classified_as: [],
  identified_by: [
    {
      type: 'Name',
      content: 'Quilon/Kollam',
      classified_as: [{ id: 'PREF', type: 'Type', _label: 'PREF' }],
    },
    {
      type: 'Name',
      content: 'Coijlang',
      classified_as: [{ id: 'ALT', type: 'Type', _label: 'ALT' }],
    },
    {
      type: 'Name',
      content: 'Coylan, t Fort',
      classified_as: [{ id: 'ALT', type: 'Type', _label: 'ALT' }],
    },
    {
      type: 'Identifier',
      content: 'https://necessaryreunions.org/gavoc/c/quilonkollam/8.88/76.58',
    },
  ],
  referred_to_by: [
    {
      type: 'LinguisticObject',
      classified_as: [
        {
          id: 'http://vocab.getty.edu/aat/300435416',
          type: 'Type',
          _label: 'Description',
          classified_as: [
            {
              id: 'http://vocab.getty.edu/aat/300418049',
              type: 'Type',
              _label: 'Brief Text',
            },
          ],
        },
      ],
      content:
        'Linked Gazetteer Place used in the spatial anchor workflow. The map label Coijlang is connected to the modern place Quilon/Kollam.',
    },
  ],
  part_of: [],
  defined_by: 'POINT (76.58333333333333 8.883333333333333)',
  coord_certainty: 'certain',
} as const;

export const PLACE_COORDINATES: [number, number] = [
  76.58333333333333, 8.883333333333333,
];

export const MAP_CROP_REGION = {
  x: 2900,
  y: 8920,
  width: 620,
  height: 320,
} as const;

export const MAP_CROP_VIEWBOX = `${MAP_CROP_REGION.x} ${MAP_CROP_REGION.y} ${MAP_CROP_REGION.width} ${MAP_CROP_REGION.height}`;

export const W37_CROP_IMAGE_URL =
  'https://service.archief.nl/iipsrv?IIIF=/55/e6/2e/89/2d/ed/40/93/ac/54/51/7e/9f/6c/f1/6f/fa7f27fc-6c2e-430e-9004-a99f888b14bf.jp2/2900,8920,620,320/full/0/default.jpg';

export const W37_CROP_IMAGE_SRC = `/api/proxy-image?url=${encodeURIComponent(
  W37_CROP_IMAGE_URL,
)}`;

export const TEXT_POLYGON_POINTS =
  '2961,9040 3008,9032 3011,9058 3042,9042 3068,9037 3088,9036 3096,9050 3170,9045 3174,9068 3169,9100 3146,9108 3109,9092 3055,9091 3029,9109 2998,9093 2968,9093 2958,9071';

export const ICON_POLYGON_POINTS =
  '3261,9004 3244,8991 3227,8984 3219,8984 3218,9007 3218,9033 3210,9049 3206,9067 3192,9070 3198,9085 3256,9085 3334,9083 3341,9078 3339,9071 3326,9070 3314,9056 3300,9048 3290,9049 3286,9037 3275,9036 3265,9027 3261,9017';

export const TEXT_CENTROID = { x: 3066, y: 9070 } as const;
export const ICON_CENTROID = { x: 3266, y: 9038 } as const;

const REAL_TEXT_ANNOTATION = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  type: 'Annotation',
  motivation: 'textspotting',
  body: [
    {
      type: 'TextualBody',
      value: 'Coijlang',
      format: 'text/plain',
      purpose: 'supplementing',
      creator: {
        id: 'https://orcid.org/0009-0002-8032-7013',
        type: 'Person',
        label: 'Manjusha Kuruppath',
      },
      created: '2025-07-14T06:37:13.769Z',
      modified: '2025-07-14T06:37:25.130Z',
    },
    {
      type: 'TextualBody',
      value: 'Coijlang',
      format: 'text/plain',
      purpose: 'supplementing',
      generator: {
        id: 'https://hdl.handle.net/10622/X2JZYY',
        type: 'Software',
        label:
          'GLOBALISE Loghi Handwritten Text Recognition Model - August 2023',
      },
    },
  ],
  target: {
    source: CANVAS_URI,
    selector: {
      type: 'SvgSelector',
      value: `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${TEXT_POLYGON_POINTS}"/></svg>`,
    },
  },
  created: '2025-07-16T17:57:56.838Z',
  id: TEXT_ANNOTATION_ID,
  modified: '2025-08-27T14:49:05.032Z',
} as const;

const REAL_ICON_ANNOTATION = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  type: 'Annotation',
  motivation: 'iconography',
  body: [],
  target: {
    source: CANVAS_URI,
    selector: {
      type: 'SvgSelector',
      value: `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${ICON_POLYGON_POINTS}"/></svg>`,
    },
  },
  creator: {
    id: 'https://orcid.org/0000-0002-4190-9566',
    type: 'Person',
    label: 'Jona Schlegel',
  },
  created: '2025-07-20T15:02:17.367Z',
  id: ICON_ANNOTATION_ID,
  modified: '2025-08-06T07:40:39.406Z',
} as const;

const REAL_LINKING_ANNOTATION = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  id: LINKING_ANNOTATION_ID,
  type: 'Annotation',
  motivation: 'linking',
  creator: {
    id: '0000-0002-4190-9566',
    type: 'Person',
    label: 'Jona Schlegel',
  },
  created: '2025-09-01T13:33:45.569Z',
  modified: '2025-09-01T13:33:45.569Z',
  target: [ICON_ANNOTATION_ID, TEXT_ANNOTATION_ID],
  body: [
    {
      type: 'SpecificResource',
      purpose: 'identifying',
      source: {
        id: PLACE_PONNANI.id,
        type: 'Place',
        label: PLACE_PONNANI._label,
        _label: PLACE_PONNANI._label,
        glob_id: PLACE_PONNANI.glob_id,
        defined_by: PLACE_PONNANI.defined_by,
        classified_as: PLACE_PONNANI.classified_as,
        identified_by: PLACE_PONNANI.identified_by,
        coord_certainty: PLACE_PONNANI.coord_certainty,
      },
      creator: {
        id: '0000-0002-4190-9566',
        type: 'Person',
        label: 'Jona Schlegel',
      },
      created: '2025-09-01T13:25:52.364Z',
    },
    {
      type: 'SpecificResource',
      purpose: 'geotagging',
      source: {
        id: PLACE_PONNANI.id,
        type: 'Feature',
        properties: {
          title: PLACE_PONNANI._label,
          description: PLACE_PONNANI._label,
          glob_id: PLACE_PONNANI.glob_id,
          classified_as: PLACE_PONNANI.classified_as,
          coord_certainty: PLACE_PONNANI.coord_certainty,
        },
        geometry: {
          type: 'Point',
          coordinates: PLACE_COORDINATES,
        },
        _label: PLACE_PONNANI._label,
        glob_id: PLACE_PONNANI.glob_id,
        classified_as: PLACE_PONNANI.classified_as,
        identified_by: PLACE_PONNANI.identified_by,
        defined_by: PLACE_PONNANI.defined_by,
        coord_certainty: PLACE_PONNANI.coord_certainty,
      },
      creator: {
        id: '0000-0002-4190-9566',
        type: 'Person',
        label: 'Jona Schlegel',
      },
      created: '2025-09-01T13:25:53.613Z',
    },
    {
      type: 'SpecificResource',
      purpose: 'selecting',
      source: CANVAS_URI,
      selector: {
        type: 'PointSelector',
        x: ANCHOR_XY.x,
        y: ANCHOR_XY.y,
      },
      creator: {
        id: '0000-0002-4190-9566',
        type: 'Person',
        label: 'Jona Schlegel',
      },
      created: '2025-09-01T13:25:52.364Z',
    },
  ],
} as const;

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function textAnnotation(): Record<string, unknown> {
  return cloneRecord(REAL_TEXT_ANNOTATION) as Record<string, unknown>;
}

function iconAnnotation(): Record<string, unknown> {
  return cloneRecord(REAL_ICON_ANNOTATION) as Record<string, unknown>;
}

function placeEntry(): Record<string, unknown> {
  return cloneRecord(PLACE_PONNANI) as Record<string, unknown>;
}

function stepIndexFor(stepId: StepId): number {
  return STEPS.findIndex((step) => step.id === stepId);
}

function isAtLeast(step: StepId, target: StepId): boolean {
  return stepIndexFor(step) >= stepIndexFor(target);
}

/* Annotation payload builders, parameterised by step */

function linkingAnnotation(step: StepId): Record<string, unknown> {
  const baseLinking = {
    '@context': REAL_LINKING_ANNOTATION['@context'],
    id: REAL_LINKING_ANNOTATION.id,
    type: REAL_LINKING_ANNOTATION.type,
    motivation: REAL_LINKING_ANNOTATION.motivation,
    target: REAL_LINKING_ANNOTATION.target,
  };

  if (isAtLeast(step, 'thesaurus')) {
    return cloneRecord({
      ...baseLinking,
      body: [
        REAL_LINKING_ANNOTATION.body[2],
        REAL_LINKING_ANNOTATION.body[0],
        REAL_LINKING_ANNOTATION.body[1],
      ],
    }) as Record<string, unknown>;
  }

  if (isAtLeast(step, 'anchor')) {
    return cloneRecord({
      ...baseLinking,
      body: [REAL_LINKING_ANNOTATION.body[2]],
    }) as Record<string, unknown>;
  }

  return cloneRecord(baseLinking) as Record<string, unknown>;
}

function georefCandidate(): Record<string, unknown> {
  return {
    '@context': [
      'http://www.w3.org/ns/anno.jsonld',
      'http://geojson.org/geojson-ld/geojson-context.jsonld',
      'http://iiif.io/api/extension/georef/1/context.json',
    ],
    type: 'Annotation',
    motivation: 'georeferencing',
    target: {
      type: 'SpecificResource',
      source: CANVAS_URI,
    },
    body: {
      type: 'FeatureCollection',
      transformation: { type: 'polynomial', options: { order: 1 } },
      features: [
        {
          type: 'Feature',
          properties: {
            resourceCoords: [ANCHOR_XY.x, ANCHOR_XY.y],
            sourceAnnotation: LINKING_ANNOTATION_ID,
          },
          geometry: {
            type: 'Point',
            coordinates: PLACE_COORDINATES,
          },
        },
      ],
    },
    _note:
      'Candidate only. Generation from spatial anchors is the planned next step.',
  };
}

/* Preview blocks */

export type BlockTone = 'green' | 'terracotta' | 'primary' | 'blue' | 'place';

export interface PreviewBlock {
  id: 'text' | 'icon' | 'linking' | 'place' | 'georef';
  label: string;
  tone: BlockTone;
  payload: Record<string, unknown>;
}

export function blocksForStep(step: StepId): PreviewBlock[] {
  switch (step) {
    case 'text':
      return [
        {
          id: 'text',
          label: 'Text annotation · motivation: textspotting',
          tone: 'green',
          payload: textAnnotation(),
        },
      ];
    case 'icon':
      return [
        {
          id: 'icon',
          label: 'Iconography annotation · motivation: iconography',
          tone: 'terracotta',
          payload: iconAnnotation(),
        },
      ];
    case 'thesaurus':
      return [
        {
          id: 'linking',
          label: 'Linking annotation · motivation: linking',
          tone: 'primary',
          payload: linkingAnnotation(step),
        },
        {
          id: 'place',
          label: 'Gazetteer place · linked identity',
          tone: 'place',
          payload: placeEntry(),
        },
      ];
    case 'future':
      return [
        {
          id: 'linking',
          label: 'Linking annotation · motivation: linking',
          tone: 'primary',
          payload: linkingAnnotation(step),
        },
        {
          id: 'place',
          label: 'Gazetteer place · linked identity',
          tone: 'place',
          payload: placeEntry(),
        },
        {
          id: 'georef',
          label: 'Georeference candidate · one control pair',
          tone: 'blue',
          payload: georefCandidate(),
        },
      ];
    case 'link':
    case 'anchor':
      return [
        {
          id: 'linking',
          label: 'Linking annotation · motivation: linking',
          tone: 'primary',
          payload: linkingAnnotation(step),
        },
      ];
    default:
      return [];
  }
}

/* Map overlay visibility */

export type OverlayKey =
  | 'textPolygon'
  | 'iconPolygon'
  | 'linkLine'
  | 'anchor'
  | 'georefHint';

export const OVERLAY_VISIBILITY: Record<StepId, OverlayKey[]> = {
  empty: [],
  text: ['textPolygon'],
  icon: ['textPolygon', 'iconPolygon'],
  link: ['textPolygon', 'iconPolygon', 'linkLine'],
  anchor: ['textPolygon', 'iconPolygon', 'linkLine', 'anchor'],
  thesaurus: ['textPolygon', 'iconPolygon', 'linkLine', 'anchor'],
  future: ['textPolygon', 'iconPolygon', 'linkLine', 'anchor', 'georefHint'],
};
