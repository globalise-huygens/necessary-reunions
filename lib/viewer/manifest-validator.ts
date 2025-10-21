/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

function isSingleCanvas(data: any): boolean {
  return (
    data &&
    (data['@type'] === 'sc:Canvas' || data.type === 'Canvas') &&
    (data['@id'] || data.id) &&
    (data.images || data.items)
  );
}

function wrapCanvasInManifest(canvas: any): any {
  const isV2 = canvas['@type'] === 'sc:Canvas';

  if (isV2) {
    return {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': canvas['@id'] + '/manifest',
      '@type': 'sc:Manifest',
      label: canvas.label || 'Single Canvas Manifest',
      sequences: [
        {
          '@id': canvas['@id'] + '/sequence/1',
          '@type': 'sc:Sequence',
          canvases: [canvas],
        },
      ],
    };
  } else {
    return {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: canvas.id + '/manifest',
      type: 'Manifest',
      label: canvas.label || { en: ['Single Canvas Manifest'] },
      items: [canvas],
    };
  }
}

function analyzeMediaTypes(canvases: any[]): {
  hasImages: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  mediaTypes: string[];
} {
  const mediaTypes = new Set<string>();
  let hasImages = false;
  let hasAudio = false;
  let hasVideo = false;

  canvases.forEach((canvas) => {
    const hasDuration = canvas.duration !== undefined;

    if (canvas.items) {
      canvas.items.forEach((annoPage: any) => {
        if (annoPage.items) {
          annoPage.items.forEach((anno: any) => {
            if (anno.body) {
              const body = anno.body;
              if (body.type) {
                mediaTypes.add(body.type);

                if (body.type === 'Image') hasImages = true;
                if (body.type === 'Sound') hasAudio = true;
                if (body.type === 'Video') hasVideo = true;
              }

              if (body.format) {
                if (body.format.startsWith('image/')) hasImages = true;
                if (body.format.startsWith('audio/')) hasAudio = true;
                if (body.format.startsWith('video/')) hasVideo = true;
              }
            }
          });
        }
      });
    }

    if (canvas.images) {
      hasImages = true;
      mediaTypes.add('Image');
    }

    if (hasDuration && !hasImages) {
      hasAudio = true;
    }
  });

  return {
    hasImages,
    hasAudio,
    hasVideo,
    mediaTypes: Array.from(mediaTypes),
  };
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  metadata: {
    version: 'v2' | 'v3' | 'unknown';
    hasImages: boolean;
    hasAudio: boolean;
    hasVideo: boolean;
    hasAnnotations: boolean;
    hasGeoreferencing: boolean;
    canvasCount: number;
    annotationCount: number;
    mediaTypes: string[];
  };
  autoWrapped?: boolean;
}

