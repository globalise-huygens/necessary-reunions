import { shouldUseStaticData, STATIC_ANNOTATIONS } from '@/lib/static-data';
import { Annotation } from '@/lib/types';
import { useEffect, useState } from 'react';

export function useStaticAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!canvasId) {
      setAnnotations([]);
      return;
    }

    setIsLoading(true);

    // Simulate loading delay for consistent UX
    setTimeout(() => {
      setAnnotations(STATIC_ANNOTATIONS);
      setIsLoading(false);
      console.log('[ANNOTATIONS] Static annotations loaded');
    }, 300);
  }, [canvasId]);

  return {
    annotations,
    isLoading,
  };
}
