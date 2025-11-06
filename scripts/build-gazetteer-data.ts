/**
 * Build-time script to fetch and process gazetteer data
 * This runs during `pnpm build` to create a static JSON file
 *
 * Usage: tsx scripts/build-gazetteer-data.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'gazetteer-data.json');

// Type definitions for annotation data
interface AnnotationBody {
  purpose?: string;
  source?: GeoSource;
}

interface GeoSource {
  preferredTerm?: string;
  label?: string;
  properties?: {
    title?: string;
    display_name?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
  category?: string;
  alternativeTerms?: string[];
}

interface Annotation {
  body?: AnnotationBody[];
  created?: string;
}

interface Place {
  id: string;
  name: string;
  category: string;
  coordinates?: { x: number; y: number };
  coordinateType: string;
  alternativeNames: string[];
  modernName?: string;
  created?: string;
  isGeotagged: boolean;
}

async function fetchLinkingAnnotations(maxPages = 10): Promise<Annotation[]> {
  const allAnnotations: Annotation[] = [];
  let page = 0;

  for (let i = 0; i < maxPages; i++) {
    try {
      const url =
        page === 0
          ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
          : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;

      const response = await fetch(url, {
        headers: {
          Accept: '*/*',
          'User-Agent': 'build-script',
        },
      });

      if (!response.ok) {
        break;
      }

      const data = await response.json();

      // Type guard for API response
      const isValidResponse = (
        obj: unknown,
      ): obj is { items: Annotation[]; next?: string } => {
        return (
          obj !== null &&
          typeof obj === 'object' &&
          'items' in obj &&
          Array.isArray((obj as Record<string, unknown>).items)
        );
      };

      if (isValidResponse(data)) {
        allAnnotations.push(...data.items);
        if (!data.next) {
          break;
        }
      } else {
        break;
      }

      page++;
      // Small delay to avoid overwhelming the server
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 100);
      });
    } catch {
      break;
    }
  }

  return allAnnotations;
}

function processAnnotationsToPlaces(annotations: Annotation[]): Place[] {
  const placeMap = new Map<string, Place>();

  for (const annotation of annotations) {
    try {
      // Extract geotagging data
      const geotaggingBody = annotation.body?.find(
        (body) => body.purpose === 'geotagging',
      );

      if (!geotaggingBody?.source) continue;

      const geoSource = geotaggingBody.source;

      const placeName =
        geoSource.preferredTerm ||
        geoSource.label ||
        geoSource.properties?.title ||
        'Unknown';

      const coordinates = geoSource.geometry?.coordinates
        ? {
            x: geoSource.geometry.coordinates[0],
            y: geoSource.geometry.coordinates[1],
          }
        : undefined;

      const categoryRaw = String(geoSource.category || 'place').split('/')[0];
      const category = categoryRaw || 'place';

      const placeId = `${String(placeName)
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          '-',
        )}-${coordinates?.x || ''}-${coordinates?.y || ''}`;

      if (!placeMap.has(placeId)) {
        placeMap.set(placeId, {
          id: placeId,
          name: String(placeName),
          category,
          coordinates,
          coordinateType: 'geographic',
          alternativeNames: geoSource.alternativeTerms || [],
          modernName: geoSource.properties?.display_name,
          created: annotation.created,
          isGeotagged: true,
        });
      }
    } catch {
      // Skip failed annotations
    }
  }

  const places = Array.from(placeMap.values());
  return places;
}

async function buildGazetteerData() {
  try {
    const annotations = await fetchLinkingAnnotations(20);

    if (annotations.length === 0) {
      process.exit(1);
    }

    const places = processAnnotationsToPlaces(annotations);

    const outputData = {
      generatedAt: new Date().toISOString(),
      totalAnnotations: annotations.length,
      totalPlaces: places.length,
      places,
    };

    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
  } catch {
    process.exit(1);
  }
}

// Run the build
buildGazetteerData().catch(() => {
  process.exit(1);
});
