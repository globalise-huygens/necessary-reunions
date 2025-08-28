import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error:
          'Unauthorized – please sign in to analyze iconography annotations',
      },
      { status: 401 },
    );
  }

  try {
    const { action, dryRun = true } = await request.json();

    if (
      action !== 'analyze-iconography' &&
      action !== 'fix-iconography-structure'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid action. Use "analyze-iconography" or "fix-iconography-structure"',
        },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    if (action === 'analyze-iconography') {
      const analysis = await analyzeIconographyAnnotations(
        ANNOREPO_BASE_URL,
        CONTAINER,
      );

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${analysis.totalIconographyAnnotations} iconography annotations. ${analysis.problematicAnnotations.length} need fixes.`,
        analysis: {
          iconographyAnalysis: analysis,
        },
      });
    }

    if (action === 'fix-iconography-structure') {
      if (dryRun) {
        const analysis = await analyzeIconographyAnnotations(
          ANNOREPO_BASE_URL,
          CONTAINER,
        );
        return NextResponse.json({
          success: true,
          dryRun: true,
          message: `DRY RUN: Would fix ${analysis.problematicAnnotations.length} iconography annotations`,
          analysis: {
            iconographyAnalysis: analysis,
          },
        });
      }

      const result = await fixIconographyStructure(
        ANNOREPO_BASE_URL,
        CONTAINER,
        session,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in iconography cleanup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process iconography annotations' },
      { status: 500 },
    );
  }
}

async function analyzeIconographyAnnotations(
  baseUrl: string,
  container: string,
) {
  const allIconographyAnnotations: any[] = [];

  try {
    let page = 0;
    let hasMore = true;

    while (hasMore && page < 250) {
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

          const items = data.items || data.first?.items || [];

          if (!Array.isArray(items) || items.length === 0) {
            hasMore = false;
            break;
          }

          const iconographyItems = items.filter(
            (item: any) =>
              item.motivation === 'iconography' ||
              item.motivation === 'iconograpy' ||
              (Array.isArray(item.motivation) &&
                (item.motivation.includes('iconography') ||
                  item.motivation.includes('iconograpy'))),
          );

          if (iconographyItems.length > 0) {
            allIconographyAnnotations.push(...iconographyItems);
          }

          page++;

          hasMore = !!data.next || items.length > 0;

          if (data.last && typeof data.last === 'string') {
            const lastPageMatch = data.last.match(/page=(\d+)/);
            if (lastPageMatch) {
              const lastPage = parseInt(lastPageMatch[1]);
              if (page > lastPage) {
                hasMore = false;
              }
            }
          }
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(
          `Error fetching page ${page}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        hasMore = false;
      }
    }
  } catch (error) {
    console.error('Error in main search loop:', error);
  }

  const analysis = {
    totalIconographyAnnotations: allIconographyAnnotations.length,
    annotationsWithTypo: 0,
    annotationsWithEmptyTextualBody: 0,
    annotationsWithIncorrectBody: 0,
    annotationsWithMissingBodyArray: 0,
    annotationsWithNonArrayBody: 0,
    annotationsWithHumanModifications: 0,
    annotationsWithMissingCreator: 0,
    correctlyStructuredAnnotations: 0,
    problematicAnnotations: [] as any[],
  };

  for (const annotation of allIconographyAnnotations) {
    const issues = analyzeIconographyAnnotation(annotation);

    if (issues.problems.length > 0) {
      analysis.problematicAnnotations.push({
        id: annotation.id,
        issues: issues.problems,
        motivation: annotation.motivation,
        body: annotation.body || [],
        hasGenerator: issues.hasGenerator,
        hasEmptyTextualBody: issues.hasEmptyTextualBody,
        hasTypoInMotivation: issues.hasTypoInMotivation,
        hasEmptyBodyArray: issues.hasEmptyBodyArray,
        hasMissingBodyArray: issues.hasMissingBodyArray,
        hasNonArrayBody: issues.hasNonArrayBody,
        hasHumanModifications: issues.hasHumanModifications,
        missingCreator: issues.missingCreator,
      });

      if (issues.hasTypoInMotivation) {
        analysis.annotationsWithTypo++;
      }
      if (issues.hasEmptyTextualBody) {
        analysis.annotationsWithEmptyTextualBody++;
      }
      if (issues.hasMissingBodyArray) {
        analysis.annotationsWithMissingBodyArray++;
      }
      if (issues.hasNonArrayBody) {
        analysis.annotationsWithNonArrayBody++;
      }
      if (issues.hasHumanModifications) {
        analysis.annotationsWithHumanModifications++;
      }
      if (issues.missingCreator) {
        analysis.annotationsWithMissingCreator++;
      }
      if (
        issues.hasEmptyTextualBody ||
        issues.hasMissingBodyArray ||
        issues.hasNonArrayBody
      ) {
        analysis.annotationsWithIncorrectBody++;
      }
    } else {
      analysis.correctlyStructuredAnnotations++;
    }
  }

  return analysis;
}

