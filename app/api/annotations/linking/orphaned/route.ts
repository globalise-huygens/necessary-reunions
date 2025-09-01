import {
  type OrphanedTargetAnalysis,
  removeOrphanedTargets,
  shouldDeleteAfterOrphanCleanup,
  validateTargetExistence,
} from '@/lib/viewer/linking-repair';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

interface OrphanedAnalysisResult {
  totalLinkingAnnotations: number;
  annotationsWithOrphanedTargets: number;
  annotationsToDelete: number;
  annotationsToRepair: number;
  totalOrphanedTargets: number;
  annotationDetails: Array<{
    id: string;
    shortId: string;
    targetAnalysis: OrphanedTargetAnalysis;
    shouldDelete: boolean;
    deleteReason?: string;
    created?: string;
    modified?: string;
  }>;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error:
          'Unauthorized – please sign in to check linking annotation targets',
      },
      { status: 401 },
    );
  }

  try {
    const { action, dryRun = true } = await request.json();

    if (action !== 'analyze-orphaned' && action !== 'fix-orphaned') {
      return NextResponse.json(
        { error: 'Invalid action. Use "analyze-orphaned" or "fix-orphaned"' },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    if (action === 'analyze-orphaned') {
      const analysis = await analyzeOrphanedTargets(
        ANNOREPO_BASE_URL,
        CONTAINER,
      );

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${analysis.totalLinkingAnnotations} linking annotations. ${analysis.annotationsWithOrphanedTargets} have orphaned targets.`,
        analysis,
      });
    }

    if (action === 'fix-orphaned') {
      if (dryRun) {
        return NextResponse.json({
          success: false,
          message:
            'Cannot perform fix-orphaned with dryRun=true. Set dryRun=false to actually fix annotations.',
        });
      }

      const result = await fixOrphanedTargets(
        ANNOREPO_BASE_URL,
        CONTAINER,
        session,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in orphaned targets check:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process orphaned targets' },
      { status: 500 },
    );
  }
}

async function fetchAllLinkingAnnotations(baseUrl: string, container: string) {
  const allAnnotations: any[] = [];

  const knownLinkingPages = [232, 233, 234, 235, 236, 237, 238, 239, 240];

  for (const page of knownLinkingPages) {
    try {
      const endpoint = `${baseUrl}/w3c/${container}?page=${page}`;

      const response = await fetch(endpoint, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const annotations = data.items || [];

        const linkingAnnotations = annotations.filter(
          (annotation: any) => annotation.motivation === 'linking',
        );

        allAnnotations.push(...linkingAnnotations);
      } else {
        console.warn(`Failed to fetch page ${page}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
    }
  }

  return allAnnotations;
}

async function analyzeOrphanedTargets(
  baseUrl: string,
  container: string,
): Promise<OrphanedAnalysisResult> {
  const linkingAnnotations = await fetchAllLinkingAnnotations(
    baseUrl,
    container,
  );

  const result: OrphanedAnalysisResult = {
    totalLinkingAnnotations: linkingAnnotations.length,
    annotationsWithOrphanedTargets: 0,
    annotationsToDelete: 0,
    annotationsToRepair: 0,
    totalOrphanedTargets: 0,
    annotationDetails: [],
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
      result.annotationDetails.push({
        id: annotation.id,
        shortId: annotation.id.split('/').pop()?.substring(0, 8) + '...',
        targetAnalysis: {
          hasOrphanedTargets: false,
          validTargets: [],
          orphanedTargets: [],
          totalTargets: 0,
          validTargetCount: 0,
          orphanedTargetCount: 0,
          details: [
            {
              target: 'analysis-error',
              exists: false,
              error: error.message,
            },
          ],
        },
        shouldDelete: false,
      });
    }
  }

  return result;
}