export function validateManifest(data: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    metadata: {
      version: 'unknown',
      hasImages: false,
      hasAudio: false,
      hasVideo: false,
      hasAnnotations: false,
      hasGeoreferencing: false,
      canvasCount: 0,
      annotationCount: 0,
      mediaTypes: [],
    },
  };

  if (!data) {
    result.errors.push('Manifest data is empty or null');
    result.isValid = false;
    return result;
  }

  if (isSingleCanvas(data)) {
    const wrappedData = wrapCanvasInManifest(data);
    result.autoWrapped = true;
    result.warnings.push(
      'Single canvas detected - automatically wrapped in manifest structure',
    );

    const wrappedResult = validateManifest(wrappedData);
    return {
      ...wrappedResult,
      autoWrapped: true,
      warnings: [...result.warnings, ...wrappedResult.warnings],
    };
  }

  const context = data['@context'];
  const isV2 =
    context &&
    (Array.isArray(context)
      ? context.some(
          (c: string) =>
            c.includes('api/presentation/2') || c.includes('shared-canvas.org'),
        )
      : context.includes('api/presentation/2') ||
        context.includes('shared-canvas.org'));

  const isV3 =
    context &&
    (Array.isArray(context)
      ? context.some((c: string) => c.includes('api/presentation/3'))
      : context.includes('api/presentation/3'));

  const hasV2Structure = data['@type'] === 'sc:Manifest' && data.sequences;

  if (isV3) {
    result.metadata.version = 'v3';
    if (data.type !== 'Manifest') {
      result.errors.push('IIIF v3 manifest must have type "Manifest"');
      result.isValid = false;
    }
  } else if (isV2 || hasV2Structure) {
    result.metadata.version = 'v2';
    if (data['@type'] !== 'sc:Manifest') {
      result.errors.push('IIIF v2 manifest must have @type "sc:Manifest"');
      result.isValid = false;
    }
  } else {
    result.warnings.push(
      'Could not determine IIIF version - may not be a valid IIIF manifest',
    );
  }

  if (!data.id && !data['@id']) {
    result.errors.push('Manifest missing required id property');
    result.isValid = false;
  }

  if (!data.label) {
    result.errors.push('Manifest missing required label property');
    result.isValid = false;
  }

  let canvases: any[] = [];
  if (result.metadata.version === 'v3' && data.items) {
    canvases = data.items;
  } else if (
    result.metadata.version === 'v2' &&
    data.sequences?.[0]?.canvases
  ) {
    canvases = data.sequences[0].canvases;
  }

  result.metadata.canvasCount = canvases.length;

  if (canvases.length === 0) {
    result.errors.push(
      'Manifest contains no viewable content (no canvases found)',
    );
    result.isValid = false;
  }

  const mediaAnalysis = analyzeMediaTypes(canvases);
  result.metadata.hasImages = mediaAnalysis.hasImages;
  result.metadata.hasAudio = mediaAnalysis.hasAudio;
  result.metadata.hasVideo = mediaAnalysis.hasVideo;
  result.metadata.mediaTypes = mediaAnalysis.mediaTypes;

  if (mediaAnalysis.hasAudio || mediaAnalysis.hasVideo) {
    result.errors.push(
      'This loader only supports image and presentation manifests. Audio and video content is not supported.',
    );
    result.isValid = false;
  }

  if (!mediaAnalysis.hasImages && canvases.length > 0) {
    result.errors.push(
      'No image content found. This loader requires IIIF manifests with image content.',
    );
    result.isValid = false;
  }

  let totalAnnotations = 0;
  let hasGeoref: boolean = false;

  for (const canvas of canvases) {
    if (canvas.annotations) {
      for (const annoPage of canvas.annotations) {
        if (annoPage.items) {
          totalAnnotations += annoPage.items.length;
          for (const anno of annoPage.items) {
            if (
              anno.motivation === 'georeferencing' ||
              (anno.body && anno.body.type === 'GeoJSON') ||
              anno.body?.value?.includes('allmaps')
            ) {
              hasGeoref = true;
            }
          }
        }
      }
    }
  }

  result.metadata.annotationCount = totalAnnotations;
  result.metadata.hasAnnotations = totalAnnotations > 0;
  result.metadata.hasGeoreferencing = hasGeoref;

  if (result.metadata.canvasCount > 100) {
    result.warnings.push(
      `Large collection with ${result.metadata.canvasCount} items - may take time to load`,
    );
  }

  if (!result.metadata.hasAnnotations) {
    result.warnings.push('No annotations found - some features may be limited');
  }

  if (result.metadata.hasGeoreferencing) {
    result.warnings.push(
      'Georeferencing data detected - map view will be available',
    );
  }

  if (!result.metadata.hasImages) {
    result.warnings.push('No image content found');
  }

  return result;
}

export function getValidationSummary(validation: ValidationResult): string {
  const { metadata } = validation;

  let summary = `IIIF ${metadata.version} image manifest with ${
    metadata.canvasCount
  } item${metadata.canvasCount !== 1 ? 's' : ''}`;

  const features = [];

  if (metadata.hasImages) features.push('images');

  if (metadata.hasAnnotations) {
    features.push(`${metadata.annotationCount} annotations`);
  }
  if (metadata.hasGeoreferencing) features.push('map data');

  if (features.length > 0) {
    summary += ` (${features.join(', ')})`;
  }

  if (validation.autoWrapped) {
    summary += ' - auto-wrapped from single canvas';
  }

  return summary;
}
