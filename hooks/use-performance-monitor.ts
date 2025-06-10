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
    if (process.env.NODE_ENV === 'development') {
      console.group('📊 Annotation Performance Metrics');
      console.log('Total annotations:', metricsRef.current.totalAnnotations);
      console.log(
        'Linking annotations:',
        metricsRef.current.linkingAnnotations,
      );
      console.log(
        'Annotation load time:',
        `${metricsRef.current.annotationLoadTime?.toFixed(2)}ms`,
      );
      console.log(
        'Linking load time:',
        `${metricsRef.current.linkingLoadTime?.toFixed(2)}ms`,
      );
      console.log(
        'Render time:',
        `${metricsRef.current.renderTime?.toFixed(2)}ms`,
      );
      console.groupEnd();
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
