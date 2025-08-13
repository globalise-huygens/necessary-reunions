/**
 * Utility functions to repair and validate linking annotations
 */

export interface RepairResult {
  needsRepair: boolean;
  issues: string[];
  repairedAnnotation?: any;
}

export function analyzeLinkingAnnotation(annotation: any): RepairResult {
  const issues: string[] = [];
  let needsRepair = false;
  const repairedAnnotation = { ...annotation };

  // Check basic structure
  if (!annotation.motivation || annotation.motivation !== 'linking') {
    issues.push('Missing or incorrect motivation');
    needsRepair = true;
    repairedAnnotation.motivation = 'linking';
  }

  if (!annotation.target || (Array.isArray(annotation.target) && annotation.target.length === 0)) {
    issues.push('Missing or empty target');
    needsRepair = true;
  }

  // Check body structure
  if (!annotation.body) {
    issues.push('Missing body');
    needsRepair = true;
    repairedAnnotation.body = [];
  } else if (!Array.isArray(annotation.body)) {
    issues.push('Body is not an array');
    needsRepair = true;
    repairedAnnotation.body = [annotation.body];
  }

  // Validate and repair body items
  if (repairedAnnotation.body && Array.isArray(repairedAnnotation.body)) {
    repairedAnnotation.body = repairedAnnotation.body.map((bodyItem: any, index: number) => {
      const repairedBodyItem = { ...bodyItem };

      // Ensure type is set
      if (!repairedBodyItem.type) {
        repairedBodyItem.type = 'SpecificResource';
        issues.push(`Body item ${index}: Missing type`);
        needsRepair = true;
      }

      // Validate purpose
      if (!repairedBodyItem.purpose) {
        // Try to infer purpose from content
        if (repairedBodyItem.selector?.type === 'PointSelector') {
          repairedBodyItem.purpose = 'selecting';
        } else if (repairedBodyItem.source?.geometry || repairedBodyItem.source?.coordinates) {
          repairedBodyItem.purpose = 'geotagging';
        } else if (repairedBodyItem.source) {
          repairedBodyItem.purpose = 'identifying';
        }
        
        if (repairedBodyItem.purpose) {
          issues.push(`Body item ${index}: Missing purpose, inferred as '${repairedBodyItem.purpose}'`);
          needsRepair = true;
        }
      }

      // Validate geotagging structure
      if (repairedBodyItem.purpose === 'geotagging' && repairedBodyItem.source) {
        if (!repairedBodyItem.source.type) {
          repairedBodyItem.source.type = 'Feature';
          issues.push(`Body item ${index}: Missing source type for geotagging`);
          needsRepair = true;
        }

        if (repairedBodyItem.source.geometry && !repairedBodyItem.source.geometry.type) {
          repairedBodyItem.source.geometry.type = 'Point';
          issues.push(`Body item ${index}: Missing geometry type`);
          needsRepair = true;
        }

        // Ensure properties exist
        if (!repairedBodyItem.source.properties && repairedBodyItem.source.label) {
          repairedBodyItem.source.properties = {
            title: repairedBodyItem.source.label,
            description: repairedBodyItem.source.label,
          };
          issues.push(`Body item ${index}: Added missing properties from label`);
          needsRepair = true;
        }
      }

      // Validate point selector structure
      if (repairedBodyItem.purpose === 'selecting' && repairedBodyItem.selector) {
        if (repairedBodyItem.selector.type !== 'PointSelector') {
          repairedBodyItem.selector.type = 'PointSelector';
          issues.push(`Body item ${index}: Fixed selector type`);
          needsRepair = true;
        }

        if (typeof repairedBodyItem.selector.x !== 'number' || typeof repairedBodyItem.selector.y !== 'number') {
          issues.push(`Body item ${index}: Invalid point coordinates`);
        }
      }

      // Ensure creator exists
      if (!repairedBodyItem.creator) {
        repairedBodyItem.creator = {
          id: 'unknown',
          type: 'Person',
          label: 'Unknown User',
        };
        issues.push(`Body item ${index}: Added missing creator`);
        needsRepair = true;
      }

      // Ensure created timestamp exists
      if (!repairedBodyItem.created) {
        repairedBodyItem.created = annotation.created || new Date().toISOString();
        issues.push(`Body item ${index}: Added missing created timestamp`);
        needsRepair = true;
      }

      return repairedBodyItem;
    });
  }

  // Ensure annotation-level creator exists
  if (!repairedAnnotation.creator) {
    repairedAnnotation.creator = {
      id: 'unknown',
      type: 'Person',
      label: 'Unknown User',
    };
    issues.push('Added missing annotation creator');
    needsRepair = true;
  }

  // Ensure created timestamp exists
  if (!repairedAnnotation.created) {
    repairedAnnotation.created = new Date().toISOString();
    issues.push('Added missing created timestamp');
    needsRepair = true;
  }

  return {
    needsRepair,
    issues,
    repairedAnnotation: needsRepair ? repairedAnnotation : undefined,
  };
}

export function validateLinkingAnnotationBeforeSave(annotation: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!annotation.motivation || annotation.motivation !== 'linking') {
    errors.push('Invalid motivation - must be "linking"');
  }

  if (!annotation.target || (Array.isArray(annotation.target) && annotation.target.length === 0)) {
    errors.push('Missing target annotations');
  }

  if (Array.isArray(annotation.target) && annotation.target.length === 1) {
    errors.push('Need at least 2 target annotations for linking');
  }

  if (!annotation.body || !Array.isArray(annotation.body)) {
    errors.push('Body must be an array');
  } else {
    annotation.body.forEach((bodyItem: any, index: number) => {
      if (!bodyItem.type) {
        errors.push(`Body item ${index}: Missing type`);
      }
      
      if (!bodyItem.purpose) {
        errors.push(`Body item ${index}: Missing purpose`);
      }
      
      if (bodyItem.purpose === 'selecting' && !bodyItem.selector) {
        errors.push(`Body item ${index}: Point selector missing selector`);
      }
      
      if (bodyItem.purpose === 'geotagging' && !bodyItem.source) {
        errors.push(`Body item ${index}: Geotagging missing source`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function repairLinkingAnnotationStructure(annotation: any): any {
  const result = analyzeLinkingAnnotation(annotation);
  return result.repairedAnnotation || annotation;
}
