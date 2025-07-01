import type { Manifest } from './types';

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  metadata: {
    version: 'v2' | 'v3' | 'unknown';
    hasImages: boolean;
    hasAnnotations: boolean;
    hasGeoreferencing: boolean;
    canvasCount: number;
    annotationCount: number;
  };
}

export function validateManifest(data: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    metadata: {
      version: 'unknown',
      hasImages: false,
      hasAnnotations: false,
      hasGeoreferencing: false,
      canvasCount: 0,
      annotationCount: 0,
    },
  };

  // Basic structure validation
  if (!data) {
    result.errors.push('Manifest data is empty or null');
    result.isValid = false;
    return result;
  }

  // Version detection
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

  // Required fields
  if (!data.id && !data['@id']) {
    result.errors.push('Manifest missing required id property');
    result.isValid = false;
  }

  if (!data.label) {
    result.errors.push('Manifest missing required label property');
    result.isValid = false;
  }

  // Content validation
  let canvases: any[] = [];
  if (result.metadata.version === 'v3' && data.items) {
    canvases = data.items;
    result.metadata.hasImages = canvases.length > 0;
  } else if (
    result.metadata.version === 'v2' &&
    data.sequences?.[0]?.canvases
  ) {
    canvases = data.sequences[0].canvases;
    result.metadata.hasImages = canvases.length > 0;
  }

  result.metadata.canvasCount = canvases.length;

  if (canvases.length === 0) {
    result.errors.push(
      'Manifest contains no viewable content (no canvases found)',
    );
    result.isValid = false;
  }

  // Analyze annotations and georeferencing
  let totalAnnotations = 0;
  let hasGeoref = false;

  canvases.forEach((canvas) => {
    if (canvas.annotations) {
      canvas.annotations.forEach((annoPage: any) => {
        if (annoPage.items) {
          totalAnnotations += annoPage.items.length;
          annoPage.items.forEach((anno: any) => {
            if (
              anno.motivation === 'georeferencing' ||
              (anno.body && anno.body.type === 'GeoJSON') ||
              anno.body?.value?.includes('allmaps')
            ) {
              hasGeoref = true;
            }
          });
        }
      });
    }
  });

  result.metadata.annotationCount = totalAnnotations;
  result.metadata.hasAnnotations = totalAnnotations > 0;
  result.metadata.hasGeoreferencing = hasGeoref;

  // Helpful warnings
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

  return result;
}

export function getValidationSummary(validation: ValidationResult): string {
  const { metadata } = validation;

  let summary = `IIIF ${metadata.version} collection with ${
    metadata.canvasCount
  } item${metadata.canvasCount !== 1 ? 's' : ''}`;

  const features = [];
  if (metadata.hasImages) features.push('images');
  if (metadata.hasAnnotations)
    features.push(`${metadata.annotationCount} annotations`);
  if (metadata.hasGeoreferencing) features.push('map data');

  if (features.length > 0) {
    summary += ` (${features.join(', ')})`;
  }

  return summary;
}
