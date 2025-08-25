'use client';

import { Input } from '@/components/shared/Input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Progress } from '@/components/shared/Progress';
import { EditableAnnotationText } from '@/components/viewer/EditableAnnotationText';
import { FastAnnotationItem } from '@/components/viewer/FastAnnotationItem';
import { LinkingAnnotationWidget } from '@/components/viewer/LinkingAnnotationWidget';
import { useDebouncedExpansion } from '@/hooks/use-debounced-expansion';
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
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

let OpenSeadragon: any;

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
  onLinkedAnnotationsOrderChange?: (order: string[]) => void;
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
  onLinkedAnnotationsOrderChange,
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
    forceRefresh: forceRefreshLinking,
    invalidateCache: invalidateLinkingCache,
  } = useLinkingAnnotations(canvasId);

  useEffect(() => {
    console.log('AnnotationList useEffect - Linking state:', {
      canvasId: canvasId,
      linkingAnnotationsCount: linkingAnnotations?.length || 0,
      annotationsCount: annotations?.length || 0,
      firstLinkingAnnotation: linkingAnnotations?.[0],
      sampleAnnotationId: annotations?.[0]?.id,
      hasMatches: linkingAnnotations?.some((la) =>
        annotations?.some((a) =>
          Array.isArray(la.target)
            ? la.target.includes(a.id)
            : la.target === a.id,
        ),
      ),
    });

    if (linkingAnnotations && linkingAnnotations.length > 0) {
      console.log('Linking annotations loaded:', {
        count: linkingAnnotations.length,
        canvasId: canvasId,
        linkingTargets: linkingAnnotations.map((la) => la.target).flat(),
        currentAnnotationIds: annotations.map((a) => a.id),
      });
    } else {
      console.log('No linking annotations found for canvas:', canvasId);
    }
  }, [linkingAnnotations, canvasId, annotations]);

  useEffect(() => {
    async function loadOpenSeadragon() {
      if (!OpenSeadragon) {
        const { default: OSD } = await import('openseadragon');
        OpenSeadragon = OSD;
      }
    }
    loadOpenSeadragon();
  }, []);

  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      React.startTransition(() => {
        itemRefs.current[selectedAnnotationId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });

      setExpanded({ [selectedAnnotationId]: true });

      const selectedAnnotation = annotations.find(
        (a) => a.id === selectedAnnotationId,
      );
      if (selectedAnnotation) {
        const bodies = getBodies(selectedAnnotation);
        const textBody = bodies.find((body) => body.type === 'TextualBody');
        if (textBody && (!textBody.value || textBody.value.trim() === '')) {
          setEditingAnnotationId(selectedAnnotationId);
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

    const humanBody = bodies.find(
      (body) => !body.generator && body.value && body.value.trim().length > 0,
    );

    if (humanBody) {
      return humanBody.value;
    }

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
    if (isHumanCreated(annotation)) {
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
    if (annotation.creator) {
      return true;
    }

    const bodies = getBodies(annotation);
    return bodies.some((body) => body.creator && !body.generator);
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
        } else if (body.purpose === 'selecting') {
          details.pointSelection = {
            purpose: 'selecting',
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
          !['geotagging', 'selecting'].includes(body.purpose)
        ) {
          details.otherPurposes.push(body.purpose);
        }
      }
    }

    return details;
  };

  const handleSaveLinkingAnnotation = async (
    currentAnnotation: Annotation,
    data: {
      linkedIds: string[];
      geotag?: any;
      point?: any;
      existingLinkingId?: string | null;
    },
  ) => {
    // Emit debug event for save start
    const emitDebugEvent = (type: string, operation: string, details: any) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('linkingDebug', {
            detail: { type, operation, data: details },
          }),
        );
      }
    };

    emitDebugEvent('info', 'Save Started', {
      currentAnnotation: currentAnnotation.id,
      linkedIds: data.linkedIds,
      hasGeotag: !!data.geotag,
      hasPoint: !!data.point,
      existingLinkingId: data.existingLinkingId,
    });

    const allTargetIds = Array.from(
      new Set([currentAnnotation.id, ...data.linkedIds]),
    );

    // Use the existingLinkingId from the widget if provided, otherwise fall back to local lookup
    let existingLinkingAnnotation = null;
    if (data.existingLinkingId) {
      existingLinkingAnnotation =
        linkingAnnotations.find((la) => la.id === data.existingLinkingId) ||
        null;
    } else {
      existingLinkingAnnotation = getLinkingAnnotationForTarget(
        currentAnnotation.id,
      );
    }

    let body: any[] = [];
    if (existingLinkingAnnotation && existingLinkingAnnotation.body) {
      body = Array.isArray(existingLinkingAnnotation.body)
        ? [...existingLinkingAnnotation.body]
        : [existingLinkingAnnotation.body];
    }

    if (data.geotag) {
      body = body.filter(
        (b) => b.purpose !== 'geotagging' && b.purpose !== 'identifying',
      );

      let geotagSource;
      let identifyingSource;

      if (data.geotag.geometry && data.geotag.properties) {
        // Globalise format - create both identifying and geotagging sources
        const coordinates = data.geotag.geometry.coordinates;
        const title =
          data.geotag.properties.title ||
          data.geotag.label ||
          'Unknown Location';

        identifyingSource = {
          id:
            data.geotag.id ||
            `https://data.globalise.huygens.knaw.nl/some_unique_pid/place/${Date.now()}`,
          type: 'Place',
          label: title,
          defined_by: `POINT(${coordinates[0]} ${coordinates[1]})`,
        };

        geotagSource = {
          id:
            data.geotag.id ||
            `https://data.globalise.huygens.knaw.nl/some_unique_pid/place/${Date.now()}`,
          type: 'Feature',
          properties: {
            title: title,
            description: data.geotag.properties.description || title,
          },
          geometry: data.geotag.geometry,
        };
      } else if (data.geotag.lat && data.geotag.lon) {
        // Nominatim format - create both identifying and geotagging sources
        const title = data.geotag.display_name || 'Unknown Location';
        const lon = parseFloat(data.geotag.lon);
        const lat = parseFloat(data.geotag.lat);

        identifyingSource = {
          id: `https://nominatim.openstreetmap.org/details.php?place_id=${
            data.geotag.place_id || Date.now()
          }`,
          type: 'Place',
          label: title,
          defined_by: `POINT(${lon} ${lat})`,
        };

        geotagSource = {
          id: `https://nominatim.openstreetmap.org/details.php?place_id=${
            data.geotag.place_id || Date.now()
          }`,
          type: 'Feature',
          properties: {
            title: title,
            description: title,
          },
          geometry: {
            type: 'Point',
            coordinates: [lon, lat],
          },
        };
      } else {
        // Fallback format
        const title =
          data.geotag.label || data.geotag.display_name || 'Unknown Location';
        const coords = data.geotag.coordinates || [0, 0];

        identifyingSource = {
          id: `geo-${Date.now()}`,
          type: 'Place',
          label: title,
          defined_by: `POINT(${coords[0]} ${coords[1]})`,
        };

        geotagSource = {
          id: `geo-${Date.now()}`,
          type: 'Feature',
          properties: {
            title: title,
            description: title,
          },
          geometry: {
            type: 'Point',
            coordinates: coords,
          },
        };
      }

      body.push({
        type: 'SpecificResource',
        purpose: 'identifying',
        source: identifyingSource,
        creator: {
          id: (session?.user as any)?.id || '0000-0000-0000-0000',
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        },
        created: new Date().toISOString(),
      });

      // Add geotagging body (note: no creator field for geotagging per existing pattern)
      body.push({
        type: 'SpecificResource',
        purpose: 'geotagging',
        source: geotagSource,
      });
    }
    if (data.point) {
      body = body.filter((b) => b.purpose !== 'selecting');
      body.push({
        type: 'SpecificResource',
        purpose: 'selecting',
        source:
          canvasId ||
          'https://data.globalise.huygens.knaw.nl/manifests/maps/default/canvas/unknown',
        selector: {
          type: 'PointSelector',
          x: Math.round(data.point.x),
          y: Math.round(data.point.y),
        },
        creator: {
          id: (session?.user as any)?.id || '0000-0000-0000-0000',
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        },
        created: new Date().toISOString(),
      });
    }

    const linkingAnnotationPayload = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: existingLinkingAnnotation
        ? existingLinkingAnnotation.id
        : `urn:uuid:${crypto.randomUUID()}`,
      type: 'Annotation',
      motivation: 'linking',
      creator: {
        id: (session?.user as any)?.id || '0000-0000-0000-0000',
        type: 'Person',
        label: (session?.user as any)?.label || 'Unknown User',
      },
      created: existingLinkingAnnotation?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      target: allTargetIds,
      body: body,
    } as LinkingAnnotation;

    try {
      let savedAnnotation;
      if (existingLinkingAnnotation) {
        emitDebugEvent('info', 'Updating Existing', {
          existingId: existingLinkingAnnotation.id,
          payload: linkingAnnotationPayload,
        });
        savedAnnotation = await updateLinkingAnnotation(
          linkingAnnotationPayload,
        );
        emitDebugEvent('success', 'Update Completed', {
          savedId: savedAnnotation?.id,
          operation: 'update',
        });
      } else {
        emitDebugEvent('info', 'Creating New', {
          payload: linkingAnnotationPayload,
        });
        savedAnnotation = await createLinkingAnnotation(
          linkingAnnotationPayload,
        );
        emitDebugEvent('success', 'Creation Completed', {
          savedId: savedAnnotation?.id,
          operation: 'create',
        });
      }

      emitDebugEvent('success', 'Save Operation Complete', {
        finalResult: savedAnnotation?.id,
        targetCount: allTargetIds.length,
        hasGeotag: !!data.geotag,
        hasPoint: !!data.point,
      });
      console.groupEnd();

      if (
        data.point &&
        typeof window !== 'undefined' &&
        (window as any).osdViewer
      ) {
        const viewer = (window as any).osdViewer;
        requestAnimationFrame(() => {
          try {
            const refreshEvent = new CustomEvent('refreshPointIndicators', {
              detail: {
                annotationId: currentAnnotation.id,
                point: data.point,
              },
            });
            window.dispatchEvent(refreshEvent);

            const annotationIdShort = currentAnnotation.id.split('/').pop();
            const existingIndicator = document.getElementById(
              `point-selector-indicator-${annotationIdShort}`,
            );
            if (existingIndicator) {
              existingIndicator.remove();
            }

            const overlay = document.createElement('div');
            overlay.id = `point-selector-indicator-${annotationIdShort}`;
            overlay.style.cssText = `
              position: absolute;
              width: 12px;
              height: 12px;
              background: hsl(var(--secondary));
              border: 2px solid white;
              border-radius: 50%;
              pointer-events: none;
              z-index: 1000;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transform: translate(-50%, -50%);
            `;

            try {
              if (!OpenSeadragon) {
                console.warn('OpenSeadragon not available for point indicator');
                return;
              }

              const viewportPoint = viewer.viewport.imageToViewportCoordinates(
                new OpenSeadragon.Point(data.point.x, data.point.y),
              );

              viewer.addOverlay({
                element: overlay,
                location: viewportPoint,
              });

              const updatePosition = () => {
                try {
                  const containerPoint =
                    viewer.viewport.viewportToViewerElementCoordinates(
                      viewportPoint,
                    );
                  overlay.style.left = `${containerPoint.x}px`;
                  overlay.style.top = `${containerPoint.y}px`;
                } catch (error) {
                  console.warn(
                    'Failed to update point indicator position:',
                    error,
                  );
                }
              };

              updatePosition();

              const throttledUpdatePosition = () => {
                requestAnimationFrame(updatePosition);
              };

              viewer.addHandler('zoom', throttledUpdatePosition);
              viewer.addHandler('pan', throttledUpdatePosition);
              viewer.addHandler('resize', throttledUpdatePosition);
            } catch (error) {
              console.warn('Failed to update point indicator:', error);
            }
          } catch (error) {
            console.warn('Failed to handle point indicator refresh:', error);
          }
        });
      }

      setTimeout(() => {
        onRefreshAnnotations?.();

        invalidateLinkingCache();

        setTimeout(() => {
          forceRefreshLinking();
        }, 200);
      }, 300);
    } catch (error) {
      console.error('LINKING SAVE ERROR:', error);
      const errorDetails = {
        message: (error as Error).message,
        stack: (error as Error).stack,
        payloadId: linkingAnnotationPayload.id,
        targetCount: linkingAnnotationPayload.target?.length,
        bodyCount: linkingAnnotationPayload.body?.length,
      };

      emitDebugEvent('error', 'Save Failed', {
        error: (error as Error).message,
        errorDetails,
        operation: existingLinkingAnnotation ? 'update' : 'create',
      });
      throw error;
    }
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
  }, [linkingAnnotations, annotations]);

  const geotagDataCache = useMemo(() => {
    const cache: Record<string, any> = {};

    annotations.forEach((annotation) => {
      const linkingAnnotation = getLinkingAnnotationForTarget(annotation.id);
      const geotagBody = linkingAnnotation?.body.find(
        (b) => b.purpose === 'geotagging',
      );

      if (geotagBody?.source) {
        if ('properties' in geotagBody.source && geotagBody.source.properties) {
          const result = geotagBody.source.properties;
          if ('lat' in result && 'lon' in result && 'display_name' in result) {
            cache[annotation.id] = {
              marker: [
                parseFloat(result.lat as string),
                parseFloat(result.lon as string),
              ] as [number, number],
              label: (result.display_name as string) || 'Unknown Location',
              originalResult: result,
            };
          }
        } else if (
          'geometry' in geotagBody.source &&
          geotagBody.source.geometry?.coordinates
        ) {
          const result = geotagBody.source as any;
          if (result.geometry && result.geometry.coordinates) {
            cache[annotation.id] = {
              marker: [
                result.geometry.coordinates[1],
                result.geometry.coordinates[0],
              ] as [number, number],
              label:
                result.properties?.preferredTitle ||
                result.properties?.title ||
                'Unknown Location',
              originalResult: result,
            };
          }
        }
      }
    });

    return cache;
  }, [annotations, linkingAnnotations]);

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
      const details = linkingDetailsCache[annotationId];
      return !!(
        details?.linkedAnnotations && details.linkedAnnotations.length > 0
      );
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

      const existingHumanBody = bodies.find(
        (body) => body.type === 'TextualBody' && !body.generator,
      );

      if (existingHumanBody) {
        const updatedBodies = bodies.map((body) =>
          body === existingHumanBody
            ? {
                ...body,
                value: trimmedValue,
                creator: {
                  id: `https://orcid.org/${
                    (session?.user as any)?.id || '0000-0000-0000-0000'
                  }`,
                  type: 'Person',
                  label: (session?.user as any)?.label || 'Unknown User',
                },
                modified: new Date().toISOString(),
              }
            : body,
        );
        updatedAnnotation.body = updatedBodies;
      } else {
        const newHumanBody = {
          type: 'TextualBody',
          value: trimmedValue,
          format: 'text/plain',
          purpose: 'supplementing',
          creator: {
            id: `https://orcid.org/${
              (session?.user as any)?.id || '0000-0000-0000-0000'
            }`,
            type: 'Person',
            label: (session?.user as any)?.label || 'Unknown User',
          },
          created: new Date().toISOString(),
        };

        updatedAnnotation.body = Array.isArray(annotation.body)
          ? [...annotation.body, newHumanBody]
          : [annotation.body, newHumanBody];
      }

      updatedAnnotation.motivation = 'textspotting';
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
      console.error('Failed to update annotation text:', error);

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

  const memoizedHelpers = useMemo(
    () => ({
      isAIGenerated,
      isHumanCreated,
      isTextAnnotation,
      isIconAnnotation,
      getAnnotationText,
      hasGeotagData,
      hasPointSelection,
      isAnnotationLinkedDebug,
    }),
    [hasGeotagData, hasPointSelection, isAnnotationLinkedDebug],
  );

  const filtered = useMemo(() => {
    const startTime = performance.now();

    const result = relevantAnnotations.filter((annotation) => {
      const isAI = memoizedHelpers.isAIGenerated(annotation);
      const isHuman = memoizedHelpers.isHumanCreated(annotation);
      const isText = memoizedHelpers.isTextAnnotation(annotation);
      const isIcon = memoizedHelpers.isIconAnnotation(annotation);

      let matchesFilter = false;
      if (isAI && isText && showAITextspotting) matchesFilter = true;
      if (isAI && isIcon && showAIIconography) matchesFilter = true;
      if (isHuman && isText && showHumanTextspotting) matchesFilter = true;
      if (isHuman && isIcon && showHumanIconography) matchesFilter = true;

      if (!matchesFilter) return false;

      if (searchQuery.trim()) {
        const annotationText = memoizedHelpers
          .getAnnotationText(annotation)
          .toLowerCase();
        const query = searchQuery.toLowerCase().trim();

        const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
        const matchesAllWords = queryWords.every((word) =>
          annotationText.includes(word),
        );

        return matchesAllWords;
      }

      return true;
    });

    const endTime = performance.now();

    return result;
  }, [
    relevantAnnotations,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    searchQuery,
    memoizedHelpers,
  ]);

  const linkingWidgetProps = useMemo(() => {
    const props: Record<string, any> = {};

    Object.keys(expanded).forEach((annotationId) => {
      if (expanded[annotationId]) {
        const annotation = annotations.find((a) => a.id === annotationId);
        if (!annotation) return;

        const initialGeotagForWidget = geotagDataCache[annotationId] || null;

        props[annotationId] = {
          canEdit,
          isExpanded: !!linkingExpanded[annotationId],
          annotations,
          availableAnnotations: annotations.filter(
            (a) => a.id !== annotationId,
          ),
          session,
          onEnablePointSelection,
          onDisablePointSelection,
          onPointChange,
          initialGeotag: initialGeotagForWidget || undefined,
          initialPoint: linkingDetailsCache[annotationId]?.pointSelection
            ? {
                x: linkingDetailsCache[annotationId]?.pointSelection?.x,
                y: linkingDetailsCache[annotationId]?.pointSelection?.y,
              }
            : null,
          alreadyLinkedIds: annotations
            .filter(
              (a) => a.id !== annotationId && isAnnotationLinkedDebug(a.id),
            )
            .map((a) => a.id),
          selectedAnnotationsForLinking,
          onEnableLinkingMode,
          onDisableLinkingMode,
          isLinkingMode,
          selectedAnnotationId: annotationId,
          onRefreshAnnotations,
          canvasId,
          onLinkedAnnotationsOrderChange,
        };
      }
    });

    return props;
  }, [
    expanded,
    canEdit,
    linkingExpanded,
    annotations.length,
    session,
    geotagDataCache,
    linkingDetailsCache,
    selectedAnnotationsForLinking,
    isLinkingMode,
    canvasId,
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

        setExpanded({ [targetAnnotation.id]: true });

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

  const highlightLinkedAnnotations = useCallback(
    (selectedAnnotationId: string) => {
      const details = linkingDetailsCache[selectedAnnotationId];
      if (details?.linkedAnnotations) {
        const linkedIds = details.linkedAnnotations
          .map((shortId: string) => {
            const fullAnnotation = annotations.find((a) => {
              const annotationShortId = a.id.split('/').pop();
              return annotationShortId === shortId;
            });
            return fullAnnotation?.id;
          })
          .filter(Boolean);

        const allConnectedIds = [selectedAnnotationId, ...linkedIds];
        onLinkedAnnotationsOrderChange?.(allConnectedIds);
      }
    },
    [linkingDetailsCache, annotations, onLinkedAnnotationsOrderChange],
  );

  const clickHandlerCache = useRef<Map<string, () => void>>(new Map());

  const createHandleClick = useCallback(
    (annotationId: string) => {
      if (!clickHandlerCache.current.has(annotationId)) {
        const handler = () => {
          if (isPointSelectionMode) {
            return;
          }

          if (editingAnnotationId === annotationId) {
            return;
          }

          if (editingAnnotationId && editingAnnotationId !== annotationId) {
            handleCancelEdit();
          }

          if (annotationId !== selectedAnnotationId) {
            onAnnotationSelect?.(annotationId);
            const newExpanded = { [annotationId]: true };
            setExpanded(newExpanded);

            highlightLinkedAnnotations(annotationId);
          } else {
            const newExpanded = { [annotationId]: !expanded[annotationId] };
            setExpanded(newExpanded);

            if (newExpanded[annotationId]) {
              highlightLinkedAnnotations(annotationId);
            } else {
              onLinkedAnnotationsOrderChange?.([]);
            }
          }
        };
        clickHandlerCache.current.set(annotationId, handler);
      }

      return clickHandlerCache.current.get(annotationId)!;
    },
    [
      isPointSelectionMode,
      editingAnnotationId,
      selectedAnnotationId,
      onAnnotationSelect,
      handleCancelEdit,
      expanded,
      highlightLinkedAnnotations,
      onLinkedAnnotationsOrderChange,
    ],
  );

  React.useEffect(() => {
    clickHandlerCache.current.clear();
  }, [isPointSelectionMode, editingAnnotationId, selectedAnnotationId]);

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
                Select a point to or cancel to finish this mode.
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

              const initialGeotagForWidget =
                geotagDataCache[annotation.id] || null;

              const isInLinkingOrder =
                linkedAnnotationsOrder?.includes(annotation.id) || false;
              const linkingOrderPosition = isInLinkingOrder
                ? linkedAnnotationsOrder.indexOf(annotation.id) + 1
                : null;

              const handleClick = createHandleClick(annotation.id);

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                >
                  <FastAnnotationItem
                    annotation={annotation}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    isCurrentlyEditing={isCurrentlyEditing}
                    isSaving={isSaving}
                    isPointSelectionMode={isPointSelectionMode}
                    canEdit={canEdit}
                    optimisticUpdates={optimisticUpdates}
                    editingAnnotationId={editingAnnotationId}
                    linkedAnnotationsOrder={linkedAnnotationsOrder}
                    linkingDetailsCache={linkingDetailsCache}
                    onClick={handleClick}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onFinishEdit={handleFinishEdit}
                    onAnnotationUpdate={handleAnnotationUpdate}
                    onOptimisticUpdate={handleOptimisticUpdate}
                    onAnnotationPrepareDelete={onAnnotationPrepareDelete}
                    getBodies={getBodies}
                    getLoghiBody={getLoghiBody}
                    isTextAnnotation={isTextAnnotation}
                    hasGeotagData={hasGeotagData}
                    hasPointSelection={hasPointSelection}
                    isAnnotationLinkedDebug={isAnnotationLinkedDebug}
                  />

                  {isExpanded && linkingWidgetProps[annotation.id] && (
                    <div className="px-4 pb-4">
                      <LinkingAnnotationWidget
                        {...linkingWidgetProps[annotation.id]}
                        onSave={(data) =>
                          handleSaveLinkingAnnotation(annotation, data)
                        }
                        onRefreshAnnotations={() => {
                          onRefreshAnnotations?.();
                          invalidateLinkingCache();
                          setTimeout(() => forceRefreshLinking(), 200);
                        }}
                        onToggleExpand={() =>
                          setLinkingExpanded((prev) => ({
                            ...prev,
                            [annotation.id]: !prev[annotation.id],
                          }))
                        }
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
