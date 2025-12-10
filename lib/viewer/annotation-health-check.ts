/**
 * Development-only health check utilities for annotation loading
 *
 * Usage in browser console:
 * window.__annotationHealthCheck()
 */

export interface AnnotationHealthReport {
  baseAnnotations: {
    loaded: boolean;
    count: number;
    canvasId: string | null;
  };
  linkingAnnotations: {
    loaded: boolean;
    count: number;
    enabled: boolean;
  };
  resolution: {
    canResolveTargets: boolean;
    unresolvedCount: number;
    totalLinkingAnnotations: number;
  };
  timing: {
    baseLoadedFirst: boolean;
    loadSequenceCorrect: boolean;
  };
  issues: string[];
  status: 'healthy' | 'warning' | 'error';
}

class AnnotationHealthChecker {
  private baseAnnotationsLoadTime: number | null = null;
  private linkingAnnotationsLoadTime: number | null = null;
  private baseAnnotationsCount: number = 0;
  private linkingAnnotationsCount: number = 0;
  private linkingEnabled: boolean = false;
  private currentCanvasId: string | null = null;

  recordBaseAnnotationsLoaded(count: number, canvasId: string) {
    this.baseAnnotationsLoadTime = Date.now();
    this.baseAnnotationsCount = count;
    this.currentCanvasId = canvasId;
  }

  recordLinkingAnnotationsLoaded(count: number, enabled: boolean) {
    this.linkingAnnotationsLoadTime = Date.now();
    this.linkingAnnotationsCount = count;
    this.linkingEnabled = enabled;
  }

  generateReport(
    currentAnnotations: Array<{ id: string }>,
    currentLinkingAnnotations: Array<{ target: string | string[] }>,
  ): AnnotationHealthReport {
    const issues: string[] = [];

    // Check if base annotations loaded
    const baseLoaded = this.baseAnnotationsCount > 0;
    if (!baseLoaded) {
      issues.push('Base annotations have not loaded yet');
    }

    // Check if linking annotations loaded (when enabled)
    const linkingLoaded =
      this.linkingEnabled && this.linkingAnnotationsCount > 0;
    if (this.linkingEnabled && !linkingLoaded) {
      issues.push('Linking annotations enabled but not loaded');
    }

    // Check load sequence
    const baseLoadedFirst =
      this.baseAnnotationsLoadTime !== null &&
      this.linkingAnnotationsLoadTime !== null &&
      this.baseAnnotationsLoadTime < this.linkingAnnotationsLoadTime;

    if (
      this.linkingAnnotationsLoadTime !== null &&
      this.baseAnnotationsLoadTime !== null &&
      !baseLoadedFirst
    ) {
      issues.push(
        'CRITICAL: Linking annotations loaded before base annotations',
      );
    }

    // Check target resolution
    const allAnnotationIds = new Set(currentAnnotations.map((a) => a.id));
    let unresolvedCount = 0;

    currentLinkingAnnotations.forEach((linking) => {
      const targets = Array.isArray(linking.target)
        ? linking.target
        : [linking.target];
      const unresolvedTargets = targets.filter(
        (target: unknown): target is string =>
          typeof target === 'string' && !allAnnotationIds.has(target),
      );
      if (unresolvedTargets.length > 0) {
        unresolvedCount++;
      }
    });

    if (unresolvedCount > 0) {
      issues.push(
        `${unresolvedCount} linking annotations cannot resolve their targets`,
      );
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (issues.some((i) => i.includes('CRITICAL'))) {
      status = 'error';
    } else if (issues.length > 0) {
      status = 'warning';
    }

    return {
      baseAnnotations: {
        loaded: baseLoaded,
        count: currentAnnotations.length,
        canvasId: this.currentCanvasId,
      },
      linkingAnnotations: {
        loaded: linkingLoaded,
        count: currentLinkingAnnotations.length,
        enabled: this.linkingEnabled,
      },
      resolution: {
        canResolveTargets: unresolvedCount === 0,
        unresolvedCount,
        totalLinkingAnnotations: currentLinkingAnnotations.length,
      },
      timing: {
        baseLoadedFirst: baseLoadedFirst,
        loadSequenceCorrect:
          !this.linkingAnnotationsLoadTime || baseLoadedFirst,
      },
      issues,
      status,
    };
  }

  reset() {
    this.baseAnnotationsLoadTime = null;
    this.linkingAnnotationsLoadTime = null;
    this.baseAnnotationsCount = 0;
    this.linkingAnnotationsCount = 0;
    this.linkingEnabled = false;
    this.currentCanvasId = null;
  }
}

export const annotationHealthChecker = new AnnotationHealthChecker();

// Expose to window for development
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__annotationHealthChecker = annotationHealthChecker;
  (window as any).__annotationHealthCheck = () => {
    console.log('Annotation Health Check is installed in the components.');
    console.log(
      'Call window.__getAnnotationHealth() from the viewer to get a report.',
    );
  };
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
