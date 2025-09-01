/**
 * Utility functions to repair and validate linking annotations
 */

export interface RepairResult {
  needsRepair: boolean;
  issues: string[];
  repairedAnnotation?: any;
}

export interface OrphanedTargetAnalysis {
  hasOrphanedTargets: boolean;
  validTargets: string[];
  orphanedTargets: string[];
  totalTargets: number;
  validTargetCount: number;
  orphanedTargetCount: number;
  details: Array<{
    target: string;
    exists: boolean;
    error?: string;
  }>;
}

/**
 * Check if target annotations still exist in the repository
 */
export async function validateTargetExistence(
  annotation: any,
  annoRepoBaseUrl: string = 'https://annorepo.globalise.huygens.knaw.nl',
): Promise<OrphanedTargetAnalysis> {
  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : annotation.target
    ? [annotation.target]
    : [];

  const analysis: OrphanedTargetAnalysis = {
    hasOrphanedTargets: false,
    validTargets: [],
    orphanedTargets: [],
    totalTargets: targets.length,
    validTargetCount: 0,
    orphanedTargetCount: 0,
    details: [],
  };

  for (const target of targets) {
    let targetUrl: string;

    if (typeof target === 'string') {
      targetUrl = target;
    } else if (target.source) {
      targetUrl = target.source;
    } else if (target.id) {
      targetUrl = target.id;
    } else {
      analysis.orphanedTargets.push(target);
      analysis.orphanedTargetCount++;
      analysis.details.push({
        target: JSON.stringify(target),
        exists: false,
        error: 'Could not determine target URL',
      });
      continue;
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'HEAD',
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        analysis.validTargets.push(targetUrl);
        analysis.validTargetCount++;
        analysis.details.push({
          target: targetUrl,
          exists: true,
        });
      } else {
        analysis.orphanedTargets.push(targetUrl);
        analysis.orphanedTargetCount++;
        analysis.details.push({
          target: targetUrl,
          exists: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error: any) {
      analysis.orphanedTargets.push(targetUrl);
      analysis.orphanedTargetCount++;
      analysis.details.push({
        target: targetUrl,
        exists: false,
        error: error.message || 'Network error',
      });
    }
  }

  analysis.hasOrphanedTargets = analysis.orphanedTargetCount > 0;

  return analysis;
}

export function analyzeLinkingAnnotation(annotation: any): RepairResult {
  const issues: string[] = [];
  let needsRepair = false;
  const repairedAnnotation = { ...annotation };

  if (!annotation.motivation || annotation.motivation !== 'linking') {
    issues.push('Missing or incorrect motivation');
    needsRepair = true;
    repairedAnnotation.motivation = 'linking';
  }

  if (
    !annotation.target ||
    (Array.isArray(annotation.target) && annotation.target.length === 0)
  ) {
    issues.push('Missing or empty target');
    needsRepair = true;
  }

  if (!annotation.body) {
    issues.push('Missing body');
    needsRepair = true;
    repairedAnnotation.body = [];
  } else if (!Array.isArray(annotation.body)) {
    issues.push('Body is not an array');
    needsRepair = true;
    repairedAnnotation.body = [annotation.body];
  }

  if (repairedAnnotation.body && Array.isArray(repairedAnnotation.body)) {
    repairedAnnotation.body = repairedAnnotation.body.map(
      (bodyItem: any, index: number) => {
        const repairedBodyItem = { ...bodyItem };

        if (!repairedBodyItem.type) {
          repairedBodyItem.type = 'SpecificResource';
          issues.push(`Body item ${index}: Missing type`);
          needsRepair = true;
        }

        if (!repairedBodyItem.purpose) {
          if (repairedBodyItem.selector?.type === 'PointSelector') {
            repairedBodyItem.purpose = 'selecting';
          } else if (
            repairedBodyItem.source?.geometry ||
            repairedBodyItem.source?.coordinates
          ) {
            repairedBodyItem.purpose = 'geotagging';
          } else if (repairedBodyItem.source) {
            repairedBodyItem.purpose = 'identifying';
          }

          if (repairedBodyItem.purpose) {
            issues.push(
              `Body item ${index}: Missing purpose, inferred as '${repairedBodyItem.purpose}'`,
            );
            needsRepair = true;
          }
        }

        if (
          repairedBodyItem.purpose === 'geotagging' &&
          repairedBodyItem.source
        ) {
          if (!repairedBodyItem.source.type) {
            repairedBodyItem.source.type = 'Feature';
            issues.push(
              `Body item ${index}: Missing source type for geotagging`,
            );
            needsRepair = true;
          }

          if (
            repairedBodyItem.source.geometry &&
            !repairedBodyItem.source.geometry.type
          ) {
            repairedBodyItem.source.geometry.type = 'Point';
            issues.push(`Body item ${index}: Missing geometry type`);
            needsRepair = true;
          }

          if (
            !repairedBodyItem.source.properties &&
            repairedBodyItem.source.label
          ) {
            repairedBodyItem.source.properties = {
              title: repairedBodyItem.source.label,
              description: repairedBodyItem.source.label,
            };
            issues.push(
              `Body item ${index}: Added missing properties from label`,
            );
            needsRepair = true;
          }
        }

        if (
          repairedBodyItem.purpose === 'selecting' &&
          repairedBodyItem.selector
        ) {
          if (repairedBodyItem.selector.type !== 'PointSelector') {
            repairedBodyItem.selector.type = 'PointSelector';
            issues.push(`Body item ${index}: Fixed selector type`);
            needsRepair = true;
          }

          if (
            typeof repairedBodyItem.selector.x !== 'number' ||
            typeof repairedBodyItem.selector.y !== 'number'
          ) {
            issues.push(`Body item ${index}: Invalid point coordinates`);
          }
        }

        if (!repairedBodyItem.creator) {
          repairedBodyItem.creator = {
            id: 'unknown',
            type: 'Person',
            label: 'Unknown User',
          };
          issues.push(`Body item ${index}: Added missing creator`);
          needsRepair = true;
        }

        if (!repairedBodyItem.created) {
          repairedBodyItem.created =
            annotation.created || new Date().toISOString();
          issues.push(`Body item ${index}: Added missing created timestamp`);
          needsRepair = true;
        }

        return repairedBodyItem;
      },
    );
  }

  if (!repairedAnnotation.creator) {
    repairedAnnotation.creator = {
      id: 'unknown',
      type: 'Person',
      label: 'Unknown User',
    };
    issues.push('Added missing annotation creator');
    needsRepair = true;
  }

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

export function validateLinkingAnnotationBeforeSave(annotation: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!annotation.motivation || annotation.motivation !== 'linking') {
    errors.push('Invalid motivation - must be "linking"');
  }

  if (
    !annotation.target ||
    (Array.isArray(annotation.target) && annotation.target.length === 0)
  ) {
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

/**
 * Remove orphaned targets from a linking annotation
 */
export function removeOrphanedTargets(
  annotation: any,
  orphanedAnalysis: OrphanedTargetAnalysis,
): any {
  if (!orphanedAnalysis.hasOrphanedTargets) {
    return annotation;
  }

  const repairedAnnotation = { ...annotation };

  const validTargetUrls = new Set(orphanedAnalysis.validTargets);

  if (Array.isArray(annotation.target)) {
    repairedAnnotation.target = annotation.target.filter((target: any) => {
      const targetUrl =
        typeof target === 'string' ? target : target.source || target.id;
      return targetUrl && validTargetUrls.has(targetUrl);
    });
  } else if (annotation.target) {
    const targetUrl =
      typeof annotation.target === 'string'
        ? annotation.target
        : annotation.target.source || annotation.target.id;

    if (!targetUrl || !validTargetUrls.has(targetUrl)) {
      repairedAnnotation.target = [];
    }
  }

  repairedAnnotation.modified = new Date().toISOString();

  return repairedAnnotation;
}

/**
 * Check if a linking annotation should be deleted after orphan cleanup
 */
export function shouldDeleteAfterOrphanCleanup(
  annotation: any,
  orphanedAnalysis: OrphanedTargetAnalysis,
): { shouldDelete: boolean; reason?: string } {
  if (orphanedAnalysis.validTargetCount < 2) {
    return {
      shouldDelete: true,
      reason: `Only ${orphanedAnalysis.validTargetCount} valid target(s) remaining, need at least 2 for linking`,
    };
  }

  return { shouldDelete: false };
}
