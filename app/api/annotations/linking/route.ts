import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { encodeCanvasUri } from '../../../../lib/shared/utils';
import { updateAnnotation } from '../../../../lib/viewer/annoRepo';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

interface AnnotationBody {
  type?: string;
  selector?: {
    type: string;
    x?: number;
    y?: number;
    [key: string]: unknown;
  };
  purpose?: string;
  source?: {
    type?: string;
    label?: string;
    geometry?: {
      type?: string;
      [key: string]: unknown;
    };
    properties?: {
      title?: string;
      description?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  [key: string]: unknown;
}

interface User {
  id?: string;
  email?: string;
  label?: string;
  name?: string;
}

interface AnnotationData {
  target?: string | string[];
  body?: AnnotationBody | AnnotationBody[];
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  [key: string]: unknown;
}

async function createAnnotationDirect(
  annotation: Record<string, unknown>,
  projectSlug?: string | null,
): Promise<Record<string, unknown>> {
  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(projectSlug);

  if (!authToken) {
    throw new Error('Authentication token not available');
  }

  const response = await fetch(`${baseUrl}/w3c/${container}/`, {
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

  return (await response.json()) as Record<string, unknown>;
}

export async function POST(request: Request): Promise<
  NextResponse<
    | {
        error: string;
        details?: unknown;
        conflictingAnnotations?: string[];
        suggestion?: string;
      }
    | Record<string, unknown>
  >
> {
  const session = await getServerSession(authOptions);
  const isTestMode = process.env.NODE_ENV === 'development';

  if (!session && !isTestMode) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create linking annotations' },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as AnnotationData & {
      project?: string;
    };
    const projectSlug =
      body.project || new URL(request.url).searchParams.get('project');
    const targets: string[] = Array.isArray(body.target)
      ? body.target
      : body.target
        ? [body.target]
        : [];

    const existingLinkingAnnotations = await findExistingLinkingAnnotations(
      targets,
      projectSlug,
    );

    const consolidationResult = await analyzeConsolidationOptions(
      existingLinkingAnnotations,
      targets,
      body,
    );

    if (consolidationResult.canConsolidate) {
      const updatedAnnotation = await consolidateWithExisting(
        consolidationResult.existingAnnotation!,
        body,
        session as { user?: User } | null,
        consolidationResult,
        projectSlug || undefined,
      );
      return NextResponse.json(updatedAnnotation, {
        status: 200,
      }) as NextResponse<
        | {
            error: string;
            details?: unknown;
            conflictingAnnotations?: string[];
            suggestion?: string;
          }
        | Record<string, unknown>
      >;
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

    const user = session?.user as User;

    let validatedBodies = body.body;
    if (validatedBodies) {
      const bodiesArray: AnnotationBody[] = Array.isArray(validatedBodies)
        ? validatedBodies
        : [validatedBodies];
      validatedBodies = validateAndFixBodies(bodiesArray, user);
    }

    const linkingAnnotationWithCreator = {
      ...body,
      motivation: 'linking',
      body: validatedBodies,
      creator: body.creator || {
        id: user.id || user.email || 'test-user@example.com',
        type: 'Person',
        label: user.label || user.name || 'Test User',
      },
      created: body.created || new Date().toISOString(),
    };

    if (
      !linkingAnnotationWithCreator.target ||
      (Array.isArray(linkingAnnotationWithCreator.target) &&
        linkingAnnotationWithCreator.target.length === 0)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid linking annotation structure',
          details: ['Missing target annotations'],
        },
        { status: 400 },
      );
    }

    if (
      !linkingAnnotationWithCreator.body ||
      !Array.isArray(linkingAnnotationWithCreator.body)
    ) {
      linkingAnnotationWithCreator.body = [];
    }

    const created = await createAnnotationDirect(
      linkingAnnotationWithCreator,
      projectSlug,
    );
    return NextResponse.json(created, { status: 201 }) as NextResponse<
      | {
          error: string;
          details?: unknown;
          conflictingAnnotations?: string[];
          suggestion?: string;
        }
      | Record<string, unknown>
    >;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('Error creating linking annotation:', {
      error: err,
      message: errorMessage,
      stack: errorStack,
    });
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

interface ExistingAnnotation {
  id?: string;
  target?: string | string[];
  body?: AnnotationBody | AnnotationBody[];
  motivation?: string;
  created?: string;
  [key: string]: unknown;
}

async function findExistingLinkingAnnotations(
  targets: string[],
  projectSlug?: string | null,
): Promise<ExistingAnnotation[]> {
  const allExisting: ExistingAnnotation[] = [];
  const { baseUrl, container, customQueryName } =
    resolveAnnoRepoConfig(projectSlug);

  // Fetch all targets in parallel instead of sequentially
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const encodedTarget = encodeCanvasUri(target);
      const queryUrl = `${baseUrl}/services/${container}/custom-query/${customQueryName}:target=${encodedTarget}`;

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
        const data = (await response.json()) as {
          items?: ExistingAnnotation[];
        };
        return (data.items || []).filter((ann) => ann.motivation === 'linking');
      }
      return [];
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allExisting.push(...result.value);
    }
  }

