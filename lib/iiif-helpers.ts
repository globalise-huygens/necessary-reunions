import type { Manifest } from './types';

export function getLocalizedValue(languageMap: any, preferredLanguage = 'en') {
  if (!languageMap) return null;

  if (typeof languageMap === 'string') return languageMap;

  if (Array.isArray(languageMap)) return languageMap.join(', ');

  if (typeof languageMap === 'object') {
    if (languageMap[preferredLanguage]) {
      return Array.isArray(languageMap[preferredLanguage])
        ? languageMap[preferredLanguage].join(', ')
        : languageMap[preferredLanguage];
    }

    if (languageMap.none) {
      return Array.isArray(languageMap.none)
        ? languageMap.none.join(', ')
        : languageMap.none;
    }

    const firstLang = Object.keys(languageMap)[0];
    if (firstLang) {
      return Array.isArray(languageMap[firstLang])
        ? languageMap[firstLang].join(', ')
        : languageMap[firstLang];
    }
  }

  return null;
}

export function normalizeManifest(manifest: any): Manifest {
  if (manifest.items) {
    return manifest;
  }

  const normalized = { ...manifest };

  if (manifest.sequences?.[0]?.canvases) {
    normalized.items = manifest.sequences[0].canvases.map((canvas: any) => {
      const normalizedCanvas = {
        ...canvas,
        type:
          canvas['@type'] === 'sc:Canvas' ? 'Canvas' : canvas.type || 'Canvas',
        id: canvas['@id'] || canvas.id,
        height: canvas.height,
        width: canvas.width,
      };

      if (canvas.label && typeof canvas.label === 'string') {
        normalizedCanvas.label = { en: [canvas.label] };
      } else if (canvas.label && !canvas.label.en && !canvas.label.none) {
        normalizedCanvas.label = canvas.label;
      }

      if (canvas.images && !normalizedCanvas.items) {
        normalizedCanvas.items = [
          {
            id: `${normalizedCanvas.id}/painting`,
            type: 'AnnotationPage',
            items: canvas.images.map((image: any, index: number) => ({
              id: `${normalizedCanvas.id}/painting/${index}`,
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: image.resource?.['@id'] || image.resource?.id,
                type: 'Image',
                format: image.resource?.format,
                height: image.resource?.height,
                width: image.resource?.width,
                service: image.resource?.service
                  ? Array.isArray(image.resource.service)
                    ? image.resource.service
                    : [image.resource.service]
                  : undefined,
              },
              target: normalizedCanvas.id,
            })),
          },
        ];
      }

      return normalizedCanvas;
    });
  }

  if (manifest.label && typeof manifest.label === 'string') {
    normalized.label = { en: [manifest.label] };
  }

  if (manifest['@id'] && !normalized.id) {
    normalized.id = manifest['@id'];
  }

  if (manifest['@type'] === 'sc:Manifest' && !normalized.type) {
    normalized.type = 'Manifest';
  }

  return normalized as Manifest;
}

export function getManifestCanvases(manifest: any) {
  if (!manifest) return [];

  if (manifest.items) {
    return manifest.items;
  }
  if (manifest.sequences?.[0]?.canvases) {
    return manifest.sequences[0].canvases;
  }
  return [];
}

export function getCanvasImageInfo(canvas: any) {
  if (!canvas) return { service: null, url: null };

  // IIIF v3 structure
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

  // IIIF v2 structure
  if (canvas.images) {
    const image = canvas.images[0];
    if (image?.resource) {
      const resource = image.resource;
      return {
        service: resource.service
          ? Array.isArray(resource.service)
            ? resource.service[0]
            : resource.service
          : null,
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
    hasAllmaps: false,
    allmapsId: null,
    controlPoints: null,
  };

  if (canvas.annotations) {
    for (const annoPage of canvas.annotations) {
      if (annoPage.items) {
        for (const anno of annoPage.items) {
          // Check for georeferencing motivation
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

                if (geoJson._allmaps) {
                  geoData.hasAllmaps = true;
                  geoData.allmapsId = geoJson._allmaps.id;
                }

                // Extract control points for manual overlay
                if (geoJson.features && Array.isArray(geoJson.features)) {
                  geoData.controlPoints = geoJson.features.filter(
                    (f: any) => f.properties && f.properties.resourceCoords,
                  );
                }
              } catch (e) {
                console.error('Error parsing GeoJSON:', e);
              }
            }

            if (anno.body && anno.body.projection) {
              geoData.projection = anno.body.projection;
            }

            if (
              anno.id &&
              (anno.id.includes('allmaps.org') ||
                (anno.body && JSON.stringify(anno.body).includes('allmaps')))
            ) {
              geoData.hasAllmaps = true;
            }
          }
        }
      }
    }
  }

  return geoData.coordinates ||
    geoData.projection ||
    geoData.boundingBox ||
    geoData.hasAllmaps ||
    geoData.controlPoints
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

