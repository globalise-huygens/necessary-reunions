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

    const response = await fetch(
      `${
        process.env.ANNOREPO_BASE_URL ||
        'https://annorepo.globalise.huygens.knaw.nl'
      }/services/necessary-reunions/search?motivation=linking`,
    );

    if (response.ok) {
      const data = await response.json();
      const existingLinkingAnnotations = Array.isArray(data.items)
        ? data.items
        : [];

      const conflictingAnnotations = existingLinkingAnnotations.filter(
        (existing: any) => {
          if (Array.isArray(existing.target)) {
            return existing.target.some((existingTarget: string) =>
              targets.includes(existingTarget),
            );
          }
          return targets.includes(existing.target);
        },
      );

      if (conflictingAnnotations.length > 0) {
        return NextResponse.json(
          {
            error:
              'One or more annotations are already part of a linking annotation',
            conflictingAnnotations: conflictingAnnotations.map(
              (a: any) => a.id,
            ),
          },
          { status: 409 },
        );
      }
    }

    const user = session?.user as any;
    let linkingAnnotationWithCreator = { ...body };

    if (!linkingAnnotationWithCreator.creator) {
      linkingAnnotationWithCreator.creator = {
        id: user?.id || user?.email || 'test-user@example.com',
        type: 'Person',
        label: user?.label || user?.name || 'Test User',
      };
    }

    if (!linkingAnnotationWithCreator.created) {
      linkingAnnotationWithCreator.created = new Date().toISOString();
    }

    linkingAnnotationWithCreator.motivation = 'linking';

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

    console.log('🔗 Linking API: GET request for canvasId:', canvasId);

    if (!canvasId) {
      console.log('🔗 Linking API: No canvasId provided, returning empty');
      return NextResponse.json({ annotations: [] });
    }

    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    console.log('🔗 Linking API: Original canvasId:', canvasId);
    console.log('🔗 Linking API: Fetching from W3C endpoint:', endpoint);

    console.log('🔗 Linking API: Step 1 - Finding all linking annotations...');
    let allLinkingAnnotations: any[] = [];

    const linkingPages = [232, 233, 234];

    console.log(
      '🔗 Linking API: Fetching only linking annotation pages:',
      linkingPages,
    );

    for (const page of linkingPages) {
      const pageUrl = `${endpoint}?page=${page}`;
      console.log(`🔗 Linking API: Fetching page ${page}:`, pageUrl);

      const response = await fetch(pageUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });

      if (!response.ok) {
        console.error(
          `Failed to fetch page ${page} from AnnoRepo, status:`,
          response.status,
        );
        continue;
      }

      const data = await response.json();
      const pageAnnotations = data.items || [];

      const pageLinkingAnnotations = pageAnnotations.filter(
        (annotation: any) => annotation.motivation === 'linking',
      );

      if (pageLinkingAnnotations.length > 0) {
        console.log(
          `🔗 Linking API: Page ${page} found ${pageLinkingAnnotations.length} linking annotations`,
        );
        allLinkingAnnotations.push(...pageLinkingAnnotations);
      }
    }

    console.log(
      `🔗 Linking API: Found ${allLinkingAnnotations.length} total linking annotations`,
    );

    const targetAnnotationIds = new Set<string>();
    for (const linkingAnnotation of allLinkingAnnotations) {
      const targets = Array.isArray(linkingAnnotation.target)
        ? linkingAnnotation.target
        : [linkingAnnotation.target];
      for (const target of targets) {
        if (typeof target === 'string') {
          targetAnnotationIds.add(target);
        }
      }
    }

    console.log(
      `🔗 Linking API: Found ${targetAnnotationIds.size} unique target annotation IDs`,
    );

    const canvasLinkingAnnotations: any[] = [];

    const targetArray = Array.from(targetAnnotationIds);
    const batchSize = 10;

    for (let i = 0; i < targetArray.length; i += batchSize) {
      const batch = targetArray.slice(i, i + batchSize);

      const batchPromises = batch.map(async (targetId) => {
        try {
          const targetResponse = await fetch(targetId, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
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
              const relevantLinkingAnnotations = allLinkingAnnotations.filter(
                (linkingAnnotation) => {
                  const linkingTargets = Array.isArray(linkingAnnotation.target)
                    ? linkingAnnotation.target
                    : [linkingAnnotation.target];
                  return linkingTargets.includes(targetId);
                },
              );

              return relevantLinkingAnnotations;
            }
          }
        } catch (error) {
          console.error(
            `Failed to fetch target annotation ${targetId}:`,
            error,
          );
        }
        return [];
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        canvasLinkingAnnotations.push(...result);
      }
    }

    console.log(
      '🔗 Linking API: Total linking annotations found for canvas:',
      canvasLinkingAnnotations.length,
    );
    console.log(
      '🔗 Linking API: Canvas linking annotation details:',
      canvasLinkingAnnotations.map((la: any) => ({
        id: la.id,
        motivation: la.motivation,
        target: la.target,
        bodyCount: la.body?.length || 0,
        bodies: la.body?.map((b: any) => ({
          purpose: b.purpose,
          type: b.type,
        })),
      })),
    );

    return NextResponse.json({ annotations: canvasLinkingAnnotations });
  } catch (error) {
    console.error('Error fetching linking annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linking annotations' },
      { status: 500 },
    );
  }
}
