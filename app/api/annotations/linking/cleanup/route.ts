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

    console.log(
      'Sample annotation targets:',
      allLinkingAnnotations.slice(0, 2).map((a) => ({
        id: a.id.substring(
          a.id.lastIndexOf('/') + 1,
          a.id.lastIndexOf('/') + 9,
        ),
        targets: Array.isArray(a.target) ? a.target.length : 1,
      })),
    );

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
          structuralFixes: analysisResult.needsStructuralFix.length,
          annotationsToKeep: analysisResult.singles.length,
          totalLinkingRelationships: analysisResult.groups.reduce(
            (total, group) => total + group.targets.length,
            0,
          ),
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
          structuralFixGroups: analysisResult.groups
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
        },
      });
    }

    const cleanupResult = await performCleanup(
      analysisResult,
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
  const knownLinkingPages = [232, 233, 234];

  for (const page of knownLinkingPages) {
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

        allAnnotations.push(...linkingAnnotations);
      }
    } catch (error) {}
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
          target: group.targets,
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

  return {
    type: 'Annotation',
    motivation: 'linking',
    target: annotation.target,
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

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Linking annotation cleanup endpoint - COMPREHENSIVE VERSION',
    features: [
      'Consolidates duplicate linking annotations with same targets',
      'Fixes structural issues in annotation bodies',
      'Corrects PointSelector purpose from "highlighting" to "selecting"',
      'Adds missing creator and created fields to body elements',
      'Maintains W3C Web Annotation Protocol compliance',
    ],
    usage: {
      dryRun: 'POST with { "action": "cleanup-duplicates", "dryRun": true }',
      cleanup: 'POST with { "action": "cleanup-duplicates", "dryRun": false }',
    },
  });
}