  const uniqueExisting = Array.from(
    new Map(allExisting.map((ann) => [ann.id, ann])).values(),
  );

  return uniqueExisting;
}

interface ConsolidationResult {
  canConsolidate: boolean;
  existingAnnotation?: ExistingAnnotation;
  reason?: string;
  preserveNewOrder?: boolean;
  combinedTargets?: string[];
}

function analyzeConsolidationOptions(
  existingAnnotations: ExistingAnnotation[],
  newTargets: string[],
  newBody: AnnotationData,
): ConsolidationResult {
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
    const createdDate = sameTargetSetMatch.created
      ? new Date(sameTargetSetMatch.created)
      : new Date();
    const timeDiff = new Date().getTime() - createdDate.getTime();
    const isRecentDuplicate = timeDiff < 48 * 60 * 60 * 1000;

    const existingBodies: AnnotationBody[] = Array.isArray(
      sameTargetSetMatch.body,
    )
      ? sameTargetSetMatch.body
      : sameTargetSetMatch.body
        ? [sameTargetSetMatch.body]
        : [];

    const newBodies: AnnotationBody[] = Array.isArray(newBody.body)
      ? newBody.body
      : newBody.body
        ? [newBody.body]
        : [];

    const hasSubstantialNewContent = newBodies.some(
      (body) => body.purpose === 'selecting' || body.purpose === 'geotagging',
    );

    const existingPointSelector = existingBodies.find(
      (body) =>
        body.purpose === 'selecting' && body.selector?.type === 'PointSelector',
    );
    const newPointSelector = newBodies.find(
      (body) =>
        body.purpose === 'selecting' && body.selector?.type === 'PointSelector',
    );

    const hasSamePointSelector =
      existingPointSelector &&
      newPointSelector &&
      existingPointSelector.selector &&
      newPointSelector.selector &&
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
    const existingTargets: string[] = Array.isArray(partialMatch.target)
      ? partialMatch.target.filter((t): t is string => typeof t === 'string')
      : partialMatch.target
        ? [partialMatch.target]
        : [];
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

function validateAndFixBodies(
  bodies: AnnotationBody[],
  user: User,
): AnnotationBody[] {
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
          title: String(body.source.label),
          description: String(body.source.label),
        };
      }
    }

    if (!body.creator) {
      body.creator = {
        id: user.id || user.email || 'unknown',
        type: 'Person',
        label: user.label || user.name || 'Unknown User',
      };
    }

    if (!body.created) {
      body.created = new Date().toISOString();
    }

    return body;
  });
}

