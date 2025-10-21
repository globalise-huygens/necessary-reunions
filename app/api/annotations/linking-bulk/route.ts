import { NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

interface LinkingAnnotation {
  target?: string | string[];
  body?: AnnotationBody | AnnotationBody[];
  motivation?: string;
  [key: string]: unknown;
}

interface AnnotationBody {
  purpose?: string;
  [key: string]: unknown;
}

async function filterLinkingAnnotationsByCanvas(
  linkingAnnotations: LinkingAnnotation[],
  targetCanvasId: string,
): Promise<LinkingAnnotation[]> {
  if (!targetCanvasId) return linkingAnnotations;

  const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
  if (!ANNO_REPO_TOKEN) {
    console.warn('No auth token for filtering linking annotations');
    return [];
  }

  const headers: HeadersInit = {
    Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
  };

  const relevantLinkingAnnotations: LinkingAnnotation[] = [];

  const MAX_PROCESSING_TIME = 8000;
  const startTime = Date.now();

  const annotationsToCheck = linkingAnnotations;

  for (const linkingAnnotation of annotationsToCheck) {
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      break;
    }

    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      continue;
    }

    const maxTargetsToCheck = 1;
    const targetsToCheck = linkingAnnotation.target.slice(0, maxTargetsToCheck);

    let isRelevant = false;

    for (const targetUrl of targetsToCheck) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 400);

        const targetResponse = await fetch(targetUrl, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (targetResponse.ok) {
          const targetData = (await targetResponse.json()) as {
            target?: { source?: string };
          };
          if (targetData.target?.source === targetCanvasId) {
            isRelevant = true;
            break;
          }
        }
      } catch {
        // Ignore fetch errors and continue
      }
    }

    if (isRelevant) {
      relevantLinkingAnnotations.push(linkingAnnotation);
    }
  }

  return relevantLinkingAnnotations;
}

export async function GET(request: Request): Promise<
  NextResponse<{
    annotations: LinkingAnnotation[];
    iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    >;
    mode?: string;
    batch?: number;
    hasMore?: boolean;
    totalAnnotations?: number;
    processedAnnotations?: number;
    foundRelevant?: number;
    nextBatch?: number | null;
    message?: string;
    error?: boolean;
    timestamp?: number;
  }>
