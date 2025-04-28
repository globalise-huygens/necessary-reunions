'use client';

import { useEffect, useState } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';

interface AnnotationLoaderProps {
  canvasId: string;
  children: (args: {
    annotations: Annotation[];
    page: number;
    setPage: (p: number) => void;
    isLoading: boolean;
    hasMore: boolean;
  }) => React.ReactNode;
}

export function AnnotationLoader({
  canvasId,
  children,
}: AnnotationLoaderProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchAnnotations({ targetCanvasId: canvasId, page })
      .then(({ items, hasMore }) => {
        if (cancelled) return;
        setAnnotations(items);
        setHasMore(hasMore);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canvasId, page]);

  return <>{children({ annotations, page, setPage, isLoading, hasMore })}</>;
}
