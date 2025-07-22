// AnnotationList.tsx
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
} from 'lucide-react'; // Keep only icons used directly in AnnotationList
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
// Import your newly extracted components
import { AnnotationItem } from './AnnotationItem'; // Adjust path
import { AnnotationEditor } from './AnnotationLinkEditor'; // Make sure this is imported if AnnotationEditor is managed at List level
import { LinkingPanel } from './AnnotationLinkingPanel'; // Make sure this is imported if LinkingPanel is managed at List level
// Import other shared components
import { Badge } from './Badge';
import { Button } from './Button';
import { EditableAnnotationText } from './EditableAnnotationText'; // If still needed directly
import { Input } from './Input';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';

// ... (ITEM_HEIGHT, BUFFER_SIZE, OVERSCAN, usePerformanceMonitor, GeoTaggingWidget, PointSelector, useVirtualScrolling remain the same)

export function AnnotationList({
  annotations,
  onAnnotationSelect,
  onAnnotationPrepareDelete,
  onAnnotationUpdate, // This will now be primarily handled by AnnotationEditor/Item
  onAnnotationSaveStart, // This will now be primarily handled by AnnotationEditor/Item
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

  // Linking panel state and handlers will be here, as they often interact with multiple items or the list itself
  const [isLinkingPanelOpen, setIsLinkingPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleCloseLinkingPanel = useCallback(() => {
    setIsLinkingPanelOpen(false);
    setSelectedIds([]); // Clear selection when closing
  }, []);
  const { toast } = useToast();

  // This `onLinkCreated` might be a prop if it needs to trigger a refresh in the parent of AnnotationList
  // For now, let's assume it just closes the panel and shows a toast.
  const onLinkCreated = useCallback(() => {
    toast({
      title: 'Link Saved!',
      description: 'Annotations linked successfully.',
    });
    setIsLinkingPanelOpen(false);
    setSelectedIds([]);
    // You might want to trigger a data refetch here if your links are not immediately updated in the 'annotations' prop
  }, [toast]);

  const linkingAnnotationsMap = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    annotations.forEach((a) => {
      if (a.motivation === 'linking' && Array.isArray(a.target)) {
        a.target.forEach((targetId: string) => {
          if (typeof targetId === 'string') {
            // Ensure targetId is string
            if (!map.has(targetId)) {
              map.set(targetId, []);
            }
            map.get(targetId)!.push(a);
          }
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
      const firstAnnotationId = selectedIds[0];
      const linkingAnnos = linkingAnnotationsMap.get(firstAnnotationId) || [];
      const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;
      const getEtag = propsGetEtag || ((id: string) => undefined);

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

      onLinkCreated(); // Use the local useCallback version
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
    onLinkCreated, // This now points to the local useCallback
    toast,
  ]);

  // Helper functions (keep these in AnnotationList as they filter/process the main 'annotations' prop)
  const getBodies = useCallback((annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  }, []); // Memoize for useCallback functions

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
          // If text is not empty, ensure it's expanded if selected
          setExpanded((prev) => ({ ...prev, [selectedAnnotationId]: true }));
        }
      }
    } else if (selectedAnnotationId === null) {
      // If no annotation is selected, collapse all
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
    if (gen.id?.includes('MapTextPipeline')) return 'MapReader'; // Check for `id` before `label` for consistency
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

      onAnnotationSaveStart?.(annotation); // Trigger prop if it exists

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

        onAnnotationUpdate?.(result); // Trigger prop if it exists
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

  // --- Filtering logic (remains in AnnotationList as it depends on all annotations) ---
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

  // --- Render part of AnnotationList ---
  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Filters</div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            {/* Filter checkboxes remain here */}
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
              // Compute required props for AnnotationItem
              const capabilities = {}; // Replace with actual logic if needed
              const title = getAnnotationText(annotation);
              const preview = getAnnotationText(annotation);
              const linkedIds = Array.isArray(annotation.target)
                ? annotation.target
                : [];
              // Add other required props as needed, using defaults or computed values

              return (
                <AnnotationItem
                  key={annotation.id}
                  annotation={annotation}
                  isSelected={annotation.id === selectedAnnotationId}
                  isExpanded={!!expanded[annotation.id]}
                  capabilities={capabilities}
                  title={title}
                  preview={preview}
                  geotag={annotation.geotag ?? null}
                  linkedIds={linkedIds}
                  canEdit={canEdit}
                  getBodies={getBodies}
                  getGeneratorLabel={getGeneratorLabel}
                  onAnnotationSelect={(id) => {
                    if (id !== selectedAnnotationId) {
                      onAnnotationSelect(id);
                      setExpanded({}); // Collapse others
                    } else {
                      setExpanded((prev) => ({
                        ...prev,
                        [id]: !prev[id], // Toggle current item
                      }));
                    }
                  }}
                  onExpandToggle={(id) => {
                    setExpanded((prev) => ({
                      ...prev,
                      [id]: !prev[id],
                    }));
                  }}
                  onEnsureExpanded={(id) => {
                    setExpanded((prev) => ({
                      ...prev,
                      [id]: true,
                    }));
                  }}
                  onDeleteAnnotation={onAnnotationPrepareDelete}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onFinishEdit={handleFinishEdit}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  editingAnnotationId={editingAnnotationId}
                  optimisticUpdates={optimisticUpdates}
                  savingAnnotations={savingAnnotations}
                  setSelectedIds={setSelectedIds}
                  toast={toast}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* LinkingPanel rendered as a full-screen overlay or modal, managed by AnnotationList */}
      {isLinkingPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <LinkingPanel
            isOpen={isLinkingPanelOpen}
            annotations={annotations}
            onClose={handleCloseLinkingPanel}
            onSave={handleSaveLinking}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            currentAnnotationId={selectedAnnotationId}
            isSaving={false}
            session={session}
          />
        </div>
      )}
    </div>
  );
}
