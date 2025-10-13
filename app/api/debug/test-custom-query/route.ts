import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
    if (!ANNO_REPO_TOKEN) {
      return NextResponse.json(
        { error: 'AnnoRepo token not configured' },
        { status: 500 },
      );
    }

    // Test the custom query that should return all linking annotations
    const customQueryUrl =
      'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==';

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
    };

    try {
      const response = await fetch(customQueryUrl, { headers });

      if (response.ok) {
        const data = await response.json();
        const allLinkingAnnotations = data.items || [];

        // Test specific annotation from user's example
        const userExampleId =
          'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/b8bbb7bd-d257-4a19-bd2e-f15e8fe1a453';
        const foundUserExample = allLinkingAnnotations.find(
          (ann: any) => ann.id === userExampleId,
        );

        // Analyze first few linking annotations to understand structure
        const structureAnalysis = allLinkingAnnotations
          .slice(0, 5)
          .map((ann: any) => ({
            id: ann.id,
            created: ann.created,
            targetCount: Array.isArray(ann.target)
              ? ann.target.length
              : ann.target
              ? 1
              : 0,
            bodyCount: Array.isArray(ann.body)
              ? ann.body.length
              : ann.body
              ? 1
              : 0,
            hasBody: !!ann.body,
            firstTarget: Array.isArray(ann.target) ? ann.target[0] : ann.target,
          }));

        // Try to fetch one of the targets to see what canvas it references
        let targetExample = null;
        if (allLinkingAnnotations.length > 0) {
          const firstAnnotation = allLinkingAnnotations[0];
          if (
            firstAnnotation.target &&
            Array.isArray(firstAnnotation.target) &&
            firstAnnotation.target.length > 0
          ) {
            try {
              const targetUrl = firstAnnotation.target[0];
              const targetResponse = await fetch(targetUrl, { headers });
              if (targetResponse.ok) {
                const targetData = await targetResponse.json();
                targetExample = {
                  targetUrl,
                  canvasSource: targetData.target?.source,
                  motivation: targetData.motivation,
                };
              }
            } catch (error) {
              console.warn('Could not fetch target example:', error);
            }
          }
        }

        return NextResponse.json({
          customQueryResults: {
            totalLinkingAnnotations: allLinkingAnnotations.length,
            foundUserExample: !!foundUserExample,
            userExampleDetails: foundUserExample
              ? {
                  id: foundUserExample.id,
                  targetCount: foundUserExample.target?.length || 0,
                  bodyCount: foundUserExample.body?.length || 0,
                }
              : null,
            structureAnalysis,
            targetExample,
          },
          testCanvasId:
            'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/cananore/891.json/canvas/p2',
          conclusion:
            allLinkingAnnotations.length === 0
              ? 'Custom query returns no linking annotations - this is the root issue'
              : `Custom query returns ${allLinkingAnnotations.length} linking annotations - issue is in filtering logic`,
        });
      } else {
        return NextResponse.json({
          error: `Custom query failed: ${response.status} ${response.statusText}`,
          url: customQueryUrl,
        });
      }
    } catch (error) {
      return NextResponse.json({
        error: 'Custom query request failed',
        details: String(error),
        url: customQueryUrl,
      });
    }
  } catch (error) {
    console.error('Error in custom query test:', error);
    return NextResponse.json(
      {
        error: 'Failed to test custom query',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
