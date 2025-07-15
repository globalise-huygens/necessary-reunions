'use client';

import { useToast } from '@/hooks/use-toast';
import type { Annotation } from '@/lib/types';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe,
  GlobeLock,
  Image,
  Link,
  Link2,
  MapPin,
  Plus,
  Search,
  Target,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import React, {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AnnotationLinker } from './AnnotationLinker';
import { Badge } from './Badge';
import { Button } from './Button';
import { EditableAnnotationText } from './EditableAnnotationText';
import { Input } from './Input';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';

const ITEM_HEIGHT = 100;
const BUFFER_SIZE = 5;
const OVERSCAN = 3;

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
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationSaveStart?: (annotation: Annotation) => void;
  canEdit: boolean;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  onFilterChange: (
    filterType: 'ai-text' | 'ai-icons' | 'human-text' | 'human-icons',
  ) => void;
  isLoading?: boolean;
  isBackgroundLoading?: boolean;
  hasMore?: boolean;
  onLoadAll?: () => void;
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

const GeoTaggingWidget = dynamic(
  () => import('./GeoTaggingWidget').then((mod) => mod.GeoTaggingWidget),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-center">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground mt-2">Loading map...</p>
      </div>
    ),
  },
);

const PointSelector = dynamic(
  () => import('./PointSelector').then((mod) => mod.PointSelector),
  { ssr: false, loading: () => <LoadingSpinner /> },
);

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

const MemoizedBadge = memo(Badge);
MemoizedBadge.displayName = 'MemoizedBadge';

const MemoizedButton = memo(Button);
MemoizedButton.displayName = 'MemoizedButton';

