/**
 * Real-data payloads for the Build a Spatial Anchor explainer.
 *
 * The running example is the completed Ponnani / Pananie chain on W37:
 * one textspotting annotation, one iconography annotation, and one linking
 * annotation from the necessary-reunions AnnoRepo container. The canonical
 * Place is the matching Ponnani record in public/neru-place-dataset.json.
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
  body: string;
}

export const STEPS: Step[] = [
  {
    id: 'empty',
    label: 'Nothing Yet',
    title: 'Nothing Yet',
    body: 'Start from the map crop alone. No annotation object is shown yet.',
  },
  {
    id: 'text',
    label: 'Text Annotation',
    title: 'Text Annotation',
    body: 'Add one textspotting annotation with the value "Pananie" and its SvgSelector polygon.',
  },
  {
    id: 'icon',
    label: 'Iconography Annotation',
    title: 'Iconography Annotation',
    body: 'Keep the text outline visible, then add the iconography outline and a simple classification body.',
  },
  {
    id: 'link',
    label: 'Linking Targets',
    title: 'Linking Targets',
    body: 'Build a linking annotation with motivation "linking" and only the ordered target array: first textspotting, then iconography.',
  },
  {
    id: 'anchor',
    label: 'Point Selected',
    title: 'Point Selected',
    body: 'Update the linking annotation with a selecting body and PointSelector at x 2106, y 6547.',
  },
  {
    id: 'thesaurus',
    label: 'Thesaurus + Coordinates',
    title: 'Thesaurus + Coordinates',
    body: 'Add identifying and geotagging bodies from the Ponnani thesaurus entry, including real-world coordinates.',
  },
  {
    id: 'future',
    label: 'Future Allmaps Path',
    title: 'Future Allmaps Path',
    body: 'The image-space point and world coordinates form one control pair. A future step can aggregate many pairs into IIIF Georeference annotations for Allmaps workflows.',
  },
];

/* Real reference data */

export const CANVAS_URI =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';

export const TEXT_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/f701ac80-829e-4c39-8d87-d2c028c3bd92';

export const ICON_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/c6ee0834-cfec-4d04-b3a6-7a29cc57108d';

export const LINKING_ANNOTATION_ID =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/5552c664-a523-448a-98bc-047182045373';

export const ALLMAPS_W37_MAP_ID =
  'https://annotations.allmaps.org/maps/53f31f0df01235d3';

export const ANCHOR_XY = { x: 2106, y: 6547 } as const;

export const PLACE_PONNANI = {
  '@context': 'https://linked.art/ns/v1/linked-art.json',
  id: 'https://id.necessaryreunions.org/place/4a47ef90-5a48-57a1-855e-7c9e60b080c8',
  type: 'Place',
  _label: 'Ponnani',
  glob_id: 'GLOB_366',
  classified_as: [],
  identified_by: [
    {
      type: 'Name',
      content: 'Ponnani',
      classified_as: [{ id: 'PREF', type: 'Type', _label: 'PREF' }],
    },
    {
      type: 'Name',
      content: 'Paniane Residensi van den Samorijn',
      classified_as: [{ id: 'ALT', type: 'Type', _label: 'ALT' }],
    },
    {
      type: 'Name',
      content: 'Pananie',
      classified_as: [{ id: 'ALT', type: 'Type', _label: 'ALT' }],
    },
    { type: 'Identifier', content: 'amh_601p' },
    { type: 'Identifier', content: 'https://geonames.org/1259411' },
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
        '[RELATION: Part Of Kodungallur (Kingdom) ()] Ponnani (Pananie on the map) is indicated as being part of "the land of the Samoryn or the kingdom of Krangenoor (Kodungallur)." This suggests that the kingdom of Krangenoor was conquered by the Samoryn (Zamorin or Samuthiri) or the King of Calicut (i.e. Kozhikode). The map also demarcates the Kingdom of Calicut as being separate from the Kingdom of Kodungallur.',
    },
  ],
  part_of: [
    {
      id: 'https://id.necessaryreunions.org/place/f87ca380-b433-5b34-8ec4-a5f87220da64',
      type: 'Place',
      _label: 'Kodungallur (Kingdom) ()',
      classified_as: [],
    },
  ],
  defined_by: 'POINT (75.920835 10.776903)',
  coord_certainty: 'certain',
} as const;

export const PLACE_COORDINATES: [number, number] = [75.920835, 10.776903];

export const MAP_CROP_REGION = {
  x: 1700,
  y: 6400,
  width: 650,
  height: 350,
} as const;

export const MAP_CROP_VIEWBOX = `${MAP_CROP_REGION.x} ${MAP_CROP_REGION.y} ${MAP_CROP_REGION.width} ${MAP_CROP_REGION.height}`;

export const W37_CROP_IMAGE_URL =
  'https://service.archief.nl/iipsrv?IIIF=/55/e6/2e/89/2d/ed/40/93/ac/54/51/7e/9f/6c/f1/6f/fa7f27fc-6c2e-430e-9004-a99f888b14bf.jp2/1700,6400,650,350/full/0/default.jpg';

export const W37_CROP_IMAGE_SRC = `/api/proxy-image?url=${encodeURIComponent(
  W37_CROP_IMAGE_URL,
)}`;

