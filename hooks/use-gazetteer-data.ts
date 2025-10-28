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
  console.log('[useGazetteerData] Hook mounted');

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
      console.log('[useGazetteerData] loadMorePlaces skipped:', {
        hasMore,
        isLoadingMore,
      });
      return;
    }

    console.log(
      '[useGazetteerData] loadMorePlaces starting, page:',
      currentBatchRef.current,
    );

    // Only set loading state if mounted
    if (!isMountedRef.current) {
      console.log(
        '[useGazetteerData] Component unmounted, skipping state update',
      );
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = `/api/gazetteer/linking-bulk?page=${currentBatchRef.current}`;
      console.log('[useGazetteerData] Fetching:', url);

      // No timeout - let Netlify's function timeout handle it (50s max)
      // This ensures pagination completes even on slow connections
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      console.log('[useGazetteerData] loadMorePlaces response:', {
        ok: response.ok,
        status: response.status,
      });

      if (response.ok) {
        const data = await response.json();
        const newPlaces = (data.places || []) as ProcessedPlace[];

        console.log('[useGazetteerData] loadMorePlaces data:', {
          placesCount: newPlaces.length,
          hasMore: data.hasMore,
          currentBatch: currentBatchRef.current,
        });

        // Convert ProcessedPlace to GazetteerPlace
        const convertedPlaces: GazetteerPlace[] = newPlaces.map((p) => ({
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

        // Increment batch counter BEFORE cache update
        currentBatchRef.current += 1;

        // Always update cache first, even if unmounted
        // This allows remounted components to pick up the data
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
          console.log(
            '[useGazetteerData] Updated cache with',
            convertedPlaces.length,
            'new places, total:',
            placeMap.size,
          );
        }

        // Only update state if component is still mounted
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ref can change during async
        if (!isMountedRef.current) {
          console.log(
            '[useGazetteerData] Component unmounted, skipping state update but cache saved',
          );
          return;
        }

        setAllPlaces((prev) => {
          // Deduplicate by ID
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

  // Auto-pagination effect
  useEffect(() => {
    console.log('[useGazetteerData] Auto-pagination check:', {
      hasMore,
      isGlobalLoading,
      isLoadingMore,
      placesCount: allPlaces.length,
    });

    if (
      !hasMore ||
      isGlobalLoading ||
      isLoadingMore ||
      allPlaces.length === 0
    ) {
      console.log('[useGazetteerData] Auto-pagination skipped');
      return;
    }

    console.log('[useGazetteerData] Scheduling auto-pagination...');
    // Auto-load next page with small delay
    const timer = setTimeout(() => {
      console.log('[useGazetteerData] Triggering auto-pagination');
      loadMorePlaces().catch(() => {
        // Silently ignore
      });
    }, 50); // Fast progressive loading

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
      console.log('[useGazetteerData] Starting fetch');

      // Check cache first
      const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
      const currentTime = Date.now();

      if (cached && currentTime - cached.timestamp < CACHE_DURATION) {
        console.log(
          '[useGazetteerData] Using cached data:',
          cached.data.length,
          'places',
        );
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

      console.log('[useGazetteerData] No cache, fetching from API');

      // If pending request exists, wait for it and check cache
      if (pendingGazetteerRequest.current) {
        console.log('[useGazetteerData] Found pending request, waiting...');
        try {
          await pendingGazetteerRequest.current;
          console.log(
            '[useGazetteerData] Pending request completed, checking cache...',
          );
          // Check if cache was populated by the pending request
          const freshCache = gazetteerCache.get(GAZETTEER_CACHE_KEY);
          console.log('[useGazetteerData] Cache check:', {
            hasCache: !!freshCache,
            isMounted: isMountedRef.current,
            cacheSize: freshCache?.data.length || 0,
          });
          if (freshCache && isMountedRef.current) {
            console.log(
              '[useGazetteerData] Using data from completed pending request:',
              freshCache.data.length,
              'places',
            );
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
            console.log(
              '[useGazetteerData] Cannot use cache - mounted:',
              isMountedRef.current,
            );
          }
        } catch {
          console.log('[useGazetteerData] Pending request failed');
          // Ignore errors from pending request
        }
        return;
      }

      console.log('[useGazetteerData] No pending request, starting new fetch');

      if (isMountedRef.current) {
        setIsGlobalLoading(true);
        setLoadingProgress({ processed: 0, total: 0, mode: 'quick' });
      }

      const fetchPromise = (async () => {
        try {
          // Don't use AbortController timeout for initial fetch
          // Let it complete naturally - Netlify has 50s function timeout
          // This ensures data is cached even if component unmounts
          console.log('[useGazetteerData] Fetching page 0...');
          const response = await fetch('/api/gazetteer/linking-bulk?page=0', {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });

          console.log('[useGazetteerData] Response received:', response.status);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          console.log('[useGazetteerData] Data parsed:', {
            placesCount: data.places?.length || 0,
            hasMore: data.hasMore,
            count: data.count,
          });
          const places = (data.places || []) as ProcessedPlace[];

          console.log(
            '[useGazetteerData] Converting',
            places.length,
            'places...',
          );

          // Convert to GazetteerPlace
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

          console.log(
            '[useGazetteerData] Converted',
            convertedPlaces.length,
            'places',
          );

          // Always save to cache, even if unmounted
          // This allows remounted components to use the data
          try {
            gazetteerCache.set(GAZETTEER_CACHE_KEY, {
              data: convertedPlaces,
              timestamp: Date.now(),
              hasMore: data.hasMore || false,
              currentBatch: 1,
            });
            console.log(
              '[useGazetteerData] Saved',
              convertedPlaces.length,
              'places to cache',
            );
          } catch (err) {
            console.error('[useGazetteerData] Cache save failed:', err);
          }

          // Check if still mounted before updating state
          if (!isMountedRef.current) {
            console.log(
              '[useGazetteerData] Component unmounted, skipping state update',
            );
            return;
          }

          console.log(
            '[useGazetteerData] Setting state with',
            convertedPlaces.length,
            'places',
          );
          setAllPlaces(convertedPlaces);
          setTotalPlaces(convertedPlaces.length);
          setHasMore(data.hasMore || false);
          currentBatchRef.current = 1;
          setLoadingProgress({
            processed: convertedPlaces.length,
            total: convertedPlaces.length * 10, // Estimate
            mode: 'quick',
          });

          console.log(
            '[useGazetteerData] Initial load complete, setting loading to false',
          );
          setIsGlobalLoading(false);
        } catch (error) {
          console.error('[useGazetteerData] Initial fetch error:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(
              '[useGazetteerData] Fetch aborted (expected in dev mode)',
            );
          } else {
            console.error('[Gazetteer] Initial fetch failed:', error);
          }
          if (isMountedRef.current) {
            setIsGlobalLoading(false);
            setAllPlaces([]);
          }
        }
      })();

      console.log('[useGazetteerData] Setting pending request');
      pendingGazetteerRequest.current = fetchPromise;
      await fetchPromise;
      console.log(
        '[useGazetteerData] Fetch completed, clearing pending request',
      );
      pendingGazetteerRequest.current = null;
    };

    fetchGazetteerData().catch(() => {
      // Ignore errors - already handled
    });

    // No cleanup needed - isMountedRef prevents state updates after unmount
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
