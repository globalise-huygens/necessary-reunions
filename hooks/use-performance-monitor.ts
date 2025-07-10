import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  annotationLoadTime: number;
  linkingLoadTime: number;
  renderTime: number;
  totalAnnotations: number;
  linkingAnnotations: number;
}

export function usePerformanceMonitor() {
  const metricsRef = useRef<Partial<PerformanceMetrics>>({});
  const timersRef = useRef<Record<string, number>>({});

  const startTimer = useCallback((name: string) => {
    timersRef.current[name] = performance.now();
  }, []);

  const endTimer = useCallback((name: string) => {
    const startTime = timersRef.current[name];
    if (startTime) {
      const duration = performance.now() - startTime;
      delete timersRef.current[name];
      return duration;
    }
    return 0;
  }, []);

  const logMetrics = useCallback(() => {
    const metrics = metricsRef.current;
    if (metrics.annotationLoadTime && metrics.annotationLoadTime > 1000) {
      console.warn('Slow annotation loading detected:', {
        loadTime: metrics.annotationLoadTime,
        totalAnnotations: metrics.totalAnnotations,
        linkingAnnotations: metrics.linkingAnnotations,
      });
    }
  }, []);

  return {
    startTimer,
    endTimer,
    logMetrics,
    setMetric: useCallback((key: keyof PerformanceMetrics, value: number) => {
      metricsRef.current[key] = value;
    }, []),
  };
}
