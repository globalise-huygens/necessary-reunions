import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../lib/types';

type UnknownRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000;

const annotationPageCache = new Map<
  string,
  { items: unknown[]; fetchedAt: number }
>();

const normalizeCanvasId = (uri?: string) =>
  uri ? uri.split('#')[0]?.split('?')[0] : undefined;

const getAnnotationPageId = (page: unknown): string | null => {
  if (!page) return null;
  if (typeof page === 'string') return page;
  if (typeof page === 'object') {
    const record = page as UnknownRecord;
    if (typeof record.id === 'string') return record.id;
    if (typeof record['@id'] === 'string') return record['@id'];
  }
  return null;
};

const getTargetSource = (target: unknown): string | null => {
  if (!target) return null;
  if (typeof target === 'string') return target;

  if (Array.isArray(target)) {
    for (const t of target) {
      const source = getTargetSource(t);
      if (source) return source;
    }
    return null;
  }

  if (typeof target === 'object') {
    const record = target as UnknownRecord;
    const source = record.source;
    if (typeof source === 'string') return source;
    if (source && typeof source === 'object') {
      const sourceRecord = source as UnknownRecord;
      if (typeof sourceRecord.id === 'string') {
        return sourceRecord.id;
      }
    }
  }

  return null;
};

const normalizeAnnotation = (annotation: unknown): Annotation | null => {
  if (!annotation || typeof annotation !== 'object') return null;

  const record = annotation as UnknownRecord;
  const id =
    typeof record.id === 'string'
      ? record.id
      : typeof record['@id'] === 'string'
        ? record['@id']
        : null;

  if (!id) return null;

  if (record.id === id) {
    return record as unknown as Annotation;
  }

  return {
    ...record,
    id,
  } as Annotation;
};

const fetchAnnotationPageItems = async (
  pageUrl: string,
): Promise<unknown[]> => {
  const cached = annotationPageCache.get(pageUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(pageUrl, { signal: controller.signal });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return [];
    const record = data as UnknownRecord;
    const items = record.items;
    if (!Array.isArray(items)) return [];
    const resolvedItems = items as unknown[];
    annotationPageCache.set(pageUrl, {
      items: resolvedItems,
      fetchedAt: Date.now(),
    });
    return resolvedItems;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

const getPageItems = async (page: unknown): Promise<unknown[]> => {
  if (page && typeof page === 'object') {
    const pageRecord = page as UnknownRecord;
    if (Array.isArray(pageRecord.items)) {
      return pageRecord.items;
    }
  }

  const pageId = getAnnotationPageId(page);
  if (!pageId) return [];
  return fetchAnnotationPageItems(pageId);
};

export function useManifestAnnotations(
  manifest: { items?: unknown[] } | null,
  canvasId: string,
) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;

    const loadAnnotations = async () => {
      if (!manifest || !canvasId) {
        setAnnotations([]);
        setIsLoading(false);
        return;
      }

      const manifestItems = Array.isArray(manifest.items) ? manifest.items : [];
      const canvas = manifestItems.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as UnknownRecord).id === canvasId,
      ) as UnknownRecord | undefined;

      if (!canvas || !Array.isArray(canvas.annotations)) {
        setAnnotations([]);
        setIsLoading(false);
        return;
      }

      const currentRequest = ++requestIdRef.current;
      setIsLoading(true);

      const collected: Annotation[] = [];
      const seen = new Set<string>();

      const pages = Array.isArray(canvas.annotations) ? canvas.annotations : [];

      const pageResults = await Promise.allSettled(
        pages.map((page) => getPageItems(page)),
      );

      for (const result of pageResults) {
        if (result.status !== 'fulfilled') {
          continue;
        }

        const items = result.value;

        for (const item of items) {
          const normalized = normalizeAnnotation(item);
          if (!normalized) continue;

          const targetSource = getTargetSource(normalized.target);
          if (!targetSource) continue;

          const matchesCanvas =
            targetSource === canvasId ||
            normalizeCanvasId(targetSource) === normalizeCanvasId(canvasId);

          if (!matchesCanvas) continue;

          if (seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          collected.push(normalized);
        }
      }

      if (!active || currentRequest !== requestIdRef.current) {
        return;
      }

      setAnnotations(collected);
      setIsLoading(false);
    };

    loadAnnotations().catch(() => {
      if (active) {
        setAnnotations([]);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [manifest, canvasId]);

  return { annotations, isLoading };
}
