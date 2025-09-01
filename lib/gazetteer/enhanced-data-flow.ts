/**
 * Enhanced Data Flow for Gazetteer with Geotagged Annotations
 *
 * CURRENT SYSTEM (Simple Explanation):
 * =====================================
 *
 * 1. SOURCE: Linking Annotations (motivation: "linking")
 *    - Query: custom-query with motivationorpurpose=bGlua2luZw== (base64 "linking")
 *    - Found: 211 linking annotations
 *
 * 2. STRUCTURE:
 *    LINKING ANNOTATION:
 *    {
 *      "motivation": "linking",
 *      "target": [
 *        "url-to-text-annotation-1",
 *        "url-to-text-annotation-2"
 *      ],
 *      "body": [{
 *        "selector": { "x": 1869, "y": 4903 }  // Place values on the image (not pixel values!)
 *      }],
 *      "creator": { "label": "Jan Janson" }
 *    }
 *
 *    TARGET ANNOTATION (Text Spotting):
 *    {
 *      "motivation": "textspotting",
 *      "body": [{
 *        "value": "Mandie.",                    // The actual text found
 *        "creator": Person OR "generator": AI   // Who/what found it
 *      }],
 *      "target": { "source": "canvas-url" }    // Which map image
 *    }
 *
 * 3. CURRENT PROCESS:
 *    - Fetch all linking annotations
 *    - For each: get pixel coords + fetch target text annotations
 *    - Combine text parts: "Mandie." or "'T RYK TREVANCOUR"
 *    - Create place: { name, coordinates, category:"place" }
 *
 *
 * ENHANCED SYSTEM (With Geotagged Support):
 * =========================================
 *
 * 1. FETCH MULTIPLE ANNOTATION TYPES:
 *    a) Linking annotations (current)
 *    b) Geotagging annotations (new)
 *
 * 2. PRIORITY SYSTEM:
 *    - IF geotagged annotation exists for a place:
 *      * PRIMARY NAME: Geotagged name (modern/standardized)
 *      * ALTERNATIVE NAMES: Text spotting results (historical variants)
 *      * COORDINATES: Geographic lat/lng from geotagging
 *    - ELSE (only linking):
 *      * PRIMARY NAME: Combined text spotting results
 *      * COORDINATES: Pixel coordinates
 *
 * 3. ENHANCED PLACE STRUCTURE:
 *    {
 *      "name": "Cochin",                    // Primary name (geotagged if available)
 *      "alternativeNames": [                // Historical variants from text spotting
 *        "Cochim", "Coetchim", "Kochi"
 *      ],
 *      "coordinates": {
 *        "x": 76.2673, "y": 9.9312         // Geographic if geotagged, else pixels
 *      },
 *      "coordinateType": "geographic",      // "geographic" or "pixel"
 *      "sources": {
 *        "geotagged": { ... },              // Geotagging annotation info
 *        "textSpotting": [ ... ],           // Text spotting annotation info
 *        "linking": { ... }                 // Linking annotation info
 *      },
 *      "mapReferences": [                   // Where mentioned on maps
 *        {
 *          "mapId": "W37.json",
 *          "textFound": "Cochim",
 *          "coordinates": { "x": 7940, "y": 5114 },
 *          "creator": "Loghi HTR"
 *        }
 *      ]
 *    }
 */

export interface EnhancedGazetteerPlace {
  name: string;
  alternativeNames?: string[];
  coordinates?: {
    x: number;
    y: number;
  };
  coordinateType?: 'geographic' | 'pixel';
  category: string;
  sources?: {
    geotagged?: any;
    textSpotting?: any[];
    linking?: any;
  };
  mapReferences?: Array<{
    mapId: string;
    textFound: string;
    coordinates: { x: number; y: number };
    creator: string;
  }>;
}

/**
 * Enhanced fetching strategy
 */
export async function fetchAllRelevantAnnotations() {
  const results: {
    linking: any[];
    geotagging: any[];
    textSpotting: any[];
  } = {
    linking: [],
    geotagging: [],
    textSpotting: [],
  };

  results.linking = await fetchAnnotationsByMotivation('linking');

  results.geotagging = await fetchAnnotationsByMotivation('geotagging');

  // results.textSpotting = await fetchAnnotationsByMotivation('textspotting');

  return results;
}

async function fetchAnnotationsByMotivation(
  motivation: string,
): Promise<any[]> {
  const base64Motivation = btoa(motivation);
  const url = `https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=${base64Motivation}`;

  try {
    const annotations: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageUrl = `${url}&page=${page}`;
      console.log(
        `Fetching ${motivation} annotations from page ${page}:`,
        pageUrl,
      );

      const response = await fetch(pageUrl, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error(
          `Failed to fetch ${motivation} annotations from page ${page}:`,
          response.status,
          response.statusText,
        );
        break;
      }

      const data = await response.json();

      if (data && Array.isArray(data)) {
        annotations.push(...data);
        console.log(
          `Fetched ${data.length} ${motivation} annotations from page ${page}`,
        );

        hasMore = data.length > 0 && data.length >= 20;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total ${motivation} annotations fetched:`, annotations.length);
    return annotations;
  } catch (error) {
    console.error(`Error fetching ${motivation} annotations:`, error);
    return [];
  }
}

/**
 * Enhanced processing strategy
 */
export function processEnhancedAnnotations(
  annotations: any,
): EnhancedGazetteerPlace[] {
  const placeMap = new Map<string, EnhancedGazetteerPlace>();

  for (const geoAnnotation of annotations.geotagging) {
    const place = processGeotaggedAnnotation(geoAnnotation);
    placeMap.set(place.name, place);
  }

  for (const linkAnnotation of annotations.linking) {
    const placeName = extractPlaceNameFromLinking(linkAnnotation);

    if (placeMap.has(placeName)) {
      enhanceWithTextSpotting(placeMap.get(placeName)!, linkAnnotation);
    } else {
      const place = processLinkingAnnotation(linkAnnotation);
      placeMap.set(place.name, place);
    }
  }

  return Array.from(placeMap.values());
}

function processGeotaggedAnnotation(annotation: any): EnhancedGazetteerPlace {
  return {
    name: annotation.body.value,
    coordinates: {
      x: annotation.body.longitude,
      y: annotation.body.latitude,
    },
    coordinateType: 'geographic',
    category: annotation.body.category || 'place',
    sources: { geotagged: annotation },
    alternativeNames: [],
    mapReferences: [],
  };
}

function enhanceWithTextSpotting(
  place: EnhancedGazetteerPlace,
  linkingAnnotation: any,
) {}

function extractPlaceNameFromLinking(linkAnnotation: any): string {
  return linkAnnotation.id || 'Unknown Place';
}

function processLinkingAnnotation(linkAnnotation: any): EnhancedGazetteerPlace {
  return {
    name: 'Unknown Place',
    coordinates: { x: 0, y: 0 },
    coordinateType: 'pixel',
    category: 'place',
    sources: { linking: linkAnnotation },
  };
}
