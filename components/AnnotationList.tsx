'use client';

import React, {
  useEffect,
  useRef,
  useState,
  Suspense,
  useMemo,
  useCallback,
  memo,
} from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';
import {
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GlobeLock,
  Link2,
  Link,
  Plus,
  MapPin,
  Globe,
  Target,
  X,
  ArrowUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AnnotationLinker } from './AnnotationLinker';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './Badge';
import { Button } from './Button';

// Virtual scrolling configuration
const ITEM_HEIGHT = 100; // Reduced for more compact annotation list
const BUFFER_SIZE = 5; // Number of items to render outside visible area
const OVERSCAN = 3; // Additional items to render for smooth scrolling

// Performance monitoring for virtual scrolling
const usePerformanceMonitor = () => {
  const [renderTime, setRenderTime] = useState<number>(0);
  const [itemsRendered, setItemsRendered] = useState<number>(0);

  const startRender = useCallback(() => {
    return performance.now();
  }, []);

  const endRender = useCallback((startTime: number, itemCount: number) => {
    const endTime = performance.now();
    setRenderTime(endTime - startTime);
    setItemsRendered(itemCount);
  }, []);

  return { renderTime, itemsRendered, startRender, endRender };
};

interface AnnotationListProps {
  annotations?: Annotation[];
  onAnnotationSelect: (id: string) => void;
  onAnnotationPrepareDelete?: (anno: Annotation) => void;
  canEdit: boolean;
  showTextspotting: boolean;
  showIconography: boolean;
  onFilterChange: (mot: 'textspotting' | 'iconography') => void;
  isLoading?: boolean;
  totalCount?: number;
  selectedAnnotationId?: string | null;
  loadingProgress?: number;
  loadedAnnotations?: number;
  totalAnnotations?: number;
  onRefreshAnnotations?: () => void;
  canvasId: string;
  manifestId?: string;
  onSaveViewport?: (viewport: any) => void;
  onOptimisticAnnotationAdd?: (anno: Annotation) => void;
  onCurrentPointSelectorChange?: (
    point: { x: number; y: number } | null,
  ) => void;
  onAnnotationInLinkingMode?: (annotationId: string | null) => void;
}

// Memoized components for performance
const GeoTaggingWidget = dynamic(
  () => import('./GeoTaggingWidget').then((mod) => mod.GeoTaggingWidget),
  { ssr: false, loading: () => <LoadingSpinner /> },
);

const PointSelector = dynamic(
  () => import('./PointSelector').then((mod) => mod.PointSelector),
  { ssr: false, loading: () => <LoadingSpinner /> },
);

// Optimized sub-components with memo
const MemoizedTabButton = memo(
  ({
    active,
    onClick,
    icon,
    label,
    description,
    disabled = false,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    description: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 p-2 sm:p-3 rounded-md text-left transition-all min-w-0 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : disabled
          ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-2 mb-1 min-w-0">
        {icon}
        <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
      </div>
      <p className="text-xs opacity-80 hidden sm:block truncate">
        {description}
      </p>
    </button>
  ),
);

MemoizedTabButton.displayName = 'MemoizedTabButton';

// Memoized Badge component to reduce re-renders
const MemoizedBadge = memo(Badge);
MemoizedBadge.displayName = 'MemoizedBadge';

// Memoized Button component
const MemoizedButton = memo(Button);
MemoizedButton.displayName = 'MemoizedButton';

// Enhanced virtual scrolling hook with dynamic height adjustment
const useVirtualScrolling = (
  items: any[],
  containerHeight: number,
  itemHeight: number = ITEM_HEIGHT,
  overscan: number = OVERSCAN,
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  // Simplify to avoid infinite loops - use fixed height for now
  const estimatedItemHeight = itemHeight;

  const visibleRange = useMemo(() => {
    if (!containerRef || items.length === 0) {
      return { start: 0, end: Math.min(10, items.length) };
    }

    const viewportHeight = containerRef.clientHeight || containerHeight;
    const startIndex = Math.floor(scrollTop / estimatedItemHeight);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / estimatedItemHeight),
    );

    return {
      start: Math.max(0, startIndex - overscan),
      end: Math.min(items.length, endIndex + overscan),
    };
  }, [
    scrollTop,
    containerHeight,
    estimatedItemHeight,
    overscan,
    items.length,
    containerRef,
  ]);

  const totalHeight = items.length * estimatedItemHeight;
  const offsetY = visibleRange.start * estimatedItemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
    setContainerRef,
    estimatedItemHeight,
  };
};

