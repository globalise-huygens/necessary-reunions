/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../lib/types';

const REQUEST_TIMEOUT_MS = 5000;

const normalizeCanvasId = (uri?: string) =>
  uri ? uri.split('#')[0]?.split('?')[0] : undefined;

const getAnnotationPageId = (page: any): string | null => {
  if (!page) return null;
  if (typeof page === 'string') return page;
  if (typeof page.id === 'string') return page.id;
  if (typeof page['@id'] === 'string') return page['@id'];
  return null;
};

const getTargetSource = (target: any): string | null => {
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
    const source = target.source;
    if (typeof source === 'string') return source;
    if (source && typeof source === 'object' && typeof source.id === 'string') {
      return source.id;
    }
  }

  return null;
};

const normalizeAnnotation = (annotation: any): Annotation | null => {
  if (!annotation) return null;

  const id = annotation.id || annotation['@id'];
  if (!id || typeof id !== 'string') return null;

  if (annotation.id === id) {
    return annotation as Annotation;
  }

  return {
    ...annotation,
    id,
  } as Annotation;
};

const fetchAnnotationPageItems = async (pageUrl: string): Promise<any[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(pageUrl, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.items)) return [];
    return data.items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

export function useManifestAnnotations(manifest: any | null, canvasId: string) {
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

      const canvas = manifest.items?.find((item: any) => item?.id === canvasId);

      if (!canvas || !Array.isArray(canvas.annotations)) {
        setAnnotations([]);
        setIsLoading(false);
        return;
      }

      const currentRequest = ++requestIdRef.current;
      setIsLoading(true);

      const collected: Annotation[] = [];
      const seen = new Set<string>();

      for (const page of canvas.annotations) {
        let items: any[] = [];

        if (page && Array.isArray(page.items)) {
          items = page.items;
        } else {
          const pageId = getAnnotationPageId(page);
          if (pageId) {
            items = await fetchAnnotationPageItems(pageId);
          }
        }

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
