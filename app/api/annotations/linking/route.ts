import { createAnnotation } from '@/lib/annoRepo';
import { encodeCanvasUri } from '@/lib/utils';
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

    // Optimized conflict checking - only check for specific targets instead of all linking annotations
    const conflictPromises = targets.map(async (target: string) => {
      try {
        const encodedTarget = encodeCanvasUri(target);
        const conflictCheckUrl = `${
          process.env.ANNOREPO_BASE_URL ||
          'https://annorepo.globalise.huygens.knaw.nl'
        }/services/necessary-reunions/custom-query/with-target:target=${encodedTarget}`;

        const response = await fetch(conflictCheckUrl, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const data = await response.json();
          const existingAnnotations = data.items || [];
          return existingAnnotations.filter(
            (ann: any) => ann.motivation === 'linking',
          );
        }
      } catch (error) {
        console.warn(`Conflict check failed for target ${target}:`, error);
      }
      return [];
    });

    const conflictResults = await Promise.all(conflictPromises);
    const conflictingAnnotations = conflictResults.flat();

    if (conflictingAnnotations.length > 0) {
      return NextResponse.json(
        {
          error:
            'One or more annotations are already part of a linking annotation',
          conflictingAnnotations: conflictingAnnotations.map((a: any) => a.id),
        },
        { status: 409 },
      );
    }

    // Prepare annotation with creator info
    const user = session?.user as any;
    const linkingAnnotationWithCreator = {
      ...body,
      motivation: 'linking',
      creator: body.creator || {
        id: user?.id || user?.email || 'test-user@example.com',
        type: 'Person',
        label: user?.label || user?.name || 'Test User',
      },
      created: body.created || new Date().toISOString(),
    };

    const created = await createAnnotation(linkingAnnotationWithCreator);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating linking annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
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

    // Use the more efficient custom query that directly filters by canvas
    const encodedCanvasId = encodeCanvasUri(canvasId);
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/linking-for-canvas:canvas=${encodedCanvasId}`;

    try {
      // Try the optimized query first
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

    // Fallback to optimized version of the original method
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;
    let allLinkingAnnotations: any[] = [];

    // Fetch pages in parallel instead of sequentially
    const linkingPages = [232, 233, 234];
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

    // Create a map for faster lookups
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

    // Batch check targets for canvas membership
    const canvasLinkingAnnotations: any[] = [];
    const targetIds = Array.from(targetToLinkingMap.keys());
    const batchSize = 20; // Increased batch size

    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batch = targetIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (targetId) => {
        try {
          const targetResponse = await fetch(targetId, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
            // Add timeout to prevent hanging requests
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
          // Silently ignore failed requests to avoid breaking the whole operation
          console.warn(`Failed to fetch target annotation ${targetId}:`, error);
        }
        return [];
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        canvasLinkingAnnotations.push(...result);
      }
    }

    // Remove duplicates efficiently
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