export const TEXT_POLYGON_POINTS =
  '1801,6516 1862,6514 1877,6530 2042,6534 2054,6565 2053,6583 1806,6571';

export const ICON_POLYGON_POINTS =
  '2090,6472 2086,6508 2080,6515 2079,6525 2078,6546 2078,6555 2083,6559 2112,6561 2146,6560 2156,6559 2155,6549 2152,6529 2136,6522 2131,6506 2134,6485 2117,6473 2094,6470';

export const TEXT_CENTROID = { x: 1928, y: 6549 } as const;
export const ICON_CENTROID = { x: 2118, y: 6521 } as const;

const REAL_TEXT_ANNOTATION = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  type: 'Annotation',
  motivation: 'textspotting',
  body: [
    {
      type: 'TextualBody',
      value: 'Pananie',
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
      value: 'Pananie',
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
  created: '2025-07-14T06:37:13.769Z',
  id: TEXT_ANNOTATION_ID,
  modified: '2025-08-27T14:49:01.745Z',
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
  created: '2025-08-04T12:49:24.038Z',
  id: ICON_ANNOTATION_ID,
  modified: '2025-08-06T07:40:45.863Z',
} as const;

const REAL_LINKING_ANNOTATION = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  id: LINKING_ANNOTATION_ID,
  type: 'Annotation',
  motivation: 'linking',
  creator: {
    id: 'https://orcid.org/0009-0002-8032-7013',
    type: 'Person',
    label: 'Manjusha Kuruppath',
  },
  created: '2025-08-06T14:40:38.532Z',
  modified: '2026-01-22T18:00:43.757Z',
  target: [TEXT_ANNOTATION_ID, ICON_ANNOTATION_ID],
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
        id: 'https://orcid.org/0009-0002-8032-7013',
        type: 'Person',
        label: 'Manjusha Kuruppath',
      },
      created: '2025-12-28T13:51:43.411Z',
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
        id: 'https://orcid.org/0009-0002-8032-7013',
        type: 'Person',
        label: 'Manjusha Kuruppath',
      },
      created: '2025-12-28T13:51:44.095Z',
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
        id: 'https://orcid.org/0009-0002-8032-7013',
        type: 'Person',
        label: 'Manjusha Kuruppath',
      },
      created: '2025-12-28T13:51:43.411Z',
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

function isAtLeast(step: StepId, target: StepId): boolean {
  const order: StepId[] = [
    'empty',
    'text',
    'icon',
    'link',
    'anchor',
    'thesaurus',
    'future',
  ];
  return order.indexOf(step) >= order.indexOf(target);
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
  const blocks: PreviewBlock[] = [];

  if (isAtLeast(step, 'text')) {
    blocks.push({
      id: 'text',
      label: 'Text annotation · motivation: textspotting',
      tone: 'green',
      payload: textAnnotation(),
    });
  }

  if (isAtLeast(step, 'icon')) {
    blocks.push({
      id: 'icon',
      label: 'Iconography annotation · motivation: iconography',
      tone: 'terracotta',
      payload: iconAnnotation(),
    });
  }

  if (isAtLeast(step, 'link')) {
    blocks.push({
      id: 'linking',
      label: 'Linking annotation · motivation: linking',
      tone: 'primary',
      payload: linkingAnnotation(step),
    });
  }

  if (step === 'thesaurus' || step === 'future') {
    blocks.push({
      id: 'place',
      label: 'External place entry · Linked.art Place',
      tone: 'place',
      payload: PLACE_PONNANI as unknown as Record<string, unknown>,
    });
  }

  if (step === 'future') {
    blocks.push({
      id: 'georef',
      label: 'Candidate IIIF Georeference Annotation',
      tone: 'blue',
      payload: georefCandidate(),
    });
  }

  return blocks;
}

/* Map overlay visibility */

export type OverlayKey =
  | 'textPolygon'
  | 'iconPolygon'
  | 'transcriptionCard'
  | 'classificationCard'
  | 'linkLine'
  | 'anchor'
  | 'placeCard'
  | 'coordinateCard'
  | 'georefHint';

export const OVERLAY_VISIBILITY: Record<StepId, OverlayKey[]> = {
  empty: [],
  text: ['textPolygon', 'transcriptionCard'],
  icon: [
    'textPolygon',
    'iconPolygon',
    'transcriptionCard',
    'classificationCard',
  ],
  link: [
    'textPolygon',
    'iconPolygon',
    'transcriptionCard',
    'classificationCard',
    'linkLine',
  ],
  anchor: [
    'textPolygon',
    'iconPolygon',
    'transcriptionCard',
    'classificationCard',
    'linkLine',
    'anchor',
  ],
  thesaurus: [
    'textPolygon',
    'iconPolygon',
    'transcriptionCard',
    'classificationCard',
    'linkLine',
    'anchor',
    'placeCard',
    'coordinateCard',
  ],
  future: [
    'textPolygon',
    'iconPolygon',
    'transcriptionCard',
    'classificationCard',
    'linkLine',
    'anchor',
    'placeCard',
    'coordinateCard',
    'georefHint',
  ],
};