> {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');
  const mode = searchParams.get('mode') || 'quick';
  const batch = parseInt(searchParams.get('batch') || '0');
  const isGlobal = searchParams.get('global') === 'true';

  if (!isGlobal && !targetCanvasId) {
    return NextResponse.json({
      annotations: [],
      iconStates: {},
      mode,
      batch,
      hasMore: false,
    });
  }

  try {
    const requestStartTime = Date.now();
    const MAX_EXECUTION_TIME = mode === 'quick' ? 5000 : 9000;
    const QUICK_MODE_LIMIT = 50;
    const FULL_MODE_BATCH_SIZE = 100;

    const checkTimeout = () => {
      if (Date.now() - requestStartTime > MAX_EXECUTION_TIME) {
        throw new Error('Netlify function timeout - returning partial results');
      }
    };

    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    };

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    } else {
      console.warn('No authorization token available for custom query');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(customQueryUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          items?: LinkingAnnotation[];
        };
        const allLinkingAnnotations: LinkingAnnotation[] = data.items || [];

        const relevantLinkingAnnotations = targetCanvasId
          ? await filterLinkingAnnotationsByCanvas(
              allLinkingAnnotations,
              targetCanvasId,
            )
          : allLinkingAnnotations;

        const iconStates: Record<
          string,
          { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
        > = {};

        relevantLinkingAnnotations.forEach((annotation) => {
          if (annotation.target && Array.isArray(annotation.target)) {
            annotation.target.forEach((targetUrl: string) => {
              if (!iconStates[targetUrl]) {
                iconStates[targetUrl] = {
                  hasGeotag: false,
                  hasPoint: false,
                  isLinked: false,
                };
              }

              const linkingBody: AnnotationBody[] = Array.isArray(
                annotation.body,
              )
                ? annotation.body
                : annotation.body
                  ? [annotation.body]
                  : [];

              if (linkingBody.some((b) => b.purpose === 'geotagging')) {
                iconStates[targetUrl].hasGeotag = true;
              }
              if (linkingBody.some((b) => b.purpose === 'selecting')) {
                iconStates[targetUrl].hasPoint = true;
              }

              iconStates[targetUrl].isLinked = true;
            });
          }
        });

        return NextResponse.json({
          annotations: relevantLinkingAnnotations,
          iconStates,
        });
      } else {
        console.warn(
          `Custom query failed with status: ${response.status} - ${response.statusText}`,
        );
        console.warn(`Query URL: ${customQueryUrl}`);
        const errorText = await response.text().catch(() => 'No error details');
        console.warn('Error details:', errorText);

        if (response.status >= 500 || response.status === 429) {
          console.warn(
            'Server error - returning empty results instead of fallback',
          );
          return NextResponse.json({
            annotations: [],
            iconStates: {},
            mode,
            batch,
            hasMore: false,
            message: 'AnnoRepo temporarily unavailable',
          });
        }
      }
    } catch (error) {
      console.warn(
        'Custom query failed with error, falling back to page-based approach:',
        error,
      );

      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('timeout'))
      ) {
        console.warn('Custom query timeout - returning empty results');
        return NextResponse.json({
          annotations: [],
          iconStates: {},
          mode,
          batch,
          hasMore: false,
          message: 'Request timeout - please try again',
        });
      }
    }

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    const allLinkingAnnotations: LinkingAnnotation[] = [];

    const findFirstPageWithLinking = async (): Promise<number> => {
      const candidatePages = [202, 205, 200, 210, 215, 220, 198, 190, 180, 150];

      for (const testPage of candidatePages) {
        checkTimeout();
        try {
          const testUrl = `${endpoint}?page=${testPage}`;
          const testResponse = await fetch(testUrl, { headers });

          if (testResponse.ok) {
            const testData = (await testResponse.json()) as {
              items?: LinkingAnnotation[];
            };
            const pageAnnotations: LinkingAnnotation[] = testData.items || [];
            const hasLinking = pageAnnotations.some(
              (ann) => ann.motivation === 'linking',
            );

            if (hasLinking) {
              let searchPage = testPage;
              while (searchPage > Math.max(1, testPage - 50)) {
                checkTimeout();
                try {
                  const backUrl = `${endpoint}?page=${searchPage - 1}`;
                  const backResponse = await fetch(backUrl, { headers });

                  if (backResponse.ok) {
                    const backData = (await backResponse.json()) as {
                      items?: LinkingAnnotation[];
                    };
                    const backAnnotations: LinkingAnnotation[] =
                      backData.items || [];
                    const backHasLinking = backAnnotations.some(
                      (ann) => ann.motivation === 'linking',
                    );

                    if (!backHasLinking) {
                      return searchPage;
                    }
                    searchPage--;
                  } else {
                    return searchPage;
                  }
                } catch {
                  return searchPage;
                }
              }
              return searchPage;
            }
          }
        } catch {
          // Continue to next candidate page
        }
      }

      return -1;
    };

    const startPage = await findFirstPageWithLinking();

    if (startPage === -1) {
      console.warn('No linking annotations found in search range');
      return NextResponse.json({
        annotations: [],
        iconStates: {},
        mode,
        batch,
        hasMore: false,
        message: 'No linking annotations found',
      });
    }

    let currentPage = startPage;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 3;
    const maxPagesToSearch = 30;
    let pagesSearched = 0;

    while (
      consecutiveEmptyPages < maxConsecutiveEmpty &&
      pagesSearched < maxPagesToSearch
    ) {
      checkTimeout();

      try {
        const pageUrl = `${endpoint}?page=${currentPage}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = (await response.json()) as {
            items?: LinkingAnnotation[];
          };
          const pageAnnotations: LinkingAnnotation[] = data.items || [];

          if (pageAnnotations.length === 0) {
            consecutiveEmptyPages++;
          } else {
            const linkingAnnotationsOnPage = pageAnnotations.filter(
              (annotation) => annotation.motivation === 'linking',
            );

            if (linkingAnnotationsOnPage.length > 0) {
              consecutiveEmptyPages = 0;
              allLinkingAnnotations.push(...linkingAnnotationsOnPage);
            } else {
              consecutiveEmptyPages++;
            }
          }
        } else if (response.status === 404) {
          break;
        } else {
          consecutiveEmptyPages++;
        }
      } catch {
        consecutiveEmptyPages++;
      }

      currentPage++;
      pagesSearched++;

      if (allLinkingAnnotations.length > 5000) {
        break;
      }
    }

    let annotationsToProcess = allLinkingAnnotations;
    let hasMore = false;

    if (mode === 'quick') {
      annotationsToProcess = allLinkingAnnotations.slice(0, QUICK_MODE_LIMIT);
      hasMore = allLinkingAnnotations.length > QUICK_MODE_LIMIT;
    } else if (mode === 'full') {
      const startIndex = batch * FULL_MODE_BATCH_SIZE;
      const endIndex = startIndex + FULL_MODE_BATCH_SIZE;
      annotationsToProcess = allLinkingAnnotations.slice(startIndex, endIndex);
      hasMore = endIndex < allLinkingAnnotations.length;
    }

    const relevantLinkingAnnotations =
      isGlobal || !targetCanvasId
        ? allLinkingAnnotations
        : await filterLinkingAnnotationsByCanvas(
            annotationsToProcess,
            targetCanvasId,
          );

    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    relevantLinkingAnnotations.forEach((annotation) => {
      if (annotation.target && Array.isArray(annotation.target)) {
        annotation.target.forEach((targetUrl: string) => {
          if (!iconStates[targetUrl]) {
            iconStates[targetUrl] = {
              hasGeotag: false,
              hasPoint: false,
              isLinked: false,
            };
          }

          const linkingBody: AnnotationBody[] = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
              ? [annotation.body]
              : [];

          if (linkingBody.some((b) => b.purpose === 'geotagging')) {
            iconStates[targetUrl].hasGeotag = true;
          }
          if (linkingBody.some((b) => b.purpose === 'selecting')) {
            iconStates[targetUrl].hasPoint = true;
          }

          iconStates[targetUrl].isLinked = true;
        });
      }
    });

    return NextResponse.json({
      annotations: relevantLinkingAnnotations,
      iconStates,
      mode,
      batch,
      hasMore,
      totalAnnotations: allLinkingAnnotations.length,
      processedAnnotations: annotationsToProcess.length,
      foundRelevant: relevantLinkingAnnotations.length,
      nextBatch: hasMore ? batch + 1 : null,
    });
  } catch (error) {
    console.error('Error fetching bulk linking annotations:', error);

    return NextResponse.json(
      {
        annotations: [],
        iconStates: {},
        mode,
        batch,
        hasMore: false,
        totalAnnotations: 0,
        processedAnnotations: 0,
        foundRelevant: 0,
        nextBatch: null,
        message:
          'Service temporarily unavailable - annotations may load with basic state',
        error: false,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  }
}
