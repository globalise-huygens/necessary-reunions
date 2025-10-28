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

    setIsLoadingMore(true);

    try {
      const url = `/api/gazetteer/linking-bulk?page=${currentBatchRef.current}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const newPlaces = (data.places || []) as ProcessedPlace[];

        if (!isMountedRef.current) return;

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

        setAllPlaces((prev) => {
          // Deduplicate by ID
          const placeMap = new Map<string, GazetteerPlace>();
          [...prev, ...convertedPlaces].forEach((place) => {
            placeMap.set(place.id, place);
          });
          return Array.from(placeMap.values());
        });

        setHasMore(data.hasMore || false);
        currentBatchRef.current += 1;

        setLoadingProgress({
          processed: loadingProgress.processed + newPlaces.length,
          total: loadingProgress.total || newPlaces.length * 10, // Estimate
          mode: 'full',
        });

        // Update cache
        const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
        if (cached) {
          const updatedData = [...cached.data, ...convertedPlaces];
          const placeMap = new Map<string, GazetteerPlace>();
          updatedData.forEach((place) => placeMap.set(place.id, place));
          gazetteerCache.set(GAZETTEER_CACHE_KEY, {
            data: Array.from(placeMap.values()),
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[Gazetteer] Load more failed:', error);
      }
    } finally {
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

  // Auto-load remaining pages progressively
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
      // Check cache first
      const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
      const currentTime = Date.now();

      if (cached && currentTime - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setAllPlaces(cached.data);
          setTotalPlaces(cached.data.length);
          setIsGlobalLoading(false);
          setHasMore(false); // Cache is complete
          setLoadingProgress({
            processed: cached.data.length,
            total: cached.data.length,
            mode: 'full',
          });
        }
        return;
      }

      // If pending request exists, wait for it
      if (pendingGazetteerRequest.current) {
        try {
          await pendingGazetteerRequest.current;
          return;
        } catch {
          // Ignore errors from pending request
        }
      }

      if (isMountedRef.current) {
        setIsGlobalLoading(true);
        setLoadingProgress({ processed: 0, total: 0, mode: 'quick' });
      }

      const fetchPromise = (async () => {
        try {
          // Fetch first page
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch('/api/gazetteer/linking-bulk?page=0', {
            signal: controller.signal,
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const places = (data.places || []) as ProcessedPlace[];

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

          if (isMountedRef.current) {
            setAllPlaces(convertedPlaces);
            setTotalPlaces(convertedPlaces.length);
            setHasMore(data.hasMore || false);
            currentBatchRef.current = 1;
            setLoadingProgress({
              processed: convertedPlaces.length,
              total: convertedPlaces.length * 10, // Estimate
              mode: 'quick',
            });

            // Update cache
            gazetteerCache.set(GAZETTEER_CACHE_KEY, {
              data: convertedPlaces,
              timestamp: Date.now(),
            });

            setIsGlobalLoading(false);
          }
        } catch (error) {
          console.error('[Gazetteer] Initial fetch failed:', error);
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

    fetchGazetteerData().catch(() => {
      // Ignore errors
    });
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
