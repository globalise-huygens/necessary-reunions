import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error:
          'Unauthorized – please sign in to analyze textspotting annotations',
      },
      { status: 401 },
    );
  }

  try {
    const { action, dryRun = true } = await request.json();

    if (
      action !== 'analyze-textspotting' &&
      action !== 'fix-textspotting-structure'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid action. Use "analyze-textspotting" or "fix-textspotting-structure"',
        },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    if (action === 'analyze-textspotting') {
      const analysis = await analyzeTextspottingAnnotations(
        ANNOREPO_BASE_URL,
        CONTAINER,
      );

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${analysis.totalTextspottingAnnotations} textspotting annotations. ${analysis.problematicAnnotations.length} need fixes.`,
        analysis: {
          textspottingAnalysis: analysis,
        },
      });
    }

    if (action === 'fix-textspotting-structure') {
      if (dryRun) {
        const analysis = await analyzeTextspottingAnnotations(
          ANNOREPO_BASE_URL,
          CONTAINER,
        );
        return NextResponse.json({
          success: true,
          dryRun: true,
          message: `DRY RUN: Would fix ${analysis.problematicAnnotations.length} textspotting annotations`,
          analysis: {
            textspottingAnalysis: analysis,
          },
        });
      }

      const result = await fixTextspottingStructure(
        ANNOREPO_BASE_URL,
        CONTAINER,
        session,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in textspotting cleanup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process textspotting annotations' },
      { status: 500 },
    );
  }
}

async function analyzeTextspottingAnnotations(
  baseUrl: string,
  container: string,
) {
  const allTextspottingAnnotations: any[] = [];

  console.log(
    'Searching for textspotting annotations using W3C collection endpoint...',
  );

  try {
    // Use the W3C collection endpoint to get all annotations
    let page = 0;
    let hasMore = true;

    while (hasMore && page < 250) {
      // Safety limit - increased to cover all pages up to 234
      try {
        // Use the working W3C collection endpoint format
        const endpoint = `${baseUrl}/w3c/${container}?page=${page}`;
        console.log(`[Page ${page}] Fetching: ${endpoint}`);

        const response = await fetch(endpoint, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Page ${page} response structure:`, Object.keys(data));

          // Check different possible response formats
          const items = data.items || data.first?.items || [];

          if (!Array.isArray(items) || items.length === 0) {
            console.log(`Page ${page} has no items, stopping search`);
            hasMore = false;
            break;
          }

          console.log(`Page ${page}: Found ${items.length} total annotations`);

          // Filter for textspotting annotations
          const textspottingItems = items.filter(
            (item: any) =>
              item.motivation === 'textspotting' ||
              (Array.isArray(item.motivation) &&
                item.motivation.includes('textspotting')),
          );

          if (textspottingItems.length > 0) {
            console.log(
              `  ✓ Found ${textspottingItems.length} textspotting annotations on page ${page}`,
            );
            allTextspottingAnnotations.push(...textspottingItems);
          }

          page++;

          // Check if there are more pages using AnnoRepo pagination
          hasMore = !!data.next || items.length > 0;

          // If we have a 'last' property, we can check if we've reached it
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
          console.log(
            `Page ${page} returned HTTP ${response.status}, stopping search`,
          );
          const text = await response.text();
          console.log(`Error response: ${text}`);
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

  console.log(
    `Found ${allTextspottingAnnotations.length} textspotting annotations total`,
  );

  const analysis = {
    totalTextspottingAnnotations: allTextspottingAnnotations.length,
    annotationsWithIncorrectCreators: 0,
    annotationsWithOverwrittenAI: 0,
    annotationsNeedingBodyRestructure: 0,
    correctlyStructuredAnnotations: 0,
    problematicAnnotations: [] as any[],
  };

  for (const annotation of allTextspottingAnnotations) {
    const issues = analyzeTextspottingAnnotation(annotation);

    if (issues.problems.length > 0) {
      analysis.problematicAnnotations.push({
        id: annotation.id,
        issues: issues.problems,
        bodies: annotation.body || [],
        hasAnnotationLevelCreator: issues.hasAnnotationLevelCreator,
        hasHumanEditedBodies: issues.hasHumanEditedBodies,
        hasAIBodies: issues.hasAIBodies,
        suspectedOverwrittenAI: issues.suspectedOverwrittenAI,
      });

      if (issues.hasAnnotationLevelCreator) {
        analysis.annotationsWithIncorrectCreators++;
      }
      if (issues.suspectedOverwrittenAI) {
        analysis.annotationsWithOverwrittenAI++;
      }
      if (!issues.hasHumanEditedBodies && issues.hasAIBodies) {
        analysis.annotationsNeedingBodyRestructure++;
      }
    } else {
      analysis.correctlyStructuredAnnotations++;
    }
  }

  console.log(
    `Analysis complete: ${analysis.problematicAnnotations.length} problematic annotations found`,
  );
  return analysis;
}

