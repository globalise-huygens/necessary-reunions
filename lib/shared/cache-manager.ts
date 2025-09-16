// Centralized cache manager for annotation system
class AnnotationCacheManager {
  private static instance: AnnotationCacheManager;

  // Cache stores
  private annotationCache = new Map<
    string,
    {
      annotations: any[];
      timestamp: number;
    }
  >();

  private linkingCache = new Map<
    string,
    {
      linkingAnnotations: any[];
      iconStates: Record<string, any>;
      timestamp: number;
    }
  >();

  private etagCache = new Map<
    string,
    {
      etag: string;
      timestamp: number;
    }
  >();

  // Cache durations
  private readonly ANNOTATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly LINKING_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
  private readonly ETAG_CACHE_DURATION = 30 * 1000; // 30 seconds

  // Event listeners for cache invalidation coordination
  private listeners = new Set<(event: CacheInvalidationEvent) => void>();

  private constructor() {}

  static getInstance(): AnnotationCacheManager {
    if (!AnnotationCacheManager.instance) {
      AnnotationCacheManager.instance = new AnnotationCacheManager();
    }
    return AnnotationCacheManager.instance;
  }

  // Annotation cache methods
  getAnnotations(canvasId: string): any[] | null {
    const cached = this.annotationCache.get(canvasId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.ANNOTATION_CACHE_DURATION) {
      this.annotationCache.delete(canvasId);
      return null;
    }

    return cached.annotations;
  }

  setAnnotations(canvasId: string, annotations: any[]): void {
    this.annotationCache.set(canvasId, {
      annotations,
      timestamp: Date.now(),
    });
  }

  // Linking cache methods
  getLinkingData(
    canvasId: string,
  ): { linkingAnnotations: any[]; iconStates: Record<string, any> } | null {
    const cached = this.linkingCache.get(canvasId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.LINKING_CACHE_DURATION) {
      this.linkingCache.delete(canvasId);
      return null;
    }

    return {
      linkingAnnotations: cached.linkingAnnotations,
      iconStates: cached.iconStates,
    };
  }

  setLinkingData(
    canvasId: string,
    linkingAnnotations: any[],
    iconStates: Record<string, any>,
  ): void {
    this.linkingCache.set(canvasId, {
      linkingAnnotations,
      iconStates,
      timestamp: Date.now(),
    });
  }

  // ETag cache methods
  getETag(annotationUrl: string): string | null {
    const cached = this.etagCache.get(annotationUrl);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.ETAG_CACHE_DURATION) {
      this.etagCache.delete(annotationUrl);
      return null;
    }

    return cached.etag;
  }

  setETag(annotationUrl: string, etag: string): void {
    this.etagCache.set(annotationUrl, {
      etag,
      timestamp: Date.now(),
    });
  }

  // Cache invalidation methods
  invalidateAnnotationCache(canvasId?: string): void {
    if (canvasId) {
      this.annotationCache.delete(canvasId);
      this.notifyListeners({
        type: 'annotation-invalidated',
        canvasId,
      });
    } else {
      this.annotationCache.clear();
      this.notifyListeners({
        type: 'all-annotations-invalidated',
      });
    }
  }

  invalidateLinkingCache(canvasId?: string): void {
    if (canvasId) {
      this.linkingCache.delete(canvasId);
      this.notifyListeners({
        type: 'linking-invalidated',
        canvasId,
      });
    } else {
      this.linkingCache.clear();
      this.notifyListeners({
        type: 'all-linking-invalidated',
      });
    }
  }

  invalidateETagCache(annotationUrl?: string): void {
    if (annotationUrl) {
      this.etagCache.delete(annotationUrl);
    } else {
      this.etagCache.clear();
    }
  }

  // Coordinated invalidation when annotations change
  onAnnotationCreated(canvasId: string, annotationId: string): void {
    this.invalidateAnnotationCache(canvasId);
    this.invalidateLinkingCache(canvasId);
    this.notifyListeners({
      type: 'annotation-created',
      canvasId,
      annotationId,
    });
  }

  onAnnotationUpdated(
    canvasId: string,
    annotationId: string,
    annotationUrl?: string,
  ): void {
    this.invalidateAnnotationCache(canvasId);
    this.invalidateLinkingCache(canvasId);

    if (annotationUrl) {
      this.invalidateETagCache(annotationUrl);
    }

    this.notifyListeners({
      type: 'annotation-updated',
      canvasId,
      annotationId,
    });
  }

  onAnnotationDeleted(
    canvasId: string,
    annotationId: string,
    annotationUrl?: string,
  ): void {
    this.invalidateAnnotationCache(canvasId);
    this.invalidateLinkingCache(canvasId);

    if (annotationUrl) {
      this.invalidateETagCache(annotationUrl);
    }

    this.notifyListeners({
      type: 'annotation-deleted',
      canvasId,
      annotationId,
    });
  }

  // Event listener management
  addListener(listener: (event: CacheInvalidationEvent) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: CacheInvalidationEvent) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: CacheInvalidationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Cache event listener error:', error);
      }
    });
  }

  // Utility methods
  getCacheStats(): CacheStats {
    return {
      annotationCacheSize: this.annotationCache.size,
      linkingCacheSize: this.linkingCache.size,
      etagCacheSize: this.etagCache.size,
      listenerCount: this.listeners.size,
    };
  }

  clearAllCaches(): void {
    this.annotationCache.clear();
    this.linkingCache.clear();
    this.etagCache.clear();
    this.notifyListeners({
      type: 'all-caches-cleared',
    });
  }
}

// Types
export interface CacheInvalidationEvent {
  type:
    | 'annotation-created'
    | 'annotation-updated'
    | 'annotation-deleted'
    | 'annotation-invalidated'
    | 'linking-invalidated'
    | 'all-annotations-invalidated'
    | 'all-linking-invalidated'
    | 'all-caches-cleared';
  canvasId?: string;
  annotationId?: string;
}

export interface CacheStats {
  annotationCacheSize: number;
  linkingCacheSize: number;
  etagCacheSize: number;
  listenerCount: number;
}

// Export singleton instance
export const cacheManager = AnnotationCacheManager.getInstance();

// React hook for using the cache manager
export function useCacheManager() {
  return cacheManager;
}
