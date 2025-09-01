import {
  type OrphanedTargetAnalysis,
  shouldDeleteAfterOrphanCleanup,
  validateTargetExistence,
} from '@/lib/viewer/linking-repair';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unauthorized – please sign in to clean up linking annotations',
      },
      { status: 401 },
    );
  }

  try {
    const { action, dryRun = true } = await request.json();

    if (action !== 'cleanup-duplicates' && action !== 'analyze') {
      return NextResponse.json(
        { error: 'Invalid action. Use "cleanup-duplicates" or "analyze"' },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const allLinkingAnnotations = await fetchAllLinkingAnnotations(
      ANNOREPO_BASE_URL,
      CONTAINER,
    );

    if (allLinkingAnnotations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No linking annotations found',
        summary: { total: 0, duplicates: 0, kept: 0, deleted: 0 },
      });
    }

    const analysisResult = analyzeLinkingAnnotations(allLinkingAnnotations);

    const orphanedTargetsAnalysis = await analyzeOrphanedTargetsInline(
      allLinkingAnnotations,
      ANNOREPO_BASE_URL,
    );

    const unwantedAnalysis = analyzeUnwantedContent(allLinkingAnnotations);

    const shouldRunDryRun = dryRun || action === 'analyze';

    if (shouldRunDryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Dry run complete - no changes made',
        analysis: {
          totalAnnotations: allLinkingAnnotations.length,
          uniqueGroups: analysisResult.groups.length,
          duplicatesToDelete: analysisResult.duplicates.length,
          structuralFixes:
            analysisResult.needsStructuralFix.length +
            orphanedTargetsAnalysis.annotationsToRepair,
          annotationsToKeep: analysisResult.singles.length,
          totalLinkingRelationships: analysisResult.groups.reduce(
            (total, group) => total + group.targets.length,
            0,
          ),
          unwantedAnnotations: unwantedAnalysis.totalUnwanted,
          cleanLinkingAnnotations: unwantedAnalysis.cleanAnnotations.length,
          unwantedDetails: unwantedAnalysis.unwantedAnnotations.map((ann) => ({
            id: ann.id,
            reasons: ann.unwantedReasons,
            preview: `${ann.id.split('/').pop()?.substring(0, 8)}... | ${
              Array.isArray(ann.body)
                ? ann.body.map((b: any) => b.value || '').join('; ')
                : ann.body?.value || 'no content'
            }`.substring(0, 100),
          })),
          totalOrphanedTargets: orphanedTargetsAnalysis.totalOrphanedTargets,
          annotationsWithOrphanedTargets:
            orphanedTargetsAnalysis.annotationsWithOrphanedTargets,
          annotationsToDelete: orphanedTargetsAnalysis.annotationsToDelete,
          annotationsToRepair: orphanedTargetsAnalysis.annotationsToRepair,
          duplicateGroups: analysisResult.groups
            .filter((g) => !g.needsStructuralFix)
            .map((group) => ({
              targets: group.targets,
              annotations: group.annotations.map((a) => ({
                id: a.id,
                created: a.created,
                modified: a.modified,
                bodyCount: Array.isArray(a.body)
                  ? a.body.length
                  : a.body
                  ? 1
                  : 0,
                bodies: Array.isArray(a.body) ? a.body : a.body ? [a.body] : [],
              })),
            })),
          structuralFixGroups: [
            ...analysisResult.groups
              .filter((g) => g.needsStructuralFix)
              .map((group) => ({
                targets: group.targets,
                annotation: {
                  id: group.annotations[0].id,
                  created: group.annotations[0].created,
                  modified: group.annotations[0].modified,
                  bodyCount: Array.isArray(group.annotations[0].body)
                    ? group.annotations[0].body.length
                    : group.annotations[0].body
                    ? 1
                    : 0,
                  bodies: Array.isArray(group.annotations[0].body)
                    ? group.annotations[0].body
                    : group.annotations[0].body
                    ? [group.annotations[0].body]
                    : [],
                  issues: identifyStructuralIssues(group.annotations[0]),
                },
              })),
            ...orphanedTargetsAnalysis.annotationDetails
              .filter(
                (detail: any) =>
                  detail.targetAnalysis.hasOrphanedTargets &&
                  !detail.shouldDelete,
              )
              .map((detail: any) => ({
                targets: detail.targetAnalysis.validTargets,
                annotation: {
                  id: detail.id,
                  created: detail.created || '',
                  modified: detail.modified || '',
                  bodyCount: 1,
                  bodies: [],
                  issues: [
                    `Has ${
                      detail.targetAnalysis.orphanedTargetCount
                    } orphaned target reference${
                      detail.targetAnalysis.orphanedTargetCount > 1 ? 's' : ''
                    }`,
                    `Valid targets: ${detail.targetAnalysis.validTargetCount}/${detail.targetAnalysis.totalTargets}`,
                    'Orphaned references will be removed during cleanup',
                  ],
                },
              })),
          ],
          singleAnnotations: analysisResult.singles.map((a) => ({
            id: a.id,
            created: a.created,
            modified: a.modified,
            target: a.target,
            bodyCount: Array.isArray(a.body) ? a.body.length : a.body ? 1 : 0,
            bodies: Array.isArray(a.body) ? a.body : a.body ? [a.body] : [],
            bodyPurposes: Array.isArray(a.body)
              ? a.body.map((b: any) => b.purpose).filter(Boolean)
              : a.body?.purpose
              ? [a.body.purpose]
              : [],
            linkedAnnotationsCount: calculateLinkedAnnotationsCount(
              a,
              allLinkingAnnotations,
            ),
          })),
          singleAnnotationsSample: `All ${analysisResult.singles.length} correctly structured annotations shown`,
          orphanedTargetsAnalysis: orphanedTargetsAnalysis,
        },
      });
    }

    const cleanupResult = await performCleanup(
      analysisResult,
      orphanedTargetsAnalysis,
      unwantedAnalysis,
      ANNOREPO_BASE_URL,
      CONTAINER,
      session,
    );

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: {
        totalAnalyzed: allLinkingAnnotations.length,
        groupsConsolidated: cleanupResult.groupsConsolidated,
        structuralFixes: cleanupResult.structuralFixes,
        annotationsDeleted: cleanupResult.annotationsDeleted,
        annotationsCreated: cleanupResult.annotationsCreated,
        annotationsKept: cleanupResult.annotationsKept,
        unwantedDeleted: cleanupResult.unwantedDeleted,
      },
      details: cleanupResult.details,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Cleanup failed: ${error.message}` },
      { status: 500 },
    );
  }
}

async function fetchAllLinkingAnnotations(baseUrl: string, container: string) {
  const allAnnotations: any[] = [];
  let page = 0;
  let hasMore = true;
  let consecutiveEmptyPages = 0;

  while (hasMore) {
    try {
      const pageUrl = `${baseUrl}/w3c/${container}?page=${page}`;

      const response = await fetch(pageUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const pageAnnotations = data.items || [];
        const linkingAnnotations = pageAnnotations.filter(
          (ann: any) => ann.motivation === 'linking',
        );

        if (linkingAnnotations.length === 0) {
          consecutiveEmptyPages++;

          if (consecutiveEmptyPages >= 10 && page > 250) {
            hasMore = false;
          }
        } else {
          consecutiveEmptyPages = 0;
          allAnnotations.push(...linkingAnnotations);
        }

        page++;

        if (page > 300) {
          hasMore = false;
        }
      } else {
        if (response.status === 404) {
          hasMore = false;
        } else {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 5) {
            hasMore = false;
          }
        }
        page++;
      }
    } catch (error: any) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= 5) {
        hasMore = false;
      }
      page++;
    }
  }

  return allAnnotations;
}

function analyzeLinkingAnnotations(annotations: any[]) {
  const targetGroups = new Map<string, any[]>();
  const singles: any[] = [];
  const duplicates: any[] = [];
  const needsStructuralFix: any[] = [];

  for (const annotation of annotations) {
    const targets = Array.isArray(annotation.target)
      ? annotation.target
      : [annotation.target];
    const sortedTargets = [...targets].sort();
    const targetKey = sortedTargets.join('|');

    const hasStructuralIssues = checkForStructuralIssues(annotation);
    if (hasStructuralIssues) {
      needsStructuralFix.push(annotation);
    }

    if (!targetGroups.has(targetKey)) {
      targetGroups.set(targetKey, []);
    }
    targetGroups.get(targetKey)!.push(annotation);
  }

  const groups: Array<{
    targets: string[];
    annotations: any[];
    keepAnnotation?: any;
    deleteAnnotations: any[];
    needsStructuralFix?: boolean;
  }> = [];

  for (const [targetKey, groupAnnotations] of targetGroups) {
    const targets = targetKey.split('|');

    if (groupAnnotations.length === 1) {
      const annotation = groupAnnotations[0];
      if (needsStructuralFix.includes(annotation)) {
        groups.push({
          targets,
          annotations: [annotation],
          keepAnnotation: annotation,
          deleteAnnotations: [],
          needsStructuralFix: true,
        });
      } else {
        singles.push(annotation);
      }
    } else {
      const bestAnnotation = findBestAnnotation(groupAnnotations);
      const toDelete = groupAnnotations.filter(
        (a) => a.id !== bestAnnotation.id,
      );

      groups.push({
        targets,
        annotations: groupAnnotations,
        keepAnnotation: bestAnnotation,
        deleteAnnotations: toDelete,
        needsStructuralFix: needsStructuralFix.some((a) =>
          groupAnnotations.includes(a),
        ),
      });

      duplicates.push(...toDelete);
    }
  }

  return { groups, singles, duplicates, needsStructuralFix };
}

function calculateLinkedAnnotationsCount(
  annotation: any,
  allAnnotations: any[],
): number {
  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : annotation.target
    ? [annotation.target]
    : [];

  return targets.length;
}
function checkForStructuralIssues(annotation: any): boolean {
  if (!annotation.body || !Array.isArray(annotation.body)) {
    return false;
  }

  for (const body of annotation.body) {
    if (
      body.selector?.type === 'PointSelector' &&
      body.purpose === 'highlighting'
    ) {
      return true;
    }

    if (!body.creator) {
      return true;
    }

    if (!body.created) {
      return true;
    }
  }

  return false;
}

function identifyStructuralIssues(annotation: any): string[] {
  const issues: string[] = [];

  if (!annotation.body || !Array.isArray(annotation.body)) {
    return issues;
  }

  for (const body of annotation.body) {
    if (
      body.selector?.type === 'PointSelector' &&
      body.purpose === 'highlighting'
    ) {
      issues.push(
        'PointSelector has wrong purpose "highlighting", should be "selecting"',
      );
    }

    if (!body.creator) {
      issues.push('Body missing individual creator field');
    }

    if (!body.created) {
      issues.push('Body missing individual created timestamp');
    }
  }

  return issues;
}

function findBestAnnotation(annotations: any[]) {
  return annotations.reduce((best, current) => {
    const bestScore = scoreAnnotation(best);
    const currentScore = scoreAnnotation(current);
    return currentScore > bestScore ? current : best;
  });
}

function scoreAnnotation(annotation: any) {
  let score = 0;

  if (annotation.modified) {
    score += new Date(annotation.modified).getTime() / 1000000;
  } else if (annotation.created) {
    score += new Date(annotation.created).getTime() / 1000000;
  }

  if (annotation.body) {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    score += bodies.length * 10;

    const purposes = new Set(bodies.map((b: any) => b.purpose).filter(Boolean));
    score += purposes.size * 5;
  }

  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : [annotation.target];
  score += targets.length;

  return score;
}

async function performCleanup(
  analysis: any,
  orphanedTargetsAnalysis: any,
  unwantedAnalysis: any,
  baseUrl: string,
  container: string,
  session: any,
) {
  const result = {
    groupsConsolidated: 0,
    annotationsDeleted: 0,
    annotationsCreated: 0,
    structuralFixes: 0,
    annotationsKept: analysis.singles.length,
    unwantedDeleted: 0,
    details: [] as any[],
  };

  const user = session.user as any;

  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
  };

  for (const group of analysis.groups) {
    try {
      if (group.needsStructuralFix && group.annotations.length === 1) {
        const originalAnnotation = group.annotations[0];
        const fixedAnnotation = fixAnnotationStructure(
          originalAnnotation,
          user,
        );

        const createResponse = await fetch(`${baseUrl}/w3c/${container}`, {
          method: 'POST',
          headers: {
            ...AUTH_HEADER,
            'Content-Type':
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          body: JSON.stringify(fixedAnnotation),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse
            .text()
            .catch(() => '[no body]');
          throw new Error(
            `Failed to create fixed annotation: ${createResponse.status} ${createResponse.statusText}\n${errorText}`,
          );
        }

        const newAnnotation = await createResponse.json();
        result.annotationsCreated++;
        result.structuralFixes++;

        await deleteAnnotation(originalAnnotation, AUTH_HEADER);
        result.annotationsDeleted++;

        result.details.push({
          type: 'structural-fix',
          targets: group.targets,
          originalId: originalAnnotation.id,
          fixedId: newAnnotation.id,
          issues: identifyStructuralIssues(originalAnnotation),
        });
      } else {
        const consolidatedBodies: any[] = [];
        const seenPurposes = new Set<string>();

        for (const annotation of group.annotations) {
          const bodies = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
            ? [annotation.body]
            : [];

          for (const body of bodies) {
            const fixedBody = fixBodyStructure(body, user);

            if (fixedBody.purpose && seenPurposes.has(fixedBody.purpose)) {
              const existingIndex = consolidatedBodies.findIndex(
                (b) => b.purpose === fixedBody.purpose,
              );
              if (existingIndex >= 0) {
                consolidatedBodies[existingIndex] = fixedBody;
              }
            } else {
              consolidatedBodies.push(fixedBody);
              if (fixedBody.purpose) seenPurposes.add(fixedBody.purpose);
            }
          }
        }

        const consolidatedAnnotation = {
          type: 'Annotation',
          motivation: 'linking',
          target: group.targets.sort(),
          body: consolidatedBodies,
          creator: {
            id: user?.id || user?.email || 'cleanup-script',
            type: 'Person',
            label: user?.label || user?.name || 'Cleanup Script',
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        const createResponse = await fetch(`${baseUrl}/w3c/${container}`, {
          method: 'POST',
          headers: {
            ...AUTH_HEADER,
            'Content-Type':
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          body: JSON.stringify(consolidatedAnnotation),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse
            .text()
            .catch(() => '[no body]');
          throw new Error(
            `Failed to create consolidated annotation: ${createResponse.status} ${createResponse.statusText}\n${errorText}`,
          );
        }

        const newAnnotation = await createResponse.json();
        result.annotationsCreated++;

        for (const annotation of group.annotations) {
          await deleteAnnotation(annotation, AUTH_HEADER);
          result.annotationsDeleted++;
        }

        result.groupsConsolidated++;
        if (group.needsStructuralFix) {
          result.structuralFixes++;
        }

        result.details.push({
          type: 'consolidation',
          targets: group.targets,
          consolidatedId: newAnnotation.id,
          deletedIds: group.annotations.map((a: any) => a.id),
          bodyCount: consolidatedBodies.length,
          hadStructuralIssues: group.needsStructuralFix,
        });
      }
    } catch (error: any) {
      result.details.push({
        targets: group.targets,
        error: error.message || 'Unknown error',
      });
    }
  }

  for (const detail of orphanedTargetsAnalysis.annotationDetails) {
    try {
      if (detail.shouldDelete) {
        await deleteAnnotation({ id: detail.id }, AUTH_HEADER);
        result.annotationsDeleted++;

        result.details.push({
          type: 'orphaned-target-deletion',
          originalId: detail.id,
          deletedIds: [detail.id],
          reason: detail.deleteReason,
          orphanedTargets: detail.targetAnalysis.orphanedTargets,
          validTargets: detail.targetAnalysis.validTargets,
        });
      } else if (
        detail.targetAnalysis.hasOrphanedTargets &&
        detail.targetAnalysis.validTargetCount > 0
      ) {
        const fetchResponse = await fetch(detail.id, {
          headers: {
            ...AUTH_HEADER,
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
        });

        if (fetchResponse.ok) {
          const originalAnnotation = await fetchResponse.json();

          const repairedAnnotation = {
            ...originalAnnotation,
            target: detail.targetAnalysis.validTargets,
            modified: new Date().toISOString(),
          };

          await deleteAnnotation(originalAnnotation, AUTH_HEADER);

          const createResponse = await fetch(`${baseUrl}/w3c/${container}`, {
            method: 'POST',
            headers: {
              ...AUTH_HEADER,
              'Content-Type':
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
            body: JSON.stringify(repairedAnnotation),
          });

          if (createResponse.ok) {
            const newAnnotation = await createResponse.json();
            result.annotationsDeleted++;
            result.annotationsCreated++;
            result.structuralFixes++;

            result.details.push({
              type: 'orphaned-target-repair',
              originalId: detail.id,
              fixedId: newAnnotation.id,
              deletedIds: [detail.id],
              orphanedTargetsRemoved: detail.targetAnalysis.orphanedTargets,
              validTargetsKept: detail.targetAnalysis.validTargets,
              issues: [
                `Removed ${detail.targetAnalysis.orphanedTargetCount} orphaned target references`,
              ],
            });
          } else {
            throw new Error(
              `Failed to create repaired annotation: ${createResponse.status}`,
            );
          }
        } else {
          throw new Error(
            `Failed to fetch annotation for repair: ${fetchResponse.status}`,
          );
        }
      }
    } catch (error: any) {
      result.details.push({
        type: 'orphaned-target-error',
        originalId: detail.id,
        error: error.message,
      });
    }
  }

  for (const annotation of unwantedAnalysis.unwantedAnnotations) {
    try {
      await deleteAnnotation(annotation, AUTH_HEADER);
      result.annotationsDeleted++;
      result.unwantedDeleted++;

      result.details.push({
        type: 'unwanted-deletion',
        originalId: annotation.id,
        deletedIds: [annotation.id],
        reasons: annotation.unwantedReasons,
      });
    } catch (error: any) {
      result.details.push({
        type: 'unwanted-deletion-error',
        originalId: annotation.id,
        error: error.message,
        reasons: annotation.unwantedReasons,
      });
    }
  }

  return result;
}

async function deleteAnnotation(annotation: any, AUTH_HEADER: any) {
  try {
    const headResponse = await fetch(annotation.id, {
      method: 'HEAD',
      headers: {
        ...AUTH_HEADER,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    let etag: string | null = null;
    if (headResponse.ok) {
      etag = headResponse.headers.get('ETag');
    }

    const deleteHeaders: Record<string, string> = {
      ...AUTH_HEADER,
    };

    if (etag) {
      deleteHeaders['If-Match'] = etag;
    }

    const deleteResponse = await fetch(annotation.id, {
      method: 'DELETE',
      headers: deleteHeaders,
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text().catch(() => '[no body]');
      throw new Error(
        `Failed to delete ${annotation.id}: ${deleteResponse.status} ${deleteResponse.statusText}\n${errorText}`,
      );
    }
  } catch (error) {
    throw error;
  }
}

function fixAnnotationStructure(annotation: any, user: any) {
  const fixedBodies = [];

  if (annotation.body && Array.isArray(annotation.body)) {
    for (const body of annotation.body) {
      fixedBodies.push(fixBodyStructure(body, user));
    }
  }

  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : [annotation.target];
  const normalizedTargets = [...targets].sort();

  return {
    type: 'Annotation',
    motivation: 'linking',
    target: normalizedTargets,
    body: fixedBodies,
    creator: annotation.creator || {
      id: user?.id || user?.email || 'cleanup-script',
      type: 'Person',
      label: user?.label || user?.name || 'Cleanup Script',
    },
    created: annotation.created || new Date().toISOString(),
    modified: new Date().toISOString(),
  };
}

function fixBodyStructure(body: any, user: any) {
  const fixedBody = { ...body };

  if (
    body.selector?.type === 'PointSelector' &&
    body.purpose === 'highlighting'
  ) {
    fixedBody.purpose = 'selecting';
  }

  if (!body.creator) {
    fixedBody.creator = {
      id: user?.id || user?.email || 'cleanup-script',
      type: 'Person',
      label: user?.label || user?.name || 'Cleanup Script',
    };
  }

  if (!body.created) {
    fixedBody.created = new Date().toISOString();
  }

  return fixedBody;
}

async function analyzeOrphanedTargetsInline(
  linkingAnnotations: any[],
  baseUrl: string,
): Promise<{
  totalOrphanedTargets: number;
  annotationsWithOrphanedTargets: number;
  annotationsToDelete: number;
  annotationsToRepair: number;
  annotationDetails: Array<{
    id: string;
    shortId: string;
    targetAnalysis: OrphanedTargetAnalysis;
    shouldDelete: boolean;
    deleteReason?: string;
    created?: string;
    modified?: string;
  }>;
}> {
  const result = {
    totalOrphanedTargets: 0,
    annotationsWithOrphanedTargets: 0,
    annotationsToDelete: 0,
    annotationsToRepair: 0,
    annotationDetails: [] as Array<{
      id: string;
      shortId: string;
      targetAnalysis: OrphanedTargetAnalysis;
      shouldDelete: boolean;
      deleteReason?: string;
      created?: string;
      modified?: string;
    }>,
  };

  for (const annotation of linkingAnnotations) {
    try {
      const targetAnalysis = await validateTargetExistence(annotation, baseUrl);
      const deleteCheck = shouldDeleteAfterOrphanCleanup(
        annotation,
        targetAnalysis,
      );

      const shortId = annotation.id.split('/').pop()?.substring(0, 8) + '...';

      result.annotationDetails.push({
        id: annotation.id,
        shortId,
        targetAnalysis,
        shouldDelete: deleteCheck.shouldDelete,
        deleteReason: deleteCheck.reason,
        created: annotation.created,
        modified: annotation.modified,
      });

      if (targetAnalysis.hasOrphanedTargets) {
        result.annotationsWithOrphanedTargets++;
        result.totalOrphanedTargets += targetAnalysis.orphanedTargetCount;

        if (deleteCheck.shouldDelete) {
          result.annotationsToDelete++;
        } else {
          result.annotationsToRepair++;
        }
      }
    } catch (error: any) {
      console.error(`Error analyzing ${annotation.id}:`, error.message);
    }
  }

  return result;
}

function analyzeUnwantedContent(annotations: any[]) {
  const unwantedAnnotations: any[] = [];
  const cleanAnnotations: any[] = [];

  for (const annotation of annotations) {
    const unwantedReasons = identifyUnwantedContent(annotation);

    if (unwantedReasons.length > 0) {
      unwantedAnnotations.push({
        ...annotation,
        unwantedReasons,
      });
    } else {
      cleanAnnotations.push(annotation);
    }
  }

  return {
    unwantedAnnotations,
    cleanAnnotations,
    totalUnwanted: unwantedAnnotations.length,
  };
}

function identifyUnwantedContent(annotation: any): string[] {
  const reasons: string[] = [];

  function hasUnwantedPattern(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const normalized = text.toLowerCase().trim();

    const patterns = [
      /^unknown$/i,
      /^test$/i,
      /^unknown location$/i,
      /^test location$/i,
      /^test annotation$/i,
      /^test user$/i,
      /^test account$/i,
      /^unknown user$/i,
      /test.*geotagging/i,
      /test.*point/i,
      /test.*data/i,
      /unknown.*location/i,
      /test.*location/i,
      /\btest\b.*\buser\b/i,
      /\bunknown\b.*\blocation\b/i,
      /^test\s*$/i,
      /^unknown\s*$/i,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  function checkObjectForUnwantedContent(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') return;

    if (obj.label && hasUnwantedPattern(obj.label)) {
      reasons.push(`Unwanted ${path}label: "${obj.label}"`);
    }
    if (obj.title && hasUnwantedPattern(obj.title)) {
      reasons.push(`Unwanted ${path}title: "${obj.title}"`);
    }
    if (obj.description && hasUnwantedPattern(obj.description)) {
      reasons.push(`Unwanted ${path}description: "${obj.description}"`);
    }
    if (obj.name && hasUnwantedPattern(obj.name)) {
      reasons.push(`Unwanted ${path}name: "${obj.name}"`);
    }

    if (obj.defined_by && typeof obj.defined_by === 'string') {
      if (obj.defined_by.includes('undefined')) {
        reasons.push(
          `Invalid coordinates in ${path}defined_by: "${obj.defined_by}"`,
        );
      }
    }

    if (obj.properties && typeof obj.properties === 'object') {
      checkObjectForUnwantedContent(obj.properties, `${path}properties.`);
    }

    if (obj.geometry && obj.geometry.coordinates) {
      const coords = obj.geometry.coordinates;
      if (
        typeof coords === 'object' &&
        (coords.latitude === undefined || coords.longitude === undefined)
      ) {
        reasons.push(
          `Invalid geometry coordinates: latitude=${coords.latitude}, longitude=${coords.longitude}`,
        );
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        key !== 'properties' &&
        key !== 'geometry'
      ) {
        checkObjectForUnwantedContent(value, `${path}${key}.`);
      }
    }
  }

  const motivation = Array.isArray(annotation.motivation)
    ? annotation.motivation
    : [annotation.motivation];

  for (const m of motivation) {
    if (m && typeof m === 'string' && hasUnwantedPattern(m)) {
      reasons.push(`Unwanted motivation: "${m}"`);
    }
  }

  if (annotation.creator) {
    const creator = annotation.creator;
    if (creator.label && hasUnwantedPattern(creator.label)) {
      reasons.push(`Unwanted creator label: "${creator.label}"`);
    }
    if (creator.name && hasUnwantedPattern(creator.name)) {
      reasons.push(`Unwanted creator name: "${creator.name}"`);
    }
    if (creator.id && typeof creator.id === 'string') {
      const id = creator.id.toLowerCase().trim();
      if (id.includes('test') || id.includes('unknown') || id === 'test-user') {
        reasons.push(`Unwanted creator ID: "${creator.id}"`);
      }
    }
  }

  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : annotation.body
    ? [annotation.body]
    : [];

  for (const body of bodies) {
    if (body && typeof body === 'object') {
      if (body.value && hasUnwantedPattern(body.value)) {
        reasons.push(`Unwanted body content: "${body.value}"`);
      }

      if (body.purpose && hasUnwantedPattern(body.purpose)) {
        reasons.push(`Unwanted body purpose: "${body.purpose}"`);
      }

      if (body.label && hasUnwantedPattern(body.label)) {
        reasons.push(`Unwanted body label: "${body.label}"`);
      }

      if (body.type === 'SpecificResource' && body.source) {
        if (typeof body.source === 'string') {
          if (
            body.source.toLowerCase().includes('test') ||
            body.source.toLowerCase().includes('unknown')
          ) {
            reasons.push(`Unwanted source URL: "${body.source}"`);
          }
        } else if (typeof body.source === 'object') {
          checkObjectForUnwantedContent(body.source, 'source.');
        }
      }

      if (body.creator) {
        const creator = body.creator;
        if (creator.label && hasUnwantedPattern(creator.label)) {
          reasons.push(`Unwanted body creator label: "${creator.label}"`);
        }
        if (creator.id && typeof creator.id === 'string') {
          const id = creator.id.toLowerCase().trim();
          if (
            id.includes('test') ||
            id.includes('unknown') ||
            id === 'test-user'
          ) {
            reasons.push(`Unwanted body creator ID: "${creator.id}"`);
          }
        }
        if (creator.name && hasUnwantedPattern(creator.name)) {
          reasons.push(`Unwanted body creator name: "${creator.name}"`);
        }
      }
    }
  }

  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : annotation.target
    ? [annotation.target]
    : [];

  for (const target of targets) {
    if (
      target &&
      typeof target === 'string' &&
      target.toLowerCase().includes('test')
    ) {
      reasons.push(`Unwanted target: "${target}"`);
    } else if (target && typeof target === 'object') {
      checkObjectForUnwantedContent(target, 'target.');
    }
  }

  if (annotation.id && typeof annotation.id === 'string') {
    const id = annotation.id.toLowerCase();
    if (
      id.includes('/test') ||
      id.includes('-test-') ||
      id.includes('_test_') ||
      id.includes('test.') ||
      id.includes('.test')
    ) {
      reasons.push(`Test annotation ID: "${annotation.id}"`);
    }
  }

  if (annotation.label && hasUnwantedPattern(annotation.label)) {
    reasons.push(`Unwanted annotation label: "${annotation.label}"`);
  }

  if (annotation.title && hasUnwantedPattern(annotation.title)) {
    reasons.push(`Unwanted annotation title: "${annotation.title}"`);
  }

  return reasons;
}

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Linking annotation cleanup endpoint - COMPREHENSIVE VERSION',
    features: [
      'Consolidates duplicate linking annotations with same targets',
      'Fixes structural issues in annotation bodies',
      'Corrects PointSelector purpose from "highlighting" to "selecting"',
      'Adds missing creator and created fields to body elements',
      'Removes annotations with orphaned/broken target references',
      'Deletes annotations with unwanted content (test, unknown, etc.)',
      'Maintains W3C Web Annotation Protocol compliance',
    ],
    unwantedContentChecks: [
      'Motivation containing "unknown", "test", or similar',
      'Body content with "test", "unknown", "test annotation"',
      'SpecificResource source labels: "Unknown Location", "Test Location"',
      'Geo properties: title/description with "unknown" or "test"',
      'Invalid coordinates: containing "undefined"',
      'Creator labels/IDs indicating test accounts',
      'Annotation IDs containing test patterns',
    ],
    usage: {
      dryRun: 'POST with { "action": "cleanup-duplicates", "dryRun": true }',
      cleanup: 'POST with { "action": "cleanup-duplicates", "dryRun": false }',
    },
  });
}
