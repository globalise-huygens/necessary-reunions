/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useEffect, useRef, useState } from 'react';
import { deduplicateMapReferences } from '../lib/gazetteer/map-references';
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
  geotagSource?: GazetteerPlace['geotagSource'];
  textRecognitionSources?: Array<{
    text: string;
    source: string;
    targetId: string;
    svgSelector?: string;
    canvasUrl?: string;
    motivation?: 'textspotting' | 'iconography';
    classification?: GazetteerPlace['textRecognitionSources'] extends Array<
      infer Source
    >
      ? Source extends { classification?: infer Classification }
        ? Classification
        : never
      : never;
  }>;
  comments?: GazetteerPlace['comments'];
  mapReferences?: GazetteerPlace['mapReferences'];
  mapInfo?: GazetteerPlace['mapInfo'];
  linkingAnnotationCount?: number;
  partOf?: GazetteerPlace['partOf'];
  parsedRemarks?: GazetteerPlace['parsedRemarks'];
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

const CACHE_DURATION = 5 * 60 * 1000;
const pendingGazetteerRequest = { current: null as Promise<any> | null };
const GAZETTEER_CACHE_KEY = 'gazetteer-places-all';

function normalisePlaceName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coordinateKey(place: GazetteerPlace): string | null {
  if (!place.coordinates || place.coordinateType !== 'geographic') return null;
  const longitude = Math.round(place.coordinates.x * 10000) / 10000;
  const latitude = Math.round(place.coordinates.y * 10000) / 10000;
  return `${latitude}|${longitude}`;
}

function getPlaceAliases(place: GazetteerPlace): string[] {
  return [
    place.name,
    place.modernName || '',
    place.geotagSource?.label || '',
    ...(place.alternativeNames || []),
  ].filter((value): value is string => value.trim().length > 0);
}

function getPlaceIdentityKeys(place: GazetteerPlace): string[] {
  const keys = new Set<string>();
  const coords = coordinateKey(place);

  if (place.geotagSource?.id) {
    keys.add(`source:${place.geotagSource.id}`);
  }

  if (
    place.id.includes('id.necessaryreunions.org/place/') ||
    place.id.includes('necessaryreunions.org/gavoc/')
  ) {
    keys.add(`source:${place.id}`);
  }

  getPlaceAliases(place).forEach((alias) => {
    const normalised = normalisePlaceName(alias);
    if (normalised.length < 3) return;

    if (coords) {
      keys.add(`geo-name:${coords}|${normalised}`);
    } else {
      keys.add(`name:${normalised}`);
    }
  });

  return Array.from(keys);
}

function appendUniqueStrings(
  target: string[] | undefined,
  values: Array<string | undefined>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  [...(target || []), ...values].forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;

    const key = normalisePlaceName(trimmed);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  });

  return result;
}

function mergeByKey<T>(
  first: T[] | undefined,
  second: T[] | undefined,
  getKey: (item: T) => string,
): T[] | undefined {
  const map = new Map<string, T>();
  [...(first || []), ...(second || [])].forEach((item) => {
    map.set(getKey(item), item);
  });
  return map.size > 0 ? Array.from(map.values()) : undefined;
}

function mergeParsedRemarks(
  first: GazetteerPlace['parsedRemarks'],
  second: GazetteerPlace['parsedRemarks'],
): GazetteerPlace['parsedRemarks'] {
  if (!first) return second;
  if (!second) return first;

  return {
    context: appendUniqueStrings(first.context, second.context),
    coord: appendUniqueStrings(first.coord, second.coord),
    disambiguation: appendUniqueStrings(
      first.disambiguation,
      second.disambiguation,
    ),
    association: appendUniqueStrings(first.association, second.association),
    inference: appendUniqueStrings(first.inference, second.inference),
    automatic: appendUniqueStrings(first.automatic, second.automatic),
    source: appendUniqueStrings(first.source, second.source),
    altLabel: appendUniqueStrings(first.altLabel, second.altLabel),
    other: appendUniqueStrings(first.other, second.other),
  };
}