export function analyzeAnnotations(canvas: any): {
  total: number;
  byMotivation: Record<string, number>;
  hasMeaningful: boolean;
} {
  const analysis = {
    total: 0,
    byMotivation: {} as Record<string, number>,
    hasMeaningful: false,
  };

  if (!canvas.annotations) return analysis;

  for (const page of canvas.annotations) {
    if (!page.items) continue;

    for (const anno of page.items) {
      analysis.total++;

      if (anno.motivation) {
        const motivations = Array.isArray(anno.motivation)
          ? anno.motivation
          : [anno.motivation];

        for (const motivation of motivations) {
          analysis.byMotivation[motivation] =
            (analysis.byMotivation[motivation] || 0) + 1;

          if (motivation !== 'painting') {
            analysis.hasMeaningful = true;
          }
        }
      }
    }
  }

  return analysis;
}

export async function mergeLocalAnnotations(
  manifest: any,
  baseUrl?: string,
): Promise<any> {
  try {
    if (typeof window === 'undefined') {
      return manifest;
    }

    const response = await fetch('/api/annotations/local');
    if (!response.ok) {
      console.warn('Failed to load local annotations:', response.status);
      return manifest;
    }

    const { annotations } = await response.json();
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return manifest;
    }

    const clonedManifest = JSON.parse(JSON.stringify(manifest));
    const canvases = getManifestCanvases(clonedManifest);

    const annotationsByCanvas = new Map<string, any[]>();

    for (const annotation of annotations) {
      if (!annotation.target?.source?.id) continue;

      const canvasId = annotation.target.source.id;
      if (!annotationsByCanvas.has(canvasId)) {
        annotationsByCanvas.set(canvasId, []);
      }
      annotationsByCanvas.get(canvasId)!.push(annotation);
    }

    for (const canvas of canvases) {
      const canvasAnnotations = annotationsByCanvas.get(canvas.id);
      if (!canvasAnnotations) continue;

      if (!canvas.annotations) {
        canvas.annotations = [];
      }

      const localAnnotationPage = {
        id: `${canvas.id}/annotations/local`,
        type: 'AnnotationPage',
        items: canvasAnnotations,
      };

      canvas.annotations.push(localAnnotationPage);
    }

    console.log(`Merged ${annotations.length} local annotations into manifest`);
    return clonedManifest;
  } catch (error) {
    console.error('Error merging local annotations:', error);
    return manifest;
  }
}

export function getCanvasContentType(
  canvas: any,
): 'image' | 'audio' | 'video' | 'unknown' {
  if (!canvas) return 'unknown';

  if (canvas.duration !== undefined) {
    let hasVideo = false;
    let hasAudio = false;

    if (canvas.items) {
      canvas.items.forEach((annoPage: any) => {
        if (annoPage.items) {
          annoPage.items.forEach((anno: any) => {
            if (anno.body) {
              const body = anno.body;
              if (body.type === 'Video') hasVideo = true;
              if (body.type === 'Sound') hasAudio = true;
              if (body.format?.startsWith('video/')) hasVideo = true;
              if (body.format?.startsWith('audio/')) hasAudio = true;
            }
          });
        }
      });
    }

    return hasVideo ? 'video' : 'audio';
  }

  if (canvas.images && canvas.images.length > 0) {
    return 'image';
  }

  if (canvas.items) {
    let hasImages = false;
    canvas.items.forEach((annoPage: any) => {
      if (annoPage.items) {
        annoPage.items.forEach((anno: any) => {
          if (anno.body) {
            const body = anno.body;
            if (body.type === 'Image' || body.format?.startsWith('image/')) {
              hasImages = true;
            }
          }
        });
      }
    });

    if (hasImages) return 'image';
  }

  if (canvas.width && canvas.height && !canvas.duration) {
    return 'image';
  }

  return 'unknown';
}

export function isImageCanvas(canvas: any): boolean {
  return getCanvasContentType(canvas) === 'image';
}

export function getManifestContentTypes(manifest: any): string[] {
  if (!manifest) return [];

  const canvases = getManifestCanvases(manifest);
  const types = new Set<string>();

  canvases.forEach((canvas: any) => {
    types.add(getCanvasContentType(canvas));
  });

  return Array.from(types);
}

export function hasImageContent(manifest: any): boolean {
  const types = getManifestContentTypes(manifest);
  return types.includes('image');
}