async function consolidateWithExisting(
  existingAnnotation: ExistingAnnotation,
  newBody: AnnotationData,
  session: { user?: User } | null,
  consolidationResult?: ConsolidationResult,
  projectSlug?: string,
): Promise<Record<string, unknown>> {
  const user = session?.user;

  const existingTargets: string[] = Array.isArray(existingAnnotation.target)
    ? existingAnnotation.target.filter(
        (t): t is string => typeof t === 'string',
      )
    : existingAnnotation.target
      ? [existingAnnotation.target]
      : [];
  const newTargets: string[] = Array.isArray(newBody.target)
    ? newBody.target.filter((t): t is string => typeof t === 'string')
    : newBody.target
      ? [newBody.target]
      : [];

  const finalTargets = consolidationResult?.preserveNewOrder
    ? newTargets
    : Array.from(new Set([...existingTargets, ...newTargets]));

  const existingBodies: AnnotationBody[] = Array.isArray(
    existingAnnotation.body,
  )
    ? existingAnnotation.body
    : existingAnnotation.body
      ? [existingAnnotation.body]
      : [];

  const newBodies: AnnotationBody[] = Array.isArray(newBody.body)
    ? newBody.body
    : newBody.body
      ? [newBody.body]
      : [];

  let consolidatedBodies = [...existingBodies];

  for (const newBodyItem of newBodies) {
    if (newBodyItem.purpose) {
      consolidatedBodies = consolidatedBodies.filter(
        (existing) => existing.purpose !== newBodyItem.purpose,
      );
    }
    consolidatedBodies.push(newBodyItem);
  }

  consolidatedBodies = validateAndFixBodies(consolidatedBodies, user || {});

  const consolidatedAnnotation = {
    type: 'Annotation',
    ...existingAnnotation,
    target: finalTargets,
    body: consolidatedBodies,
    modified: new Date().toISOString(),
    ...(user && {
      lastModifiedBy: {
        id: user.id || user.email || 'unknown',
        type: 'Person',
        label: user.label || user.name || 'Unknown User',
      },
    }),
  };

  const updated = await updateAnnotation(
    existingAnnotation.id as string,
    consolidatedAnnotation as any,
    projectSlug,
  );

  return updated as unknown as Record<string, unknown>;
}

function checkForConflictingRelationships(
  existingAnnotations: ExistingAnnotation[],
  newTargets: string[],
): string[] {
  const conflicts: string[] = [];

  for (const existing of existingAnnotations) {
    const existingTargets: string[] = Array.isArray(existing.target)
      ? existing.target.filter((t): t is string => typeof t === 'string')
      : existing.target
        ? [existing.target]
        : [];

    const hasOverlap = newTargets.some((target: string) =>
      existingTargets.includes(target),
    );
    const isCompleteMatch =
      newTargets.every((target: string) => existingTargets.includes(target)) &&
      existingTargets.every((target) => newTargets.includes(target));

    if (hasOverlap && !isCompleteMatch) {
      const conflictingTargets = existingTargets.filter(
        (target) => !newTargets.includes(target),
      );

      if (conflictingTargets.length > 0) {
        const overlapRatio =
          existingTargets.filter((target) => newTargets.includes(target))
            .length / Math.max(existingTargets.length, newTargets.length);

        if (overlapRatio > 0.5 && existing.id) {
          conflicts.push(existing.id);
        }
      }
    }
  }

  return conflicts;
}

export async function GET(
  request: Request,
): Promise<
  NextResponse<{ annotations: Record<string, unknown>[]; message?: string }>
> {
  try {
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    if (!canvasId) {
      return NextResponse.json({ annotations: [] });
    }

    const project = searchParams.get('project');
    const { baseUrl, container, authToken, linkingQueryName } =
      resolveAnnoRepoConfig(project);

    const encodedMotivation = btoa('linking');
    // When canvasId is provided, encode it for server-side filtering
    // This avoids returning all linking annotations when only canvas-specific ones are needed
    const encodedTarget = canvasId ? encodeCanvasUri(canvasId) : '';
    const customQueryUrl = `${baseUrl}/services/${container}/custom-query/${linkingQueryName}:target=${encodedTarget},motivationorpurpose=${encodedMotivation}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 8000);

      const headers: HeadersInit = {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      };

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(customQueryUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          items?: Record<string, unknown>[];
        };
        const linkingAnnotations = data.items || [];
        return NextResponse.json(
          { annotations: linkingAnnotations },
          {
            headers: {
              'Cache-Control':
                'public, s-maxage=60, stale-while-revalidate=120',
            },
          },
        );
      } else {
        console.warn(
          `Custom query failed with status: ${response.status} - ${response.statusText}`,
        );
      }
    } catch (error) {
      console.warn('Custom query failed, external service may be down:', error);
    }

    return NextResponse.json({
      annotations: [],
      message: 'External linking service temporarily unavailable',
    });
  } catch (error) {
    console.error('Error fetching linking annotations:', error);
    return NextResponse.json(
      {
        annotations: [],
        message: 'Service temporarily unavailable',
      },
      { status: 200 },
    );
  }
}
