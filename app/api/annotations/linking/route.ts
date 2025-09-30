import { encodeCanvasUri } from '@/lib/shared/utils';
import { updateAnnotation } from '@/lib/viewer/annoRepo';
import {
  repairLinkingAnnotationStructure,
  validateLinkingAnnotationBeforeSave,
} from '@/lib/viewer/linking-repair';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

// Server-side annotation creation to avoid circular dependency
async function createAnnotationDirect(annotation: any): Promise<any> {
  const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
  const CONTAINER = 'necessary-reunions';

  const authToken = process.env.ANNO_REPO_TOKEN_JONA;
  if (!authToken) {
    throw new Error('Authentication token not available');
  }

  const response = await fetch(`${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/`, {
    method: 'POST',
    headers: {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Failed to create annotation: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
}

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
        consolidationResult,
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

    const repairedAnnotation = repairLinkingAnnotationStructure(
      linkingAnnotationWithCreator,
    );

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

    const created = await createAnnotationDirect(repairedAnnotation);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating linking annotation:', {
      error: err,
      message: err.message,
      stack: err.stack,
    });
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000);

      const response = await fetch(queryUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

  const exactMatch = existingAnnotations.find((existing) => {
    const existingTargets = Array.isArray(existing.target)
      ? existing.target
      : [existing.target];

    return (
      newTargets.length === existingTargets.length &&
      newTargets.every(
        (target: string, index: number) => existingTargets[index] === target,
      )
    );
  });

  if (exactMatch) {
    return {
      canConsolidate: true,
      existingAnnotation: exactMatch,
      reason: 'Exact target match (same order) - consolidating bodies',
    };
  }

  const sameTargetSetMatch = existingAnnotations.find((existing) => {
    const existingTargets = Array.isArray(existing.target)
      ? existing.target
      : [existing.target];

    return (
      newTargets.length === existingTargets.length &&
      newTargets.every((target: string) => existingTargets.includes(target)) &&
      existingTargets.every((target: any) => newTargets.includes(target)) &&
      !newTargets.every(
        (target: string, index: number) => existingTargets[index] === target,
      )
    );
  });

  if (sameTargetSetMatch) {
    const timeDiff =
      new Date().getTime() - new Date(sameTargetSetMatch.created).getTime();
    const isRecentDuplicate = timeDiff < 48 * 60 * 60 * 1000;

    const existingBodies = Array.isArray(sameTargetSetMatch.body)
      ? sameTargetSetMatch.body
      : sameTargetSetMatch.body
      ? [sameTargetSetMatch.body]
      : [];

    const newBodies = Array.isArray(newBody.body)
      ? newBody.body
      : newBody.body
      ? [newBody.body]
      : [];

    const hasSubstantialNewContent = newBodies.some(
      (body: any) =>
        body.purpose === 'selecting' || body.purpose === 'geotagging',
    );

    const existingPointSelector = existingBodies.find(
      (body: any) =>
        body.purpose === 'selecting' && body.selector?.type === 'PointSelector',
    );
    const newPointSelector = newBodies.find(
      (body: any) =>
        body.purpose === 'selecting' && body.selector?.type === 'PointSelector',
    );

    const hasSamePointSelector =
      existingPointSelector &&
      newPointSelector &&
      existingPointSelector.selector.x === newPointSelector.selector.x &&
      existingPointSelector.selector.y === newPointSelector.selector.y;

    if (
      (isRecentDuplicate && hasSubstantialNewContent) ||
      hasSamePointSelector
    ) {
      return {
        canConsolidate: true,
        existingAnnotation: sameTargetSetMatch,
        reason: hasSamePointSelector
          ? 'Same target set + identical PointSelector - clear duplicate'
          : 'Same target set (different order) - likely duplicate from failed update',
        preserveNewOrder: true,
      };
    }
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
    if (!body.type) {
      body.type = 'SpecificResource';
    }

    if (
      body.selector?.type === 'PointSelector' &&
      (body.purpose === 'highlighting' || !body.purpose)
    ) {
      body.purpose = 'selecting';
    }

    if (body.source && !body.purpose) {
      body.purpose = 'identifying';
    }

    if (body.purpose === 'geotagging' && body.source) {
      if (!body.source.type) {
        body.source.type = 'Feature';
      }

      if (body.source.geometry && !body.source.geometry.type) {
        body.source.geometry.type = 'Point';
      }

      if (!body.source.properties && body.source.label) {
        body.source.properties = {
          title: body.source.label,
          description: body.source.label,
        };
      }
    }

    if (!body.creator && user) {
      body.creator = {
        id: user.id || user.email,
        type: 'Person',
        label: user.label || user.name,
      };
    }

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
  consolidationResult?: any,
) {
  const user = session?.user as any;

  const existingTargets = Array.isArray(existingAnnotation.target)
    ? existingAnnotation.target
    : [existingAnnotation.target];
  const newTargets = Array.isArray(newBody.target)
    ? newBody.target
    : [newBody.target];

  const finalTargets = consolidationResult?.preserveNewOrder
    ? newTargets
    : Array.from(new Set([...existingTargets, ...newTargets]));

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
    target: finalTargets,
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
        const overlapRatio =
          existingTargets.filter((target: any) => newTargets.includes(target))
            .length / Math.max(existingTargets.length, newTargets.length);

        if (overlapRatio > 0.5) {
          conflicts.push(existing.id);
        }
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

    // Use the custom query endpoint for linking annotations as specified in the README
    const encodedMotivation = btoa('linking'); // base64 encode 'linking'
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=${encodedMotivation}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000);

      const authToken = process.env.ANNO_REPO_TOKEN_JONA;
      const headers: HeadersInit = {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      };

      // Add authorization header if token is available
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(customQueryUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const linkingAnnotations = data.items || [];
        console.log(
          `Custom query successful: Found ${linkingAnnotations.length} linking annotations`,
        );
        return NextResponse.json({ annotations: linkingAnnotations });
      } else {
        console.warn(
          `Custom query failed with status: ${response.status} - ${response.statusText}`,
        );
        console.warn(`Query URL: ${customQueryUrl}`);
        const errorText = await response.text().catch(() => 'No error details');
        console.warn('Error details:', errorText);
      }
    } catch (error) {
      console.warn(
        'Custom query failed, falling back to standard method:',
        error,
      );
    }

    // Fallback to the existing implementation if custom query fails
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;
    let allLinkingAnnotations: any[] = [];

    // Updated page range based on current state mentioned in the user's request
    const linkingPages = [
      220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234,
      235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
      250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260,
    ];
    const pagePromises = linkingPages.map(async (page) => {
      const pageUrl = `${endpoint}?page=${page}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);

        const response = await fetch(pageUrl, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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

    // Rest of the existing fallback logic...
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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 12000);

          const targetResponse = await fetch(targetId, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

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