function analyzeIconographyAnnotation(annotation: any) {
  const problems: string[] = [];
  const hasGenerator = !!annotation.target?.generator;
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body].filter(Boolean);

  const hasTypoInMotivation = annotation.motivation === 'iconograpy';
  if (hasTypoInMotivation) {
    problems.push('Motivation has typo: "iconograpy" should be "iconography"');
  }

  const hasEmptyBodyArray =
    Array.isArray(annotation.body) && annotation.body.length === 0;
  const hasMissingBodyArray = !annotation.body;
  const hasNonArrayBody = annotation.body && !Array.isArray(annotation.body);

  if (hasMissingBodyArray) {
    problems.push('Missing body array');
  }

  if (hasNonArrayBody) {
    problems.push('Body should be array');
  }

  const textualBodies = bodies.filter((b: any) => b.type === 'TextualBody');
  const hasEmptyTextualBody = textualBodies.some(
    (body: any) => !body.value || body.value.trim() === '',
  );

  const humanModifiedBodies = textualBodies.filter((body: any) => body.creator);
  const hasHumanModifications =
    humanModifiedBodies.length > 0 || !!annotation.creator;

  const missingCreator = !annotation.creator && hasHumanModifications;

  if (textualBodies.length > 0) {
    if (hasHumanModifications) {
      problems.push('Has TextualBody with human modifications');
    } else {
      problems.push('Has TextualBody (should be empty)');
    }

    if (hasEmptyTextualBody) {
      problems.push('Has empty TextualBody');
    }
  }

  if (bodies.length > 0 && !hasHumanModifications) {
    problems.push('Has body elements (should have empty body array)');
  }

  if (missingCreator) {
    problems.push('Missing creator for human-modified annotation');
  }

  return {
    problems,
    hasGenerator,
    hasEmptyTextualBody: hasEmptyTextualBody,
    hasTypoInMotivation,
    hasEmptyBodyArray,
    hasMissingBodyArray,
    hasNonArrayBody,
    hasHumanModifications,
    missingCreator,
    textualBodyCount: textualBodies.length,
  };
}

async function fixIconographyStructure(
  baseUrl: string,
  container: string,
  session: any,
) {
  const analysis = await analyzeIconographyAnnotations(baseUrl, container);

  const result = {
    success: true,
    message: `Processing ${analysis.problematicAnnotations.length} problematic iconography annotations`,
    summary: {
      totalAnalyzed: analysis.totalIconographyAnnotations,
      annotationsFixed: 0,
      annotationsWithErrors: 0,
      typosFixed: 0,
      textualBodiesRemoved: 0,
      bodyArraysFixed: 0,
      humanModificationsPreserved: 0,
    },
    details: [] as any[],
  };

  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
  };

  for (const problematicAnnotation of analysis.problematicAnnotations) {
    try {
      const fetchResponse = await fetch(problematicAnnotation.id, {
        headers: {
          ...AUTH_HEADER,
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });

      if (!fetchResponse.ok) {
        result.details.push({
          id: problematicAnnotation.id,
          error: `Failed to fetch annotation: ${fetchResponse.status}`,
        });
        result.summary.annotationsWithErrors++;
        continue;
      }

      const currentAnnotation = await fetchResponse.json();
      const fixedAnnotation =
        fixIconographyAnnotationStructure(currentAnnotation);

      const updateResponse = await updateAnnotation(
        problematicAnnotation.id,
        fixedAnnotation,
        AUTH_HEADER,
      );

      if (updateResponse.success) {
        result.summary.annotationsFixed++;

        const detail: any = {
          id: problematicAnnotation.id,
          fixes: [],
        };

        if (problematicAnnotation.hasTypoInMotivation) {
          detail.fixes.push(
            'Fixed motivation typo: "iconograpy" → "iconography"',
          );
          result.summary.typosFixed++;
        }

        if (problematicAnnotation.hasEmptyTextualBody) {
          detail.fixes.push('Removed empty TextualBody');
          result.summary.textualBodiesRemoved++;
        }

        if (problematicAnnotation.hasHumanModifications) {
          detail.fixes.push(
            'Preserved creator information while fixing W3C structure',
          );
          result.summary.humanModificationsPreserved++;
        }

        if (
          problematicAnnotation.hasMissingBodyArray ||
          problematicAnnotation.hasNonArrayBody
        ) {
          detail.fixes.push('Fixed body array structure');
          result.summary.bodyArraysFixed++;
        }

        result.details.push(detail);
      } else {
        result.details.push({
          id: problematicAnnotation.id,
          error: updateResponse.error,
        });
        result.summary.annotationsWithErrors++;
      }
    } catch (error: any) {
      result.details.push({
        id: problematicAnnotation.id,
        error: error.message,
      });
      result.summary.annotationsWithErrors++;
    }
  }

  return result;
}

