/**
 * Sync AnnoRepo linking annotations with updated NeRu place dataset
 *
 * This script:
 * 1. Loads the current NeRu place dataset
 * 2. Fetches all linking annotations from AnnoRepo that have NeRu geotags
 * 3. Updates annotations where the place data has changed (new coordinates, etc.)
 *
 * Run manually: pnpm tsx data/scripts/sync-annorepo-geotags.ts
 * Or via GitHub Actions after dataset updates
 */

import fs from 'node:fs';
import path from 'node:path';

const ANNOREPO_BASE = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// Delay helper to avoid eslint promise-executor-return warning
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface NeRuPlace {
  '@context': string;
  id: string;
  type: string;
  _label: string;
  glob_id?: string;
  coord_certainty?: string;
  classified_as?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
  identified_by: Array<{
    type: string;
    content: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  defined_by?: string;
}

interface AnnotationBody {
  purpose?: string;
  type?: string;
  source?: {
    glob_id?: string;
    _label?: string;
    geometry?: {
      coordinates?: [number, number];
    };
    properties?: {
      glob_id?: string;
      title?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Output body type for building new annotation bodies
interface OutputAnnotationBody {
  purpose: string;
  type: string;
  source: Record<string, unknown>;
}

interface Annotation {
  id: string;
  body?: AnnotationBody | AnnotationBody[];
  [key: string]: unknown;
}

interface AnnotationPage {
  items?: Annotation[];
  next?: string;
}

interface SyncStats {
  totalAnnotations: number;
  neruGeotags: number;
  updated: number;
  unchanged: number;
  errors: number;
  notFound: number;
}

function parseWKTPoint(wkt: string): [number, number] | null {
  const match = wkt.match(
    /POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/,
  );
  if (match && match[1] && match[2]) {
    return [parseFloat(match[1]), parseFloat(match[2])];
  }
  return null;
}

function loadNeRuDataset(): Map<string, NeRuPlace> {
  const datasetPath = path.join(
    process.cwd(),
    'public',
    'neru-place-dataset.json',
  );
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as NeRuPlace[];

  const map = new Map<string, NeRuPlace>();
  for (const place of data) {
    if (place.glob_id) {
      map.set(place.glob_id, place);
    }
  }

  console.log(`Loaded ${map.size} NeRu places with glob_id`);
  return map;
}

async function fetchAllLinkingAnnotations(
  token: string,
): Promise<Annotation[]> {
  const annotations: Annotation[] = [];

  // Fetch linking annotations using the custom query
  // motivationorpurpose=bGlua2luZw== is base64 for "linking"
  let pageUrl: string | null =
    `${ANNOREPO_BASE}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

  let pageCount = 0;
  const maxPages = 100; // Safety limit

  while (pageUrl && pageCount < maxPages) {
    console.log(`Fetching page ${pageCount + 1}...`);

    const response = await fetch(pageUrl, {
      headers: {
        Accept: 'application/ld+json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch annotations: ${response.status}`);
    }

    const data = (await response.json()) as AnnotationPage;
    const items = data.items ?? [];
    annotations.push(...items);

    // Check for next page
    pageUrl = data.next ?? null;
    pageCount++;

    // Small delay to avoid rate limiting
    await delay(100);
  }

  console.log(`Fetched ${annotations.length} linking annotations`);
  return annotations;
}

function extractNeRuGlobId(annotation: Annotation): string | null {
  if (!annotation.body) return null;

  const bodies: AnnotationBody[] = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  for (const body of bodies) {
    if (body.purpose === 'geotagging' || body.purpose === 'identifying') {
      // Check various locations where glob_id might be stored
      const globId = body.source?.glob_id ?? body.source?.properties?.glob_id;

      if (
        globId &&
        typeof globId === 'string' &&
        (globId.startsWith('NR_') || globId.startsWith('GLOB_'))
      ) {
        return globId;
      }
    }
  }

  return null;
}

function needsUpdate(annotation: Annotation, neruPlace: NeRuPlace): boolean {
  const bodies: AnnotationBody[] = Array.isArray(annotation.body)
    ? annotation.body
    : annotation.body
      ? [annotation.body]
      : [];
  const geotagBody = bodies.find(
    (b: AnnotationBody) => b.purpose === 'geotagging',
  );

  if (!geotagBody?.source) return true;

  // Check if coordinates changed
  const currentCoords = geotagBody.source.geometry?.coordinates;
  const newCoords = neruPlace.defined_by
    ? parseWKTPoint(neruPlace.defined_by)
    : null;

  // If dataset now has coordinates but annotation doesn't
  if (
    newCoords &&
    (!currentCoords || (currentCoords[0] === 0 && currentCoords[1] === 0))
  ) {
    return true;
  }

  // If coordinates differ
  if (newCoords && currentCoords) {
    if (
      Math.abs(currentCoords[0] - newCoords[0]) > 0.0001 ||
      Math.abs(currentCoords[1] - newCoords[1]) > 0.0001
    ) {
      return true;
    }
  }

  // Check if label changed
  const currentLabel =
    geotagBody.source.properties?.title ?? geotagBody.source._label;
  if (currentLabel !== neruPlace._label) {
    return true;
  }

  return false;
}

function buildUpdatedBodies(
  annotation: Annotation,
  neruPlace: NeRuPlace,
): OutputAnnotationBody[] {
  const bodies: AnnotationBody[] = Array.isArray(annotation.body)
    ? [...annotation.body]
    : annotation.body
      ? [annotation.body]
      : [];

  // Filter out old geotag/identifying bodies
  const filteredBodies: OutputAnnotationBody[] = bodies
    .filter(
      (b: AnnotationBody) =>
        b.purpose !== 'geotagging' && b.purpose !== 'identifying',
    )
    .map((b) => ({
      purpose: b.purpose ?? '',
      type: b.type ?? '',
      source: (b.source ?? {}) as Record<string, unknown>,
    }));

  const title = neruPlace._label;
  const coords = neruPlace.defined_by
    ? parseWKTPoint(neruPlace.defined_by)
    : ([0, 0] as [number, number]);
  const globId = neruPlace.glob_id!;

  // Add fresh identifying body
  filteredBodies.push({
    purpose: 'identifying',
    type: 'SpecificResource',
    source: {
      id: neruPlace.id || `https://id.necessaryreunions.org/place/${globId}`,
      type: 'Place',
      label: title,
      _label: title,
      glob_id: globId,
      defined_by:
        neruPlace.defined_by ||
        `POINT(${coords?.[0] ?? 0} ${coords?.[1] ?? 0})`,
      classified_as: neruPlace.classified_as,
      identified_by: neruPlace.identified_by,
      coord_certainty: neruPlace.coord_certainty,
    },
  });

  // Add fresh geotagging body
  filteredBodies.push({
    purpose: 'geotagging',
    type: 'SpecificResource',
    source: {
      id: neruPlace.id || `https://id.necessaryreunions.org/place/${globId}`,
      type: 'Feature',
      properties: {
        title: title,
        description: title,
        glob_id: globId,
        classified_as: neruPlace.classified_as,
        coord_certainty: neruPlace.coord_certainty,
      },
      geometry: {
        type: 'Point',
        coordinates: coords,
      },
      _label: title,
      glob_id: globId,
      classified_as: neruPlace.classified_as,
      identified_by: neruPlace.identified_by,
      defined_by: neruPlace.defined_by,
      coord_certainty: neruPlace.coord_certainty,
    },
  });

  return filteredBodies;
}

async function updateAnnotation(
  annotation: Annotation,
  newBodies: OutputAnnotationBody[],
  token: string,
): Promise<boolean> {
  const annotationId = annotation.id;
  const encodedId = encodeURIComponent(encodeURIComponent(annotationId));

  const updatedAnnotation = {
    ...annotation,
    body: newBodies,
    modified: new Date().toISOString(),
  };

  const response = await fetch(
    `${ANNOREPO_BASE}/w3c/${CONTAINER}/${encodedId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/ld+json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatedAnnotation),
    },
  );

  return response.ok;
}

async function main() {
  const token = process.env.ANNO_REPO_TOKEN_JONA;

  if (!token) {
    console.error('ANNO_REPO_TOKEN_JONA environment variable not set');
    process.exit(1);
  }

  const stats: SyncStats = {
    totalAnnotations: 0,
    neruGeotags: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    notFound: 0,
  };

  try {
    // Load NeRu dataset
    const neruDataset = loadNeRuDataset();

    // Fetch all linking annotations
    const annotations = await fetchAllLinkingAnnotations(token);
    stats.totalAnnotations = annotations.length;

    // Process each annotation
    for (const annotation of annotations) {
      const globId = extractNeRuGlobId(annotation);

      if (!globId) {
        continue; // Not a NeRu geotag
      }

      stats.neruGeotags++;

      const neruPlace = neruDataset.get(globId);
      if (!neruPlace) {
        console.warn(`Place not found in dataset: ${globId}`);
        stats.notFound++;
        continue;
      }

      if (!needsUpdate(annotation, neruPlace)) {
        stats.unchanged++;
        continue;
      }

      console.log(`Updating annotation for ${globId} (${neruPlace._label})`);

      const newBodies = buildUpdatedBodies(annotation, neruPlace);
      const success = await updateAnnotation(annotation, newBodies, token);

      if (success) {
        stats.updated++;
      } else {
        console.error(`Failed to update annotation: ${annotation.id}`);
        stats.errors++;
      }

      // Small delay between updates
      await delay(50);
    }

    console.log('\n--- Sync Complete ---');
    console.log(`Total linking annotations: ${stats.totalAnnotations}`);
    console.log(`With NeRu geotags: ${stats.neruGeotags}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Unchanged: ${stats.unchanged}`);
    console.log(`Not found in dataset: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors}`);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