// Enhanced Annotation Editor with performance optimizations and optimistic updates
const AnnotationEditor = memo(
  ({
    annotation,
    session,
    geotag,
    linkedIds,
    annotations,
    onRefreshAnnotations,
    onLinkCreated,
    onCurrentPointSelectorChange,
    linkingMode,
    setLinkingMode,
    selectedIds,
    setSelectedIds,
    getEtag,
    canvasId,
    manifestId,
    onSaveViewport,
    onOptimisticAnnotationAdd,
    pendingGeotags,
    setPendingGeotags,
    onAnnotationInLinkingMode,
    onAnnotationSelect,
    onEnsureExpanded,
    toast,
  }: {
    annotation: any;
    session: any;
    geotag: any;
    linkedIds: string[];
    annotations: any[];
    onRefreshAnnotations?: () => void;
    onLinkCreated?: () => void;
    onCurrentPointSelectorChange?: (
      point: { x: number; y: number } | null,
    ) => void;
    linkingMode?: boolean;
    setLinkingMode?: (v: boolean) => void;
    selectedIds?: string[];
    setSelectedIds?: (ids: string[]) => void;
    getEtag: (id: string) => string | undefined;
    canvasId: string;
    manifestId?: string;
    onSaveViewport?: (viewport: any) => void;
    onOptimisticAnnotationAdd?: (anno: any) => void;
    onAnnotationInLinkingMode?: (annotationId: string | null) => void;
    onAnnotationSelect?: (id: string) => void;
    onEnsureExpanded?: (id: string) => void;
    pendingGeotags: Record<string, any>;
    setPendingGeotags: React.Dispatch<
      React.SetStateAction<Record<string, any>>
    >;
    toast: any;
  }) => {
    const [activeTab, setActiveTab] = useState<'link' | 'geotag' | 'point'>(
      'link',
    );

    // State for tracking pending changes
    const [pendingGeotag, setPendingGeotag] = useState<any>(null);
    const [pendingPoint, setPendingPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Notify parent when entering/leaving link tab
    useEffect(() => {
      if (onAnnotationInLinkingMode) {
        if (activeTab === 'link') {
          onAnnotationInLinkingMode(annotation.id);

          // Initialize selectedIds with current annotation and any existing linked annotations
          // Only set if selectedIds is empty or doesn't include current annotation
          if (
            setSelectedIds &&
            (!selectedIds ||
              selectedIds.length === 0 ||
              !selectedIds.includes(annotation.id))
          ) {
            const linkingAnnos = getLinkingAnnotations(annotation.id);
            if (
              linkingAnnos.length > 0 &&
              Array.isArray(linkingAnnos[0].target)
            ) {
              // Use existing link targets
              setSelectedIds(linkingAnnos[0].target);
            } else {
              // Start with just the current annotation
              setSelectedIds([annotation.id]);
            }
          }
        } else {
          onAnnotationInLinkingMode(null);
          // Only clear selectedIds when explicitly leaving Link tab, not during saves
          // This prevents context disruption during save operations
          if (setSelectedIds && !isSaving) {
            setSelectedIds([]);
          }
        }
      }
    }, [activeTab, annotation.id, onAnnotationInLinkingMode, isSaving]);

    // Debug: Track selectedIds changes
    useEffect(() => {
      if (activeTab === 'link') {
        // Optional: Keep this log for debugging if needed
        // console.log('AnnotationEditor selectedIds changed:', selectedIds);
      }
    }, [selectedIds, activeTab]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }, []);

    // Helper to get linking annotations for this annotation
    const getLinkingAnnotations = (annotationId: string) => {
      return annotations.filter((a) => {
        if (a.motivation !== 'linking') return false;
        if (Array.isArray(a.target)) {
          return a.target.includes(annotationId);
        }
        return a.target === annotationId;
      });
    };

    // Check if there are any pending changes for the current tab
    const hasPendingChanges = (() => {
      if (activeTab === 'geotag') return !!pendingGeotag;
      if (activeTab === 'point') return !!pendingPoint;
      if (activeTab === 'link') return selectedIds && selectedIds.length > 1; // Need at least 2 for a link
      return false;
    })();

    // Check if there's existing data for the current tab
    const hasExistingData = (() => {
      if (activeTab === 'geotag') return !!geotag;
      if (activeTab === 'point') {
        // Check if current annotation has existing point selector
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        for (const linkAnno of linkingAnnos) {
          if (linkAnno.body && Array.isArray(linkAnno.body)) {
            const pointSelectorBody = linkAnno.body.find(
              (b: any) =>
                b.type === 'SpecificResource' &&
                b.purpose === 'identifying' &&
                b.selector &&
                b.selector.type === 'PointSelector',
            );
            if (pointSelectorBody) return true;
          }
        }
        return false;
      }
      if (activeTab === 'link') return linkedIds.length > 0;
      return false;
    })();

    const TabButton = MemoizedTabButton;

    const getSmartSuggestions = (annotation: any) => {
      const bodies = annotation.body || [];
      const textContent = bodies
        .filter((b: any) => b.type === 'TextualBody')
        .map((b: any) => b.value || '')
        .join(' ')
        .toLowerCase();

      const hasPlaceIndicators =
        /\b(in|at|near|from|to|town|city|village|street|amsterdam|london|paris|church|market|house|building)\b/.test(
          textContent,
        );
      const hasLocationWords =
        /\b(amsterdam|london|paris|church|market|house|street|road|square|bridge)\b/.test(
          textContent,
        );
      const hasConnectiveWords =
        /\b(and|with|next to|beside|above|below|between)\b/.test(textContent);

      return {
        suggestLinking: hasConnectiveWords || textContent.length > 50,
        suggestGeotagging: hasLocationWords || hasPlaceIndicators,
        suggestPoint: hasLocationWords,
        explanation: hasLocationWords
          ? 'This annotation mentions specific places that could be mapped geographically.'
          : hasConnectiveWords
          ? 'This annotation contains words that suggest it might relate to other annotations.'
          : null,
      };
    };

    // Helper function to streamline all save operations
    const performSave = useCallback(
      async (
        annotationData: any,
        existingLink: any,
        onSuccess: () => void,
        successMessage: string,
      ) => {
        let response;
        if (existingLink) {
          response = await fetch(`/api/annotations/${existingLink.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
              'If-Match': getEtag(existingLink.id) || '',
            },
            body: JSON.stringify(annotationData),
          });
        } else {
          response = await fetch('/api/annotations', {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
              Slug: `linking-${annotation.id.split('/').pop()}`,
            },
            body: JSON.stringify(annotationData),
          });
        }

        if (!response.ok) {
          throw new Error(
            `Failed to save: ${response.status} ${response.statusText}`,
          );
        }

        // Get the saved annotation data for optimistic update
        const savedAnnotation = await response.json();

        // Optimistic update: add the new/updated linking annotation to the list immediately
        if (onOptimisticAnnotationAdd && savedAnnotation) {
          onOptimisticAnnotationAdd({
            ...annotationData,
            id:
              savedAnnotation.id ||
              (existingLink ? existingLink.id : `temp-${Date.now()}`),
            etag: savedAnnotation.etag || response.headers.get('etag'),
          });
        }

        onSuccess();

        toast({
          title: successMessage,
          description: 'Changes saved successfully.',
        });

        // Trigger parent callbacks without forcing refresh
        onLinkCreated?.();
      },
      [
        session,
        annotation.id,
        getEtag,
        onOptimisticAnnotationAdd,
        onLinkCreated,
        toast,
      ],
    );

    const handleSaveLinkingData = useCallback(async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!selectedIds || selectedIds.length <= 1) {
        setSaveError(
          'You need to select at least 2 annotations to create a link.',
        );
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      // Store current annotation ID for refocusing after refresh
      const currentAnnotationId = annotation.id;

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (
              body.purpose === 'geotagging' ||
              (body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector')
            ) {
              bodies.push(body);
            }
          });
        }

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: selectedIds,
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {
            // Keep selectedIds active to maintain zoom and visual state
            // No refresh needed - rely on optimistic updates for smooth UX
          },
          'Link Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save link');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save link. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, [
      session,
      selectedIds,
      annotation.id,
      getLinkingAnnotations,
      getEtag,
      onLinkCreated,
      onOptimisticAnnotationAdd,
      toast,
      performSave,
    ]);

    const handleSaveGeotagData = async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!pendingGeotag) {
        setSaveError('No geotag changes to save.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (body.purpose !== 'geotagging') {
              bodies.push(body);
            }
          });
        }

        const geotagBody = {
          type: 'SpecificResource',
          purpose: 'geotagging',
          source: {
            id: pendingGeotag.nominatimResult.place_id.toString(),
            type: pendingGeotag.osmType,
            label: pendingGeotag.displayName,
            lat: pendingGeotag.marker[0].toString(),
            lon: pendingGeotag.marker[1].toString(),
            properties: {
              title: pendingGeotag.label,
            },
          },
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: new Date().toISOString(),
        };
        bodies.push(geotagBody);

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: existingLink?.target || [annotation.id],
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {
            setPendingGeotag(null);
          },
          'Location Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save geotag');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save location. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const handleSavePointData = async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!pendingPoint) {
        setSaveError('No point changes to save.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (
              !(
                body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector'
              )
            ) {
              bodies.push(body);
            }
          });
        }

        const pointSelectorBody = {
          type: 'SpecificResource',
          purpose: 'identifying',
          source: canvasId,
          selector: {
            type: 'PointSelector',
            x: pendingPoint.x,
            y: pendingPoint.y,
          },
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: new Date().toISOString(),
        };
        bodies.push(pointSelectorBody);

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: existingLink?.target || [annotation.id],
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {
            setPendingPoint(null);
          },
          'Point Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save point');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save point. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    // Function to remove specific type of data
    const handleRemoveData = async (type: 'link' | 'geotag' | 'point') => {
      if (!session) {
        setSaveError('You must be logged in to remove data.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        if (!existingLink) {
          setSaveError('No existing data to remove.');
          return;
        }

        if (type === 'link') {
          const hasOtherData =
            existingLink.body &&
            Array.isArray(existingLink.body) &&
            existingLink.body.some(
              (body: any) =>
                body.purpose === 'geotagging' ||
                (body.purpose === 'identifying' &&
                  body.selector?.type === 'PointSelector'),
            );

          if (!hasOtherData) {
            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'DELETE',
                headers: {
                  'If-Match': getEtag(existingLink.id) || '',
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to delete: ${response.status} ${response.statusText}`,
              );
            }
          } else {
            const bodies = existingLink.body.filter(
              (body: any) =>
                body.purpose === 'geotagging' ||
                (body.purpose === 'identifying' &&
                  body.selector?.type === 'PointSelector'),
            );

            const annotationData = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              type: 'Annotation',
              motivation: 'linking',
              target: [annotation.id],
              body: bodies,
              creator: {
                id: session.user.id,
                type: 'Person',
                label: session.user.label,
              },
              created: existingLink.created || new Date().toISOString(),
              modified: new Date().toISOString(),
            };

            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type':
                    'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                  'If-Match': getEtag(existingLink.id) || '',
                },
                body: JSON.stringify(annotationData),
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to update: ${response.status} ${response.statusText}`,
              );
            }
          }
        } else {
          const bodies: any[] = [];

          if (existingLink.body && Array.isArray(existingLink.body)) {
            existingLink.body.forEach((body: any) => {
              if (type === 'geotag' && body.purpose === 'geotagging') {
                return;
              }
              if (
                type === 'point' &&
                body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector'
              ) {
                return;
              }
              bodies.push(body);
            });
          }

          const hasLinkedTargets =
            Array.isArray(existingLink.target) &&
            existingLink.target.length > 1;

          if (bodies.length === 0 && !hasLinkedTargets) {
            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'DELETE',
                headers: {
                  'If-Match': getEtag(existingLink.id) || '',
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to delete: ${response.status} ${response.statusText}`,
              );
            }
          } else {
            const annotationData = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              type: 'Annotation',
              motivation: 'linking',
              target: existingLink.target,
              body: bodies,
              creator: {
                id: session.user.id,
                type: 'Person',
                label: session.user.label,
              },
              created: existingLink.created || new Date().toISOString(),
              modified: new Date().toISOString(),
            };

            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type':
                    'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                  'If-Match': getEtag(existingLink.id) || '',
                },
                body: JSON.stringify(annotationData),
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to update: ${response.status} ${response.statusText}`,
              );
            }
          }
        }

        if (type === 'geotag') setPendingGeotag(null);
        if (type === 'point') setPendingPoint(null);
        if (type === 'link' && setSelectedIds) setSelectedIds([]);

        const typeLabel =
          type === 'link' ? 'links' : type === 'geotag' ? 'location' : 'point';
        toast({
          title: 'Data Removed!',
          description: `Successfully removed ${typeLabel} from this annotation.`,
        });

        // Trigger parent callbacks without forcing refresh - optimistic removal should handle UI updates
        onLinkCreated?.();
      } catch (error: any) {
        setSaveError(error.message || 'Failed to remove data');
        toast({
          title: 'Remove Failed',
          description:
            error.message || 'Failed to remove data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const smartSuggestions = getSmartSuggestions(annotation);

    return (
      <div className="space-y-2">
        <div className="p-2 bg-muted/20 border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <GlobeLock className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Annotation Details</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID:</span>
              <span className="font-mono">
                {annotation.id.split('/').pop()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{annotation.motivation || 'annotation'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GeoTag:</span>
              <span
                className={geotag ? 'text-green-600' : 'text-muted-foreground'}
              >
                {geotag
                  ? geotag.source.properties?.title || geotag.source.label
                  : 'none'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Links:</span>
              <span
                className={(() => {
                  const currentCount =
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                      ? selectedIds.length
                      : linkedIds.length;
                  return currentCount > 0
                    ? 'text-blue-600'
                    : 'text-muted-foreground';
                })()}
              >
                {(() => {
                  const currentCount =
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                      ? selectedIds.length
                      : linkedIds.length;
                  return currentCount > 0
                    ? `${currentCount} connected`
                    : 'none';
                })()}
              </span>
            </div>
          </div>

          {(linkedIds.length > 0 ||
            (activeTab === 'link' &&
              selectedIds &&
              selectedIds.length > 0)) && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">
                {activeTab === 'link' && selectedIds && selectedIds.length > 0
                  ? 'Linked annotations (click in image to add/remove):'
                  : 'Linked annotations (reading order):'}
              </div>
              <div className="flex flex-wrap gap-1 max-w-full">
                {(() => {
                  let orderedIds: string[] = [];
                  if (
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                  ) {
                    orderedIds = selectedIds;
                  } else {
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    if (
                      linkingAnnos.length > 0 &&
                      Array.isArray(linkingAnnos[0].target)
                    ) {
                      orderedIds = linkingAnnos[0].target;
                    } else {
                      orderedIds = [annotation.id];
                    }
                  }

                  return orderedIds.map((lid, index) => {
                    const linkedAnno = annotations.find((a) => a.id === lid);
                    let label = lid;
                    if (linkedAnno) {
                      if (
                        linkedAnno.motivation === 'iconography' ||
                        linkedAnno.motivation === 'iconograpy'
                      ) {
                        label = 'Icon';
                      } else if (Array.isArray(linkedAnno.body)) {
                        // Use the first available text body value
                        if (linkedAnno.body[0]?.value) {
                          label = linkedAnno.body[0].value;
                        }
                      }
                    }
                    const isCurrent = lid === annotation.id;
                    const sequenceNumber = index + 1;

                    return (
                      <span
                        key={lid}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium max-w-[120px] ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <span className="bg-background text-foreground rounded-full w-3 h-3 text-xs flex items-center justify-center font-bold leading-none flex-shrink-0">
                          {sequenceNumber}
                        </span>
                        <span className="truncate">
                          {label.length > 12
                            ? label.substring(0, 12) + '...'
                            : label}
                        </span>
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Smart suggestions */}
        {smartSuggestions.explanation && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">💡</span>
              </div>
              <div>
                <div className="font-medium text-blue-900 text-sm">
                  Smart Suggestion
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {smartSuggestions.explanation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-muted/20 rounded-lg overflow-x-auto">
          <TabButton
            active={activeTab === 'link'}
            onClick={() => setActiveTab('link')}
            icon={
              <div className="flex items-center gap-1">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestLinking && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Link"
            description="Connect related annotations"
          />
          <TabButton
            active={activeTab === 'geotag'}
            onClick={() => setActiveTab('geotag')}
            icon={
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestGeotagging && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Location"
            description="Associate with real place"
          />
          <TabButton
            active={activeTab === 'point'}
            onClick={() => setActiveTab('point')}
            icon={
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestPoint && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Point"
            description="Point to location on image"
          />
        </div>

        {/* Save/Update/Remove Controls - Always visible for all tabs */}
        <div className="flex items-center justify-between p-2 bg-muted/10 border border-border rounded-lg">
          <div className="flex-1">
            {hasPendingChanges ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-amber-700">
                  You have unsaved changes
                </span>
              </div>
            ) : hasExistingData ? (
              <span className="text-sm text-muted-foreground">
                {activeTab === 'geotag' &&
                  'Location set - modify below or remove'}
                {activeTab === 'point' && 'Point set - modify below or remove'}
                {activeTab === 'link' && 'Links exist - modify below or remove'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {activeTab === 'geotag' && 'No location - add below'}
                {activeTab === 'point' && 'No point - add below'}
                {activeTab === 'link' && 'No links - create below'}
              </span>
            )}
            {saveError && (
              <div className="text-xs text-destructive mt-1">{saveError}</div>
            )}
          </div>
          <div className="flex gap-2">
            {hasPendingChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeTab === 'geotag') setPendingGeotag(null);
                  if (activeTab === 'point') setPendingPoint(null);
                  if (activeTab === 'link' && setSelectedIds) {
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    if (
                      linkingAnnos.length > 0 &&
                      Array.isArray(linkingAnnos[0].target)
                    ) {
                      setSelectedIds(linkingAnnos[0].target);
                    } else {
                      setSelectedIds([annotation.id]);
                    }
                  }
                  setSaveError(null);
                }}
                disabled={isSaving}
                className="text-xs"
              >
                Discard
              </Button>
            )}
            {hasExistingData && !hasPendingChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeTab === 'geotag') handleRemoveData('geotag');
                  else if (activeTab === 'point') handleRemoveData('point');
                  else if (activeTab === 'link') handleRemoveData('link');
                }}
                disabled={isSaving}
                className="text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            )}
            <Button
              onClick={async () => {
                // Immediate visual feedback - show saving state before actual save
                setIsSaving(true);

                try {
                  if (activeTab === 'link') await handleSaveLinkingData();
                  else if (activeTab === 'geotag') await handleSaveGeotagData();
                  else if (activeTab === 'point') await handleSavePointData();
                } catch (error) {
                  // Error is already handled in individual save functions
                  console.error('Save error:', error);
                }
                // isSaving is reset in individual save functions
              }}
              disabled={!hasPendingChanges || isSaving || !session}
              size="sm"
              className="text-xs font-medium"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                (() => {
                  if (activeTab === 'link') return 'Save Link';
                  if (activeTab === 'geotag')
                    return hasExistingData
                      ? 'Update Location'
                      : 'Save Location';
                  if (activeTab === 'point')
                    return hasExistingData ? 'Update Point' : 'Save Point';
                  return 'Save';
                })()
              )}
            </Button>
          </div>
        </div>

        {/* Tab content */}
        <div className="min-h-[200px] max-h-[500px] overflow-auto p-2 bg-card border border-border rounded-lg">
          {activeTab === 'link' && (
            <div className="space-y-4 overflow-auto">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-5 h-5 text-primary flex-shrink-0" />
                <h3 className="font-medium">Link Annotations</h3>
              </div>

              {/* Clear instructions for linking workflow */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">💡</span>
                  </div>
                  <div>
                    <div className="font-medium text-blue-900 text-sm">
                      How to Link Annotations
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      Click annotations in the image viewer to add/remove them
                      from this link. Use ↑↓ arrows to reorder annotations in
                      reading sequence, or ✕ button to remove annotations from
                      the selection.
                    </div>
                  </div>
                </div>
              </div>

              {/* Link Building Section - Always visible in Link tab */}
              <div className="space-y-3 p-3 bg-secondary/10 border border-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-primary">
                    Link Builder
                  </h4>
                </div>

                {/* Current selection */}
                {selectedIds && selectedIds.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-foreground">
                      Selected Annotations ({selectedIds.length})
                    </h5>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedIds.map((id, index) => {
                        const anno = annotations.find((a) => a.id === id);
                        if (!anno) return null;

                        const isCurrent = id === annotation.id;
                        const title =
                          anno.motivation === 'iconography' ||
                          anno.motivation === 'iconograpy'
                            ? 'Icon'
                            : (Array.isArray(anno.body) &&
                                anno.body[0]?.value) ||
                              'Untitled';

                        const canMoveUp = index > 0;
                        const canMoveDown = index < selectedIds.length - 1;

                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 p-2 rounded border ${
                              isCurrent
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/20 border-border'
                            }`}
                          >
                            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="text-sm font-medium truncate">
                                {title}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded whitespace-nowrap">
                                Current
                              </span>
                            )}

                            {/* Reordering controls */}
                            {selectedIds.length > 1 && (
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (canMoveUp && setSelectedIds) {
                                      const newIds = [...selectedIds];
                                      [newIds[index], newIds[index - 1]] = [
                                        newIds[index - 1],
                                        newIds[index],
                                      ];
                                      setSelectedIds(newIds);
                                    }
                                  }}
                                  disabled={!canMoveUp}
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (canMoveDown && setSelectedIds) {
                                      const newIds = [...selectedIds];
                                      [newIds[index], newIds[index + 1]] = [
                                        newIds[index + 1],
                                        newIds[index],
                                      ];
                                      setSelectedIds(newIds);
                                    }
                                  }}
                                  disabled={!canMoveDown}
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {/* Remove from selection */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (setSelectedIds) {
                                  const newIds = selectedIds.filter(
                                    (selectedId) => selectedId !== id,
                                  );
                                  setSelectedIds(newIds);
                                }
                              }}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-red-600 flex-shrink-0"
                              title="Remove from link"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {selectedIds.length < 2 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                        Select at least 2 annotations to create a link
                      </div>
                    )}

                    {selectedIds.length >= 2 && (
                      <div className="p-2 bg-secondary/20 border border-secondary/40 rounded text-xs text-secondary-foreground">
                        ✓ Ready to link! Use ↑↓ arrows to arrange annotations in
                        reading order.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center text-muted-foreground bg-card/50 rounded border border-dashed border-muted-foreground/30">
                    <p className="text-sm">
                      No annotations selected for linking
                    </p>
                    <p className="text-xs mt-1">
                      Click annotations in the image viewer to start building a
                      link
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      The current annotation will automatically be included
                    </p>
                  </div>
                )}

                <div className="text-xs text-primary bg-secondary/10 p-2 rounded border border-secondary/30">
                  💡 Click annotations in the image viewer to add/remove them
                  from this link. Use ↑↓ arrows to arrange annotations in
                  reading order, or ✕ button to remove them from the selection.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'geotag' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-medium">Geographic Location</h3>
              </div>

              {/* Show existing geotag if present */}
              {geotag && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">
                      Current Location
                    </span>
                  </div>
                  <p className="text-sm text-green-700">
                    {geotag.source.properties?.title || geotag.source.label}
                    {geotag.source?.type && (
                      <span className="text-green-600 ml-1">
                        ({geotag.source.type})
                      </span>
                    )}
                  </p>
                  {geotag.created && (
                    <p className="text-xs text-green-600 mt-1">
                      Created: {new Date(geotag.created).toLocaleString()}
                      {geotag.creator?.label && ` by ${geotag.creator.label}`}
                    </p>
                  )}
                </div>
              )}

              {/* Show pending geotag if present */}
              {pendingGeotag && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      Pending Location Change
                    </span>
                  </div>
                  <p className="text-sm text-amber-700">
                    {pendingGeotag.label}
                    <span className="text-amber-600 ml-1">
                      ({pendingGeotag.osmType})
                    </span>
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Coordinates: {pendingGeotag.marker[0].toFixed(5)},{' '}
                    {pendingGeotag.marker[1].toFixed(5)}
                  </p>
                </div>
              )}

              {/* GeoTagging Widget */}
              <GeoTaggingWidget
                target={annotation.id}
                expandedStyle={true}
                initialGeotag={
                  geotag
                    ? {
                        marker: [
                          parseFloat(geotag.source.lat || '0'),
                          parseFloat(geotag.source.lon || '0'),
                        ],
                        label:
                          geotag.source.properties?.title ||
                          geotag.source.label ||
                          '',
                        nominatimResult: geotag.source,
                      }
                    : undefined
                }
                onGeotagSelected={(selectedGeotag) => {
                  setPendingGeotag(selectedGeotag);
                  setSaveError(null);

                  toast({
                    title: 'Location Selected',
                    description:
                      'Geographic location ready to save. Click "Save Changes" below.',
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'point' && (
            <div className="space-y-4">
              {' '}
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="font-medium">Image Point Mapping</h3>
              </div>
              {/* Show pending point if present */}
              {pendingPoint && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      Pending Point Change
                    </span>
                  </div>
                  <p className="text-sm text-amber-700">
                    New coordinates: ({pendingPoint.x}, {pendingPoint.y})
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This point will be saved when you click "Save Changes"
                  </p>
                </div>
              )}
              {/* PointSelector Widget */}
              <Suspense fallback={<LoadingSpinner />}>
                <PointSelector
                  value={(() => {
                    // Get existing point selector from linking annotations
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    for (const linkAnno of linkingAnnos) {
                      if (linkAnno.body && Array.isArray(linkAnno.body)) {
                        const pointSelectorBody = linkAnno.body.find(
                          (b: any) =>
                            b.type === 'SpecificResource' &&
                            b.purpose === 'identifying' &&
                            b.selector &&
                            b.selector.type === 'PointSelector',
                        );
                        if (pointSelectorBody && pointSelectorBody.selector) {
                          return {
                            x: pointSelectorBody.selector.x,
                            y: pointSelectorBody.selector.y,
                          };
                        }
                      }
                    }
                    return null;
                  })()}
                  onChange={(point: { x: number; y: number } | null) => {
                    // Store as pending change instead of immediately saving
                    setPendingPoint(point);
                    setSaveError(null);
                    onCurrentPointSelectorChange?.(point);
                  }}
                  canvasId={canvasId}
                  manifestId={manifestId}
                  expandedStyle={true}
                  existingAnnotations={annotations}
                  currentAnnotationId={annotation.id}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    );
  },
);

AnnotationEditor.displayName = 'AnnotationEditor';

// Memoized AnnotationItem component for optimal performance
const AnnotationItem = memo(
  ({
    annotation,
    isSelected,
    isExpanded,
    capabilities,
    title,
    preview,
    geotag,
    linkedIds,
    canEdit,
    onAnnotationSelect,
    onExpandToggle,
    onEnsureExpanded,
    onDeleteAnnotation,
    getBodies,
    getGeneratorLabel,
    // Editor props
    session,
    annotations,
    onRefreshAnnotations,
    onLinkCreated,
    onCurrentPointSelectorChange,
    linkingMode,
    setLinkingMode,
    selectedIds,
    setSelectedIds,
    getEtag,
    canvasId,
    manifestId,
    onSaveViewport,
    onOptimisticAnnotationAdd,
    onAnnotationInLinkingMode,
    pendingGeotags,
    setPendingGeotags,
    toast,
  }: {
    annotation: any;
    isSelected: boolean;
    isExpanded: boolean;
    capabilities: any;
    title: string;
    preview: string;
    geotag: any;
    linkedIds: string[];
    canEdit: boolean;
    onAnnotationSelect: (id: string) => void;
    onExpandToggle: (id: string) => void;
    onEnsureExpanded: (id: string) => void;
    onDeleteAnnotation: (annotation: any) => void;
    getBodies: (annotation: any) => any[];
    getGeneratorLabel: (body: any) => string;
    // Editor props
    session: any;
    annotations: any[];
    onRefreshAnnotations?: () => void;
    onLinkCreated?: () => void;
    onCurrentPointSelectorChange?: (
      point: { x: number; y: number } | null,
    ) => void;
    linkingMode?: boolean;
    setLinkingMode?: (v: boolean) => void;
    selectedIds?: string[];
    setSelectedIds?: (ids: string[]) => void;
    getEtag: (id: string) => string | undefined;
    canvasId: string;
    manifestId?: string;
    onSaveViewport?: (viewport: any) => void;
    onOptimisticAnnotationAdd?: (anno: any) => void;
    onAnnotationInLinkingMode?: (annotationId: string | null) => void;
    pendingGeotags: Record<string, any>;
    setPendingGeotags: React.Dispatch<
      React.SetStateAction<Record<string, any>>
    >;
    toast: any;
  }) => {
    // Memoized bodies computation
    const bodies = useMemo(() => {
      const annotationBodies = getBodies(annotation);

      if (
        (annotation.motivation === 'iconography' ||
          annotation.motivation === 'iconograpy') &&
        annotationBodies.length === 0
      ) {
        return [
          {
            type: 'TextualBody',
            value: 'Icon',
            format: 'text/plain',
            generator: { id: '', label: 'Icon' },
            created: new Date().toISOString(),
          } as any,
        ];
      }

      return annotationBodies;
    }, [annotation, getBodies]);

    // Memoized click handler
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (e && e.target instanceof HTMLElement) {
          const tag = e.target.tagName.toLowerCase();
          if (
            ['input', 'textarea', 'button', 'select', 'label'].includes(tag)
          ) {
            return;
          }
        }
        onAnnotationSelect(annotation.id);
      },
      [annotation.id, onAnnotationSelect],
    );

    // Memoized expand handler
    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onExpandToggle(annotation.id);
        if (!isSelected) {
          onAnnotationSelect(annotation.id);
        }
      },
      [annotation.id, isSelected, onExpandToggle, onAnnotationSelect],
    );

    // Memoized delete handler
    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeleteAnnotation(annotation);
      },
      [annotation, onDeleteAnnotation],
    );

    return (
      <div
        className={`border rounded-lg p-2 transition-all duration-200 overflow-hidden ${
          isSelected
            ? 'bg-primary/10 border-primary shadow-md'
            : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
        }`}
      >
        {/* Main content area */}
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex-1 cursor-pointer min-w-0" onClick={handleClick}>
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {title}
                  </h4>
                  {preview && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {preview}
                    </p>
                  )}
                </div>

                {/* Capability indicators */}
                <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
                  {capabilities.hasLinks && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Linked"
                    >
                      <Link2 className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                  {capabilities.hasGeotag && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Located"
                    >
                      <MapPin className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                  {capabilities.hasPointSelector && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Mapped"
                    >
                      <Globe className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                </div>
              </div>

              {/* Generator badges */}
              <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                {bodies
                  .filter((body) => {
                    const label = getGeneratorLabel(body);
                    // Filter out MapReader and Loghi tags
                    return label !== 'MapReader' && label !== 'Loghi';
                  })
                  .sort((a, b) => {
                    const la = getGeneratorLabel(a);
                    const lb = getGeneratorLabel(b);
                    return la.localeCompare(lb);
                  })
                  .map((body, idx) => {
                    const label = getGeneratorLabel(body);
                    return (
                      <span
                        key={idx}
                        className="inline-block px-2 py-1 text-xs font-semibold rounded whitespace-nowrap bg-brand-primary text-white"
                      >
                        {label}
                      </span>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* Expand button */}
            <MemoizedButton
              variant="ghost"
              size="sm"
              onClick={handleExpandClick}
              className="text-muted-foreground hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Edit</span>
                </>
              )}
              <span className="sr-only">
                {isExpanded ? 'Collapse' : 'Expand'} editing options
              </span>
            </MemoizedButton>

            {/* Delete button */}
            <MemoizedButton
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              disabled={!canEdit}
              className={`${
                canEdit
                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="sr-only">Delete annotation</span>
            </MemoizedButton>
          </div>
        </div>

        {/* Expanded editing interface */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border overflow-hidden">
            <div className="max-w-full overflow-auto">
              <AnnotationEditor
                annotation={annotation}
                session={session}
                geotag={geotag}
                linkedIds={linkedIds}
                annotations={annotations}
                onRefreshAnnotations={onRefreshAnnotations}
                onLinkCreated={onLinkCreated}
                onCurrentPointSelectorChange={onCurrentPointSelectorChange}
                linkingMode={linkingMode}
                setLinkingMode={setLinkingMode}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                getEtag={getEtag}
                canvasId={canvasId}
                manifestId={manifestId}
                onSaveViewport={onSaveViewport}
                onOptimisticAnnotationAdd={onOptimisticAnnotationAdd}
                onAnnotationInLinkingMode={onAnnotationInLinkingMode}
                onAnnotationSelect={onAnnotationSelect}
                onEnsureExpanded={onEnsureExpanded}
                pendingGeotags={pendingGeotags}
                setPendingGeotags={setPendingGeotags}
                toast={toast}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);

AnnotationItem.displayName = 'AnnotationItem';

// Main AnnotationList component
export function AnnotationList({
  annotations: propsAnnotations = [],
  onAnnotationSelect,
  onAnnotationPrepareDelete,
  canEdit,
  showTextspotting,
  showIconography,
  onFilterChange,
  isLoading = false,
  totalCount,
  selectedAnnotationId = null,
  loadingProgress = 0,
  loadedAnnotations = 0,
  totalAnnotations = 0,
  onRefreshAnnotations,
  linkingMode,
  setLinkingMode,
  selectedIds,
  setSelectedIds,
  onLinkCreated,
  canvasId,
  manifestId,
  isLinkingLoading = false,
  onSaveViewport,
  onOptimisticAnnotationAdd,
  onCurrentPointSelectorChange,
  onAnnotationInLinkingMode,
  getEtag: propsGetEtag,
}: AnnotationListProps & {
  linkingMode?: boolean;
  setLinkingMode?: (v: boolean) => void;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  onLinkCreated?: () => void;
  isLinkingLoading?: boolean;
  onAnnotationInLinkingMode?: (annotationId: string | null) => void;
  getEtag?: (id: string) => string | undefined;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingGeotags, setPendingGeotags] = useState<Record<string, any>>({});
  const { data: session } = useSession();
  const { toast } = useToast();

  const annotations = propsAnnotations;
  const getEtag = propsGetEtag || ((id: string) => undefined);

  // Memoized computations for better performance
  const linkingAnnotationsMap = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    annotations.forEach((a) => {
      if (a.motivation === 'linking' && Array.isArray(a.target)) {
        a.target.forEach((targetId: string) => {
          if (!map.has(targetId)) {
            map.set(targetId, []);
          }
          map.get(targetId)!.push(a);
        });
      }
    });
    return map;
  }, [annotations]);

  const geotagAnnotationsMap = useMemo(() => {
    const map = new Map<string, Annotation>();
    annotations.forEach((a) => {
      if (a.motivation === 'linking') {
        let targetIds: string[] = [];
        if (typeof a.target === 'string') targetIds = [a.target];
        else if (Array.isArray(a.target)) {
          targetIds = a.target
            .map((t) => (typeof t === 'string' ? t : t?.id))
            .filter(Boolean);
        } else if (a.target && typeof a.target === 'object') {
          targetIds = [a.target.id];
        }

        const bodies = Array.isArray(a.body) ? a.body : [a.body];
        const hasGeotag = bodies.some(
          (b) =>
            b.type === 'SpecificResource' &&
            (b.purpose === 'geotagging' || b.purpose === 'identifying') &&
            b.source &&
            b.source.label &&
            b.source.id,
        );

        if (hasGeotag) {
          targetIds.forEach((targetId) => {
            map.set(targetId, a);
          });
        }
      }
    });
    return map;
  }, [annotations]);

  // Memoized helper functions
  const getBodies = useCallback((annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  }, []);

  const getGeotagBody = useCallback((annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.find(
      (b) =>
        b.type === 'SpecificResource' &&
        (b.purpose === 'geotagging' || b.purpose === 'identifying') &&
        b.source &&
        b.source.label &&
        b.source.id,
    );
  }, []);

  const getGeneratorLabel = useCallback((body: any) => {
    const gen = body.generator;
    if (!gen) return 'Unknown';
    if (gen.id.includes('MapTextPipeline')) return 'MapReader';
    if (gen.label?.toLowerCase().includes('loghi')) return 'Loghi';
    if (gen.label) return gen.label;
    return gen.id;
  }, []);

  const getAnnotationTitle = useCallback(
    (annotation: any) => {
      const bodies = getBodies(annotation);
      if (
        annotation.motivation === 'iconography' ||
        annotation.motivation === 'iconograpy'
      ) {
        return 'Icon';
      }
      if (bodies.length > 0) {
        return bodies[0].value || 'Untitled';
      }
      return 'Untitled';
    },
    [getBodies],
  );

  const getAnnotationPreview = useCallback(
    (annotation: any) => {
      const bodies = getBodies(annotation);
      if (bodies.length > 1) {
        return bodies
          .slice(1)
          .map((b) => b.value)
          .join(', ');
      }
      return '';
    },
    [getBodies],
  );

  // Helper functions for extracting data
  const getGeotagAnnoFor = useCallback(
    (annotationId: string) => {
      return geotagAnnotationsMap.get(annotationId);
    },
    [geotagAnnotationsMap],
  );

  const getLinkedAnnotationIds = useCallback(
    (annotationId: string) => {
      const linkingAnnos = linkingAnnotationsMap.get(annotationId) || [];
      const linkedIds = new Set<string>();
      linkingAnnos.forEach((link) => {
        (link.target || []).forEach((tid: string) => {
          if (tid !== annotationId) linkedIds.add(tid);
        });
      });
      return Array.from(linkedIds);
    },
    [linkingAnnotationsMap],
  );

  // Memoized capabilities computation
  const getCapabilities = useCallback(
    (annotation: any) => {
      const geotagAnno = geotagAnnotationsMap.get(annotation.id);
      const linkingAnnos = linkingAnnotationsMap.get(annotation.id) || [];

      const linkedIds = new Set<string>();
      linkingAnnos.forEach((link) => {
        (link.target || []).forEach((tid: string) => {
          if (tid !== annotation.id) linkedIds.add(tid);
        });
      });

      const hasPointSelector = linkingAnnos.some((linkAnno) => {
        if (linkAnno.body && Array.isArray(linkAnno.body)) {
          return linkAnno.body.some(
            (b: any) =>
              b.type === 'SpecificResource' &&
              b.purpose === 'identifying' &&
              b.selector &&
              b.selector.type === 'PointSelector',
          );
        }
        return false;
      });

      return {
        canBeLinked: true,
        hasGeotag: !!geotagAnno,
        hasLinks: linkedIds.size > 0,
        hasPointSelector: hasPointSelector,
        linkedIds: Array.from(linkedIds),
        geotagAnno,
      };
    },
    [linkingAnnotationsMap, geotagAnnotationsMap],
  );

  // Legacy alias for compatibility
  const getAnnotationCapabilities = getCapabilities;

  const handleAnnotationSelect = useCallback(
    (id: string) => {
      onAnnotationSelect(id);
    },
    [onAnnotationSelect],
  );

  const handleDeleteAnnotation = useCallback(
    (annotation: any) => {
      onAnnotationPrepareDelete?.(annotation);
    },
    [onAnnotationPrepareDelete],
  );

  const handleFilterChange = useCallback(
    (type: 'textspotting' | 'iconography') => {
      onFilterChange(type);
    },
    [onFilterChange],
  );

  // Optimized filtered annotations with useMemo
  const filtered = useMemo(() => {
    return annotations.filter((a) => {
      const m = a.motivation?.toLowerCase();
      if (m === 'textspotting') return showTextspotting;
      if (m === 'iconography' || m === 'iconograpy') return showIconography;
      return true;
    });
  }, [annotations, showTextspotting, showIconography]);

  // Initialize virtual scrolling for large lists
  const [containerHeight, setContainerHeight] = useState(600);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { renderTime, itemsRendered, startRender, endRender } =
    usePerformanceMonitor();

  const {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
    setContainerRef,
    estimatedItemHeight,
  } = useVirtualScrolling(filtered, containerHeight, ITEM_HEIGHT, OVERSCAN);

  // Track render performance
  const renderStartTime = useRef<number>(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Track scroll position for scroll-to-top button
  const handleScrollWithTracking = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      setShowScrollToTop(scrollTop > 500); // Show button after scrolling 500px
      handleScroll(e);
    },
    [handleScroll],
  );

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, []);

  // Update container height when ref changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerRef(scrollContainerRef.current);
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(scrollContainerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [setContainerRef]);

  // Enhanced auto-scroll to selected annotation with virtual scrolling support
  useEffect(() => {
    if (selectedAnnotationId && scrollContainerRef.current) {
      const selectedIndex = filtered.findIndex(
        (a) => a.id === selectedAnnotationId,
      );
      if (selectedIndex !== -1) {
        const targetScrollTop = selectedIndex * estimatedItemHeight;
        const containerHeight = scrollContainerRef.current.clientHeight;

        // Check if item is already visible
        const currentScrollTop = scrollContainerRef.current.scrollTop;
        const isVisible =
          targetScrollTop >= currentScrollTop &&
          targetScrollTop <=
            currentScrollTop + containerHeight - estimatedItemHeight;

        if (!isVisible) {
          // Scroll to make the item visible
          const centeredScrollTop = Math.max(
            0,
            targetScrollTop - containerHeight / 2 + estimatedItemHeight / 2,
          );
          scrollContainerRef.current.scrollTo({
            top: centeredScrollTop,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedAnnotationId, filtered, estimatedItemHeight]);

  // Enhanced expand toggle handler with virtual scrolling support
  const handleExpandToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));

      // Scroll into view after expansion with virtual scrolling support
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const selectedIndex = filtered.findIndex((a) => a.id === id);
          if (selectedIndex !== -1) {
            const targetScrollTop = selectedIndex * estimatedItemHeight;
            const containerHeight = scrollContainerRef.current.clientHeight;
            const currentScrollTop = scrollContainerRef.current.scrollTop;

            // Check if expanded item will be visible
            const isVisible =
              targetScrollTop >= currentScrollTop &&
              targetScrollTop <=
                currentScrollTop + containerHeight - estimatedItemHeight * 2;

            if (!isVisible) {
              scrollContainerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop - containerHeight / 3),
                behavior: 'smooth',
              });
            }
          }
        }
      }, 100); // Allow time for expansion animation
    },
    [filtered, estimatedItemHeight],
  );

  // Function to ensure an annotation is expanded (not toggled)
  const handleEnsureExpanded = useCallback(
    (id: string) => {
      setExpandedId((prev) => {
        // Only set to expanded if it's not already expanded
        if (prev !== id) {
          return id;
        }
        return prev; // Already expanded, don't change
      });

      // Scroll into view after ensuring expansion
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const selectedIndex = filtered.findIndex((a) => a.id === id);
          if (selectedIndex !== -1) {
            const targetScrollTop = selectedIndex * estimatedItemHeight;
            const containerHeight = scrollContainerRef.current.clientHeight;
            const currentScrollTop = scrollContainerRef.current.scrollTop;

            // Check if expanded item will be visible
            const isVisible =
              targetScrollTop >= currentScrollTop &&
              targetScrollTop <=
                currentScrollTop + containerHeight - estimatedItemHeight * 2;

            if (!isVisible) {
              scrollContainerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop - containerHeight / 3),
                behavior: 'smooth',
              });
            }
          }
        }
      }, 100); // Allow time for expansion animation
    },
    [filtered, estimatedItemHeight],
  );

  // Auto-scroll to selected annotation with optimized effect
  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        itemRefs.current[selectedAnnotationId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  }, [selectedAnnotationId]);

  const displayCount = totalCount ?? filtered.length;

  // Auto-scroll to selected annotation
  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedAnnotationId]);

  return (
    <div className="h-full border-l border-border bg-card flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-xs text-muted-foreground flex space-x-4 flex-shrink-0">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTextspotting}
            onChange={() => onFilterChange('textspotting')}
            className="accent-primary"
          />
          <span>Texts (AI)</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showIconography}
            onChange={() => onFilterChange('iconography')}
            className="accent-secondary"
          />
          <span>Icons (AI)</span>
        </label>
      </div>

      <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground bg-muted/30 flex-shrink-0 flex justify-between items-center">
        <span>
          Showing {displayCount} of {annotations.length}
        </span>
        {filtered.length > 20 && (
          <span className="text-xs text-primary">
            Virtual scrolling: {visibleRange.end - visibleRange.start} items
            rendered
            {renderTime > 0 && ` (${renderTime.toFixed(1)}ms)`}
          </span>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-auto flex-1 min-h-0 relative"
        onScroll={handleScrollWithTracking}
      >
        {isLoading && filtered.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-muted-foreground">
              Loading annotations…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No annotations for this image
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: totalHeight, minHeight: totalHeight }}
          >
            <div
              className="absolute top-0 left-0 right-0 p-2 space-y-1"
              style={{ transform: `translateY(${offsetY}px)` }}
            >
              {(() => {
                renderStartTime.current = startRender();
                const visibleItems = filtered.slice(
                  visibleRange.start,
                  visibleRange.end,
                );

                // Track performance after render
                setTimeout(() => {
                  endRender(renderStartTime.current, visibleItems.length);
                }, 0);

                return visibleItems.map((annotation, virtualIndex) => {
                  const actualIndex = visibleRange.start + virtualIndex;

                  let bodies = getBodies(annotation);

                  if (
                    (annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy') &&
                    bodies.length === 0
                  ) {
                    bodies = [
                      {
                        type: 'TextualBody',
                        value: 'Icon',
                        format: 'text/plain',
                        generator: { id: '', label: 'Icon' },
                        created: new Date().toISOString(),
                      } as any,
                    ];
                  }

                  const geotagAnno = getGeotagAnnoFor(annotation.id);
                  const geotag = geotagAnno
                    ? getGeotagBody(geotagAnno)
                    : undefined;

                  const isSelected = annotation.id === selectedAnnotationId;
                  const isExpanded = annotation.id === expandedId;

                  const linkedIds = getLinkedAnnotationIds(annotation.id);
                  const isLinked = linkedIds.length > 0;

                  const capabilities = getAnnotationCapabilities(annotation);
                  const title = getAnnotationTitle(annotation);
                  const preview = getAnnotationPreview(annotation);

                  return (
                    <div
                      key={annotation.id}
                      data-index={actualIndex}
                      style={{
                        minHeight: estimatedItemHeight,
                        marginBottom: '4px',
                      }}
                      ref={(el) => {
                        if (el) {
                          itemRefs.current[annotation.id] = el;
                        }
                      }}
                    >
                      <AnnotationItem
                        annotation={annotation}
                        isSelected={isSelected}
                        isExpanded={isExpanded}
                        capabilities={capabilities}
                        title={title}
                        preview={preview}
                        geotag={geotag}
                        linkedIds={linkedIds}
                        canEdit={canEdit}
                        onAnnotationSelect={handleAnnotationSelect}
                        onExpandToggle={handleExpandToggle}
                        onEnsureExpanded={handleEnsureExpanded}
                        onDeleteAnnotation={handleDeleteAnnotation}
                        getBodies={getBodies}
                        getGeneratorLabel={getGeneratorLabel}
                        // Editor props
                        session={session}
                        annotations={annotations}
                        onRefreshAnnotations={onRefreshAnnotations}
                        onLinkCreated={onLinkCreated}
                        onCurrentPointSelectorChange={
                          onCurrentPointSelectorChange
                        }
                        linkingMode={linkingMode}
                        setLinkingMode={setLinkingMode}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        getEtag={getEtag}
                        canvasId={canvasId}
                        manifestId={manifestId}
                        onSaveViewport={onSaveViewport}
                        onOptimisticAnnotationAdd={onOptimisticAnnotationAdd}
                        onAnnotationInLinkingMode={onAnnotationInLinkingMode}
                        pendingGeotags={pendingGeotags}
                        setPendingGeotags={setPendingGeotags}
                        toast={toast}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Scroll to top button */}
        {showScrollToTop && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-4 right-4 w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 flex items-center justify-center z-10"
            title="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
