import { encodeCanvasUri } from '@/lib/shared/utils';
import { createAnnotation, updateAnnotation } from '@/lib/viewer/annoRepo';
import {
  repairLinkingAnnotationStructure,
  validateLinkingAnnotationBeforeSave,
} from '@/lib/viewer/linking-repair';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const isTestMode = process.env.NODE_ENV === 'development';

  if (!session && !isTestMode) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create linking annotations' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const targets = Array.isArray(body.target) ? body.target : [body.target];

    const existingLinkingAnnotations = await findExistingLinkingAnnotations(
      targets,
    );

    const consolidationResult = await analyzeConsolidationOptions(
      existingLinkingAnnotations,
      targets,
      body,
    );

    if (consolidationResult.canConsolidate) {
      const updatedAnnotation = await consolidateWithExisting(
        consolidationResult.existingAnnotation,
        body,
        session,
      );
      return NextResponse.json(updatedAnnotation, { status: 200 });
    }

    const conflicts = await checkForConflictingRelationships(
      existingLinkingAnnotations,
      targets,
    );

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot link these annotations - they are already part of different linking groups',
          conflictingAnnotations: conflicts,
          suggestion: 'Remove existing links first or merge the groups',
        },
        { status: 409 },
      );
    }

    const user = session?.user as any;

    let validatedBodies = body.body;
    if (validatedBodies) {
      const bodiesArray = Array.isArray(validatedBodies)
        ? validatedBodies
        : [validatedBodies];
      validatedBodies = validateAndFixBodies(bodiesArray, user);
    }

    const linkingAnnotationWithCreator = {
      ...body,
      motivation: 'linking',
      body: validatedBodies,
      creator: body.creator || {
        id: user?.id || user?.email || 'test-user@example.com',
        type: 'Person',
        label: user?.label || user?.name || 'Test User',
      },
      created: body.created || new Date().toISOString(),
    };

    // Repair the annotation structure before saving
    const repairedAnnotation = repairLinkingAnnotationStructure(
      linkingAnnotationWithCreator,
    );

    // Validate the annotation before saving
    const validation = validateLinkingAnnotationBeforeSave(repairedAnnotation);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid linking annotation structure',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    const created = await createAnnotation(repairedAnnotation);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating linking annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

async function findExistingLinkingAnnotations(targets: string[]) {
  const allExisting: any[] = [];

  for (const target of targets) {
    try {
      const encodedTarget = encodeCanvasUri(target);
      const queryUrl = `${
        process.env.ANNOREPO_BASE_URL ||
        'https://annorepo.globalise.huygens.knaw.nl'
      }/services/necessary-reunions/custom-query/with-target:target=${encodedTarget}`;

      const response = await fetch(queryUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const linkingAnnotations = (data.items || []).filter(
          (ann: any) => ann.motivation === 'linking',
        );
        allExisting.push(...linkingAnnotations);
      }
    } catch (error) {
      console.warn(`Failed to check target ${target}:`, error);
    }
  }

  const uniqueExisting = Array.from(
    new Map(allExisting.map((ann) => [ann.id, ann])).values(),
  );

  return uniqueExisting;
}

async function analyzeConsolidationOptions(
  existingAnnotations: any[],
  newTargets: string[],
  newBody: any,
) {
  if (existingAnnotations.length === 0) {
    return { canConsolidate: false };
  }

  const perfectMatch = existingAnnotations.find((existing) => {
    const existingTargets = Array.isArray(existing.target)
      ? existing.target
      : [existing.target];
    return (
      newTargets.every((target: string) => existingTargets.includes(target)) &&
      existingTargets.every((target: any) => newTargets.includes(target))
    );
  });

  if (perfectMatch) {
    return {
      canConsolidate: true,
      existingAnnotation: perfectMatch,
      reason: 'Perfect target match - consolidating bodies',
    };
  }

  const partialMatch = existingAnnotations.find((existing) => {
    const existingTargets = Array.isArray(existing.target)
      ? existing.target
      : [existing.target];
    return newTargets.some((target: string) =>
      existingTargets.includes(target),
    );
  });

  if (partialMatch) {
    const existingTargets = Array.isArray(partialMatch.target)
      ? partialMatch.target
      : [partialMatch.target];
    const combinedTargets = Array.from(
      new Set([...existingTargets, ...newTargets]),
    );

    return {
      canConsolidate: true,
      existingAnnotation: partialMatch,
      combinedTargets,
      reason: 'Partial target overlap - expanding target list',
    };
  }

  return { canConsolidate: false };
}

function validateAndFixBodies(bodies: any[], user: any): any[] {
  return bodies.map((body) => {
    // Ensure proper structure
    if (!body.type) {
      body.type = 'SpecificResource';
    }

    // Fix point selector purpose
    if (
      body.selector?.type === 'PointSelector' &&
      (body.purpose === 'highlighting' || !body.purpose)
    ) {
      body.purpose = 'selecting';
    }

    // Fix identifying purpose
    if (body.source && !body.purpose) {
      body.purpose = 'identifying';
    }

    // Fix geotagging sources
    if (body.purpose === 'geotagging' && body.source) {
      if (!body.source.type) {
        body.source.type = 'Feature';
      }

      // Ensure proper geometry structure
      if (body.source.geometry && !body.source.geometry.type) {
        body.source.geometry.type = 'Point';
      }

      // Ensure properties exist
      if (!body.source.properties && body.source.label) {
        body.source.properties = {
          title: body.source.label,
          description: body.source.label,
        };
      }
    }

    // Add creator if missing
    if (!body.creator && user) {
      body.creator = {
        id: user.id || user.email,
        type: 'Person',
        label: user.label || user.name,
      };
    }

    // Add created timestamp if missing
    if (!body.created) {
      body.created = new Date().toISOString();
    }

    return body;
  });
}

