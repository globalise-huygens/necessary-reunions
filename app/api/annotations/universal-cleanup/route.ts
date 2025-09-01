import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unauthorized – please sign in to clean up unwanted annotations',
      },
      { status: 401 },
    );
  }

  try {
    const { action, dryRun = true } = await request.json();

    if (action !== 'cleanup-unwanted' && action !== 'analyze') {
      return NextResponse.json(
        {
          error: 'Invalid action. Use "cleanup-unwanted" or "analyze"',
        },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const allAnnotations = await fetchAllAnnotations(
      ANNOREPO_BASE_URL,
      CONTAINER,
    );

    if (allAnnotations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No annotations found',
        summary: { total: 0, unwanted: 0, cleaned: 0 },
      });
    }

    const analysisResult = analyzeUnwantedAnnotations(allAnnotations);

    const shouldRunDryRun = dryRun || action === 'analyze';

    if (shouldRunDryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Analysis complete - no changes made',
        analysis: {
          totalAnnotations: allAnnotations.length,
          unwantedAnnotations: analysisResult.unwantedAnnotations.length,
          cleanAnnotations: analysisResult.cleanAnnotations.length,
          unwantedByMotivation: analysisResult.unwantedByMotivation,
          unwantedByContent: analysisResult.unwantedByContent,
          unwantedDetails: analysisResult.unwantedAnnotations.map((ann) => ({
            id: ann.id,
            motivation: ann.motivation,
            reasons: ann.unwantedReasons,
            preview: getAnnotationPreview(ann),
          })),
        },
      });
    }

    const cleanupResult = await performUnwantedCleanup(
      analysisResult.unwantedAnnotations,
      ANNOREPO_BASE_URL,
      session,
    );

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: {
        totalAnalyzed: allAnnotations.length,
        unwantedFound: analysisResult.unwantedAnnotations.length,
        annotationsDeleted: cleanupResult.annotationsDeleted,
        errors: cleanupResult.errors,
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

async function fetchAllAnnotations(baseUrl: string, container: string) {
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

        if (pageAnnotations.length === 0) {
          consecutiveEmptyPages++;

          if (consecutiveEmptyPages >= 10 && page > 250) {
            hasMore = false;
          }
        } else {
          consecutiveEmptyPages = 0;
          allAnnotations.push(...pageAnnotations);
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

function analyzeUnwantedAnnotations(annotations: any[]) {
  const unwantedAnnotations: any[] = [];
  const cleanAnnotations: any[] = [];
  const unwantedByMotivation: Record<string, number> = {};
  const unwantedByContent: Record<string, number> = {};

  for (const annotation of annotations) {
    const unwantedReasons = identifyUnwantedContent(annotation);

    if (unwantedReasons.length > 0) {
      const annotationWithReasons = {
        ...annotation,
        unwantedReasons,
      };
      unwantedAnnotations.push(annotationWithReasons);

      const motivation = Array.isArray(annotation.motivation)
        ? annotation.motivation.join(', ')
        : annotation.motivation || 'unknown';
      unwantedByMotivation[motivation] =
        (unwantedByMotivation[motivation] || 0) + 1;

      for (const reason of unwantedReasons) {
        unwantedByContent[reason] = (unwantedByContent[reason] || 0) + 1;
      }
    } else {
      cleanAnnotations.push(annotation);
    }
  }

  return {
    unwantedAnnotations,
    cleanAnnotations,
    unwantedByMotivation,
    unwantedByContent,
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

  const motivation = Array.isArray(annotation.motivation)
    ? annotation.motivation
    : [annotation.motivation];

  for (const m of motivation) {
    if (m && typeof m === 'string' && hasUnwantedPattern(m)) {
      reasons.push(`Unwanted motivation: "${m}"`);
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
        if (body.source.label && hasUnwantedPattern(body.source.label)) {
          reasons.push(`Unwanted source label: "${body.source.label}"`);
        }

        if (body.source.title && hasUnwantedPattern(body.source.title)) {
          reasons.push(`Unwanted source title: "${body.source.title}"`);
        }

        if (body.source.properties) {
          const props = body.source.properties;

          const geoFields = [
            'title',
            'description',
            'name',
            'label',
            'placename',
          ];
          for (const field of geoFields) {
            if (props[field] && hasUnwantedPattern(props[field])) {
              reasons.push(`Unwanted geo ${field}: "${props[field]}"`);
            }
          }
        }

        const coordFields = ['defined_by', 'coordinates', 'geometry'];
        for (const field of coordFields) {
          if (body.source[field] && typeof body.source[field] === 'string') {
            if (
              body.source[field].includes('undefined') ||
              body.source[field].includes('null')
            ) {
              reasons.push(
                `Invalid coordinates in ${field}: "${body.source[field]}"`,
              );
            }
          }
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
      if (
        target.source &&
        target.source.label &&
        hasUnwantedPattern(target.source.label)
      ) {
        reasons.push(`Unwanted target source label: "${target.source.label}"`);
      }
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

function getAnnotationPreview(annotation: any): string {
  const motivation = Array.isArray(annotation.motivation)
    ? annotation.motivation.join(', ')
    : annotation.motivation || 'unknown';

  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : annotation.body
    ? [annotation.body]
    : [];

  const bodyText = bodies
    .map((b: any) => b.value || '')
    .filter(Boolean)
    .join('; ')
    .substring(0, 100);

  const shortId = annotation.id.split('/').pop()?.substring(0, 8) + '...';

  return `${motivation} | ${shortId} | ${bodyText || 'no content'}`;
}

async function performUnwantedCleanup(
  unwantedAnnotations: any[],
  baseUrl: string,
  session: any,
) {
  const result = {
    annotationsDeleted: 0,
    errors: 0,
    details: [] as any[],
  };

  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
  };

  for (const annotation of unwantedAnnotations) {
    try {
      await deleteAnnotation(annotation, AUTH_HEADER);
      result.annotationsDeleted++;

      result.details.push({
        type: 'unwanted-deletion',
        id: annotation.id,
        motivation: annotation.motivation,
        reasons: annotation.unwantedReasons,
        success: true,
      });
    } catch (error: any) {
      result.errors++;
      result.details.push({
        type: 'unwanted-deletion-error',
        id: annotation.id,
        motivation: annotation.motivation,
        reasons: annotation.unwantedReasons,
        error: error.message,
        success: false,
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

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Universal annotation cleanup endpoint',
    features: [
      'Identifies and removes annotations with unwanted content',
      'Checks motivations for "unknown", "test", or similar unwanted values',
      'Examines body content for test/unknown text',
      'Validates creator information for test accounts',
      'Removes annotations with test-related IDs or targets',
      'Works across all annotation types (linking, iconography, textspotting, etc.)',
    ],
    unwantedPatterns: [
      'Motivation: "unknown", "test", or containing these terms',
      'Body value: "unknown", "test", "test annotation", "test geotagging", etc.',
      'Body purpose: "unknown", "test", or containing these terms',
      'SpecificResource source labels: "Unknown Location", "Test Location"',
      'Geo properties: title/description with "unknown" or "test"',
      'Invalid coordinates: containing "undefined"',
      'Creator label: "test", "unknown", "test user", etc.',
      'Creator ID: "test-user" or containing "test"/"unknown"',
      'Target: containing "test"',
      'Annotation ID: containing "/test", "-test-", or "_test_"',
    ],
    usage: {
      analyze: 'POST with { "action": "analyze", "dryRun": true }',
      cleanup: 'POST with { "action": "cleanup-unwanted", "dryRun": false }',
    },
  });
}