function fixIconographyAnnotationStructure(annotation: any) {
  const fixed = { ...annotation };

  if (fixed.motivation === 'iconograpy') {
    fixed.motivation = 'iconography';
  }

  if (Array.isArray(fixed.body)) {
    const textualBodies = fixed.body.filter(
      (body: any) => body.type === 'TextualBody',
    );

    if (textualBodies.length > 0) {
      const humanModifiedBodies = textualBodies.filter(
        (body: any) => body.creator,
      );

      if (humanModifiedBodies.length > 0) {
        const mostRecentBody = humanModifiedBodies.reduce(
          (latest: any, current: any) => {
            const latestDate = new Date(latest.modified || latest.created || 0);
            const currentDate = new Date(
              current.modified || current.created || 0,
            );
            return currentDate > latestDate ? current : latest;
          },
        );

        if (!fixed.creator && mostRecentBody.creator) {
          fixed.creator = mostRecentBody.creator;
        }

        fixed.modified =
          mostRecentBody.modified ||
          mostRecentBody.created ||
          new Date().toISOString();
      }
    }

    fixed.body = [];
  } else if (fixed.body && fixed.body.type === 'TextualBody') {
    if (fixed.body.creator && !fixed.creator) {
      fixed.creator = fixed.body.creator;
      fixed.modified =
        fixed.body.modified || fixed.body.created || new Date().toISOString();
    }
    fixed.body = [];
  } else if (!fixed.body) {
    fixed.body = [];
  }

  const hadOriginalModification = !!annotation.modified;
  const hadOriginalCreator = !!annotation.creator;

  if (!fixed.created) {
    const originalCreated =
      annotation.created ||
      annotation.target?.created ||
      annotation.target?.generator?.created ||
      annotation.body?.find?.((b: any) => b.created)?.created;

    if (originalCreated) {
      fixed.created = originalCreated;
    } else {
      fixed.created = new Date().toISOString();
    }
  }

  if (hadOriginalModification) {
    const currentModified = new Date().toISOString();
    const createdTime = fixed.created;

    if (createdTime && new Date(currentModified) < new Date(createdTime)) {
      console.warn(
        `Preventing impossible timestamp for annotation ${annotation.id}: would set modified ${currentModified} before created ${createdTime}, using created time as modified time`,
      );
      fixed.modified = createdTime;
    } else {
      fixed.modified = currentModified;
    }
  } else {
  }

  return fixed;
}

async function updateAnnotation(
  annotationUrl: string,
  annotation: any,
  authHeader: any,
) {
  try {
    let etag: string | null = null;
    const headRes = await fetch(annotationUrl, {
      method: 'HEAD',
      headers: {
        ...authHeader,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    if (headRes.ok) {
      etag = headRes.headers.get('etag');
    }

    if (!etag) {
      const getRes = await fetch(annotationUrl, {
        method: 'GET',
        headers: {
          ...authHeader,
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });
      if (!getRes.ok) {
        return {
          success: false,
          error: `Failed to fetch annotation for ETag: ${getRes.status}`,
        };
      }
      etag = getRes.headers.get('etag');
    }

    if (!etag) {
      return { success: false, error: 'No ETag header on annotation resource' };
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
      const txt = await putRes.text().catch(() => '[no body]');
      return {
        success: false,
        error: `Update failed: ${putRes.status} ${putRes.statusText}\n${txt}`,
      };
    }

    return { success: true, data: await putRes.json() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Iconography annotation cleanup endpoint',
    features: [
      'Analyzes iconography annotations for structural issues',
      'Fixes motivation typos ("iconograpy" → "iconography")',
      'Removes unnecessary TextualBody elements from iconography',
      'Fixes empty body array structures',
      'Maintains W3C Web Annotation Protocol compliance',
    ],
    usage: {
      analyze: 'POST with { "action": "analyze-iconography", "dryRun": true }',
      fix: 'POST with { "action": "fix-iconography-structure", "dryRun": false }',
    },
  });
}
