'use client';

import { useToast } from '@/hooks/use-toast';
import type { Annotation, AnnotationListProps } from '@/lib/types';
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
import { AnnotationEditor } from './AnnotationLinkEditor'; // Adjust path if necessary
// Import your LinkingPanel and AnnotationEditor
import { LinkingPanel } from './AnnotationLinkingPanel'; // Adjust path if necessary
// Import other shared components
import { Badge } from './Badge'; // Assuming MemoizedBadge, MemoizedButton are still used directly in AnnotationList
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

export function AnnotationList({
  annotations,
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
  totalCount,
  selectedAnnotationId = null,
  loadingProgress = 0,
  loadedAnnotations = 0,
  totalAnnotations = 0,
  getEtag: propsGetEtag,
}: AnnotationListProps) {
  const { data: session } = useSession();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null,
  );
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, string>
  >({});
  const [savingAnnotations, setSavingAnnotations] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State for LinkingPanel
  const [isLinkingPanelOpen, setIsLinkingPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // These will be used by the LinkingPanel
  const { toast } = useToast();

  const handleCloseLinkingPanel = useCallback(() => {
    setIsLinkingPanelOpen(false);
    setSelectedIds([]); // Clear selected IDs when closing
  }, []);

  // Handler for when a link is created (e.g., from the LinkingPanel)
  const onLinkCreated = useCallback(() => {
    toast({
      title: 'Link Saved!',
      description: 'Annotations linked successfully.',
    });
    // You might want to trigger a refresh of annotations here if links aren't immediately reflected
    // e.g., onRefreshAnnotations?.();
    setIsLinkingPanelOpen(false); // Close the linking panel
    setSelectedIds([]); // Clear selected IDs
  }, [toast]);

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

  const handleSaveLinking = useCallback(async () => {
    if (!session || selectedIds.length < 2) {
      toast({
        title: 'Linking Error',
        description: 'Please select at least two annotations to link.',
      });
      return;
    }

    try {
      const firstAnnotationId = selectedIds[0]; // Or some other logic for the "primary" annotation
      const linkingAnnos = linkingAnnotationsMap.get(firstAnnotationId) || [];
      const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;
      const getEtag = propsGetEtag || ((id: string) => undefined);

      const annotationData = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selectedIds, // The array of linked annotation IDs
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
      onLinkCreated(); // Call the local callback on success
      // You might also want to trigger onAnnotationUpdate for the saved linking annotation here
      // onAnnotationUpdate?.(savedAnnotation);
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
    propsGetEtag,
    onLinkCreated,
    toast,
  ]);

  const getBodies = useCallback((annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  }, []);

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
          setEditingAnnotationId(selectedAnnotationId);
          setExpanded((prev) => ({ ...prev, [selectedAnnotationId]: true }));
        } else {
          // If selected, ensure it's expanded even if not empty for editing
          setExpanded((prev) => ({ ...prev, [selectedAnnotationId]: true }));
        }
      }
    } else if (selectedAnnotationId === null) {
      // If no annotation is selected, ensure all are collapsed
      setExpanded({});
    }
  }, [selectedAnnotationId, annotations, getBodies]);

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

  const getGeneratorLabel = useCallback((body: any) => {
    const gen = body.generator;
    if (!gen) return 'Unknown';
    if (gen.id?.includes('MapTextPipeline')) return 'MapReader';
    if (gen.label?.toLowerCase().includes('loghi')) return 'Loghi';
    if (gen.label) return gen.label;
    return gen.id;
  }, []);

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

      const hasTargetAIGenerator = (
        annotation.target as any
      )?.generator?.id?.includes('segment_icons.py');

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

  const handleOptimisticUpdate = useCallback(
    (annotation: Annotation, newValue: string) => {
      setOptimisticUpdates((prev) => {
        if (prev[annotation.id] === newValue) {
          return prev;
        }
        return {
          ...prev,
          [annotation.id]: newValue,
        };
      });
    },
    [],
  );

  // This handler is crucial as it takes care of saving the updated text
  const handleAnnotationUpdate = useCallback(
    async (annotation: Annotation, newValue: string) => {
      if (!isTextAnnotation(annotation) || !canEdit || !session?.user) {
        console.warn(
          'Updates are only allowed for text annotations by authenticated users',
        );
        return;
      }

      const trimmedValue = newValue.trim();
      if (!trimmedValue || trimmedValue.length === 0) {
        toast({
          title: 'Update Failed',
          description:
            'Textspotting annotations must have a text value. Text cannot be empty.',
        });
        throw new Error(
          'Textspotting annotations must have a text value. Text cannot be empty.',
        );
      }

      const annotationName = annotation.id.split('/').pop()!;

      onAnnotationSaveStart?.(annotation);

      setSavingAnnotations((prev) => new Set(prev).add(annotation.id));

      try {
        let updatedAnnotation = { ...annotation };

        const bodies = getBodies(annotation);
        const loghiBody = getLoghiBody(annotation);

        if (loghiBody) {
          const updatedBodies = bodies.map((body) =>
            body === loghiBody ? { ...body, value: trimmedValue } : body,
          );
          updatedAnnotation.body = updatedBodies;
        } else {
          const existingTextBody = bodies.find(
            (body) => body.type === 'TextualBody' && body.value,
          );

          if (existingTextBody) {
            const updatedBodies = bodies.map((body) =>
              body === existingTextBody
                ? { ...body, value: trimmedValue }
                : body,
            );
            updatedAnnotation.body = updatedBodies;
          } else {
            const newBody = {
              type: 'TextualBody',
              value: trimmedValue,
              format: 'text/plain',
              purpose: 'supplementing',
              generator: {
                id: 'https://hdl.handle.net/10622/X2JZYY',
                type: 'Software',
                label:
                  'GLOBALISE Loghi Handwritten Text Recognition Model - August 2023',
              },
            };
            updatedAnnotation.body = Array.isArray(annotation.body)
              ? [...annotation.body, newBody]
              : [annotation.body, newBody];
          }
        }

        updatedAnnotation.motivation = 'textspotting'; // Ensure motivation is textspotting after edit

        updatedAnnotation.creator = {
          id: `https://orcid.org/${
            (session?.user as any)?.id || '0000-0000-0000-0000'
          }`,
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        };
        updatedAnnotation.modified = new Date().toISOString();

        const res = await fetch(
          `/api/annotations/${encodeURIComponent(annotationName)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedAnnotation),
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Update failed: ${res.status}`);
        }

        const result = await res.json();

        setOptimisticUpdates((prev) => {
          const { [annotation.id]: removed, ...rest } = prev;
          return rest;
        });

        onAnnotationUpdate?.(result);
        toast({
          title: 'Annotation Updated',
          description: 'Annotation text saved successfully.',
        });
      } catch (error: any) {
        console.error('Failed to update annotation:', error);
        toast({
          title: 'Update Failed',
          description:
            error.message || 'Failed to update annotation. Please try again.',
        });

        setOptimisticUpdates((prev) => {
          const { [annotation.id]: removed, ...rest } = prev;
          return rest;
        });

        throw error;
      } finally {
        setSavingAnnotations((prev) => {
          const newSet = new Set(prev);
          newSet.delete(annotation.id);
          return newSet;
        });
      }
    },
    [
      session,
      isTextAnnotation,
      canEdit,
      onAnnotationSaveStart,
      getBodies,
      getLoghiBody,
      onAnnotationUpdate,
      toast,
    ],
  );

  const handleStartEdit = useCallback(
    (annotationId: string) => {
      if (!canEdit || !session?.user) return;
      setEditingAnnotationId(annotationId);
    },
    [canEdit, session?.user],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingAnnotationId(null);
    if (editingAnnotationId) {
      setOptimisticUpdates((prev) => {
        const { [editingAnnotationId]: removed, ...rest } = prev;
        return rest;
      });
    }
  }, [editingAnnotationId]);

  const handleFinishEdit = useCallback(() => {
    setEditingAnnotationId(null);
  }, []);

  const relevantAnnotations = annotations.filter((annotation) => {
    return isTextAnnotation(annotation) || isIconAnnotation(annotation);
  });

  const filtered = relevantAnnotations.filter((annotation) => {
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

  const displayCount = totalCount ?? filtered.length;

  const humanEditedCount = annotations.filter(isHumanCreated).length;
  const humanEditedPercentage =
    annotations.length > 0
      ? Math.round((humanEditedCount / annotations.length) * 100)
      : 0;

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
            • <span className="text-primary">{humanEditedPercentage}%</span>{' '}
            human-edited
          </span>
        )}
      </div>

      <div className="overflow-auto flex-1" ref={listRef}>
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
          <div className="divide-y relative">
            {filtered.map((annotation) => {
              let bodies = getBodies(annotation);

              // Handle empty iconography bodies for display
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

              const isSelected = annotation.id === selectedAnnotationId;
              const isExpanded = !!expanded[annotation.id];
              const isCurrentlyEditing = editingAnnotationId === annotation.id;
              const isSaving = savingAnnotations.has(annotation.id);

              const handleClick = () => {
                // If another annotation is being edited, cancel that edit
                if (
                  editingAnnotationId &&
                  editingAnnotationId !== annotation.id
                ) {
                  handleCancelEdit();
                }

                // If clicking on a new annotation, select it and collapse others
                if (annotation.id !== selectedAnnotationId) {
                  onAnnotationSelect(annotation.id);
                  setExpanded({}); // Collapse all other items
                } else {
                  // If clicking on the already selected annotation, toggle its expanded state
                  setExpanded((prev) => ({
                    ...prev,
                    [annotation.id]: !prev[annotation.id],
                  }));
                }
              };

              // Props for AnnotationEditor (assuming it's a separate component)
              // This is a placeholder; you'll need to define how these specific actions
              // (onGeotagSelected, onPointSelected, onAddPoint, onAddGeoTag)
              // are handled and what data they need from AnnotationList.
              // For a true extraction, these often become props of AnnotationEditor,
              // which then might call back to AnnotationList for data updates.
              const onGeotagSelected = useCallback(
                (geoTagAnnotationId: string, geoTagValue: any) => {
                  // Logic to update a geotagging annotation
                  console.log(
                    'Geotag selected for:',
                    geoTagAnnotationId,
                    geoTagValue,
                  );
                },
                [],
              );
              const onPointSelected = useCallback(
                (pointAnnotationId: string, pointCoords: any) => {
                  // Logic to update a point annotation
                  console.log(
                    'Point selected for:',
                    pointAnnotationId,
                    pointCoords,
                  );
                },
                [],
              );
              const onAddPoint = useCallback((annotationId: string) => {
                console.log('Add point for:', annotationId);
                // Logic to initiate adding a point selector
              }, []);
              const onAddGeoTag = useCallback((annotationId: string) => {
                console.log('Add geotag for:', annotationId);
                // Logic to initiate adding a geotag widget
              }, []);
              const memoizedInitialGeotag = useMemo(() => {
                return annotation.motivation === 'geotagging' &&
                  annotation.target?.selector?.type === 'FragmentSelector' &&
                  (annotation.target.selector.value as string)?.startsWith(
                    'geo:',
                  )
                  ? annotation.target.selector.value
                  : null;
              }, [annotation]);

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                  className={`p-4 flex items-start justify-between border-l-2 transition-all duration-150 cursor-pointer relative ${
                    isCurrentlyEditing
                      ? 'bg-blue-50 border-l-blue-500 shadow-md ring-1 ring-blue-200 transform scale-[1.01]'
                      : isSelected
                      ? 'bg-primary/5 border-l-primary shadow-sm'
                      : 'border-l-transparent hover:bg-muted/30 hover:border-l-muted-foreground/20 hover:shadow-sm'
                  } ${isSaving ? 'opacity-75' : ''}`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1">
                    {isTextAnnotation(annotation) ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Type className="h-4 w-4 text-primary" />
                          {annotation.creator && (
                            <div
                              title="Modified by human"
                              className="flex items-center"
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {(() => {
                          const loghiBody = getLoghiBody(annotation);
                          const fallbackBody =
                            loghiBody ||
                            getBodies(annotation).find(
                              (body) =>
                                body.value && body.value.trim().length > 0,
                            );
                          const originalValue = fallbackBody?.value || '';
                          const displayValue =
                            optimisticUpdates[annotation.id] ?? originalValue;

                          return (
                            <EditableAnnotationText
                              annotation={annotation}
                              value={displayValue}
                              placeholder={
                                displayValue
                                  ? 'Click to edit text...'
                                  : 'No text recognized - click to add...'
                              }
                              canEdit={canEdit}
                              onUpdate={handleAnnotationUpdate} // Passes this list's update handler
                              onOptimisticUpdate={handleOptimisticUpdate}
                              className="flex-1"
                              isEditing={editingAnnotationId === annotation.id}
                              onStartEdit={() => handleStartEdit(annotation.id)}
                              onCancelEdit={handleCancelEdit}
                              onFinishEdit={handleFinishEdit}
                            />
                          );
                        })()}
                      </div>
                    ) : annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                          <Image className="h-4 w-4 text-secondary" />
                          {annotation.creator && (
                            <div
                              title="Modified by human"
                              className="flex items-center"
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">
                            Iconography annotation
                          </span>
                          {bodies.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {bodies.map((body, idx) => {
                                const label = getGeneratorLabel(body);
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1"
                                  >
                                    <span className="font-medium">{label}</span>
                                    {body.value && <span>: {body.value}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1">
                          <span className="text-xs">?</span>
                        </div>
                        <div className="flex-1 text-sm text-muted-foreground">
                          Unknown annotation type
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-4 bg-muted/30 p-4 rounded-lg text-xs space-y-3 border border-border/50">
                        <div className="grid gap-2">
                          <div>
                            <span className="font-medium text-primary">
                              ID:
                            </span>{' '}
                            <span className="font-mono text-muted-foreground">
                              {annotation.id.split('/').pop()}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">
                              Target source:
                            </span>{' '}
                            <span className="break-all text-muted-foreground">
                              {annotation.target.source}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">
                              Selector type:
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {annotation.target.selector.type}
                            </span>
                          </div>
                          {annotation.creator && (
                            <div>
                              <span className="font-medium text-primary">
                                Modified by:
                              </span>{' '}
                              <span className="text-muted-foreground">
                                {annotation.creator.label}
                              </span>
                            </div>
                          )}
                          {annotation.modified && (
                            <div>
                              <span className="font-medium text-primary">
                                Modified:
                              </span>{' '}
                              <span className="text-muted-foreground">
                                {new Date(annotation.modified).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Only render AnnotationEditor if it's the selected/expanded annotation AND editable */}
                          {canEdit &&
                            isSelected && ( // Make sure AnnotationEditor only appears for the selected/expanded annotation
                              <AnnotationEditor
                                annotation={annotation}
                                onSave={handleAnnotationUpdate} // Re-use the update handler
                                onDelete={onAnnotationPrepareDelete}
                                onCancel={handleCancelEdit} // This editor can trigger a cancel
                                isSaving={isSaving}
                                canEdit={canEdit}
                                isGeoTaggingAnnotation={
                                  annotation.motivation === 'geotagging'
                                }
                                initialGeotag={memoizedInitialGeotag}
                                onGeotagSelected={(geo) =>
                                  onGeotagSelected(annotation.id, geo)
                                } // Pass current annotation ID
                                onPointSelected={(coords) =>
                                  onPointSelected(annotation.id, coords)
                                } // Pass current annotation ID
                                onAddPoint={() => onAddPoint(annotation.id)}
                                onAddGeoTag={() => onAddGeoTag(annotation.id)}
                                session={session} // Pass the session for internal checks/creators
                              />
                            )}
                          {/* Button to open LinkingPanel for THIS annotation */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent parent div's handleClick
                              setIsLinkingPanelOpen(true);
                              setSelectedIds([annotation.id]); // Initialize with the current annotation
                            }}
                            disabled={isCurrentlyEditing || !canEdit}
                          >
                            <Link className="h-4 w-4 mr-1" />
                            Link
                          </Button>
                          {/* Delete Button (moved inside expanded section) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnnotationPrepareDelete(annotation);
                            }}
                            disabled={
                              isSaving || isCurrentlyEditing || !canEdit
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                        {/* Conditional rendering for the LinkingPanel (as a child of the expanded item) */}
                        {isLinkingPanelOpen &&
                          selectedIds.includes(annotation.id) && (
                            <LinkingPanel
                              annotations={annotations} // Pass the full list for multi-selection
                              currentAnnotation={annotation} // Pass the specific annotation this panel is opened from
                              linkingAnnotations={
                                linkingAnnotationsMap.get(annotation.id) || []
                              }
                              onClose={handleCloseLinkingPanel}
                              onSave={handleSaveLinking}
                              selectedIds={selectedIds}
                              setSelectedIds={setSelectedIds}
                              session={session} // Pass session if LinkingPanel needs it
                            />
                          )}
                      </div>
                    )}
                  </div>

                  {/* Expand/Collapse Button (remains here) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClick} // Allow expanding/collapsing via this button too
                    className="text-muted-foreground"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