async function consolidateWithExisting(
  existingAnnotation: any,
  newBody: any,
  session: any,
) {
  const user = session?.user as any;

  const existingTargets = Array.isArray(existingAnnotation.target)
    ? existingAnnotation.target
    : [existingAnnotation.target];
  const newTargets = Array.isArray(newBody.target)
    ? newBody.target
    : [newBody.target];
  const combinedTargets = Array.from(
    new Set([...existingTargets, ...newTargets]),
  );

  const existingBodies = Array.isArray(existingAnnotation.body)
    ? existingAnnotation.body
    : existingAnnotation.body
    ? [existingAnnotation.body]
    : [];

  const newBodies = Array.isArray(newBody.body)
    ? newBody.body
    : newBody.body
    ? [newBody.body]
    : [];

  let consolidatedBodies = [...existingBodies];

  for (const newBodyItem of newBodies) {
    if (newBodyItem.purpose) {
      consolidatedBodies = consolidatedBodies.filter(
        (existing: any) => existing.purpose !== newBodyItem.purpose,
      );
    }
    consolidatedBodies.push(newBodyItem);
  }

  consolidatedBodies = validateAndFixBodies(consolidatedBodies, user);

  const consolidatedAnnotation = {
    ...existingAnnotation,
    target: combinedTargets,
    body: consolidatedBodies,
    modified: new Date().toISOString(),
    ...(user && {
      lastModifiedBy: {
        id: user?.id || user?.email || 'unknown',
        type: 'Person',
        label: user?.label || user?.name || 'Unknown User',
      },
    }),
  };

  const updated = await updateAnnotation(
    existingAnnotation.id,
    consolidatedAnnotation,
  );

  return updated;
}

async function checkForConflictingRelationships(
  existingAnnotations: any[],
  newTargets: string[],
) {
  const conflicts: string[] = [];

  for (const existing of existingAnnotations) {
    const existingTargets = Array.isArray(existing.target)
      ? existing.target
      : [existing.target];

    const hasOverlap = newTargets.some((target: string) =>
      existingTargets.includes(target),
    );
    const isCompleteMatch =
      newTargets.every((target: string) => existingTargets.includes(target)) &&
      existingTargets.every((target: any) => newTargets.includes(target));

    if (hasOverlap && !isCompleteMatch) {
      const conflictingTargets = existingTargets.filter(
        (target: any) => !newTargets.includes(target),
      );
      if (conflictingTargets.length > 0) {
        conflicts.push(existing.id);
      }
    }
  }

  return conflicts;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    if (!canvasId) {
      return NextResponse.json({ annotations: [] });
    }

    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const encodedCanvasId = encodeCanvasUri(canvasId);
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/linking-for-canvas:canvas=${encodedCanvasId}`;

    try {
      const response = await fetch(customQueryUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const linkingAnnotations = data.items || [];
        return NextResponse.json({ annotations: linkingAnnotations });
      }
    } catch (error) {
      console.warn(
        'Custom query failed, falling back to standard method:',
        error,
      );
    }

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;
    let allLinkingAnnotations: any[] = [];

    // Include more recent pages to catch newest linking annotations
    const linkingPages = [232, 233, 234, 235, 236, 237, 238, 239, 240];
    const pagePromises = linkingPages.map(async (page) => {
      const pageUrl = `${endpoint}?page=${page}`;

      try {
        const response = await fetch(pageUrl, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];
          return pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );
        }
      } catch (error) {
        console.error(`Failed to fetch page ${page}:`, error);
      }
      return [];
    });

    const pageResults = await Promise.all(pagePromises);
    allLinkingAnnotations = pageResults.flat();

    const targetToLinkingMap = new Map<string, any[]>();
    for (const linkingAnnotation of allLinkingAnnotations) {
      const targets = Array.isArray(linkingAnnotation.target)
        ? linkingAnnotation.target
        : [linkingAnnotation.target];

      for (const target of targets) {
        if (typeof target === 'string') {
          if (!targetToLinkingMap.has(target)) {
            targetToLinkingMap.set(target, []);
          }
          targetToLinkingMap.get(target)!.push(linkingAnnotation);
        }
      }
    }

    const canvasLinkingAnnotations: any[] = [];
    const targetIds = Array.from(targetToLinkingMap.keys());
    const batchSize = 20;

    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batch = targetIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (targetId) => {
        try {
          const targetResponse = await fetch(targetId, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
            signal: AbortSignal.timeout(5000),
          });

          if (targetResponse.ok) {
            const targetAnnotation = await targetResponse.json();
            const annotationTargets = Array.isArray(targetAnnotation.target)
              ? targetAnnotation.target
              : [targetAnnotation.target];

            const belongsToCanvas = annotationTargets.some((target: any) => {
              const targetSource =
                typeof target === 'string' ? target : target.source;
              return targetSource && targetSource.includes(canvasId);
            });

            if (belongsToCanvas) {
              return targetToLinkingMap.get(targetId) || [];
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch target annotation ${targetId}:`, error);
        }
        return [];
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        canvasLinkingAnnotations.push(...result);
      }
    }

    const uniqueAnnotations = Array.from(
      new Map(canvasLinkingAnnotations.map((ann) => [ann.id, ann])).values(),
    );

    return NextResponse.json({ annotations: uniqueAnnotations });
  } catch (error) {
    console.error('Error fetching linking annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linking annotations' },
      { status: 500 },
    );
  }
}
