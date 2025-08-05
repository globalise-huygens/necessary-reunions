// Test script for textspotting cleanup without authentication
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { action, dryRun = true } = await request.json();

    if (action !== 'analyze-textspotting') {
      return NextResponse.json(
        { error: 'Only analyze-textspotting supported in test mode' },
        { status: 400 },
      );
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

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
  } catch (error: any) {
    console.error('Error in textspotting cleanup test:', error);
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

  console.log('Testing textspotting search using W3C collection endpoint...');

  try {
    // Use the W3C collection endpoint to get all annotations (test first few pages)
    let page = 0;
    let hasMore = true;
    const maxPages = 5; // Test just first 5 pages

    while (hasMore && page < maxPages) {
      try {
        // Use the working W3C collection endpoint format
        const endpoint = `${baseUrl}/w3c/${container}?page=${page}`;
        console.log(`[Page ${page}] Testing: ${endpoint}`);

        const response = await fetch(endpoint, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          signal: AbortSignal.timeout(15000),
        });

        console.log(`Page ${page} response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`Page ${page} response keys:`, Object.keys(data));

          const items = data.items || data.first?.items || [];

          if (!Array.isArray(items)) {
            console.log(`Page ${page}: items is not an array:`, typeof items);
            hasMore = false;
            break;
          }

          if (items.length === 0) {
            console.log(`Page ${page} has no items, stopping search`);
            hasMore = false;
            break;
          }

          console.log(`Page ${page}: Found ${items.length} total annotations`);

          // Log first few motivations for debugging
          const motivations = items
            .slice(0, 5)
            .map((item: any) => item.motivation);
          console.log(`First 5 motivations on page ${page}:`, motivations);

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
          } else {
            console.log(`  - No textspotting annotations on page ${page}`);
          }

          page++;

          // Check pagination info
          if (data.next) {
            console.log(`Next page available: ${data.next}`);
          }
          if (data.last) {
            console.log(`Last page: ${data.last}`);
          }

          hasMore = !!data.next || items.length > 0;
        } else {
          const text = await response.text();
          console.log(`Page ${page} returned HTTP ${response.status}: ${text}`);
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
    testResults: {
      testedPages: 5,
      searchMethod: 'w3c-collection-endpoint',
      detailedLogs: 'Check server console for detailed logs',
    },
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

  return analysis;
}

function analyzeTextspottingAnnotation(annotation: any) {
  const problems: string[] = [];
  let hasAnnotationLevelCreator = false;
  let hasHumanEditedBodies = false;
  let hasAIBodies = false;
  let suspectedOverwrittenAI = false;

  // Check for annotation-level creator (should not exist for textspotting)
  if (annotation.creator) {
    hasAnnotationLevelCreator = true;
    problems.push(
      'Has annotation-level creator (should be body-level for textspotting)',
    );
  }

  const bodies = Array.isArray(annotation.body) ? annotation.body : [];

  // Analyze bodies
  for (const body of bodies) {
    if (body.creator) {
      if (typeof body.creator === 'string') {
        hasHumanEditedBodies = true;
      } else if (body.creator?.name || body.creator?.label) {
        if (
          body.creator.name?.toLowerCase().includes('loghi') ||
          body.creator.label?.toLowerCase().includes('loghi') ||
          body.creator.name?.toLowerCase().includes('maptextpipeline') ||
          body.creator.label?.toLowerCase().includes('maptextpipeline')
        ) {
          hasAIBodies = true;
        } else {
          hasHumanEditedBodies = true;
        }
      }
    }
  }

  if (!hasHumanEditedBodies && hasAIBodies) {
    problems.push('Has AI-generated bodies but no human-edited body structure');
  }

  if (hasAnnotationLevelCreator && hasAIBodies && !hasHumanEditedBodies) {
    suspectedOverwrittenAI = true;
    problems.push('Suspected AI text overwritten by annotation-level creator');
  }

  return {
    problems,
    hasAnnotationLevelCreator,
    hasHumanEditedBodies,
    hasAIBodies,
    suspectedOverwrittenAI,
  };
}