async function fixOrphanedTargets(
  baseUrl: string,
  container: string,
  session: any,
) {
  const analysis = await analyzeOrphanedTargets(baseUrl, container);

  const result = {
    success: true,
    message: `Processing ${analysis.annotationsWithOrphanedTargets} annotations with orphaned targets`,
    summary: {
      totalAnalyzed: analysis.totalLinkingAnnotations,
      annotationsWithOrphanedTargets: analysis.annotationsWithOrphanedTargets,
      annotationsDeleted: 0,
      annotationsRepaired: 0,
      annotationsWithErrors: 0,
      orphanedTargetsRemoved: 0,
    },
    details: [] as any[],
  };

  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
  };

  for (const annotationDetail of analysis.annotationDetails) {
    if (!annotationDetail.targetAnalysis.hasOrphanedTargets) {
      continue;
    }

    try {
      if (annotationDetail.shouldDelete) {
        await deleteAnnotation(annotationDetail.id, AUTH_HEADER);
        result.summary.annotationsDeleted++;
        result.details.push({
          id: annotationDetail.shortId,
          action: 'deleted',
          reason: annotationDetail.deleteReason,
          orphanedTargetsRemoved:
            annotationDetail.targetAnalysis.orphanedTargetCount,
        });
      } else {
        const fetchResponse = await fetch(annotationDetail.id, {
          headers: {
            ...AUTH_HEADER,
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
        });

        if (!fetchResponse.ok) {
          throw new Error(
            `Failed to fetch annotation: ${fetchResponse.status}`,
          );
        }

        const currentAnnotation = await fetchResponse.json();
        const repairedAnnotation = removeOrphanedTargets(
          currentAnnotation,
          annotationDetail.targetAnalysis,
        );

        const updateResult = await updateAnnotation(
          annotationDetail.id,
          repairedAnnotation,
          AUTH_HEADER,
        );

        if (updateResult.success) {
          result.summary.annotationsRepaired++;
          result.summary.orphanedTargetsRemoved +=
            annotationDetail.targetAnalysis.orphanedTargetCount;
          result.details.push({
            id: annotationDetail.shortId,
            action: 'repaired',
            orphanedTargetsRemoved:
              annotationDetail.targetAnalysis.orphanedTargetCount,
            validTargetsRemaining:
              annotationDetail.targetAnalysis.validTargetCount,
          });
        } else {
          throw new Error(updateResult.error);
        }
      }
    } catch (error: any) {
      result.summary.annotationsWithErrors++;
      result.details.push({
        id: annotationDetail.shortId,
        action: 'error',
        error: error.message,
      });
    }
  }

  return result;
}

async function deleteAnnotation(annotationUrl: string, authHeader: any) {
  const headResponse = await fetch(annotationUrl, {
    method: 'HEAD',
    headers: {
      ...authHeader,
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
  });

  let etag: string | null = null;
  if (headResponse.ok) {
    etag = headResponse.headers.get('ETag');
  }

  const deleteHeaders: Record<string, string> = {
    ...authHeader,
  };

  if (etag) {
    deleteHeaders['If-Match'] = etag;
  }

  const deleteResponse = await fetch(annotationUrl, {
    method: 'DELETE',
    headers: deleteHeaders,
  });

  if (!deleteResponse.ok) {
    throw new Error(
      `Failed to delete annotation: ${deleteResponse.status} ${deleteResponse.statusText}`,
    );
  }
}

async function updateAnnotation(
  annotationUrl: string,
  annotation: any,
  authHeader: any,
) {
  try {
    const headRes = await fetch(annotationUrl, {
      method: 'HEAD',
      headers: {
        ...authHeader,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    let etag: string | null = null;
    if (headRes.ok) {
      etag = headRes.headers.get('ETag');
    }

    if (!etag) {
      throw new Error('Could not get ETag for annotation update');
    }

    const putRes = await fetch(annotationUrl, {
      method: 'PUT',
      headers: {
        ...authHeader,
        'If-Match': etag,
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
      body: JSON.stringify(annotation),
    });

    if (!putRes.ok) {
      throw new Error(`Update failed: ${putRes.status} ${putRes.statusText}`);
    }

    return { success: true, data: await putRes.json() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    message:
      'Orphaned target analysis and cleanup endpoint for linking annotations',
    features: [
      'Analyzes linking annotations for references to deleted/missing annotations',
      'Validates target annotation existence via HTTP HEAD requests',
      'Removes orphaned targets from linking annotations',
      'Deletes linking annotations with insufficient valid targets (<2)',
      'Maintains W3C Web Annotation Protocol compliance',
    ],
    usage: {
      analyze: 'POST with { "action": "analyze-orphaned", "dryRun": true }',
      fix: 'POST with { "action": "fix-orphaned", "dryRun": false }',
    },
  });
}
