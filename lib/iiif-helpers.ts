import type { Manifest } from './types';

export function getLocalizedValue(languageMap: any, preferredLanguage = 'en') {
  if (!languageMap) return null;

  if (typeof languageMap === 'string') return languageMap;

  if (Array.isArray(languageMap)) return languageMap.join(', ');

  if (languageMap[preferredLanguage]) {
    return Array.isArray(languageMap[preferredLanguage])
      ? languageMap[preferredLanguage].join(', ')
      : languageMap[preferredLanguage];
  }

  const firstLang = Object.keys(languageMap)[0];
  if (firstLang) {
    return Array.isArray(languageMap[firstLang])
      ? languageMap[firstLang].join(', ')
      : languageMap[firstLang];
  }

  return null;
}

/**
 * Normalizes IIIF v2 and v3 manifests to a consistent v3-like structure
 */
export function normalizeManifest(manifest: any): Manifest {
  // If it's already v3, return as is
  if (manifest.items) {
    return manifest;
  }

  // Convert v2 to v3-like structure
  const normalized = { ...manifest };

  // Convert sequences to items
  if (manifest.sequences?.[0]?.canvases) {
    normalized.items = manifest.sequences[0].canvases.map((canvas: any) => ({
      ...canvas,
      // Ensure we have the basic v3 structure
      type:
        canvas['@type'] === 'sc:Canvas' ? 'Canvas' : canvas.type || 'Canvas',
      id: canvas['@id'] || canvas.id,
    }));
  }

  return normalized as Manifest;
}

/**
 * Gets the canvases from a manifest, handling both v2 and v3 formats
 */
export function getManifestCanvases(manifest: any) {
  if (!manifest) return [];

  if (manifest.items) {
    return manifest.items; // v3
  }
  if (manifest.sequences?.[0]?.canvases) {
    return manifest.sequences[0].canvases; // v2
  }
  return [];
}

/**
 * Extracts image service and URL from a canvas, handling both IIIF v2 and v3 formats
 */
export function getCanvasImageInfo(canvas: any) {
  if (!canvas) return { service: null, url: null };

  // IIIF v3 format
  if (canvas.items) {
    const items = canvas.items?.[0]?.items || [];
    return items.reduce(
      (acc: any, { body, motivation }: any) => {
        if (!acc.service && body?.service) {
          acc.service = Array.isArray(body.service)
            ? body.service[0]
            : body.service;
        }
        if (
          !acc.url &&
          body?.id &&
          (body.type === 'Image' || motivation === 'painting')
        ) {
          acc.url = body.id;
        }
        return acc;
      },
      { service: null, url: null },
    );
  }

  // IIIF v2 format
  if (canvas.images) {
    const image = canvas.images[0];
    if (image?.resource) {
      const resource = image.resource;
      return {
        service: resource.service || null,
        url: resource['@id'] || resource.id || null,
      };
    }
  }

  return { service: null, url: null };
}

export function extractGeoData(canvas: any) {
  if (!canvas) return null;

  const geoData = {
    coordinates: null,
    projection: null,
    boundingBox: null,
  };

  if (canvas.annotations) {
    for (const annoPage of canvas.annotations) {
      if (annoPage.items) {
        for (const anno of annoPage.items) {
          if (
            anno.motivation === 'georeferencing' ||
            (anno.body && anno.body.type === 'GeoJSON') ||
            (anno.target &&
              anno.target.selector &&
              anno.target.selector.type === 'GeoJSON')
          ) {
            if (anno.body && anno.body.value) {
              try {
                const geoJson =
                  typeof anno.body.value === 'string'
                    ? JSON.parse(anno.body.value)
                    : anno.body.value;

                if (geoJson.coordinates) {
                  geoData.coordinates = geoJson.coordinates;
                }
                if (geoJson.properties && geoJson.properties.projection) {
                  geoData.projection = geoJson.properties.projection;
                }
                if (geoJson.bbox) {
                  geoData.boundingBox = geoJson.bbox;
                }
              } catch (e) {
                console.error('Error parsing GeoJSON:', e);
              }
            }

            if (anno.body && anno.body.projection) {
              geoData.projection = anno.body.projection;
            }
          }
        }
      }
    }
  }

  return geoData.coordinates || geoData.projection || geoData.boundingBox
    ? geoData
    : null;
}

export function extractAnnotations(canvas: any) {
  if (!canvas || !canvas.annotations) return [];

  const result = [];

  for (const annoPage of canvas.annotations) {
    if (annoPage.items) {
      for (const anno of annoPage.items) {
        if (!anno.motivation || !anno.body) continue;

        if (anno.body.service && anno.motivation === 'painting') continue;

        result.push({
          id: anno.id || anno['@id'],
          motivation: Array.isArray(anno.motivation)
            ? anno.motivation
            : [anno.motivation],
          label: anno.label ? getLocalizedValue(anno.label) : null,
          body: anno.body,
          target: anno.target,
          created: anno.created,
          creator: anno.creator
            ? anno.creator.name ||
              (anno.creator.label && getLocalizedValue(anno.creator.label)) ||
              anno.creator.id ||
              anno.creator['@id']
            : null,
        });
      }
    }
  }

  return result;
}
