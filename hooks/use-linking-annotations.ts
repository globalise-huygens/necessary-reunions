import { getProjectConfig } from '@/lib/projects';
import { safeJson } from '@/lib/shared/utils';
import type { LinkingAnnotation } from '@/lib/types';
import { directFetch, getAnnoRepoToken, getETag } from '@/lib/viewer/annoRepo';
import { useCallback, useEffect, useRef, useState } from 'react';

const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - matches global linking cache
const pendingRequests = new Map<
  string,
  { promise: Promise<any>; controller: AbortController }
>();
const failedRequests = new Map<
  string,
  { count: number; lastFailed: number; circuitOpen: boolean }
>();
const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_MS = 15000;
const CIRCUIT_BREAKER_TIMEOUT = 60000;
const REQUEST_TIMEOUT = 30000;

export const invalidateLinkingCache = (canvasId?: string) => {
  if (canvasId) {
    linkingCache.delete(canvasId);
  } else {
    linkingCache.clear();
  }
};

export function useLinkingAnnotations(canvasId: string, projectSlug = 'neru') {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIsLoading(false);
      }
      return;
    }

    const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
      canvasId,
    )}&project=${encodeURIComponent(projectSlug)}`;

    const requestKey = `fetch-${canvasId}`;
    const pendingRequest = pendingRequests.get(requestKey);
    if (pendingRequest) {
      try {
        await pendingRequest.promise;
        const freshCache = linkingCache.get(canvasId);
        if (freshCache && isMountedRef.current) {
          setLinkingAnnotations(freshCache.data);
          setIsLoading(false);
        }
        return;
      } catch {}
    }
    const failureInfo = failedRequests.get(canvasId);
    const now = Date.now();
    if (failureInfo) {
      if (failureInfo.circuitOpen) {
        const timeSinceFailure = now - failureInfo.lastFailed;
        if (timeSinceFailure < CIRCUIT_BREAKER_TIMEOUT) {
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIsLoading(false);
          }
          return;
        } else {
          failedRequests.delete(canvasId);
        }
      }

      if (failureInfo.count >= MAX_RETRY_COUNT) {
        const timeSinceLastFailure = now - failureInfo.lastFailed;
        if (timeSinceLastFailure < RETRY_BACKOFF_MS) {
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIsLoading(false);
          }
          return;
        } else {
          failedRequests.delete(canvasId);
        }
      }
    }

    const cached = linkingCache.get(canvasId);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setLinkingAnnotations(cached.data);
        setIsLoading(false);
      }
      return;
    }

    const pendingRequestKey = `fetch-${canvasId}`;
    const existingRequest = pendingRequests.get(pendingRequestKey);
    if (existingRequest) {
      try {
        existingRequest.controller.abort();
      } catch {}
      pendingRequests.delete(pendingRequestKey);
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, REQUEST_TIMEOUT);

    const fetchPromise = (async () => {
      try {
        let annotations: LinkingAnnotation[] = [];
        let fetchedViaDirectRoute = false;

        // Try direct browser → AnnoRepo first
        try {
          const config = getProjectConfig(projectSlug);
          const encodedMotivation =
            typeof btoa !== 'undefined' ? btoa('linking') : '';
          const encodedTarget =
            typeof btoa !== 'undefined' ? btoa(canvasId) : '';

          if (encodedMotivation && encodedTarget) {
            const directUrl = `${config.annoRepoBaseUrl}/services/${config.annoRepoContainer}/custom-query/${config.linkingQueryName}:target=${encodedTarget},motivationorpurpose=${encodedMotivation}`;

            const directRes = await directFetch(
              directUrl,
              {
                headers: { Accept: 'application/json' },
              },
              REQUEST_TIMEOUT,
            );

            if (directRes.ok) {
              const data = (await directRes.json()) as {
                items?: LinkingAnnotation[];
              };
              annotations = data.items || [];
              fetchedViaDirectRoute = true;
            }
          }
        } catch {
          // Fall through to API route
        }

        // Fallback to API route
        if (!fetchedViaDirectRoute) {
          const response = await fetch(url, {
            signal: abortController.signal,
            cache: 'no-cache',
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await safeJson<{
              annotations?: LinkingAnnotation[];
            }>(response);
            annotations = data.annotations || [];
          } else {
            const current = failedRequests.get(canvasId) || {
              count: 0,
              lastFailed: 0,
              circuitOpen: false,
            };

            if (response.status === 502 || response.status === 504) {
              const newCount = current.count + 1;
              failedRequests.set(canvasId, {
                count: newCount,
                lastFailed: Date.now(),
                circuitOpen: newCount >= 3,
              });
            } else {
              const newCount = current.count + 1;
              failedRequests.set(canvasId, {
                count: newCount,
                lastFailed: Date.now(),
                circuitOpen: newCount >= MAX_RETRY_COUNT,
              });
            }

            if (isMountedRef.current) {
              setLinkingAnnotations([]);
            }
            return;
          }
        }

        linkingCache.set(canvasId, { data: annotations, timestamp: now });
        failedRequests.delete(canvasId);

        if (isMountedRef.current) {
          setLinkingAnnotations(annotations);
        }
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return;
        }

        const current = failedRequests.get(canvasId) || {
          count: 0,
          lastFailed: 0,
          circuitOpen: false,
        };

        const isTimeoutError =
          error instanceof Error && error.message.includes('timeout');
        const newCount = current.count + (isTimeoutError ? 2 : 1);
        failedRequests.set(canvasId, {
          count: newCount,
          lastFailed: Date.now(),
          circuitOpen: isTimeoutError || newCount >= MAX_RETRY_COUNT,
        });

        if (isMountedRef.current) {
          setLinkingAnnotations([]);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        pendingRequests.delete(requestKey);
      }
    })();

    pendingRequests.set(requestKey, {
      promise: fetchPromise,
      controller: abortController,
    });
    await fetchPromise;
  }, [canvasId, projectSlug]);

  useEffect(() => {
    fetchLinkingAnnotations().catch(() => {});
  }, [fetchLinkingAnnotations]);

  const createLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        const optimisticAnnotation = {
          ...linkingAnnotation,
          id: linkingAnnotation.id || `temp-${Date.now()}`,
          _isOptimistic: true,
        };

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) => [...prev, optimisticAnnotation]);
        }

        const optimisticCached = linkingCache.get(canvasId);
        if (optimisticCached) {
          linkingCache.set(canvasId, {
            data: [...optimisticCached.data, optimisticAnnotation],
            timestamp: Date.now(),
          });
        }

        let created: LinkingAnnotation | null = null;

        // Try direct browser → AnnoRepo first
        const tokenInfo = await getAnnoRepoToken(projectSlug);
        if (tokenInfo) {
          try {
            const config = getProjectConfig(projectSlug);
            const url = `${config.annoRepoBaseUrl}/w3c/${config.annoRepoContainer}/`;
            const body = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              ...linkingAnnotation,
              motivation: 'linking',
              creator: linkingAnnotation.creator || {
                id: tokenInfo.user.id,
                type: 'Person',
                label: tokenInfo.user.label || 'Unknown User',
              },
              created: linkingAnnotation.created || new Date().toISOString(),
            };

            const res = await directFetch(url, {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                Authorization: `Bearer ${tokenInfo.token}`,
              },
              body: JSON.stringify(body),
            });

            if (res.ok) {
              created = (await res.json()) as LinkingAnnotation;
            }
          } catch {
            // Fall through to API route
          }
        }

        // Fallback to API route
        if (!created) {
          const response = await fetch('/api/annotations/linking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...linkingAnnotation,
              project: projectSlug,
            }),
          });

          if (!response.ok) {
            if (isMountedRef.current) {
              setLinkingAnnotations((prev) =>
                prev.filter((la) => la.id !== optimisticAnnotation.id),
              );
            }

            const rollbackCached = linkingCache.get(canvasId);
            if (rollbackCached) {
              linkingCache.set(canvasId, {
                data: rollbackCached.data.filter(
                  (la) => la.id !== optimisticAnnotation.id,
                ),
                timestamp: Date.now(),
              });
            }

            let errorMessage = `Failed to create linking annotation: ${response.status}`;
            try {
              const errorData = (await response.json()) as { error?: string };
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = `Failed to create linking annotation: ${response.status} ${response.statusText}`;
            }

            if (response.status === 409) {
              throw new Error('One or more annotations are already linked');
            }
            throw new Error(errorMessage);
          }

          created = await safeJson<LinkingAnnotation>(response);
        }

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === optimisticAnnotation.id
                ? { ...created, _isOptimistic: false }
                : la,
            ),
          );
        }

        const successCached = linkingCache.get(canvasId);
        if (successCached) {
          const updatedData = successCached.data.map((la) =>
            la.id === optimisticAnnotation.id ? created : la,
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        }

        return created;
      } catch (error) {
        throw error;
      }
    },
    [canvasId, projectSlug],
  );

  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        const originalAnnotations = linkingAnnotations;
        const optimisticUpdate = { ...linkingAnnotation, _isOptimistic: true };

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === linkingAnnotation.id ? optimisticUpdate : la,
            ),
          );
        }

        const updateCached = linkingCache.get(canvasId);
        if (updateCached) {
          linkingCache.set(canvasId, {
            data: updateCached.data.map((la) =>
              la.id === linkingAnnotation.id ? optimisticUpdate : la,
            ),
            timestamp: Date.now(),
          });
        }

        let updated: LinkingAnnotation | null = null;

        // Try direct browser → AnnoRepo first
        const tokenInfo = await getAnnoRepoToken(projectSlug);
        if (tokenInfo) {
          try {
            const annotationUrl = linkingAnnotation.id;
            const etag = await getETag(annotationUrl, tokenInfo.token);

            const body = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              ...linkingAnnotation,
              modified: new Date().toISOString(),
            };

            const res = await directFetch(annotationUrl, {
              method: 'PUT',
              headers: {
                'Content-Type':
                  'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                Authorization: `Bearer ${tokenInfo.token}`,
                'If-Match': etag,
              },
              body: JSON.stringify(body),
            });

            if (res.ok) {
              updated = (await res.json()) as LinkingAnnotation;
            }
          } catch {
            // Fall through to API route
          }
        }

        // Fallback to API route
        if (!updated) {
          const annotationId = linkingAnnotation.id;
          const encodedId = encodeURIComponent(
            encodeURIComponent(annotationId),
          );

          const response = await fetch(
            `/api/annotations/linking/${encodedId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...linkingAnnotation,
                project: projectSlug,
              }),
            },
          );

          if (!response.ok) {
            if (isMountedRef.current) {
              setLinkingAnnotations(originalAnnotations);
            }

            const rollbackUpdateCached = linkingCache.get(canvasId);
            if (rollbackUpdateCached) {
              linkingCache.set(canvasId, {
                data: rollbackUpdateCached.data.map((la) =>
                  la.id === linkingAnnotation.id
                    ? originalAnnotations.find(
                        (orig) => orig.id === linkingAnnotation.id,
                      ) || la
                    : la,
                ),
                timestamp: Date.now(),
              });
            }

            let errorMessage = `Failed to update linking annotation: ${response.status}`;
            try {
              const errorData = (await response.json()) as { error?: string };
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = `Failed to update linking annotation: ${response.status} ${response.statusText}`;
            }

            if (response.status === 409) {
              throw new Error('One or more annotations are already linked');
            }
            throw new Error(errorMessage);
          }

          updated = await safeJson<LinkingAnnotation>(response);
        }

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === updated.id ? { ...updated, _isOptimistic: false } : la,
            ),
          );
        }

        const updateSuccessCached = linkingCache.get(canvasId);
        if (updateSuccessCached) {
          const updatedData = updateSuccessCached.data.map(
            (la: LinkingAnnotation) => (la.id === updated.id ? updated : la),
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        } else {
          linkingCache.set(canvasId, {
            data: linkingAnnotations.map((la: LinkingAnnotation) =>
              la.id === updated.id ? updated : la,
            ),
            timestamp: Date.now(),
          });
        }

        return updated;
      } catch (error) {
        throw error;
      }
    },
    [linkingAnnotations, canvasId, projectSlug],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      try {
        const originalAnnotations = linkingAnnotations;

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.filter((la) => la.id !== linkingAnnotationId),
          );
        }

        linkingCache.delete(canvasId);

        let directSuccess = false;

        // Try direct browser → AnnoRepo first
        const tokenInfo = await getAnnoRepoToken(projectSlug);
        if (tokenInfo) {
          try {
            const etag = await getETag(linkingAnnotationId, tokenInfo.token);
            const res = await directFetch(linkingAnnotationId, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${tokenInfo.token}`,
                'If-Match': etag,
              },
            });
            directSuccess = res.ok;
          } catch {
            // Fall through to API route
          }
        }

        // Fallback to API route
        if (!directSuccess) {
          const encodedId = encodeURIComponent(
            encodeURIComponent(linkingAnnotationId),
          );
          const response = await fetch(
            `/api/annotations/linking/${encodedId}?project=${encodeURIComponent(projectSlug)}`,
            {
              method: 'DELETE',
            },
          );

          if (!response.ok) {
            if (isMountedRef.current) {
              setLinkingAnnotations(originalAnnotations);
            }

            let errorMessage = `Failed to delete linking annotation: ${response.status}`;
            try {
              const errorData = (await response.json()) as { error?: string };
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = `Failed to delete linking annotation: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
          }
        }

        const deleteCached = linkingCache.get(canvasId);
        if (deleteCached) {
          const updatedData = deleteCached.data.filter(
            (la: LinkingAnnotation) => la.id !== linkingAnnotationId,
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [linkingAnnotations, canvasId, projectSlug],
  );

  const getLinkingAnnotationForTarget = useCallback(
    (annotationId: string): LinkingAnnotation | null => {
      const result =
        linkingAnnotations.find((la) => {
          const targets = Array.isArray(la.target) ? la.target : [la.target];
          return targets.includes(annotationId);
        }) || null;

      return result;
    },
    [linkingAnnotations],
  );

  const invalidateCache = useCallback(() => {
    linkingCache.delete(canvasId);
    fetchLinkingAnnotations().catch(() => {});
  }, [canvasId, fetchLinkingAnnotations]);

  const forceRefresh = useCallback(async () => {
    linkingCache.delete(canvasId);
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 500);
    });
    await fetchLinkingAnnotations();
  }, [canvasId, fetchLinkingAnnotations]);

  return {
    linkingAnnotations,
    isLoading,
    createLinkingAnnotation,
    updateLinkingAnnotation,
    deleteLinkingAnnotation,
    getLinkingAnnotationForTarget,
    refetch: fetchLinkingAnnotations,
    invalidateCache,
    forceRefresh,
  };
}