function mergePlaceRecords(
  existing: GazetteerPlace,
  incoming: GazetteerPlace,
): GazetteerPlace {
  const alternativeNames = appendUniqueStrings(existing.alternativeNames, [
    incoming.name,
    incoming.modernName,
    incoming.geotagSource?.label,
    ...(incoming.alternativeNames || []),
  ]).filter(
    (name) => normalisePlaceName(name) !== normalisePlaceName(existing.name),
  );

  const incomingHasBetterCoordinates =
    (!existing.coordinates && !!incoming.coordinates) ||
    (existing.coordinateType !== 'geographic' &&
      incoming.coordinateType === 'geographic');

  return {
    ...existing,
    category: existing.category || incoming.category,
    coordinates: incomingHasBetterCoordinates
      ? incoming.coordinates
      : existing.coordinates,
    coordinateType: incomingHasBetterCoordinates
      ? incoming.coordinateType
      : existing.coordinateType,
    modernName: existing.modernName || incoming.modernName,
    alternativeNames:
      alternativeNames.length > 0 ? alternativeNames : undefined,
    geotagSource: existing.geotagSource || incoming.geotagSource,
    textParts: mergeByKey(
      existing.textParts,
      incoming.textParts,
      (item) => `${item.targetId}|${item.source}|${item.value}`,
    ),
    textRecognitionSources: mergeByKey(
      existing.textRecognitionSources,
      incoming.textRecognitionSources,
      (item) =>
        `${item.targetId}|${item.source}|${item.motivation || ''}|${item.text}`,
    ),
    comments: mergeByKey(
      existing.comments,
      incoming.comments,
      (item) => `${item.targetId}|${item.value}`,
    ),
    mapReferences: deduplicateMapReferences([
      ...(existing.mapReferences || []),
      ...(incoming.mapReferences || []),
    ]),
    mapInfo: existing.mapInfo || incoming.mapInfo,
    linkingAnnotationCount:
      (existing.linkingAnnotationCount || 1) +
      (incoming.linkingAnnotationCount || 1),
    hasPointSelection: existing.hasPointSelection || incoming.hasPointSelection,
    hasGeotagging: existing.hasGeotagging || incoming.hasGeotagging,
    isGeotagged: existing.isGeotagged || incoming.isGeotagged,
    hasHumanVerification:
      existing.hasHumanVerification || incoming.hasHumanVerification,
    partOf: mergeByKey(existing.partOf, incoming.partOf, (item) => item.id),
    parsedRemarks: mergeParsedRemarks(
      existing.parsedRemarks,
      incoming.parsedRemarks,
    ),
  };
}

function mergeGazetteerPlaces(places: GazetteerPlace[]): GazetteerPlace[] {
  const mergedPlaces: GazetteerPlace[] = [];
  const keyIndex = new Map<string, GazetteerPlace>();

  places.forEach((place) => {
    const keys = getPlaceIdentityKeys(place);
    const existing = keys
      .map((key) => keyIndex.get(key))
      .find((item): item is GazetteerPlace => !!item);

    if (!existing) {
      mergedPlaces.push(place);
      keys.forEach((key) => keyIndex.set(key, place));
      return;
    }

    const merged = mergePlaceRecords(existing, place);
    const index = mergedPlaces.indexOf(existing);
    if (index >= 0) {
      mergedPlaces[index] = merged;
    }

    [...keys, ...getPlaceIdentityKeys(merged)].forEach((key) => {
      keyIndex.set(key, merged);
    });
  });

  return mergedPlaces;
}

function toGazetteerPlace(place: ProcessedPlace): GazetteerPlace {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    coordinates: place.coordinates,
    coordinateType: place.coordinateType,
    modernName: place.modernName,
    alternativeNames: place.alternativeNames,
    linkingAnnotationId: place.linkingAnnotationId,
    geotagSource: place.geotagSource,
    textParts: place.textParts?.map((textPart) => ({
      value: textPart.value,
      source:
        textPart.source === 'creator' || textPart.source === 'loghi'
          ? textPart.source
          : 'loghi',
      targetId: textPart.targetId,
    })),
    textRecognitionSources: place.textRecognitionSources?.map((source) => ({
      text: source.text,
      source:
        source.source === 'human' ||
        source.source === 'ai-pipeline' ||
        source.source === 'loghi-htr'
          ? source.source
          : source.source === 'creator'
            ? 'human'
            : source.source === 'loghi'
              ? 'loghi-htr'
              : 'ai-pipeline',
      targetId: source.targetId,
      svgSelector: source.svgSelector,
      canvasUrl: source.canvasUrl,
      motivation: source.motivation,
      classification: source.classification,
    })),
    comments: place.comments,
    mapReferences: deduplicateMapReferences(place.mapReferences),
    mapInfo: place.mapInfo,
    isGeotagged: place.isGeotagged,
    hasPointSelection: place.hasPointSelection,
    hasGeotagging: place.hasGeotagging,
    hasHumanVerification: place.hasHumanVerification,
    linkingAnnotationCount: place.linkingAnnotationCount,
    partOf: place.partOf,
    parsedRemarks: place.parsedRemarks,
  };
}

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

        const convertedPlaces = mergeGazetteerPlaces(
          newPlaces.map(toGazetteerPlace),
        );

        currentBatchRef.current += 1;

        const cached = gazetteerCache.get(GAZETTEER_CACHE_KEY);
        if (cached) {
          const updatedData = mergeGazetteerPlaces([
            ...cached.data,
            ...convertedPlaces,
          ]);
          gazetteerCache.set(GAZETTEER_CACHE_KEY, {
            data: updatedData,
            timestamp: Date.now(),
            hasMore: data.hasMore || false,
            currentBatch: currentBatchRef.current,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ref can change during async
        if (!isMountedRef.current) {
          return;
        }

        setAllPlaces((prev) =>
          mergeGazetteerPlaces([...prev, ...convertedPlaces]),
        );

        setHasMore(data.hasMore || false);

        setLoadingProgress({
          processed: loadingProgress.processed + newPlaces.length,
          total: loadingProgress.total || newPlaces.length * 10,
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

          const convertedPlaces = mergeGazetteerPlaces(
            places.map(toGazetteerPlace),
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
