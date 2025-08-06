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
    let page = 0;
    let hasMore = true;

    while (hasMore && page < 250) {
      try {
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

          const items = data.items || data.first?.items || [];

          if (!Array.isArray(items) || items.length === 0) {
            console.log(`Page ${page} has no items, stopping search`);
            hasMore = false;
            break;
          }

          console.log(`Page ${page}: Found ${items.length} total annotations`);

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

  hasHumanEditedBodies = textualBodies.some(
    (body: any) => !body.generator && body.creator,
  );

  hasAIBodies = textualBodies.some(
    (body: any) =>
      body.generator?.id?.includes('MapTextPipeline') ||
      body.generator?.label?.toLowerCase().includes('loghi'),
  );

  const emptyHumanBodies = textualBodies.filter(
    (body: any) => !body.generator && (!body.value || body.value.trim() === ''),
  );

  if (hasAnnotationLevelCreator) {
    problems.push(
      'Has annotation-level creator (should be moved to body level)',
    );

    if (emptyHumanBodies.length > 0 && hasAIBodies) {
      problems.push(
        'Empty human body should contain text from AI body (incomplete edit)',
      );
    }
  }

  if (emptyHumanBodies.length > 0 && hasAIBodies) {
    problems.push(
      'Human-edited body is empty but AI body has text (incomplete edit)',
    );
  }

  if (hasAnnotationLevelCreator && !hasHumanEditedBodies) {
    problems.push(
      'Missing separate human-edited TextualBody (human edits should create new body)',
    );
  }

  for (const body of textualBodies) {
    if (!body.generator && (!body.creator || !body.created)) {
      problems.push(
        'TextualBody missing creator/created metadata for human edit',
      );
    }
  }

  const humanBodyCount = textualBodies.filter(
    (body: any) => !body.generator,
  ).length;
  const aiBodyCount = textualBodies.filter(
    (body: any) => body.generator,
  ).length;

  if (humanBodyCount > 1) {
    problems.push(
      'Multiple human-edited TextualBodies - structure needs verification',
    );
  }

  for (const body of textualBodies) {
    if (body.created && body.modified) {
      if (new Date(body.modified) < new Date(body.created)) {
        problems.push(
          `Impossible timestamps: modified (${body.modified}) before created (${body.created})`,
        );
      }
    }
  }

  if (annotation.created && annotation.modified) {
    if (new Date(annotation.modified) < new Date(annotation.created)) {
      problems.push(
        `Impossible annotation timestamps: modified (${annotation.modified}) before created (${annotation.created})`,
      );
    }
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

  if (annotation.creator) {
    const humanEditedBody = textualBodies.find((body: any) => !body.generator);

    if (humanEditedBody) {
      if (!humanEditedBody.creator) {
        humanEditedBody.creator = annotation.creator;

        const originalCreated =
          humanEditedBody.created ||
          annotation.created ||
          annotation.target?.created ||
          annotation.target?.generator?.created ||
          annotation.body?.find?.((b: any) => b.created)?.created;

        const createdTime = originalCreated || new Date().toISOString();
        const modifiedTime =
          humanEditedBody.modified ||
          annotation.modified ||
          new Date().toISOString();

        if (originalCreated) {
          console.log(
            `Preserved original creation timestamp: ${originalCreated} for existing human body in annotation ${annotation.id}`,
          );
        } else {
          console.warn(
            `No original creation timestamp found for existing human body in annotation ${annotation.id}, using current time`,
          );
        }

        if (new Date(modifiedTime) < new Date(createdTime)) {
          console.warn(
            `Fixing impossible timestamps for annotation ${annotation.id}: modified ${modifiedTime} before created ${createdTime}`,
          );
          humanEditedBody.created = createdTime;
          humanEditedBody.modified = createdTime;
        } else {
          humanEditedBody.created = createdTime;
          humanEditedBody.modified = modifiedTime;
        }
      }

      if (!humanEditedBody.value || humanEditedBody.value.trim() === '') {
        const aiBodiesWithText = textualBodies.filter(
          (body: any) =>
            body.generator && body.value && body.value.trim() !== '',
        );

        if (aiBodiesWithText.length > 0) {
          const preferredAI =
            aiBodiesWithText.find((body: any) =>
              body.generator?.label?.toLowerCase().includes('loghi'),
            ) || aiBodiesWithText[0];

          humanEditedBody.value = preferredAI.value;
        }
      }
    } else {
      const aiBodiesWithText = textualBodies.filter(
        (body: any) => body.generator && body.value && body.value.trim() !== '',
      );

      let textToCopy = '';
      if (aiBodiesWithText.length > 0) {
        const preferredAI =
          aiBodiesWithText.find((body: any) =>
            body.generator?.label?.toLowerCase().includes('loghi'),
          ) || aiBodiesWithText[0];

        textToCopy = preferredAI.value;
      }

      const originalCreated =
        annotation.created ||
        annotation.target?.created ||
        annotation.target?.generator?.created ||
        annotation.body?.find?.((b: any) => b.created)?.created;

      const createdTime = originalCreated || new Date().toISOString();
      const modifiedTime = annotation.modified || new Date().toISOString();

      if (originalCreated) {
        console.log(
          `Preserved original creation timestamp: ${originalCreated} for textspotting annotation ${annotation.id}`,
        );
      } else {
        console.warn(
          `No original creation timestamp found for textspotting annotation ${annotation.id}, using current time`,
        );
      }

      let finalCreatedTime = createdTime;
      let finalModifiedTime = modifiedTime;

      if (new Date(modifiedTime) < new Date(createdTime)) {
        console.warn(
          `Fixing impossible timestamps for annotation ${annotation.id}: modified ${modifiedTime} before created ${createdTime}`,
        );
        finalModifiedTime = createdTime;
      }

      const humanBody = {
        type: 'TextualBody',
        value: textToCopy,
        format: 'text/plain',
        purpose: 'supplementing',
        creator: annotation.creator,
        created: finalCreatedTime,
        modified: finalModifiedTime,
      };

      bodies.push(humanBody);
    }

    delete fixed.creator;
  }

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
        const originalCreated =
          annotation.created ||
          annotation.target?.created ||
          annotation.target?.generator?.created ||
          annotation.body?.find?.((b: any) => b.created)?.created;

        body.created = originalCreated || new Date().toISOString();

        if (originalCreated) {
          console.log(
            `Preserved original creation timestamp: ${originalCreated} for textspotting body in annotation ${annotation.id}`,
          );
        } else {
          console.warn(
            `No original creation timestamp found for textspotting body in annotation ${annotation.id}, using current time`,
          );
        }
      }

      if (body.modified) {
        const bodyCreated = body.created;
        if (bodyCreated && new Date(body.modified) < new Date(bodyCreated)) {
          console.warn(
            `Fixing existing impossible timestamps for body in annotation ${annotation.id}: modified ${body.modified} before created ${bodyCreated}`,
          );
          body.modified = bodyCreated;
        }
      } else if (!body.modified) {
        const proposedModified =
          annotation.modified || new Date().toISOString();
        const bodyCreated = body.created;

        if (bodyCreated && new Date(proposedModified) < new Date(bodyCreated)) {
          console.warn(
            `Fixing impossible timestamps for body in annotation ${annotation.id}: modified ${proposedModified} before created ${bodyCreated}`,
          );
          body.modified = bodyCreated;
        } else {
          body.modified = proposedModified;
        }
      }
    }
  }

  fixed.body = bodies;

  if (!fixed.created) {
    const originalCreated =
      annotation.created ||
      annotation.target?.created ||
      annotation.target?.generator?.created ||
      bodies.find((b: any) => b.created)?.created;

    if (originalCreated) {
      fixed.created = originalCreated;
      console.log(
        `Preserved original annotation creation timestamp: ${originalCreated} for ${annotation.id}`,
      );
    } else {
      fixed.created = new Date().toISOString();
      console.warn(
        `No original creation timestamp found for annotation ${annotation.id}, using current time`,
      );
    }
  }

  if (
    fixed.created &&
    fixed.modified &&
    new Date(fixed.modified) < new Date(fixed.created)
  ) {
    console.warn(
      `Fixing impossible annotation timestamps for ${annotation.id}: modified ${fixed.modified} before created ${fixed.created}`,
    );
    fixed.modified = fixed.created;
  }

  fixed.modified = new Date().toISOString();

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
