'use client';

import { useLinkingAnnotations } from '@/hooks/use-linking-annotations';
import type { Annotation, LinkingAnnotation } from '@/lib/types';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Image,
  Link,
  MapPin,
  Plus,
  Search,
  Share2,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditableAnnotationText } from './EditableAnnotationText';
import { Input } from './Input';
import { LinkingAnnotationWidget } from './LinkingAnnotationWidget';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';

const EnhancementIndicators = React.memo(function EnhancementIndicators({
  annotation,
  linkedAnnotationsOrder,
  isAnnotationLinkedDebug,
  hasGeotagData,
  hasPointSelection,
}: {
  annotation: Annotation;
  linkedAnnotationsOrder: string[];
  isAnnotationLinkedDebug: (id: string) => boolean;
  hasGeotagData: (id: string) => boolean;
  hasPointSelection: (id: string) => boolean;
}) {
  const hasEnhancements = useMemo(
    () =>
      hasGeotagData(annotation.id) ||
      hasPointSelection(annotation.id) ||
      isAnnotationLinkedDebug(annotation.id),
    [annotation.id, hasGeotagData, hasPointSelection, isAnnotationLinkedDebug],
  );

  const isInOrder = useMemo(
    () => linkedAnnotationsOrder?.includes(annotation.id),
    [linkedAnnotationsOrder, annotation.id],
  );

  const orderPosition = useMemo(
    () =>
      isInOrder ? linkedAnnotationsOrder.indexOf(annotation.id) + 1 : null,
    [isInOrder, linkedAnnotationsOrder, annotation.id],
  );

  if (!hasEnhancements && !isInOrder) return null;

  const isText =
    annotation.motivation === 'textspotting' ||
    (annotation.body &&
      Array.isArray(annotation.body) &&
      annotation.body.some((b: any) => b.type === 'TextualBody'));
  const isIcon =
    annotation.motivation === 'iconography' ||
    annotation.motivation === 'iconograpy';
  const isHuman = !!annotation.creator;

  return (
    <div className="flex items-center gap-1.5">
      {isInOrder && (
        <div
          className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium border border-primary/30"
          title={`Position ${orderPosition} in reading order`}
        >
          {orderPosition}
        </div>
      )}

      <div
        className="flex items-center gap-1"
        title="Annotation type and enhancements"
      >
        {isAnnotationLinkedDebug(annotation.id) && (
          <div title="Linked to other annotations">
            <Share2 className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        {hasGeotagData(annotation.id) && (
          <div title="Has geographic location">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
          </div>
        )}
        {hasPointSelection(annotation.id) && (
          <div title="Has point selection">
            <Plus className="h-3.5 w-3.5 text-accent" />
          </div>
        )}
      </div>
    </div>
  );
});

interface AnnotationListProps {
  annotations: Annotation[];
  onAnnotationSelect: (id: string) => void;
  onAnnotationPrepareDelete?: (id: string) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationSaveStart?: (id: string) => void;
  canEdit: boolean;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  onFilterChange: (
    filterType: 'ai-text' | 'ai-icons' | 'human-text' | 'human-icons',
  ) => void;
  isLoading?: boolean;
  totalCount?: number;
  selectedAnnotationId?: string | null;
  loadingProgress?: number;
  loadedAnnotations?: number;
  totalAnnotations?: number;
  canvasId?: string;
  onEnablePointSelection?: (
    handler: (point: { x: number; y: number }) => void,
  ) => void;
  onDisablePointSelection?: () => void;
  onPointChange?: (point: { x: number; y: number } | null) => void;
  onAddToLinkingOrder?: (annotationId: string) => void;
  onRemoveFromLinkingOrder?: (annotationId: string) => void;
  onClearLinkingOrder?: () => void;
  linkedAnnotationsOrder?: string[];
  isLinkingMode?: boolean;
  selectedAnnotationsForLinking?: string[];
  onEnableLinkingMode?: () => void;
  onDisableLinkingMode?: () => void;
  selectedPointLinkingId?: string | null;
  onRefreshAnnotations?: () => void;
  isPointSelectionMode?: boolean;
}

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
  canvasId = '',
  onEnablePointSelection,
  onDisablePointSelection,
  onPointChange,
  onAddToLinkingOrder,
  onRemoveFromLinkingOrder,
  onClearLinkingOrder,
  linkedAnnotationsOrder = [],
  isLinkingMode = false,
  selectedAnnotationsForLinking = [],
  onEnableLinkingMode,
  onDisableLinkingMode,
  selectedPointLinkingId = null,
  onRefreshAnnotations,
  isPointSelectionMode = false,
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
  const [linkingExpanded, setLinkingExpanded] = useState<
    Record<string, boolean>
  >({});

  const {
    linkingAnnotations,
    createLinkingAnnotation,
    updateLinkingAnnotation,
    deleteLinkingAnnotation,
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch: refetchLinkingAnnotations,
  } = useLinkingAnnotations(canvasId);

  useEffect(() => {
    if (linkingAnnotations && linkingAnnotations.length > 0) {
      linkingAnnotations.forEach((linkingAnno, index) => {});
    }
  }, [linkingAnnotations, canvasId]);

  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId]?.scrollIntoView({
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
        }
      }
    }
  }, [selectedAnnotationId, annotations]);

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

  const getBodies = (annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  };

  const getLoghiBody = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    return bodies.find(
      (body) =>
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('loghi'),
    );
  };

  const getAnnotationText = useCallback((annotation: Annotation) => {
    const bodies = getBodies(annotation);
    const loghiBody = getLoghiBody(annotation);
    const fallbackBody =
      loghiBody ||
      bodies.find((body) => body.value && body.value.trim().length > 0);
    return fallbackBody?.value || '';
  }, []);

  const getAnnotationTextById = (annotationId: string): string => {
    const annotation = annotations.find((a) => {
      const shortId = a.id.split('/').pop();
      return shortId === annotationId;
    });
    if (!annotation) return annotationId;

    if (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    ) {
      return '(Icon)';
    }

    const text = getAnnotationText(annotation);
    return text || '(Empty)';
  };

  const getGeneratorLabel = (body: any) => {
    const gen = body.generator;
    if (!gen) return 'Unknown';
    if (gen.id.includes('MapTextPipeline')) return 'MapReader';
    if (gen.label?.toLowerCase().includes('loghi')) return 'Loghi';
    if (gen.label) return gen.label;
    return gen.id;
  };

  const isAIGenerated = (annotation: Annotation) => {
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
  };

  const isHumanCreated = (annotation: Annotation) => {
    return !!annotation.creator;
  };

  const isTextAnnotation = (annotation: Annotation) => {
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
  };

  const getLinkingDetails = (annotationId: string) => {
    const linkingAnnotation = getLinkingAnnotationForTarget(annotationId);
    if (!linkingAnnotation) return null;

    const details: {
      linkedAnnotations: string[];
      linkedAnnotationTexts: string[];
      readingOrder: string[];
      currentAnnotationText: string;
      geotagging?: {
        name: string;
        type: string;
        coordinates?: [number, number];
        description?: string;
        body?: any;
      };
      pointSelection?: {
        x?: number;
        y?: number;
        purpose: string;
      };
      otherPurposes: string[];
    } = {
      linkedAnnotations: [],
      linkedAnnotationTexts: [],
      readingOrder: [],
      currentAnnotationText: '',
      otherPurposes: [],
    };

    const targets = Array.isArray(linkingAnnotation.target)
      ? linkingAnnotation.target
      : [linkingAnnotation.target];

    details.linkedAnnotations = targets
      .map((target) =>
        typeof target === 'string' ? target.split('/').pop() : '',
      )
      .filter((id): id is string => Boolean(id));

    details.linkedAnnotationTexts = details.linkedAnnotations.map((id) =>
      getAnnotationTextById(id),
    );

    const currentAnnotation = annotations.find((a) => a.id === annotationId);
    if (currentAnnotation) {
      if (
        currentAnnotation.motivation === 'iconography' ||
        currentAnnotation.motivation === 'iconograpy'
      ) {
        details.currentAnnotationText = '(Icon)';
      } else {
        details.currentAnnotationText =
          getAnnotationText(currentAnnotation) || '(Empty)';
      }
    }

    const allAnnotationIds = [...details.linkedAnnotations];
    const currentAnnotationId = annotationId.split('/').pop();

    if (
      currentAnnotationId &&
      !allAnnotationIds.includes(currentAnnotationId)
    ) {
      allAnnotationIds.push(currentAnnotationId);
    }

    details.readingOrder = allAnnotationIds.map((id) => {
      if (id === currentAnnotationId) {
        return details.currentAnnotationText;
      }
      return getAnnotationTextById(id);
    });

    if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
      for (const body of linkingAnnotation.body) {
        if (body.purpose === 'geotagging') {
          if (body.source) {
            const source = body.source as any;

            let extractedName = source.label || 'Unknown Location';
            let extractedType = source.type || 'Place';

            if (source.properties) {
              const props = source.properties;

              if (props.title) {
                extractedName = props.title;
              } else if (props.preferredTitle) {
                extractedName = props.preferredTitle;
              } else if (props.description) {
                const labelMatch = props.description.match(
                  /Label\(s\):\s*([^|]+)/,
                );
                if (labelMatch) {
                  const labelsPart = labelMatch[1].trim();
                  const labelItems = labelsPart
                    .split(',')
                    .map((item: string) => item.trim());
                  for (const item of labelItems) {
                    if (item.includes('(PREF)')) {
                      extractedName = item.replace('(PREF)', '').trim();
                      break;
                    }
                  }
                }
              }

              if (props.description) {
                const typeMatch =
                  props.description.match(/Type\(s\):\s*([^|]+)/);
                if (typeMatch) {
                  const typesPart = typeMatch[1].trim();
                  if (typesPart.includes('/')) {
                    const parts = typesPart
                      .split('/')
                      .map((part: string) => part.trim());
                    extractedType = parts.join(' / ');
                  } else {
                    extractedType = typesPart;
                  }
                }
              } else if (props.type) {
                extractedType = props.type;
              } else if (props.types && props.types.length > 0) {
                extractedType = props.types[0];
              }
            }

            details.geotagging = {
              name: extractedName,
              type: extractedType,
              description: source.properties?.description,
              body: body,
            };

            if (source.geometry?.coordinates) {
              details.geotagging!.coordinates = source.geometry.coordinates;
            } else if (
              source.defined_by &&
              typeof source.defined_by === 'string' &&
              source.defined_by.startsWith('POINT(')
            ) {
              const match = source.defined_by.match(/POINT\(([^)]+)\)/);
              if (match) {
                const coords = match[1].split(' ').map(Number);
                details.geotagging!.coordinates = [coords[0], coords[1]];
              }
            }
          }
        } else if (body.purpose === 'highlighting') {
          details.pointSelection = {
            purpose: 'highlighting',
          };

          if (body.selector && 'x' in body.selector && 'y' in body.selector) {
            details.pointSelection.x = body.selector.x;
            details.pointSelection.y = body.selector.y;
          }

          const bodyAny = body as any;
          if (bodyAny.value && typeof bodyAny.value === 'string') {
            try {
              const parsed = JSON.parse(bodyAny.value);
              if (parsed.x !== undefined && parsed.y !== undefined) {
                details.pointSelection.x = parsed.x;
                details.pointSelection.y = parsed.y;
              }
            } catch {
              const coordMatch = bodyAny.value.match(
                /x:\s*(\d+),?\s*y:\s*(\d+)/i,
              );
              if (coordMatch) {
                details.pointSelection.x = parseInt(coordMatch[1]);
                details.pointSelection.y = parseInt(coordMatch[2]);
              }
            }
          }
        } else if (
          body.purpose &&
          !['geotagging', 'highlighting'].includes(body.purpose)
        ) {
          details.otherPurposes.push(body.purpose);
        }
      }
    }

    return details;
  };

  const handleSaveLinkingAnnotation = async (
    currentAnnotation: Annotation,
    data: { linkedIds: string[]; geotag?: any; point?: any },
  ) => {
    const allTargetIds = Array.from(
      new Set([currentAnnotation.id, ...data.linkedIds]),
    );

    const existingLinkingAnnotation = getLinkingAnnotationForTarget(
      currentAnnotation.id,
    );

    let body: any[] = [];
    if (existingLinkingAnnotation && existingLinkingAnnotation.body) {
      body = Array.isArray(existingLinkingAnnotation.body)
        ? [...existingLinkingAnnotation.body]
        : [existingLinkingAnnotation.body];
    }

    if (data.geotag) {
      body = body.filter((b) => b.purpose !== 'geotagging');
      body.push({
        purpose: 'geotagging',
        type: 'SpecificResource',
        source: {
          id: `https://www.openstreetmap.org/?mlat=${data.geotag.lat}&mlon=${data.geotag.lon}#map=15/${data.geotag.lat}/${data.geotag.lon}`,
          type: 'Place',
          label: data.geotag.display_name,
          properties: {
            ...data.geotag,
          },
        },
      });
    }
    if (data.point) {
      body = body.filter((b) => b.purpose !== 'highlighting');
      body.push({
        purpose: 'highlighting',
        type: 'SpecificResource',
        selector: {
          type: 'PointSelector',
          x: Math.round(data.point.x),
          y: Math.round(data.point.y),
        },
      });
    }

    const linkingAnnotationPayload = {
      id: existingLinkingAnnotation
        ? existingLinkingAnnotation.id
        : `urn:uuid:${crypto.randomUUID()}`,
      type: 'Annotation',
      motivation: 'linking',
      creator: {
        id: `https://orcid.org/${
          (session?.user as any)?.id || '0000-0000-0000-0000'
        }`,
        type: 'Person',
        label: (session?.user as any)?.label || 'Unknown User',
      },
      created: existingLinkingAnnotation?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      target: allTargetIds,
      body: body,
    } as LinkingAnnotation;

    if (existingLinkingAnnotation) {
      await updateLinkingAnnotation(linkingAnnotationPayload);
    } else {
      await createLinkingAnnotation(linkingAnnotationPayload);
    }

    await refetchLinkingAnnotations();
  };

  const linkingDetailsCache = React.useMemo(() => {
    const cache: Record<string, any> = {};
    if (linkingAnnotations && linkingAnnotations.length > 0) {
      annotations.forEach((annotation) => {
        const details = getLinkingDetails(annotation.id);
        if (details) {
          cache[annotation.id] = details;
        }
      });
    }
    return cache;
  }, [linkingAnnotations, annotations, getLinkingAnnotationForTarget]);

  const hasGeotagData = useCallback(
    (annotationId: string): boolean => {
      const details = linkingDetailsCache[annotationId];
      return !!details?.geotagging;
    },
    [linkingDetailsCache],
  );

  const hasPointSelection = useCallback(
    (annotationId: string): boolean => {
      const details = linkingDetailsCache[annotationId];
      return !!details?.pointSelection;
    },
    [linkingDetailsCache],
  );

  const isAnnotationLinkedDebug = useCallback(
    (annotationId: string): boolean => {
      return !!linkingDetailsCache[annotationId];
    },
    [linkingDetailsCache],
  );

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

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

  const handleAnnotationUpdate = async (
    annotation: Annotation,
    newValue: string,
  ) => {
    if (!isTextAnnotation(annotation) || !canEdit || !session?.user) {
      console.warn(
        'Updates are only allowed for text annotations by authenticated users',
      );
      return;
    }

    const trimmedValue = newValue.trim();
    if (!trimmedValue || trimmedValue.length === 0) {
      throw new Error(
        'Textspotting annotations must have a text value. Text cannot be empty.',
      );
    }

    const annotationName = annotation.id.split('/').pop()!;

    onAnnotationSaveStart?.(annotation.id);

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
            body === existingTextBody ? { ...body, value: trimmedValue } : body,
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

      updatedAnnotation.motivation = 'textspotting';

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
    } catch (error) {
      console.error('Failed to update annotation:', error);

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
  };

  const handleStartEdit = (annotationId: string) => {
    if (!canEdit || !session?.user) return;
    setEditingAnnotationId(annotationId);
  };

  const handleCancelEdit = () => {
    setEditingAnnotationId(null);
    if (editingAnnotationId) {
      setOptimisticUpdates((prev) => {
        const { [editingAnnotationId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleFinishEdit = () => {
    setEditingAnnotationId(null);
  };

  const relevantAnnotations = annotations.filter((annotation) => {
    return isTextAnnotation(annotation) || isIconAnnotation(annotation);
  });

  const filtered = useMemo(() => {
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
    relevantAnnotations,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    searchQuery,
  ]);

  const displayCount = totalCount ?? filtered.length;
  const totalRelevantCount = relevantAnnotations.length;

  const humanEditedCount = annotations.filter(isHumanCreated).length;
  const humanEditedPercentage =
    annotations.length > 0
      ? Math.round((humanEditedCount / annotations.length) * 100)
      : 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          editingAnnotationId
        ) {
          return;
        }

        e.preventDefault();

        const currentIndex = selectedAnnotationId
          ? filtered.findIndex((a) => a.id === selectedAnnotationId)
          : -1;

        let nextIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
        }

        if (filtered[nextIndex]) {
          onAnnotationSelect?.(filtered[nextIndex].id);
        }
      }

      if ((e.key === ' ' || e.key === 'Enter') && selectedAnnotationId) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          editingAnnotationId
        ) {
          return;
        }

        e.preventDefault();
        setExpanded((prev) => ({
          ...prev,
          [selectedAnnotationId]: !prev[selectedAnnotationId],
        }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, filtered, onAnnotationSelect, editingAnnotationId]);

  const navigateToLinkedAnnotation = useCallback(
    (linkedId: string) => {
      const targetAnnotation = annotations.find((a) => {
        const shortId = a.id.split('/').pop();
        return shortId === linkedId;
      });
      if (targetAnnotation && onAnnotationSelect) {
        onAnnotationSelect(targetAnnotation.id);

        setExpanded((prev) => ({
          ...prev,
          [targetAnnotation.id]: true,
        }));

        if (itemRefs.current[targetAnnotation.id]) {
          itemRefs.current[targetAnnotation.id].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    },
    [annotations, onAnnotationSelect],
  );

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
                onChange={() => onFilterChange?.('ai-text')}
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
                onChange={() => onFilterChange?.('ai-icons')}
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
                onChange={() => onFilterChange?.('human-text')}
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
                onChange={() => onFilterChange?.('human-icons')}
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
        <div className="flex items-center justify-between">
          <div>
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
        </div>
      </div>

      {/* Point Selection Mode Indicator */}
      {isPointSelectionMode && (
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-yellow-800">
                Point Selection Mode Active
              </div>
              <div className="text-xs text-yellow-700">
                Click on the image to select a point. Annotation selection is
                temporarily disabled.
              </div>
            </div>
          </div>
        </div>
      )}

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

              const linkingAnnotation = getLinkingAnnotationForTarget(
                annotation.id,
              );
              const geotagBody = linkingAnnotation?.body.find(
                (b) => b.purpose === 'geotagging',
              );
              let nominatimResult: any = undefined;
              if (
                geotagBody &&
                geotagBody.source &&
                'properties' in geotagBody.source &&
                geotagBody.source.properties
              ) {
                nominatimResult = geotagBody.source.properties;
              }

              let initialGeotagForWidget = null;
              if (nominatimResult) {
                initialGeotagForWidget = {
                  marker: [
                    parseFloat(nominatimResult.lat),
                    parseFloat(nominatimResult.lon),
                  ] as [number, number],
                  label: nominatimResult.display_name || 'Unknown Location',
                  originalResult: nominatimResult,
                };
              }

              const isInLinkingOrder =
                linkedAnnotationsOrder?.includes(annotation.id) || false;
              const linkingOrderPosition = isInLinkingOrder
                ? linkedAnnotationsOrder.indexOf(annotation.id) + 1
                : null;

              const handleClick = useCallback(() => {
                if (isPointSelectionMode) {
                  return;
                }

                if (editingAnnotationId === annotation.id) {
                  return;
                }

                if (
                  editingAnnotationId &&
                  editingAnnotationId !== annotation.id
                ) {
                  handleCancelEdit();
                }

                // Immediate selection for faster response
                if (annotation.id !== selectedAnnotationId) {
                  onAnnotationSelect?.(annotation.id);
                  // Use direct state update for instant feedback
                  setExpanded((prev) => ({
                    ...prev,
                    [annotation.id]: true,
                  }));
                } else {
                  setExpanded((prev) => ({
                    ...prev,
                    [annotation.id]: !prev[annotation.id],
                  }));
                }
              }, [
                isPointSelectionMode,
                editingAnnotationId,
                annotation.id,
                selectedAnnotationId,
                onAnnotationSelect,
                handleCancelEdit,
              ]);

              const handleAddToLinking = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onAddToLinkingOrder) {
                  onAddToLinkingOrder(annotation.id);
                }
              };

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                  className={`p-4 border-l-2 transition-all duration-200 relative group ${
                    isCurrentlyEditing
                      ? 'bg-accent/10 border-l-accent shadow-md ring-1 ring-accent/30 transform scale-[1.01] cursor-default'
                      : isPointSelectionMode
                      ? 'cursor-crosshair'
                      : 'cursor-pointer'
                  } ${
                    isSelected
                      ? isExpanded
                        ? 'bg-accent/8 border-l-accent shadow-md'
                        : 'bg-accent/5 border-l-accent shadow-sm'
                      : isInLinkingOrder
                      ? 'bg-secondary/10 border-l-secondary/50 shadow-sm hover:bg-secondary/15 hover:shadow-md'
                      : 'border-l-transparent hover:bg-muted/50 hover:border-l-muted-foreground/30 hover:shadow-sm'
                  } ${isSaving ? 'opacity-75' : ''}`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  {/* Main content row - icons and text on same line */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 pr-4">
                      {isTextAnnotation(annotation) ? (
                        <>
                          {/* Icons */}
                          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
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
                          {/* Text content on same line */}
                          <div className="flex-1 min-w-0">
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
                                optimisticUpdates[annotation.id] ??
                                originalValue;

                              return (
                                <EditableAnnotationText
                                  annotation={annotation}
                                  value={displayValue}
                                  placeholder={
                                    displayValue
                                      ? 'Click to edit text...'
                                      : 'No text recognized - click to add...'
                                  }
                                  canEdit={canEdit ?? false}
                                  onUpdate={handleAnnotationUpdate}
                                  onOptimisticUpdate={handleOptimisticUpdate}
                                  className="text-sm leading-relaxed"
                                  isEditing={
                                    editingAnnotationId === annotation.id
                                  }
                                  onStartEdit={() =>
                                    handleStartEdit(annotation.id)
                                  }
                                  onCancelEdit={handleCancelEdit}
                                  onFinishEdit={handleFinishEdit}
                                />
                              );
                            })()}
                          </div>
                        </>
                      ) : annotation.motivation === 'iconography' ||
                        annotation.motivation === 'iconograpy' ? (
                        <>
                          {/* Icon annotation indicator */}
                          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                            <Image className="h-4 w-4 text-primary" />
                            {annotation.creator && (
                              <div
                                title="Modified by human"
                                className="flex items-center"
                              >
                                <User className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          {/* Iconography content */}
                          <div className="flex-1">
                            <span className="text-sm text-muted-foreground">
                              Iconography annotation
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">
                            Unknown annotation type
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <EnhancementIndicators
                        annotation={annotation}
                        linkedAnnotationsOrder={linkedAnnotationsOrder}
                        isAnnotationLinkedDebug={isAnnotationLinkedDebug}
                        hasGeotagData={hasGeotagData}
                        hasPointSelection={hasPointSelection}
                      />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnnotationPrepareDelete?.(annotation.id);
                          }}
                          disabled={!canEdit}
                          className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Expansion indicator */}
                        <div
                          className="flex items-center"
                          title={
                            isSelected
                              ? isExpanded
                                ? 'Click to collapse details'
                                : 'Click to expand details'
                              : 'Click to select and view details'
                          }
                        >
                          {isSelected ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            )
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full-width expanded information section */}
                  {isExpanded && (
                    <div className="mt-4 bg-accent/5 p-4 rounded-lg text-xs space-y-3 border border-accent/20 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid gap-2">
                        <div>
                          <span className="font-medium text-primary">ID:</span>{' '}
                          <span className="font-mono text-muted-foreground">
                            {annotation.id.split('/').pop()}
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

                      {/* Enhanced Linking Information Section */}
                      {linkingDetailsCache[annotation.id] && (
                        <div className="pt-3 border-t border-accent/30">
                          <div className="font-medium text-accent mb-2 flex items-center gap-1">
                            <Link className="h-3 w-3" />
                            Linking Information
                          </div>

                          {linkingDetailsCache[annotation.id] && (
                            <div className="mb-3">
                              <div className="flex items-center gap-1 mb-2">
                                <Share2 className="h-3 w-3 text-primary" />
                                <span className="font-medium text-primary text-xs">
                                  Reading Order
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {linkingDetailsCache[
                                  annotation.id
                                ].readingOrder.map(
                                  (text: string, index: number) => {
                                    const isCurrentAnnotation =
                                      text ===
                                      linkingDetailsCache[annotation.id]
                                        .currentAnnotationText;
                                    const currentShortId = annotation.id
                                      .split('/')
                                      .pop();
                                    let targetId: string | undefined;

                                    if (isCurrentAnnotation) {
                                      targetId = currentShortId;
                                    } else {
                                      const targetAnnotation = annotations.find(
                                        (a) => {
                                          const aText =
                                            a.motivation === 'iconography' ||
                                            a.motivation === 'iconograpy'
                                              ? '(Icon)'
                                              : getAnnotationText(a) ||
                                                '(Empty)';
                                          return (
                                            aText === text &&
                                            a.id.split('/').pop() !==
                                              currentShortId
                                          );
                                        },
                                      );
                                      targetId = targetAnnotation?.id
                                        .split('/')
                                        .pop();
                                    }

                                    return (
                                      <span
                                        key={index}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                          isCurrentAnnotation
                                            ? 'bg-primary/15 text-primary border border-primary/30 ring-1 ring-primary/20'
                                            : 'bg-secondary/20 text-secondary-foreground border border-secondary/40 cursor-pointer hover:bg-secondary/30 hover:border-secondary/60 hover:shadow-sm'
                                        }`}
                                        onClick={
                                          isCurrentAnnotation
                                            ? undefined
                                            : (e) => {
                                                e.stopPropagation();
                                                if (targetId) {
                                                  navigateToLinkedAnnotation(
                                                    targetId,
                                                  );
                                                }
                                              }
                                        }
                                        title={
                                          isCurrentAnnotation
                                            ? 'Current annotation'
                                            : 'Click to navigate to this annotation'
                                        }
                                      >
                                        <span
                                          className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                                            isCurrentAnnotation
                                              ? 'bg-primary/20 text-primary'
                                              : 'bg-secondary/40 text-secondary-foreground'
                                          }`}
                                        >
                                          {index + 1}
                                        </span>
                                        <span className="truncate max-w-[120px]">
                                          {text}
                                        </span>
                                      </span>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid gap-3">
                            {linkingDetailsCache[annotation.id].geotagging && (
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <MapPin className="h-3 w-3 text-secondary" />
                                  <span className="font-medium text-primary text-xs">
                                    Geographic Location
                                  </span>
                                </div>
                                <div className="ml-4 space-y-1 text-xs">
                                  <div>
                                    <span className="font-medium">Name:</span>{' '}
                                    <span className="text-muted-foreground">
                                      {
                                        linkingDetailsCache[annotation.id]
                                          .geotagging.name
                                      }
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Type:</span>{' '}
                                    <span className="text-muted-foreground">
                                      {
                                        linkingDetailsCache[annotation.id]
                                          .geotagging.type
                                      }
                                    </span>
                                  </div>
                                  {linkingDetailsCache[annotation.id].geotagging
                                    .coordinates && (
                                    <div>
                                      <span className="font-medium">
                                        Coordinates:
                                      </span>{' '}
                                      <span className="text-muted-foreground font-mono">
                                        {linkingDetailsCache[
                                          annotation.id
                                        ].geotagging.coordinates[1].toFixed(6)}
                                        ,{' '}
                                        {linkingDetailsCache[
                                          annotation.id
                                        ].geotagging.coordinates[0].toFixed(6)}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        (lat, lon)
                                      </span>
                                    </div>
                                  )}
                                  {linkingDetailsCache[annotation.id].geotagging
                                    .description && (
                                    <div>
                                      <span className="font-medium">
                                        Description:
                                      </span>{' '}
                                      <span className="text-muted-foreground">
                                        {
                                          linkingDetailsCache[annotation.id]
                                            .geotagging.description
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {(() => {
                                    const source =
                                      linkingDetailsCache[annotation.id]
                                        .geotagging.body?.source;
                                    if (!source?.properties) return null;

                                    const props = source.properties;

                                    const isGlobaliseData =
                                      props.preferredTitle ||
                                      props.alternativeNames ||
                                      props.types;

                                    if (isGlobaliseData) {
                                      return (
                                        <>
                                          {props.alternativeNames &&
                                            props.alternativeNames.length >
                                              0 && (
                                              <div>
                                                <span className="font-medium">
                                                  Alternative Names:
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                  {props.alternativeNames.join(
                                                    ', ',
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          {props.types &&
                                            props.types.length > 0 && (
                                              <div>
                                                <span className="font-medium">
                                                  Historical Types:
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                  {props.types.join(', ')}
                                                </span>
                                              </div>
                                            )}
                                          {props.preferredTitle &&
                                            props.preferredTitle !==
                                              linkingDetailsCache[annotation.id]
                                                .geotagging.name && (
                                              <div>
                                                <span className="font-medium">
                                                  Preferred Name:
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                  {props.preferredTitle}
                                                </span>
                                              </div>
                                            )}
                                          {props.originalDescription && (
                                            <div>
                                              <span className="font-medium">
                                                Source Data:
                                              </span>{' '}
                                              <span className="text-muted-foreground text-xs">
                                                {props.originalDescription}
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    } else {
                                      return (
                                        <>
                                          {props.class && (
                                            <div>
                                              <span className="font-medium">
                                                Category:
                                              </span>{' '}
                                              <span className="text-muted-foreground">
                                                {props.class}{' '}
                                                {props.type &&
                                                  `(${props.type})`}
                                              </span>
                                            </div>
                                          )}
                                          {props.addresstype && (
                                            <div>
                                              <span className="font-medium">
                                                Address Type:
                                              </span>{' '}
                                              <span className="text-muted-foreground">
                                                {props.addresstype}
                                              </span>
                                            </div>
                                          )}
                                          {props.osm_id && (
                                            <div>
                                              <span className="font-medium">
                                                OSM ID:
                                              </span>{' '}
                                              <span className="text-muted-foreground font-mono">
                                                {props.osm_id}
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}

                            {linkingDetailsCache[annotation.id]
                              .pointSelection && (
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Plus className="h-3 w-3 text-accent" />
                                  <span className="font-medium text-primary text-xs">
                                    Point Selection
                                  </span>
                                </div>
                                <div className="ml-4 space-y-1 text-xs">
                                  <div>
                                    <span className="font-medium">
                                      Purpose:
                                    </span>{' '}
                                    <span className="text-muted-foreground">
                                      {
                                        linkingDetailsCache[annotation.id]
                                          .pointSelection.purpose
                                      }
                                    </span>
                                  </div>
                                  {linkingDetailsCache[annotation.id]
                                    .pointSelection.x !== undefined &&
                                    linkingDetailsCache[annotation.id]
                                      .pointSelection.y !== undefined && (
                                      <div>
                                        <span className="font-medium">
                                          Coordinates:
                                        </span>{' '}
                                        <span className="text-muted-foreground font-mono">
                                          x:{' '}
                                          {
                                            linkingDetailsCache[annotation.id]
                                              .pointSelection.x
                                          }
                                          , y:{' '}
                                          {
                                            linkingDetailsCache[annotation.id]
                                              .pointSelection.y
                                          }
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}

                            {linkingDetailsCache[annotation.id].otherPurposes
                              .length > 0 && (
                              <div>
                                <span className="font-medium text-primary text-xs">
                                  Other purposes:
                                </span>{' '}
                                <span className="text-muted-foreground text-xs">
                                  {linkingDetailsCache[
                                    annotation.id
                                  ].otherPurposes.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full-width linking widget when expanded */}
                  {isExpanded && (
                    <div
                      className="mt-4 pt-4 border-t border-muted-foreground/10 animate-in slide-in-from-top-1 duration-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {' '}
                      <LinkingAnnotationWidget
                        canEdit={canEdit}
                        isExpanded={!!linkingExpanded[annotation.id]}
                        onSave={(data) =>
                          handleSaveLinkingAnnotation(annotation, data)
                        }
                        onToggleExpand={() =>
                          setLinkingExpanded((prev) => ({
                            ...prev,
                            [annotation.id]: !prev[annotation.id],
                          }))
                        }
                        annotations={annotations}
                        availableAnnotations={annotations.filter(
                          (a) => a.id !== annotation.id,
                        )}
                        session={session}
                        onEnablePointSelection={onEnablePointSelection}
                        onDisablePointSelection={onDisablePointSelection}
                        onPointChange={onPointChange}
                        initialGeotag={initialGeotagForWidget || undefined}
                        initialPoint={
                          linkingDetailsCache[annotation.id]?.pointSelection
                            ? {
                                x: linkingDetailsCache[annotation.id]
                                  ?.pointSelection?.x,
                                y: linkingDetailsCache[annotation.id]
                                  ?.pointSelection?.y,
                              }
                            : null
                        }
                        alreadyLinkedIds={annotations
                          .filter(
                            (a) =>
                              a.id !== annotation.id &&
                              isAnnotationLinkedDebug(a.id),
                          )
                          .map((a) => a.id)}
                        selectedAnnotationsForLinking={
                          selectedAnnotationsForLinking
                        }
                        onEnableLinkingMode={onEnableLinkingMode}
                        onDisableLinkingMode={onDisableLinkingMode}
                        isLinkingMode={isLinkingMode}
                        selectedAnnotationId={annotation.id}
                        onRefreshAnnotations={onRefreshAnnotations}
                        canvasId={canvasId}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