const useVirtualScrolling = (
  items: any[],
  containerHeight: number,
  itemHeight: number = ITEM_HEIGHT,
  overscan: number = OVERSCAN,
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
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

const LinkingPanel = memo(
  ({
    isOpen,
    onClose,
    selectedIds,
    setSelectedIds,
    annotations,
    currentAnnotationId,
    onSave,
    isSaving,
    session,
  }: {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    annotations: any[];
    currentAnnotationId: string | null;
    onSave: () => void;
    isSaving: boolean;
    session: any;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="absolute inset-0 bg-background border-l border-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Link Annotations</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {selectedIds.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">
                Selected Annotations ({selectedIds.length})
              </h4>

              <div className="space-y-2">
                {selectedIds.map((id, index) => {
                  const anno = annotations.find((a) => a.id === id);
                  if (!anno) return null;

                  const isCurrent = id === currentAnnotationId;
                  const title =
                    anno.motivation === 'iconography' ||
                    anno.motivation === 'iconograpy'
                      ? 'Icon'
                      : (Array.isArray(anno.body) && anno.body[0]?.value) ||
                        'Untitled';

                  const canMoveUp = index > 0;
                  const canMoveDown = index < selectedIds.length - 1;

                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-2 p-3 rounded border ${
                        isCurrent
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{title}</div>
                        {isCurrent && (
                          <div className="text-xs text-primary">
                            Current annotation
                          </div>
                        )}
                      </div>

                      {/* Reordering controls */}
                      {selectedIds.length > 1 && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (canMoveUp) {
                                const newIds = [...selectedIds];
                                [newIds[index], newIds[index - 1]] = [
                                  newIds[index - 1],
                                  newIds[index],
                                ];
                                setSelectedIds(newIds);
                              }
                            }}
                            disabled={!canMoveUp}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (canMoveDown) {
                                const newIds = [...selectedIds];
                                [newIds[index], newIds[index + 1]] = [
                                  newIds[index + 1],
                                  newIds[index],
                                ];
                                setSelectedIds(newIds);
                              }
                            }}
                            disabled={!canMoveDown}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newIds = selectedIds.filter(
                            (selectedId) => selectedId !== id,
                          );
                          setSelectedIds(newIds);
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {selectedIds.length < 2 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                  Select at least 2 annotations to create a link
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No annotations selected</p>
              <p className="text-sm mt-1">
                Click annotations in the image viewer to start building a link
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedIds.length >= 2 ? (
                <span className="text-green-600">✓ Ready to save link</span>
              ) : (
                <span>Select at least 2 annotations</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={selectedIds.length < 2 || isSaving || !session}
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Link'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

LinkingPanel.displayName = 'LinkingPanel';

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
    onAnnotationInLinkingMode,
    onAnnotationSelect,
    onEnsureExpanded,
    pendingGeotags,
    setPendingGeotags,
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

    const [pendingGeotag, setPendingGeotag] = useState<any>(null);
    const [pendingPoint, setPendingPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (onAnnotationInLinkingMode) {
        if (activeTab === 'link') {
          onAnnotationInLinkingMode(annotation.id);

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
              setSelectedIds(linkingAnnos[0].target);
            } else {
              setSelectedIds([annotation.id]);
            }
          }
        } else {
          onAnnotationInLinkingMode(null);
          if (setSelectedIds && !isSaving) {
            setSelectedIds([]);
          }
        }
      }
    }, [activeTab, annotation.id, onAnnotationInLinkingMode, isSaving]);

    useEffect(() => {
      if (activeTab === 'link') {
      }
    }, [selectedIds, activeTab]);

    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }, []);

    const getLinkingAnnotations = (annotationId: string) => {
      return annotations.filter((a) => {
        if (a.motivation !== 'linking') return false;
        if (Array.isArray(a.target)) {
          return a.target.includes(annotationId);
        }
        return a.target === annotationId;
      });
    };

    const hasPendingChanges = (() => {
      if (activeTab === 'geotag') return !!pendingGeotag;
      if (activeTab === 'point') return !!pendingPoint;
      if (activeTab === 'link') return selectedIds && selectedIds.length > 1;
      return false;
    })();

    const hasExistingData = (() => {
      if (activeTab === 'geotag') return !!geotag;
      if (activeTab === 'point') {
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

    const memoizedInitialGeotag = useMemo(() => {
      return geotag
        ? {
            marker: [
              parseFloat(geotag.source.lat || '0'),
              parseFloat(geotag.source.lon || '0'),
            ] as [number, number],
            label: geotag.source.properties?.title || geotag.source.label || '',
            nominatimResult: geotag.source,
          }
        : undefined;
    }, [geotag]);

    const handleGeotagSelected = useCallback(
      (selectedGeotag: any) => {
        setPendingGeotag(selectedGeotag);
        setSaveError(null);

        toast({
          title: 'Location Selected',
          description:
            'Geographic location ready to save. Click "Save Changes" below.',
        });
      },
      [toast],
    );

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

        const savedAnnotation = await response.json();

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
          () => {},
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

    // Text editing functionality
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const loghiBody = getLoghiBody(annotation);
    const annotationText = getAnnotationText(annotation);
    const isTextEditable = !!loghiBody; // Only allow editing of Loghi text

    const handleUpdateAnnotationText = useCallback(
      async (annotation: Annotation, newValue: string) => {
        if (!session?.user) {
          throw new Error('You must be logged in to edit annotations');
        }

        // Update the Loghi body only
        const bodies = getBodies(annotation);
        const updatedBodies = bodies.map((body: any) => {
          if (
            body.generator?.id === 'https://loghi.nl' ||
            body.generator?.label === 'Loghi' ||
            body.purpose === 'classifying'
          ) {
            return {
              ...body,
              value: newValue,
              modified: new Date().toISOString(),
            };
          }
          return body;
        });

        const updatedAnnotation = {
          ...annotation,
          body: updatedBodies,
          modified: new Date().toISOString(),
        };

        // Save to API
        const response = await fetch(`/api/annotations/${annotation.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          body: JSON.stringify(updatedAnnotation),
        });

        if (!response.ok) {
          throw new Error(`Failed to update annotation: ${response.status}`);
        }

        // Call the update callback if provided
        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        toast({
          title: 'Text Updated',
          description: 'Annotation text has been saved successfully.',
        });
      },
      [session, onRefreshAnnotations, toast],
    );

    return (
      <div className="space-y-2">
        {/* Text editing section - only show for annotations with Loghi text */}
        {(isTextEditable || annotation.motivation === 'textspotting') && (
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">
                {annotation.motivation === 'iconography' ||
                annotation.motivation === 'iconograpy'
                  ? 'Icon Label'
                  : 'Text Content'}
              </h3>
              {isTextEditable && (
                <Badge variant="secondary" className="text-xs">
                  Loghi
                </Badge>
              )}
            </div>

            {isTextEditable ? (
              <EditableAnnotationText
                annotation={annotation}
                value={annotationText}
                placeholder={
                  annotation.motivation === 'iconography' ||
                  annotation.motivation === 'iconograpy'
                    ? 'Describe this icon...'
                    : 'Enter text content...'
                }
                multiline={annotationText.length > 50}
                canEdit={isTextEditable && !!session?.user}
                onUpdate={handleUpdateAnnotationText}
                isEditing={editingTextId === annotation.id}
                onStartEdit={() => setEditingTextId(annotation.id)}
                onCancelEdit={() => setEditingTextId(null)}
                onFinishEdit={() => setEditingTextId(null)}
                className="w-full"
              />
            ) : (
              <div className="text-sm text-muted-foreground p-2 bg-muted/20 rounded border-dashed border">
                {annotationText ||
                  (annotation.motivation === 'iconography' ||
                  annotation.motivation === 'iconograpy'
                    ? 'Icon annotation - no editable text'
                    : 'No editable text available')}
                {!isTextEditable && annotationText && (
                  <div className="text-xs text-muted-foreground mt-1">
                    • Text generated by{' '}
                    {getBodies(annotation).find(
                      (b: any) => b.type === 'TextualBody',
                    )?.generator?.label || 'AI'}{' '}
                    - not editable
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                {/* <span className="text-sm font-medium text-amber-700">
                  You have unsaved changes
                </span> */}
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
            {/* {hasPendingChanges && (
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
            )} */}
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
                setIsSaving(true);

                try {
                  if (activeTab === 'link') await handleSaveLinkingData();
                  else if (activeTab === 'geotag') await handleSaveGeotagData();
                  else if (activeTab === 'point') await handleSavePointData();
                } catch (error) {
                  console.error('Save error:', error);
                }
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
        <div
          className="p-2 bg-card border border-border rounded-lg"
          style={{ minHeight: '200px' }}
        >
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-5 h-5 text-primary flex-shrink-0" />
                <h3 className="font-medium">Link Annotations</h3>
              </div>

              {/* Link Building Section - Always visible in Link tab */}
              <div className="space-y-3 p-3 bg-secondary/10 border border-secondary/30 rounded-lg mb-4">
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
                    <div className="space-y-2">
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
              <GeoTaggingErrorBoundary>
                <Suspense
                  fallback={
                    <div className="p-4 text-center border border-border rounded-lg">
                      <LoadingSpinner />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading map widget...
                      </p>
                    </div>
                  }
                >
                  <GeoTaggingWidget
                    target={annotation.id}
                    expandedStyle={true}
                    initialGeotag={memoizedInitialGeotag}
                    onGeotagSelected={handleGeotagSelected}
                  />
                </Suspense>
              </GeoTaggingErrorBoundary>
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
          <div className="mt-2 pt-2 border-t border-border">
            <div className="max-w-full">
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

// Error boundary component for handling map widget errors
class GeoTaggingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GeoTagging widget error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center border border-destructive/20 bg-destructive/10 rounded-lg">
          <div className="text-destructive text-sm font-medium mb-2">
            Map widget failed to load
          </div>
          <div className="text-xs text-muted-foreground">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface AnnotationOperationState {
  pendingGeotags: Record<string, any>;
  pendingPoints: Record<string, { x: number; y: number }>;
  savingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  successes: Record<string, boolean>;
}

type AnnotationOperationAction =
  | { type: 'SET_PENDING_GEOTAG'; annotationId: string; geotag: any }
  | { type: 'CLEAR_PENDING_GEOTAG'; annotationId: string }
  | {
      type: 'SET_PENDING_POINT';
      annotationId: string;
      point: { x: number; y: number };
    }
  | { type: 'CLEAR_PENDING_POINT'; annotationId: string }
  | { type: 'SET_SAVING'; annotationId: string; saving: boolean }
  | { type: 'SET_ERROR'; annotationId: string; error: string | null }
  | { type: 'SET_SUCCESS'; annotationId: string; success: boolean }
  | { type: 'CLEAR_ANNOTATION_STATE'; annotationId: string }
  | { type: 'RESET_ALL' };

const annotationOperationReducer = (
  state: AnnotationOperationState,
  action: AnnotationOperationAction,
): AnnotationOperationState => {
  switch (action.type) {
    case 'SET_PENDING_GEOTAG':
      return {
        ...state,
        pendingGeotags: {
          ...state.pendingGeotags,
          [action.annotationId]: action.geotag,
        },
        errors: { ...state.errors, [action.annotationId]: null },
      };
    case 'CLEAR_PENDING_GEOTAG':
      const { [action.annotationId]: removedGeotag, ...restGeotags } =
        state.pendingGeotags;
      return { ...state, pendingGeotags: restGeotags };
    case 'SET_PENDING_POINT':
      return {
        ...state,
        pendingPoints: {
          ...state.pendingPoints,
          [action.annotationId]: action.point,
        },
        errors: { ...state.errors, [action.annotationId]: null },
      };
    case 'CLEAR_PENDING_POINT':
      const { [action.annotationId]: removedPoint, ...restPoints } =
        state.pendingPoints;
      return { ...state, pendingPoints: restPoints };
    case 'SET_SAVING':
      return {
        ...state,
        savingStates: {
          ...state.savingStates,
          [action.annotationId]: action.saving,
        },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.annotationId]: action.error },
        successes: { ...state.successes, [action.annotationId]: false },
      };
    case 'SET_SUCCESS':
      return {
        ...state,
        successes: {
          ...state.successes,
          [action.annotationId]: action.success,
        },
        errors: { ...state.errors, [action.annotationId]: null },
      };
    case 'CLEAR_ANNOTATION_STATE':
      const { [action.annotationId]: removedGeo, ...restGeo } =
        state.pendingGeotags;
      const { [action.annotationId]: removedPt, ...restPt } =
        state.pendingPoints;
      const { [action.annotationId]: removedSaving, ...restSaving } =
        state.savingStates;
      const { [action.annotationId]: removedError, ...restError } =
        state.errors;
      const { [action.annotationId]: removedSuccess, ...restSuccess } =
        state.successes;
      return {
        pendingGeotags: restGeo,
        pendingPoints: restPt,
        savingStates: restSaving,
        errors: restError,
        successes: restSuccess,
      };
    case 'RESET_ALL':
      return {
        pendingGeotags: {},
        pendingPoints: {},
        savingStates: {},
        errors: {},
        successes: {},
      };
    default:
      return state;
  }
};

class AnnotationOperationQueue {
  private queue: Map<string, () => Promise<void>> = new Map();
  private processing: Set<string> = new Set();
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();

  addOperation(key: string, operation: () => Promise<void>, debounceMs = 500) {
    // Clear existing timeout
    if (this.debounceTimeouts.has(key)) {
      clearTimeout(this.debounceTimeouts.get(key)!);
    }

    // Set new debounced timeout
    const timeout = setTimeout(() => {
      this.processOperation(key, operation);
      this.debounceTimeouts.delete(key);
    }, debounceMs);

    this.debounceTimeouts.set(key, timeout);
    this.queue.set(key, operation);
  }

  private async processOperation(key: string, operation: () => Promise<void>) {
    if (this.processing.has(key)) return;

    this.processing.add(key);
    try {
      await operation();
    } catch (error) {
      console.error(`Operation ${key} failed:`, error);
    } finally {
      this.processing.delete(key);
      this.queue.delete(key);
    }
  }

  isProcessing(key: string): boolean {
    return this.processing.has(key);
  }

  clear() {
    for (const timeout of this.debounceTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimeouts.clear();
    this.queue.clear();
    this.processing.clear();
  }
}

// Helper functions for annotation text and body handling
const getLoghiBody = (annotation: Annotation) => {
  if (!annotation.body) return null;
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];
  return bodies.find(
    (body: any) =>
      body.generator?.id === 'https://loghi.nl' ||
      body.generator?.label === 'Loghi' ||
      body.purpose === 'classifying',
  );
};

const getAnnotationText = (annotation: Annotation): string => {
  if (!annotation.body) return '';
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  // For iconography annotations, return "Icon"
  if (
    annotation.motivation === 'iconography' ||
    annotation.motivation === 'iconograpy'
  ) {
    return 'Icon';
  }

  // Find text bodies and prioritize Loghi
  const textBodies = bodies.filter((body: any) => body.type === 'TextualBody');
  const loghiBody = getLoghiBody(annotation);

  if (loghiBody && loghiBody.value) {
    return loghiBody.value;
  }

  // Fall back to first text body
  const firstTextBody = textBodies[0];
  return firstTextBody?.value || '';
};

const isAIGenerated = (annotation: Annotation): boolean => {
  if (!annotation.body) return false;
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];
  return bodies.some(
    (body: any) =>
      body.generator?.id === 'https://readcoop.eu/model/textspotting/v1' ||
      body.generator?.id === 'https://readcoop.eu/model/iconography/v1' ||
      body.generator?.label === 'MapReader' ||
      body.generator?.label === 'textspotting' ||
      body.generator?.label === 'iconography',
  );
};

const isHumanCreated = (annotation: Annotation): boolean => {
  return !isAIGenerated(annotation);
};

const isTextAnnotation = (annotation: Annotation): boolean => {
  return annotation.motivation === 'textspotting';
};

const isIconAnnotation = (annotation: Annotation): boolean => {
  return (
    annotation.motivation === 'iconography' ||
    annotation.motivation === 'iconograpy'
  );
};

const getBodies = (annotation: Annotation) => {
  if (!annotation.body) return [];
  return Array.isArray(annotation.body) ? annotation.body : [annotation.body];
};

const getGeneratorLabel = (body: any): string => {
  if (body.generator?.label) return body.generator.label;
  if (body.generator?.id) {
    if (body.generator.id.includes('textspotting')) return 'MapReader';
    if (body.generator.id.includes('iconography')) return 'MapReader';
    if (body.generator.id.includes('loghi')) return 'Loghi';
  }
  return 'Unknown';
};

export function AnnotationList({
  annotations: propsAnnotations = [],
  onAnnotationSelect,
  onAnnotationPrepareDelete,
  onAnnotationUpdate,
  onAnnotationSaveStart,
  canEdit,
  showAITextspotting,
  showAIIconography,
  showHumanTextspotting,
  showHumanIconography,
  onFilterChange,
  isLoading = false,
  isBackgroundLoading = false,
  hasMore = false,
  onLoadAll,
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
  const [isLinkingPanelOpen, setIsLinkingPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const getBodies = useCallback((annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  }, []);

  const getLoghiBody = useCallback(
    (annotation: Annotation) => {
      const bodies = getBodies(annotation);
      return bodies.find(
        (body) =>
          body.generator?.label?.toLowerCase().includes('loghi') ||
          body.generator?.id?.includes('loghi'),
      );
    },
    [getBodies],
  );

  const getAnnotationText = useCallback(
    (annotation: Annotation) => {
      const bodies = getBodies(annotation);
      const loghiBody = getLoghiBody(annotation);
      const fallbackBody =
        loghiBody ||
        bodies.find((body) => body.value && body.value.trim().length > 0);
      return fallbackBody?.value || '';
    },
    [getBodies, getLoghiBody],
  );

  const isAIGenerated = useCallback(
    (annotation: Annotation) => {
      if (annotation.creator) {
        return false;
      }

      const bodies = getBodies(annotation);
      const hasAIGenerator = bodies.some(
        (body) =>
          body.generator?.id?.includes('MapTextPipeline') ||
          body.generator?.label?.toLowerCase().includes('loghi') ||
          body.generator?.id?.includes('segment_icons.py'),
      );

      const hasTargetAIGenerator =
        annotation.target?.generator?.id?.includes('segment_icons.py');

      return hasAIGenerator || hasTargetAIGenerator;
    },
    [getBodies],
  );

  const isHumanCreated = useCallback((annotation: Annotation) => {
    return !!annotation.creator;
  }, []);

  const isTextAnnotation = useCallback(
    (annotation: Annotation) => {
      if (annotation.motivation === 'textspotting') {
        return true;
      }

      const bodies = getBodies(annotation);
      const hasTextualContent = bodies.some(
        (body) =>
          body.type === 'TextualBody' &&
          body.value &&
          body.value.trim().length > 0 &&
          body.purpose !== 'describing' &&
          !body.value.toLowerCase().includes('icon'),
      );

      return hasTextualContent;
    },
    [getBodies],
  );

  const isIconAnnotation = useCallback((annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
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
    (type: 'ai-text' | 'ai-icons' | 'human-text' | 'human-icons') => {
      onFilterChange(type);
    },
    [onFilterChange],
  );

  const handleOpenLinkingPanel = useCallback(
    (annotationId: string) => {
      setIsLinkingPanelOpen(true);
      if (setSelectedIds) {
        if (
          !selectedIds ||
          selectedIds.length === 0 ||
          !selectedIds.includes(annotationId)
        ) {
          setSelectedIds([annotationId]);
        }
      }
    },
    [selectedIds, setSelectedIds],
  );

  const handleCloseLinkingPanel = useCallback(() => {
    setIsLinkingPanelOpen(false);
  }, []);

  const handleSaveLinking = useCallback(async () => {
    if (!session || !selectedIds || selectedIds.length < 2) return;

    try {
      const firstAnnotationId = selectedIds[0];
      const linkingAnnos = linkingAnnotationsMap.get(firstAnnotationId) || [];
      const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

      const annotationData = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selectedIds,
        body: existingLink?.body || [],
        creator: {
          id: session?.user?.email || 'anonymous',
          type: 'Person',
          label: session?.user?.name || 'Anonymous User',
        },
        created: (existingLink as any)?.created || new Date().toISOString(),
        modified: new Date().toISOString(),
      };

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
            Slug: `linking-${firstAnnotationId.split('/').pop()}`,
          },
          body: JSON.stringify(annotationData),
        });
      }

      if (!response.ok) {
        throw new Error(
          `Failed to save: ${response.status} ${response.statusText}`,
        );
      }

      const savedAnnotation = await response.json();

      if (onOptimisticAnnotationAdd && savedAnnotation) {
        onOptimisticAnnotationAdd({
          ...annotationData,
          id:
            savedAnnotation.id ||
            (existingLink ? existingLink.id : `temp-${Date.now()}`),
          ...(savedAnnotation.etag && { etag: savedAnnotation.etag }),
        } as any);
      }

      toast({
        title: 'Link Saved!',
        description: 'Annotations linked successfully.',
      });

      onLinkCreated?.();
      setIsLinkingPanelOpen(false);
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save link. Please try again.',
      });
    }
  }, [
    session,
    selectedIds,
    linkingAnnotationsMap,
    getEtag,
    onOptimisticAnnotationAdd,
    toast,
    onLinkCreated,
  ]);

  const filtered = useMemo(() => {
    const relevantAnnotations = annotations.filter((annotation) => {
      return isTextAnnotation(annotation) || isIconAnnotation(annotation);
    });

    return relevantAnnotations.filter((annotation) => {
      const isAI = isAIGenerated(annotation);
      const isHuman = isHumanCreated(annotation);
      const isText = isTextAnnotation(annotation);
      const isIcon = isIconAnnotation(annotation);

      let matchesFilter = false;
      if (isAI && isText && showAITextspotting) matchesFilter = true;
      if (isAI && isIcon && showAIIconography) matchesFilter = true;
      if (isHuman && isText && showHumanTextspotting) matchesFilter = true;
      if (isHuman && isIcon && showHumanIconography) matchesFilter = true;

      if (!matchesFilter) return false;

      if (searchQuery.trim()) {
        const annotationText = getAnnotationText(annotation).toLowerCase();
        const query = searchQuery.toLowerCase().trim();

        const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
        const matchesAllWords = queryWords.every((word) =>
          annotationText.includes(word),
        );

        return matchesAllWords;
      }

      return true;
    });
  }, [
    annotations,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    searchQuery,
    isTextAnnotation,
    isIconAnnotation,
    isAIGenerated,
    isHumanCreated,
    getAnnotationText,
  ]);

  const [containerHeight, setContainerHeight] = useState(600);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { renderTime, itemsRendered, startRender, endRender } =
    usePerformanceMonitor();

  const useVirtualScrollingForRender = !expandedId && filtered.length > 20;

  const {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
    setContainerRef,
    estimatedItemHeight,
  } = useVirtualScrolling(filtered, containerHeight, ITEM_HEIGHT, OVERSCAN);

  const renderStartTime = useRef<number>(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const handleScrollWithTracking = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      setShowScrollToTop(scrollTop > 500);

      if (useVirtualScrollingForRender) {
        handleScroll(e);
      }
    },
    [handleScroll, useVirtualScrollingForRender],
  );

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, []);

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

  useEffect(() => {
    if (selectedAnnotationId && scrollContainerRef.current) {
      const selectedIndex = filtered.findIndex(
        (a) => a.id === selectedAnnotationId,
      );
      if (selectedIndex !== -1) {
        const targetScrollTop = selectedIndex * estimatedItemHeight;
        const containerHeight = scrollContainerRef.current.clientHeight;

        const currentScrollTop = scrollContainerRef.current.scrollTop;
        const isVisible =
          targetScrollTop >= currentScrollTop &&
          targetScrollTop <=
            currentScrollTop + containerHeight - estimatedItemHeight;

        if (!isVisible) {
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

  const handleExpandToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));

      setTimeout(() => {
        if (scrollContainerRef.current) {
          const selectedIndex = filtered.findIndex((a) => a.id === id);
          if (selectedIndex !== -1) {
            const targetScrollTop = selectedIndex * estimatedItemHeight;
            const containerHeight = scrollContainerRef.current.clientHeight;
            const currentScrollTop = scrollContainerRef.current.scrollTop;

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
      }, 100);
    },
    [filtered, estimatedItemHeight],
  );

  const handleEnsureExpanded = useCallback(
    (id: string) => {
      setExpandedId((prev) => {
        if (prev !== id) {
          return id;
        }
        return prev;
      });

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
      }, 100);
    },
    [filtered, estimatedItemHeight],
  );

  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      requestAnimationFrame(() => {
        itemRefs.current[selectedAnnotationId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  }, [selectedAnnotationId]);

  const displayCount = totalCount ?? filtered.length;

  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });

      const selectedAnnotation = annotations.find(
        (a) => a.id === selectedAnnotationId,
      );
      if (selectedAnnotation) {
        const bodies = getBodies(selectedAnnotation);
        const textBody = bodies.find((body) => body.type === 'TextualBody');
        if (textBody && (!textBody.value || textBody.value.trim() === '')) {
          // Ensure this annotation is expanded for editing
          setExpandedId(selectedAnnotationId);
        }
      }
    }
  }, [selectedAnnotationId, annotations]);

  // Keyboard shortcut to focus search (Ctrl/Cmd + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Filters</div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showAITextspotting}
                onChange={() => onFilterChange('ai-text')}
                className="accent-primary scale-75"
              />
              <Bot className="h-3 w-3 text-primary" />
              <Type className="h-3 w-3 text-primary" />
              <span className="text-foreground">AI Text</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showAIIconography}
                onChange={() => onFilterChange('ai-icons')}
                className="accent-primary scale-75"
              />
              <Bot className="h-3 w-3 text-primary" />
              <Image className="h-3 w-3 text-primary" />
              <span className="text-foreground">AI Icons</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showHumanTextspotting}
                onChange={() => onFilterChange('human-text')}
                className="accent-secondary scale-75"
              />
              <User className="h-3 w-3 text-secondary" />
              <Type className="h-3 w-3 text-secondary" />
              <span className="text-foreground">Human Text</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showHumanIconography}
                onChange={() => onFilterChange('human-icons')}
                className="accent-secondary scale-75"
              />
              <User className="h-3 w-3 text-secondary" />
              <Image className="h-3 w-3 text-secondary" />
              <span className="text-foreground">Human Icons</span>
            </label>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search annotations... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Showing {displayCount} annotation{displayCount !== 1 ? 's' : ''}
        {searchQuery && (
          <span className="ml-1 text-primary">for "{searchQuery}"</span>
        )}
        {annotations.length > 0 && (
          <span className="ml-1">
            •{' '}
            <span className="text-primary">
              {Math.round(
                (annotations.filter(isHumanCreated).length /
                  annotations.length) *
                  100,
              )}
              %
            </span>{' '}
            human-edited
          </span>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-auto flex-1 min-h-0 relative"
        onScroll={handleScrollWithTracking}
        style={{
          overscrollBehavior: 'contain',
          scrollBehavior: 'smooth',
        }}
      >
        {isLoading && filtered.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-40 flex items-center justify-center pointer-events-none z-10">
            <LoadingSpinner />
          </div>
        )}
        {isLoading && filtered.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-500">Loading annotations…</p>
            {totalAnnotations! > 0 && (
              <>
                <div className="w-full max-w-xs mt-4 px-4">
                  <Progress value={loadingProgress} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Loading annotations ({Math.round(loadingProgress)}%)
                </p>
              </>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? (
              <div className="space-y-2">
                <p>No annotations found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:text-primary/80 text-sm underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              'No annotations for this image'
            )}
          </div>
        ) : (
          <div
            className="relative"
            style={
              useVirtualScrollingForRender
                ? { height: totalHeight, minHeight: totalHeight }
                : { minHeight: 'auto' }
            }
          >
            <div
              className={
                useVirtualScrollingForRender
                  ? 'absolute top-0 left-0 right-0 p-2 space-y-1'
                  : 'p-2 space-y-1'
              }
              style={
                useVirtualScrollingForRender
                  ? { transform: `translateY(${offsetY}px)` }
                  : {}
              }
            >
              {(() => {
                renderStartTime.current = startRender();
                const visibleItems = useVirtualScrollingForRender
                  ? filtered.slice(visibleRange.start, visibleRange.end)
                  : filtered;

                setTimeout(() => {
                  endRender(renderStartTime.current, visibleItems.length);
                }, 0);

                return visibleItems.map((annotation, virtualIndex) => {
                  const actualIndex = useVirtualScrollingForRender
                    ? visibleRange.start + virtualIndex
                    : virtualIndex;

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

        {/* Load All button */}
        {!isLoading && hasMore && onLoadAll && (
          <div className="absolute bottom-4 left-4 z-10">
            <Button
              onClick={onLoadAll}
              disabled={isBackgroundLoading}
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
            >
              {isBackgroundLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Loading all...
                </div>
              ) : (
                `Load all annotations`
              )}
            </Button>
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

      {/* Linking Panel */}
      <LinkingPanel
        isOpen={isLinkingPanelOpen}
        onClose={handleCloseLinkingPanel}
        selectedIds={selectedIds || []}
        setSelectedIds={setSelectedIds || (() => {})}
        annotations={annotations}
        currentAnnotationId={selectedAnnotationId}
        onSave={handleSaveLinking}
        isSaving={false} // TODO: Add proper saving state
        session={session}
      />
    </div>
  );
}
