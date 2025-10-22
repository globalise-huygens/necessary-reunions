/**
 * Build-time script to fetch and process gazetteer data
 * This runs during `pnpm build` to create a static JSON file
 * 
 * Usage: tsx scripts/build-gazetteer-data.ts
 */

import fs from 'fs';
import path from 'path';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'gazetteer-data.json');

async function fetchLinkingAnnotations(maxPages = 10): Promise<any[]> {
  console.log('[Build] Fetching linking annotations...');
  const allAnnotations: any[] = [];
  let page = 0;

  for (let i = 0; i < maxPages; i++) {
    try {
      const url =
        page === 0
          ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
          : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;

      console.log(`[Build] Fetching page ${page}...`);
      const response = await fetch(url, {
        headers: {
          Accept: '*/*',
          'User-Agent': 'build-script',
        },
      });

      if (!response.ok) {
        console.error(`[Build] Failed to fetch page ${page}: ${response.status}`);
        break;
      }

      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        allAnnotations.push(...data.items);
        console.log(`[Build] Page ${page}: +${data.items.length} annotations (total: ${allAnnotations.length})`);
      }

      if (!data.next) {
        console.log(`[Build] Reached last page at ${page}`);
        break;
      }

      page++;
      // Small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Build] Error fetching page ${page}:`, error);
      break;
    }
  }

  return allAnnotations;
}

async function processAnnotationsToPlaces(annotations: any[]): Promise<any[]> {
  console.log(`[Build] Processing ${annotations.length} annotations into places...`);
  
  const placeMap = new Map<string, any>();

  for (const annotation of annotations) {
    try {
      // Extract geotagging data
      const geotaggingBody = annotation.body?.find(
        (body: any) => body.purpose === 'geotagging'
      );

      if (!geotaggingBody) continue;

      const geoSource = geotaggingBody.source;
      const placeName =
        geoSource.preferredTerm ||
        geoSource.label ||
        geoSource.properties?.title ||
        'Unknown';

      const coordinates = geoSource.geometry?.coordinates
        ? { x: geoSource.geometry.coordinates[0], y: geoSource.geometry.coordinates[1] }
        : undefined;

      const category = (geoSource.category || 'place').split('/')[0];

      const placeId = `${placeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${coordinates?.x || ''}-${coordinates?.y || ''}`;

      if (!placeMap.has(placeId)) {
        placeMap.set(placeId, {
          id: placeId,
          name: placeName,
          category,
          coordinates,
          coordinateType: 'geographic',
          alternativeNames: geoSource.alternativeTerms || [],
          modernName: geoSource.properties?.display_name,
          created: annotation.created,
          isGeotagged: true,
        });
      }
    } catch (error) {
      console.error('[Build] Error processing annotation:', error);
    }
  }

  const places = Array.from(placeMap.values());
  console.log(`[Build] Created ${places.length} unique places`);
  return places;
}

async function buildGazetteerData() {
  console.log('[Build] Starting gazetteer data build...');

  try {
    // Fetch linking annotations (limit to reasonable amount for build time)
    const annotations = await fetchLinkingAnnotations(20); // Fetch up to 20 pages

    if (annotations.length === 0) {
      console.error('[Build] No annotations fetched - build failed');
      process.exit(1);
    }

    // Process into places
    const places = await processAnnotationsToPlaces(annotations);

    // Create output data structure
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

    console.log(`[Build] ✓ Successfully wrote ${places.length} places to ${OUTPUT_FILE}`);
    console.log(`[Build] ✓ File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('[Build] Failed to build gazetteer data:', error);
    process.exit(1);
  }
}

// Run the build
buildGazetteerData().catch((error) => {
  console.error('[Build] Unhandled error:', error);
  process.exit(1);
});