function analyzeTextspottingAnnotation(annotation: any) {
  const problems: string[] = [];
  const hasAnnotationLevelCreator = !!annotation.creator;
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body].filter(Boolean);
  const textualBodies = bodies.filter((b: any) => b.type === 'TextualBody');

  let hasHumanEditedBodies = false;
  let hasAIBodies = false;
  let suspectedOverwrittenAI = false;

  // Check for human-edited bodies (no generator field)
  hasHumanEditedBodies = textualBodies.some(
    (body: any) => !body.generator && body.creator,
  );

  // Check for AI-generated bodies
  hasAIBodies = textualBodies.some(
    (body: any) =>
      body.generator?.id?.includes('MapTextPipeline') ||
      body.generator?.label?.toLowerCase().includes('loghi'),
  );

  // Check for empty human bodies that should contain text from AI bodies
  const emptyHumanBodies = textualBodies.filter(
    (body: any) => !body.generator && (!body.value || body.value.trim() === ''),
  );

  // Problem 1: Annotation-level creator (should be body-level for textspotting)
  if (hasAnnotationLevelCreator) {
    problems.push(
      'Has annotation-level creator (should be moved to body level)',
    );

    // Check if we need to copy AI text to human body
    if (emptyHumanBodies.length > 0 && hasAIBodies) {
      problems.push('Empty human body should contain text from AI body');
      suspectedOverwrittenAI = true;
    }
  }

  // Problem 2: Empty human bodies when AI bodies exist
  if (emptyHumanBodies.length > 0 && hasAIBodies) {
    problems.push('Human-edited body is empty but AI body has text');
  }

  // Problem 3: Missing proper body structure for human edits
  if (hasAnnotationLevelCreator && !hasHumanEditedBodies) {
    problems.push(
      'Missing separate human-edited TextualBody (human edits should create new body)',
    );
  }

  // Problem 4: TextualBody without proper metadata
  for (const body of textualBodies) {
    if (!body.generator && (!body.creator || !body.created)) {
      problems.push(
        'TextualBody missing creator/created metadata for human edit',
      );
    }
  }

  // Problem 5: Multiple bodies but unclear structure
  if (textualBodies.length > 2) {
    problems.push('Multiple TextualBodies - structure needs verification');
  }

  return {
    problems,
    hasAnnotationLevelCreator,
    hasHumanEditedBodies,
    hasAIBodies,
    suspectedOverwrittenAI,
  };
}

