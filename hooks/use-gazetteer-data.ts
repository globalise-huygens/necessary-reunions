/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GazetteerPlace } from '../lib/gazetteer/types';

interface ProcessedPlace {
  id: string;
  name: string;
  category: string;
  coordinates?: { x: number; y: number };
  coordinateType?: 'geographic' | 'pixel';
  modernName?: string;
  alternativeNames?: string[];
  linkingAnnotationId: string;
  textParts?: Array<{ value: string; source: string; targetId: string }>;
  isGeotagged?: boolean;
  hasPointSelection?: boolean;
  hasGeotagging?: boolean;
  hasHumanVerification?: boolean;
}

const gazetteerCache = new Map<
  string,
  {
    data: GazetteerPlace[];
    timestamp: number;
    hasMore: boolean;
    currentBatch: number;
  }
>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const pendingGazetteerRequest = { current: null as Promise<any> | null };
const GAZETTEER_CACHE_KEY = 'gazetteer-places-all';

/**
 * Progressive gazetteer data loader
 * Follows the same pattern as use-global-linking-annotations.ts
 * Fetches data in pages and auto-loads progressively in background
 */
export function useGazetteerData() {
  const [allPlaces, setAllPlaces] = useState<GazetteerPlace[]>([]);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalPlaces, setTotalPlaces] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState<{
    processed: number;
    total: number;
    mode: 'quick' | 'full';
  }>({ processed: 0, total: 0, mode: 'quick' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMountedRef = useRef(true);
  const currentBatchRef = useRef<number>(0);

  const loadMorePlaces = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = `/api/gazetteer/linking-bulk?page=${currentBatchRef.current}`;

      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newPlaces = (data.places || []) as ProcessedPlace[];

        const convertedPlaces: GazetteerPlace[] = newPlaces.map(
          (p: ProcessedPlace) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            coordinates: p.coordinates,
            coordinateType: p.coordinateType,
            modernName: p.modernName,
            alternativeNames: p.alternativeNames,
            linkingAnnotationId: p.linkingAnnotationId,
            textParts: p.textParts?.map(
              (tp: { value: string; source: string; targetId: string }) => ({
                value: tp.value,
                source:
                  tp.source === 'creator' || tp.source === 'loghi'
                    ? tp.source
                    : 'loghi',
                targetId: tp.targetId,
              }),
            ),
            isGeotagged: p.isGeotagged,
            hasPointSelection: p.hasPointSelection,
            hasGeotagging: p.hasGeotagging,
            hasHumanVerification: p.hasHumanVerification,
          }),
        );

        currentBatchRef.current += 1;

        const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
        if (cached) {
          const updatedData = [...cached.data, ...convertedPlaces];
          const placeMap = new Map<string, GazetteerPlace>();
          updatedData.forEach((place) => placeMap.set(place.id, place));
          gazetteerCache.set(GAZETTEER_CACHE_KEY, {
            data: Array.from(placeMap.values()),
            timestamp: Date.now(),
            hasMore: data.hasMore || false,
            currentBatch: currentBatchRef.current,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ref can change during async
        if (!isMountedRef.current) {
          return;
        }

        setAllPlaces((prev) => {
          const placeMap = new Map<string, GazetteerPlace>();
          [...prev, ...convertedPlaces].forEach((place) => {
            placeMap.set(place.id, place);
          });
          return Array.from(placeMap.values());
        });

        setHasMore(data.hasMore || false);

        setLoadingProgress({
          processed: loadingProgress.processed + newPlaces.length,
          total: loadingProgress.total || newPlaces.length * 10, // Estimate
          mode: 'full',
        });
      }
    } catch (error) {
      console.error('[useGazetteerData] Load more error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[Gazetteer] Load more failed:', error);
      }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ref can change during async
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [
    hasMore,
    isLoadingMore,
    loadingProgress.processed,
    loadingProgress.total,
  ]);

  useEffect(() => {
    if (
      !hasMore ||
      isGlobalLoading ||
      isLoadingMore ||
      allPlaces.length === 0
    ) {
      return;
    }

    // Auto-load next page with small delay
    const timer = setTimeout(() => {
      loadMorePlaces().catch(() => {});
    }, 50);

    return () => clearTimeout(timer);
  }, [
    hasMore,
    isGlobalLoading,
    isLoadingMore,
    allPlaces.length,
    loadMorePlaces,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchGazetteerData = async () => {
      // Check cache first
      const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
      const currentTime = Date.now();

      if (cached && currentTime - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setAllPlaces(cached.data);
          setTotalPlaces(cached.data.length);
          setIsGlobalLoading(false);
          setHasMore(cached.hasMore);
          currentBatchRef.current = cached.currentBatch;
          setLoadingProgress({
            processed: cached.data.length,
            total: cached.data.length,
            mode: 'full',
          });
        }
        return;
      }

      if (pendingGazetteerRequest.current) {
        try {
          await pendingGazetteerRequest.current;
          const freshCache = gazetteerCache.get(GAZETTEER_CACHE_KEY);
          if (freshCache && isMountedRef.current) {
            setAllPlaces(freshCache.data);
            setTotalPlaces(freshCache.data.length);
            setIsGlobalLoading(false);
            setHasMore(freshCache.hasMore);
            currentBatchRef.current = freshCache.currentBatch;
            setLoadingProgress({
              processed: freshCache.data.length,
              total: freshCache.data.length,
              mode: 'full',
            });
          } else {
          }
        } catch {}
        return;
      }

      if (isMountedRef.current) {
        setIsGlobalLoading(true);
        setLoadingProgress({ processed: 0, total: 0, mode: 'quick' });
      }

      const fetchPromise = (async () => {
        try {
          // Don't use AbortController timeout for initial fetch
          // Let it complete naturally - Netlify has 50s function timeout
          // This ensures data is cached even if component unmounts
          const response = await fetch('/api/gazetteer/linking-bulk?page=0', {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const places = (data.places || []) as ProcessedPlace[];

          const convertedPlaces: GazetteerPlace[] = places.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            coordinates: p.coordinates,
            coordinateType: p.coordinateType,
            modernName: p.modernName,
            alternativeNames: p.alternativeNames,
            linkingAnnotationId: p.linkingAnnotationId,
            textParts: p.textParts?.map((tp) => ({
              value: tp.value,
              source:
                tp.source === 'creator' || tp.source === 'loghi'
                  ? tp.source
                  : 'loghi',
              targetId: tp.targetId,
            })),
            isGeotagged: p.isGeotagged,
            hasPointSelection: p.hasPointSelection,
            hasGeotagging: p.hasGeotagging,
            hasHumanVerification: p.hasHumanVerification,
          }));

          // Always save to cache, even if unmounted
          // This allows remounted components to use the data
          try {
            gazetteerCache.set(GAZETTEER_CACHE_KEY, {
              data: convertedPlaces,
              timestamp: Date.now(),
              hasMore: data.hasMore || false,
              currentBatch: 1,
            });
          } catch (err) {
            console.error('[useGazetteerData] Cache save failed:', err);
          }

          if (!isMountedRef.current) {
            return;
          }

          setAllPlaces(convertedPlaces);
          setTotalPlaces(convertedPlaces.length);
          setHasMore(data.hasMore || false);
          currentBatchRef.current = 1;
          setLoadingProgress({
            processed: convertedPlaces.length,
            total: convertedPlaces.length * 10,
            mode: 'quick',
          });

          setIsGlobalLoading(false);
        } catch (error) {
          console.error('[useGazetteerData] Initial fetch error:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          if (error instanceof Error && error.name === 'AbortError') {
          } else {
            console.error('[Gazetteer] Initial fetch failed:', error);
          }
          if (isMountedRef.current) {
            setIsGlobalLoading(false);
            setAllPlaces([]);
          }
        }
      })();

      pendingGazetteerRequest.current = fetchPromise;
      await fetchPromise;
      pendingGazetteerRequest.current = null;
    };

    fetchGazetteerData().catch(() => {});
  }, [refreshTrigger]);

  const invalidateGazetteerCache = useCallback(() => {
    gazetteerCache.delete(GAZETTEER_CACHE_KEY);
  }, []);

  const refetch = useCallback(() => {
    invalidateGazetteerCache();
    currentBatchRef.current = 0;
    setRefreshTrigger((prev) => prev + 1);
  }, [invalidateGazetteerCache]);

  return {
    allPlaces,
    isGlobalLoading,
    isLoadingMore,
    hasMore,
    totalPlaces,
    loadingProgress,
    loadMorePlaces,
    invalidateGazetteerCache,
    refetch,
  };
}

export const invalidateGazetteerCache = () => {
  gazetteerCache.delete(GAZETTEER_CACHE_KEY);
};
