import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  try {
    const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
    if (!ANNO_REPO_TOKEN) {
      return NextResponse.json(
        { error: 'AnnoRepo token not configured' },
        { status: 500 },
      );
    }

    // Force page-based search to test if it can find the linking annotations
    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
    };

    let allLinkingAnnotations: any[] = [];
    const pageResults: any[] = [];

    // Search specifically around page 231 where user found linking annotations
    const pagesToTest = [230, 231, 232, 233];

    for (const pageNum of pagesToTest) {
      try {
        const pageUrl = `${endpoint}?page=${pageNum}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          pageResults.push({
            page: pageNum,
            totalItems: pageAnnotations.length,
            linkingAnnotations: linkingAnnotationsOnPage.length,
            linkingIds: linkingAnnotationsOnPage.map((ann: any) => ann.id),
          });

          allLinkingAnnotations.push(...linkingAnnotationsOnPage);
        } else {
          pageResults.push({
            page: pageNum,
            error: `${response.status} ${response.statusText}`,
          });
        }
      } catch (error) {
        pageResults.push({
          page: pageNum,
          error: String(error),
        });
      }
    }

    // Now test filtering - look for the specific annotation the user mentioned
    const userExampleId =
      'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/b8bbb7bd-d257-4a19-bd2e-f15e8fe1a453';
    const foundUserExample = allLinkingAnnotations.find(
      (ann: any) => ann.id === userExampleId,
    );

    // Try to resolve one target to see canvas mapping
    let targetResolutionTest = null;
    if (
      foundUserExample &&
      foundUserExample.target &&
      foundUserExample.target.length > 0
    ) {
      try {
        const targetUrl = foundUserExample.target[0];
        const targetResponse = await fetch(targetUrl, { headers });
        if (targetResponse.ok) {
          const targetData = await targetResponse.json();
          targetResolutionTest = {
            targetUrl,
            canvasSource: targetData.target?.source,
            motivation: targetData.motivation,
            matchesTestCanvas: targetData.target?.source === targetCanvasId,
          };
        }
      } catch (error) {
        targetResolutionTest = { error: String(error) };
      }
    }

    return NextResponse.json({
      pageBasedSearch: {
        totalLinkingAnnotations: allLinkingAnnotations.length,
        pageResults,
        foundUserExample: !!foundUserExample,
        targetCanvasId,
        targetResolutionTest,
      },
      conclusion:
        allLinkingAnnotations.length === 0
          ? 'Page-based search also finds no linking annotations - authentication or page range issue'
          : 'Page-based search works - issue is in custom query endpoint',
    });
  } catch (error) {
    console.error('Error in page-based test:', error);
    return NextResponse.json(
      {
        error: 'Failed to test page-based search',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