async function fixTextspottingStructure(
  baseUrl: string,
  container: string,
  session: any,
) {
  const analysis = await analyzeTextspottingAnnotations(baseUrl, container);

  const result = {
    success: true,
    message: `Processing ${analysis.problematicAnnotations.length} problematic textspotting annotations`,
    summary: {
      totalAnalyzed: analysis.totalTextspottingAnnotations,
      annotationsFixed: 0,
      annotationsWithErrors: 0,
      structuralFixes: 0,
      creatorMovedToBody: 0,
      humanBodiesCreated: 0,
    },
    details: [] as any[],
  };

  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
  };

  const user = session.user as any;

  for (const problematicAnnotation of analysis.problematicAnnotations) {
    try {
      // Fetch the current annotation
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
      const fixedAnnotation = fixAnnotationStructure(currentAnnotation, user);

      // Update the annotation
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

        if (problematicAnnotation.hasAnnotationLevelCreator) {
          detail.fixes.push(
            'Moved creator from annotation level to body level',
          );
          result.summary.creatorMovedToBody++;
        }

        if (problematicAnnotation.suspectedOverwrittenAI) {
          detail.fixes.push('Created separate human-edited TextualBody');
          result.summary.humanBodiesCreated++;
        }

        result.summary.structuralFixes++;
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

function fixAnnotationStructure(annotation: any, user: any) {
  const fixed = { ...annotation };
  const bodies = Array.isArray(annotation.body)
    ? [...annotation.body]
    : [annotation.body].filter(Boolean);
  const textualBodies = bodies.filter((b: any) => b.type === 'TextualBody');

  // Step 1: If annotation has creator, we need to handle it properly
  if (annotation.creator) {
    // Find if there's already a human-edited body (no generator)
    const humanEditedBody = textualBodies.find((body: any) => !body.generator);

    if (humanEditedBody) {
      // Add creator metadata to existing human body if missing
      if (!humanEditedBody.creator) {
        humanEditedBody.creator = annotation.creator;
        humanEditedBody.created =
          annotation.created || new Date().toISOString();
        humanEditedBody.modified =
          annotation.modified || new Date().toISOString();
      }

      // If human body is empty but we have AI bodies with text, copy the AI text
      if (!humanEditedBody.value || humanEditedBody.value.trim() === '') {
        const aiBodiesWithText = textualBodies.filter(
          (body: any) =>
            body.generator && body.value && body.value.trim() !== '',
        );

        if (aiBodiesWithText.length > 0) {
          // Prefer Loghi over MapTextPipeline
          const preferredAI =
            aiBodiesWithText.find((body: any) =>
              body.generator?.label?.toLowerCase().includes('loghi'),
            ) || aiBodiesWithText[0];

          humanEditedBody.value = preferredAI.value;
        }
      }
    } else {
      // Create a new human-edited body
      // Find AI body with text to copy from
      const aiBodiesWithText = textualBodies.filter(
        (body: any) => body.generator && body.value && body.value.trim() !== '',
      );

      let textToCopy = '';
      if (aiBodiesWithText.length > 0) {
        // Prefer Loghi over MapTextPipeline
        const preferredAI =
          aiBodiesWithText.find((body: any) =>
            body.generator?.label?.toLowerCase().includes('loghi'),
          ) || aiBodiesWithText[0];

        textToCopy = preferredAI.value;
      }

      // Create human-edited version
      const humanBody = {
        type: 'TextualBody',
        value: textToCopy,
        format: 'text/plain',
        purpose: 'supplementing',
        creator: annotation.creator,
        created: annotation.created || new Date().toISOString(),
        modified: annotation.modified || new Date().toISOString(),
      };

      bodies.push(humanBody);
    }

    // Remove creator from annotation level
    delete fixed.creator;
  }

  // Step 2: Ensure all human-edited bodies have proper metadata
  for (const body of bodies) {
    if (body.type === 'TextualBody' && !body.generator) {
      if (!body.creator) {
        body.creator = {
          id:
            user?.id || user?.email || 'https://orcid.org/0000-0000-0000-0000',
          type: 'Person',
          label: user?.label || user?.name || 'Unknown User',
        };
      }
      if (!body.created) {
        body.created = annotation.created || new Date().toISOString();
      }
      if (!body.modified) {
        body.modified = annotation.modified || new Date().toISOString();
      }
    }
  }

  fixed.body = bodies;
  fixed.modified = new Date().toISOString();

  return fixed;
}

async function updateAnnotation(
  annotationUrl: string,
  annotation: any,
  authHeader: any,
) {
  try {
    // Get ETag
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

    // Update annotation
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
    message: 'Textspotting annotation cleanup endpoint',
    features: [
      'Analyzes textspotting annotations for structural issues',
      'Fixes annotations with incorrect annotation-level creators',
      'Creates proper human-edited TextualBodies for overwritten AI text',
      'Adds missing creator/created metadata to body elements',
      'Maintains W3C Web Annotation Protocol compliance',
    ],
    usage: {
      analyze: 'POST with { "action": "analyze-textspotting", "dryRun": true }',
      fix: 'POST with { "action": "fix-textspotting-structure", "dryRun": false }',
    },
  });
}
