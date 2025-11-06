/**
 * AnnotationList Component - Complex annotation management with external integrations
 *
 * This file contains extensive ESLint disables due to:
 * 1. Legacy OpenSeadragon integration using untyped `any` for viewer APIs
 * 2. W3C Annotation Model with flexible body structures (requires `any`)
 * 3. Complex React hooks with intentional dependency optimizations
 * 4. Function hoisting patterns for callback organization
 *
 * Refactoring this to strict TypeScript would require:
 * - Creating comprehensive type definitions for OpenSeadragon
 * - Defining strict types for all W3C Annotation body variants
 * - Restructuring callback dependencies (may impact performance)
 *
 * TODO: Consider gradual type strengthening in future iterations
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-use-before-define */

'use client';

import { Bot, Image, Search, Type, User, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Input } from '../../components/shared/Input';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Progress } from '../../components/shared/Progress';
import { FastAnnotationItem } from '../../components/viewer/FastAnnotationItem';
import { LinkingAnnotationWidget } from '../../components/viewer/LinkingAnnotationWidget';
import { useGlobalLinkingAnnotations } from '../../hooks/use-global-linking-annotations';
import { useLinkingAnnotations } from '../../hooks/use-linking-annotations';
import type { Annotation, LinkingAnnotation } from '../../lib/types';

// OpenSeadragon is a global library that requires PascalCase naming convention
// eslint-disable-next-line @typescript-eslint/naming-convention
let OpenSeadragon: any;

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
  totalAnnotations?: number;
  canvasId?: string;
  onEnablePointSelection?: (
    handler: (point: { x: number; y: number }) => void,
  ) => void;
  onDisablePointSelection?: () => void;
  onPointChange?: (point: { x: number; y: number } | null) => void;
  onLinkedAnnotationsOrderChange?: (order: string[]) => void;
  linkedAnnotationsOrder?: string[];
  isLinkingMode?: boolean;
  selectedAnnotationsForLinking?: string[];
  onEnableLinkingMode?: () => void;
  onDisableLinkingMode?: () => void;
  onRefreshAnnotations?: () => void;
  isPointSelectionMode?: boolean;
  viewer?: any;
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
  totalAnnotations = 0,
  canvasId = '',
  onEnablePointSelection,
  onDisablePointSelection,
  onPointChange,
  onLinkedAnnotationsOrderChange,
  linkedAnnotationsOrder = [],
  isLinkingMode = false,
  selectedAnnotationsForLinking = [],
  onEnableLinkingMode,
  onDisableLinkingMode,
  onRefreshAnnotations,
  isPointSelectionMode = false,
  viewer,
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
    createLinkingAnnotation,
    updateLinkingAnnotation,
    getLinkingAnnotationForTarget,
    invalidateCache: invalidateLinkingCache,
    forceRefresh: forceRefreshLinking,
  } = useLinkingAnnotations('');

  const {
    isGlobalLoading,
    getAnnotationsForCanvas,
    refetch: refetchGlobalLinking,
    invalidateGlobalCache,
  } = useGlobalLinkingAnnotations();

  const canvasLinkingAnnotations = getAnnotationsForCanvas(canvasId);

  useEffect(() => {}, [canvasLinkingAnnotations, canvasId, annotations]);

  useEffect(() => {
    async function loadOpenSeadragon() {
      if (!OpenSeadragon) {
        const { default: OSD } = await import('openseadragon');
        OpenSeadragon = OSD;
      }
    }
    loadOpenSeadragon().catch(() => {});
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

    const textContentBodies = bodies.filter(
      (body) =>
        body.purpose !== 'assessing' &&
        body.purpose !== 'commenting' &&
        body.purpose !== 'describing',
    );

    const humanBody = textContentBodies.find(
      (body) => !body.generator && body.value && body.value.trim().length > 0,
    );

    if (humanBody) {
      return humanBody.value;
    }

    const loghiBody = textContentBodies.find(
      (body) =>
        body.generator &&
        (body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')) &&
        body.value &&
        body.value.trim().length > 0,
    );

    if (loghiBody) {
      return loghiBody.value;
    }

    const otherAiBody = textContentBodies.find(
      (body) =>
        body.generator &&
        !(
          body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')
        ) &&
        body.value &&
        body.value.trim().length > 0,
    );

    return otherAiBody?.value || '';
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

  const isAIGenerated = (annotation: Annotation) => {
    if (isHumanCreated(annotation)) {
      return false;
    }

    const bodies = getBodies(annotation);

    const hasAIGenerator = bodies.some((body) => {
      return (
        body.generator?.id?.includes('MapTextPipeline') ||
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('segment_icons.py')
      );
    });

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
    // Iconography annotations should NEVER be treated as text annotations
    if (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    ) {
      return false;
    }

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
        body.purpose !== 'assessing' &&
        body.purpose !== 'commenting' &&
        !body.value.toLowerCase().includes('icon'),
    );

    return hasTextualContent;
  };

  const getLinkingDetails = React.useCallback(
    (annotationId: string) => {
      const linkingAnnotation = canvasLinkingAnnotations?.find((la) => {
        const targets = Array.isArray(la.target) ? la.target : [la.target];
        return targets.some(
          (t) =>
            typeof t === 'string' &&
            (t === annotationId ||
              t.endsWith(`/${annotationId.split('/').pop()}`)),
        );
      });

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

              if (source.preferredTerm && source.category) {
                extractedName = source.preferredTerm;
                extractedType = source.category;
              } else if (source.properties) {
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
                source.coordinates &&
                source.coordinates.latitude &&
                source.coordinates.longitude
              ) {
                details.geotagging!.coordinates = [
                  source.coordinates.longitude,
                  source.coordinates.latitude,
                ];
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
    },
    [canvasLinkingAnnotations, annotations, getAnnotationText],
  );

  const handleSaveLinkingAnnotation = async (
    currentAnnotation: Annotation,
    data: {
      linkedIds: string[];
      geotag?: any;
      point?: any;
      existingLinkingId?: string | null;
    },
  ) => {
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

    let existingLinkingAnnotation = null;
    if (data.existingLinkingId) {
      existingLinkingAnnotation =
        canvasLinkingAnnotations.find(
          (la) => la.id === data.existingLinkingId,
        ) || null;
    } else {
      existingLinkingAnnotation = getLinkingAnnotationForTarget(
        currentAnnotation.id,
      );
    }

    let allTargetIds: string[];
    const isBodyOnlyUpdate =
      existingLinkingAnnotation &&
      data.linkedIds.length === 0 &&
      (data.geotag || data.point);

    if (isBodyOnlyUpdate && existingLinkingAnnotation) {
      const existingTargets = Array.isArray(existingLinkingAnnotation.target)
        ? existingLinkingAnnotation.target
        : [existingLinkingAnnotation.target];
      allTargetIds = existingTargets.filter(
        (t): t is string => typeof t === 'string',
      );
      emitDebugEvent('info', 'Preserving Existing Targets', {
        existingTargets: allTargetIds,
        reason:
          'Body-only update (geotag/point) with no target changes specified',
      });
    } else {
      allTargetIds = Array.from(
        new Set([currentAnnotation.id, ...data.linkedIds]),
      );
      if (existingLinkingAnnotation && data.linkedIds.length > 0) {
        emitDebugEvent('info', 'Updating Targets', {
          oldTargetCount: Array.isArray(existingLinkingAnnotation.target)
            ? existingLinkingAnnotation.target.length
            : 1,
          newTargetCount: allTargetIds.length,
          reason: 'User modified target annotations',
        });
      }
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
      } else if (
        data.geotag.preferredTerm &&
        data.geotag.category &&
        data.geotag.coordinates
      ) {
        const title = data.geotag.preferredTerm;
        const category = data.geotag.category;
        const lon = data.geotag.coordinates.longitude;
        const lat = data.geotag.coordinates.latitude;

        identifyingSource = {
          id:
            data.geotag.uri ||
            `https://data.globalise.huygens.knaw.nl/gavoc/${data.geotag.id}`,
          type: 'Place',
          label: title,
          defined_by: `POINT(${lon} ${lat})`,
          preferredTerm: title,
          category: category,
          alternativeTerms: data.geotag.alternativeTerms || [],
          uri: data.geotag.uri,
        };

        geotagSource = {
          id:
            data.geotag.uri ||
            `https://data.globalise.huygens.knaw.nl/gavoc/${data.geotag.id}`,
          type: 'Feature',
          properties: {
            title: title,
            description: `${title} (${category})`,
            category: category,
            preferredTerm: title,
            alternativeTerms: data.geotag.alternativeTerms || [],
          },
          geometry: {
            type: 'Point',
            coordinates: [lon, lat],
          },
          preferredTerm: title,
          category: category,
          coordinates: {
            latitude: lat,
            longitude: lon,
          },
          uri: data.geotag.uri,
        };
      } else {
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
          id:
            (session?.user as any)?.id ||
            'https://orcid.org/0000-0000-0000-0000',
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        },
        created: new Date().toISOString(),
      });

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
          id:
            (session?.user as any)?.id ||
            'https://orcid.org/0000-0000-0000-0000',
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
        id:
          (session?.user as any)?.id || 'https://orcid.org/0000-0000-0000-0000',
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

      if (
        data.point &&
        typeof window !== 'undefined' &&
        (window as any).osdViewer &&
        typeof window !== 'undefined'
      ) {
        const osdViewer = (window as any).osdViewer;
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
            // eslint-disable-next-line no-restricted-syntax -- legacy OpenSeadragon overlay management
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
              width: 14px;
              height: 14px;
              background: #f59e0b;
              border: 3px solid white;
              border-radius: 50%;
              pointer-events: none;
              z-index: 1000;
              box-shadow: 0 3px 12px rgba(245, 158, 11, 0.6), 0 1px 3px rgba(0, 0, 0, 0.2);
              transform: translate(-50%, -50%);
              outline: 2px solid rgba(245, 158, 11, 0.3);
              outline-offset: 2px;
            `;

            try {
              if (!OpenSeadragon) {
                return;
              }

              const viewportPoint =
                osdViewer.viewport.imageToViewportCoordinates(
                  new OpenSeadragon.Point(data.point.x, data.point.y),
                );

              osdViewer.addOverlay({
                element: overlay,
                location: viewportPoint,
              });

              const updatePosition = () => {
                try {
                  const containerPoint =
                    osdViewer.viewport.viewportToViewerElementCoordinates(
                      viewportPoint,
                    );
                  overlay.style.left = `${containerPoint.x}px`;
                  overlay.style.top = `${containerPoint.y}px`;
                } catch {}
              };

              updatePosition();

              const throttledUpdatePosition = () => {
                requestAnimationFrame(updatePosition);
              };

              osdViewer.addHandler('zoom', throttledUpdatePosition);
              osdViewer.addHandler('pan', throttledUpdatePosition);
              osdViewer.addHandler('resize', throttledUpdatePosition);
            } catch {}
          } catch {}
        });
      }

      invalidateLinkingCache();
      invalidateGlobalCache();

      await Promise.all([
        forceRefreshLinking().catch(() => {}),
        refetchGlobalLinking(),
      ]);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 300);
      });

      await Promise.all([
        forceRefreshLinking().catch(() => {}),
        refetchGlobalLinking(),
      ]);

      onRefreshAnnotations?.();
    } catch (error) {
      const errorDetails = {
        message: (error as Error).message,
        stack: (error as Error).stack,
        payloadId: linkingAnnotationPayload.id,
        targetCount: linkingAnnotationPayload.target.length,
        bodyCount: linkingAnnotationPayload.body.length,
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

    annotations.forEach((annotation) => {
      const details = getLinkingDetails(annotation.id);

      if (
        details &&
        (details.linkedAnnotations?.length > 0 ||
          details.geotagging ||
          details.pointSelection)
      ) {
        cache[annotation.id] = details;
      }
    });

    return cache;
  }, [annotations, getLinkingDetails]);

  const geotagDataCache = useMemo(() => {
    const cache: Record<string, any> = {};

    annotations.forEach((annotation) => {
      const details = getLinkingDetails(annotation.id);
      if (!details?.geotagging?.body) return;

      const geotagBody = details.geotagging.body;

      if (geotagBody?.source) {
        const source = geotagBody.source;

        if ('display_name' in source && 'lat' in source && 'lon' in source) {
          cache[annotation.id] = {
            marker: [
              parseFloat(source.lat as string),
              parseFloat(source.lon as string),
            ] as [number, number],
            label: (source.display_name as string) || 'Unknown Location',
            displayName: (source.display_name as string) || 'Unknown Location',
            originalResult: source,
          };
        } else if (
          'geometry' in source &&
          source.geometry?.coordinates &&
          'properties' in source
        ) {
          const coords = source.geometry.coordinates;
          cache[annotation.id] = {
            marker: [coords[1], coords[0]] as [number, number],
            label:
              source.properties?.preferredTitle ||
              source.properties?.title ||
              'Unknown Location',
            displayName:
              source.properties?.preferredTitle ||
              source.properties?.title ||
              'Unknown Location',
            originalResult: source,
          };
        }
        // Handle NeRu results (has _label and defined_by with POINT)
        else if ('_label' in source && source._label) {
          let marker: [number, number] | undefined;
          if (source.defined_by) {
            const match = source.defined_by.match(/POINT \(([^ ]+) ([^ ]+)\)/);
            if (match && match[1] && match[2]) {
              marker = [parseFloat(match[2]), parseFloat(match[1])] as [
                number,
                number,
              ];
            }
          }

          cache[annotation.id] = {
            marker: marker,
            label: source._label,
            displayName: source._label,
            originalResult: source,
          };
        } else if ('preferredTerm' in source && source.preferredTerm) {
          let marker: [number, number] | undefined;
          if (source.coordinates?.latitude && source.coordinates?.longitude) {
            marker = [
              source.coordinates.latitude,
              source.coordinates.longitude,
            ];
          }

          cache[annotation.id] = {
            marker: marker,
            label: source.preferredTerm,
            displayName: source.preferredTerm,
            originalResult: source,
          };
        } else if ('label' in source && source.label) {
          cache[annotation.id] = {
            marker: undefined,
            label: source.label,
            displayName: source.label,
            originalResult: source,
          };
        }
      }
    });

    return cache;
  }, [annotations, canvasLinkingAnnotations]);

  const iconStateCache = useMemo(() => {
    const cache: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    annotations.forEach((annotation) => {
      const details = linkingDetailsCache[annotation.id];
      cache[annotation.id] = {
        hasGeotag: !!details?.geotagging,
        hasPoint: !!details?.pointSelection,
        isLinked: !!(
          details?.linkedAnnotations && details.linkedAnnotations.length > 0
        ),
      };
    });

    return cache;
  }, [linkingDetailsCache, annotations]);

  const hasGeotagData = useCallback(
    (annotationId: string): boolean => {
      const result = iconStateCache[annotationId]?.hasGeotag || false;
      return result;
    },
    [iconStateCache],
  );

  const hasPointSelection = useCallback(
    (annotationId: string): boolean => {
      const result = iconStateCache[annotationId]?.hasPoint || false;
      return result;
    },
    [iconStateCache],
  );

  const isAnnotationLinkedDebug = useCallback(
    (annotationId: string): boolean => {
      const result = iconStateCache[annotationId]?.isLinked || false;
      return result;
    },
    [iconStateCache],
  );

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

  const getAssessingBody = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    return bodies.find(
      (body) => body.type === 'TextualBody' && body.purpose === 'assessing',
    );
  };

  const hasAssessing = (annotation: Annotation) => {
    const assessingBody = getAssessingBody(annotation);
    return assessingBody && assessingBody.value === 'checked';
  };

  const canHaveAssessing = (annotation: Annotation) => {
    return isTextAnnotation(annotation) || isIconAnnotation(annotation);
  };

  const getCommentBody = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    return bodies.find(
      (body) => body.type === 'TextualBody' && body.purpose === 'commenting',
    );
  };

  const hasComment = (annotation: Annotation) => {
    const commentBody = getCommentBody(annotation);
    return (
      commentBody && commentBody.value && commentBody.value.trim().length > 0
    );
  };

  const getCommentText = (annotation: Annotation) => {
    const commentBody = getCommentBody(annotation);
    return commentBody?.value || '';
  };

  const getClassifyingBody = (annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.find(
      (body) =>
        body.type === 'SpecificResource' && body.purpose === 'classifying',
    );
  };

  const hasClassification = (annotation: Annotation) => {
    const classifyingBody = getClassifyingBody(annotation);
    return classifyingBody && classifyingBody.source;
  };

  const getClassificationLabel = (annotation: Annotation) => {
    const classifyingBody = getClassifyingBody(annotation);
    return classifyingBody?.source?.label || '';
  };

  const getClassificationId = (annotation: Annotation) => {
    const classifyingBody = getClassifyingBody(annotation);
    return classifyingBody?.source?.id || '';
  };

  const handleCommentUpdate = async (
    annotation: Annotation,
    newComment: string,
  ) => {
    if (!canEdit || !session?.user) {
      return;
    }

    const annotationName = annotation.id.split('/').pop()!;

    onAnnotationSaveStart?.(annotation.id);

    setSavingAnnotations((prev) => new Set(prev).add(annotation.id));

    try {
      let updatedAnnotation = { ...annotation };

      // Work with ALL body types to preserve SpecificResource bodies
      const allBodies = Array.isArray(annotation.body)
        ? annotation.body
        : annotation.body
          ? [annotation.body]
          : [];

      const existingCommentBody = getCommentBody(annotation);

      const trimmedComment = newComment.trim();

      if (existingCommentBody) {
        if (trimmedComment === '') {
          const updatedBodies = allBodies.filter(
            (body: any) => body !== existingCommentBody,
          );
          updatedAnnotation.body = updatedBodies;
        } else {
          const updatedBodies = allBodies.map((body: any) =>
            body === existingCommentBody
              ? {
                  ...body,
                  value: trimmedComment,
                  modified: new Date().toISOString(),
                }
              : body,
          );
          updatedAnnotation.body = updatedBodies;
        }
      } else if (trimmedComment !== '') {
        const newCommentBody = {
          type: 'TextualBody',
          value: trimmedComment,
          format: 'text/plain',
          purpose: 'commenting',
          creator: {
            id:
              (session?.user as any)?.id ||
              'https://orcid.org/0000-0000-0000-0000',
            type: 'Person',
            label: (session?.user as any)?.label || 'Unknown User',
          },
          created: new Date().toISOString(),
        };

        updatedAnnotation.body = [...allBodies, newCommentBody];
      }

      updatedAnnotation.modified = new Date().toISOString();

      const res = await fetch(
        `/api/annotations/${encodeURIComponent(annotationName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updatedAnnotation),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Update failed: ${res.status}`);
      }

      const result = await res.json();
      onAnnotationUpdate?.(result);
    } catch (error) {
      throw error;
    } finally {
      setSavingAnnotations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
  };

  const handleClassificationUpdate = async (
    annotation: Annotation,
    classificationId: string | null,
  ) => {
    if (!canEdit || !session?.user || !isIconAnnotation(annotation)) {
      return;
    }

    const annotationName = annotation.id.split('/').pop()!;

    onAnnotationSaveStart?.(annotation.id);

    setSavingAnnotations((prev) => new Set(prev).add(annotation.id));

    try {
      const thesaurusResponse = await fetch('/iconography-thesaurus.json');
      if (!thesaurusResponse.ok) {
        throw new Error('Failed to load iconography thesaurus');
      }
      const thesaurus = await thesaurusResponse.json();

      let selectedConcept = null;
      if (classificationId) {
        selectedConcept = thesaurus['@graph'].find(
          (concept: any) => concept['@id'] === classificationId,
        );
        if (!selectedConcept) {
          throw new Error('Classification concept not found');
        }
      }

      let updatedAnnotation = { ...annotation };

      const bodies = Array.isArray(annotation.body)
        ? [...annotation.body]
        : annotation.body
          ? [annotation.body]
          : [];

      // Remove existing classifying body
      const filteredBodies = bodies.filter(
        (body: any) =>
          !(body.type === 'SpecificResource' && body.purpose === 'classifying'),
      );

      const now = new Date().toISOString();

      if (selectedConcept) {
        const classifyingBody = {
          type: 'SpecificResource',
          purpose: 'classifying',
          source: {
            id: `https://data.globalise.huygens.knaw.nl/thesaurus/icons/${selectedConcept['@id']}`,
            type: 'Concept',
            label: selectedConcept.prefLabel['@value'],
          },
          creator: {
            id:
              (session?.user as any)?.id ||
              'https://orcid.org/0000-0000-0000-0000',
            type: 'Person',
            label: (session?.user as any)?.label || 'Unknown User',
          },
          created: now,
        };

        filteredBodies.push(classifyingBody);
      }

      updatedAnnotation.body = filteredBodies;
      updatedAnnotation.modified = now;

      const res = await fetch(
        `/api/annotations/${encodeURIComponent(annotationName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updatedAnnotation),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Update failed: ${res.status}`);
      }

      const result = await res.json();
      onAnnotationUpdate?.(result);
    } catch (error) {
      throw error;
    } finally {
      setSavingAnnotations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
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

      // Work with ALL body types to preserve SpecificResource bodies
      const allBodies = Array.isArray(annotation.body)
        ? annotation.body
        : annotation.body
          ? [annotation.body]
          : [];

      const textualBodies = getBodies(annotation);
      const existingHumanBody = textualBodies.find(
        (body) => body.type === 'TextualBody' && !body.generator,
      );

      if (existingHumanBody) {
        const updatedBodies = allBodies.map((body: any) =>
          body === existingHumanBody
            ? {
                ...body,
                value: trimmedValue,
                creator: {
                  id:
                    (session?.user as any)?.id ||
                    'https://orcid.org/0000-0000-0000-0000',
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
            id:
              (session?.user as any)?.id ||
              'https://orcid.org/0000-0000-0000-0000',
            type: 'Person',
            label: (session?.user as any)?.label || 'Unknown User',
          },
          created: new Date().toISOString(),
        };

        updatedAnnotation.body = [...allBodies, newHumanBody];
      }

      updatedAnnotation.modified = new Date().toISOString();

      const res = await fetch(
        `/api/annotations/${encodeURIComponent(annotationName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

  const handleAssessingToggle = async (annotation: Annotation) => {
    if (!canEdit || !session?.user || !canHaveAssessing(annotation)) {
      return;
    }

    const annotationName = annotation.id.split('/').pop()!;
    const currentAssessment = hasAssessing(annotation);

    setSavingAnnotations((prev) => new Set(prev).add(annotation.id));

    try {
      let updatedAnnotation = { ...annotation };

      // Work with ALL body types, not just TextualBody
      const allBodies = Array.isArray(annotation.body)
        ? annotation.body
        : annotation.body
          ? [annotation.body]
          : [];

      const existingAssessingBody = getAssessingBody(annotation);

      if (currentAssessment) {
        // Remove assessing body but preserve ALL other body types
        const updatedBodies = allBodies.filter(
          (body: any) => body !== existingAssessingBody,
        );
        updatedAnnotation.body = updatedBodies.length > 0 ? updatedBodies : [];
      } else {
        const newAssessingBody = {
          type: 'TextualBody',
          purpose: 'assessing',
          value: 'checked',
          creator: {
            id:
              (session?.user as any)?.id ||
              'https://orcid.org/0000-0000-0000-0000',
            type: 'Person',
            label: (session?.user as any)?.label || 'Unknown User',
          },
          created: new Date().toISOString(),
        };

        updatedAnnotation.body = [...allBodies, newAssessingBody];
      }

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
      onAnnotationUpdate?.(result);
    } catch (error) {
      throw error;
    } finally {
      setSavingAnnotations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
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
      hasAssessing,
      canHaveAssessing,
      getAssessingBody,
      getCommentBody,
      hasComment,
      getCommentText,
      getClassifyingBody,
      hasClassification,
      getClassificationLabel,
      getClassificationId,
    }),
    [hasGeotagData, hasPointSelection, isAnnotationLinkedDebug],
  );

  const annotationClassifications = useMemo(() => {
    const classifications = new Map();
    annotations.forEach((annotation) => {
      classifications.set(annotation.id, {
        isAI: memoizedHelpers.isAIGenerated(annotation),
        isHuman: memoizedHelpers.isHumanCreated(annotation),
        isText: memoizedHelpers.isTextAnnotation(annotation),
        isIcon: memoizedHelpers.isIconAnnotation(annotation),
        text: memoizedHelpers.getAnnotationText(annotation).toLowerCase(),
      });
    });
    return classifications;
  }, [annotations, memoizedHelpers]);

  const filtered = useMemo(() => {
    const queryWords = searchQuery.trim()
      ? searchQuery
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0)
      : [];

    return relevantAnnotations.filter((annotation) => {
      const classification = annotationClassifications.get(annotation.id);
      if (!classification) return false;

      const { isAI, isHuman, isText, isIcon, text } = classification;

      let matchesFilter = false;
      if (isAI && isText && showAITextspotting) matchesFilter = true;
      if (isAI && isIcon && showAIIconography) matchesFilter = true;
      if (isHuman && isText && showHumanTextspotting) matchesFilter = true;
      if (isHuman && isIcon && showHumanIconography) matchesFilter = true;

      if (!matchesFilter) return false;

      if (queryWords.length > 0) {
        return queryWords.every((word) => text.includes(word));
      }

      return true;
    });
  }, [
    relevantAnnotations,
    annotationClassifications,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    searchQuery,
  ]);

  const linkingWidgetProps = useMemo(() => {
    const props: Record<string, any> = {};

    Object.keys(expanded).forEach((annotationId) => {
      if (expanded[annotationId]) {
        const annotation = annotations.find((a) => a.id === annotationId);
        if (!annotation) return;

        if (!canEdit || !session?.user) return;

        const initialGeotagForWidget = geotagDataCache[annotationId] || null;

        props[annotationId] = {
          canEdit: canEdit && !!session?.user,
          isExpanded: !!linkingExpanded[annotationId],
          annotations,
          availableAnnotations: canvasLinkingAnnotations,
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
          viewer,
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
    viewer,
  ]);

  const displayCount = totalCount ?? filtered.length;

  const humanEditedCount = annotations.filter(isHumanCreated).length;
  const humanEditedPercentage =
    annotations.length > 0
      ? Math.round((humanEditedCount / annotations.length) * 100)
      : 0;

  const assessableAnnotations = relevantAnnotations.filter(canHaveAssessing);
  const assessedCount = assessableAnnotations.filter(hasAssessing).length;
  const assessmentPercentage =
    assessableAnnotations.length > 0
      ? Math.round((assessedCount / assessableAnnotations.length) * 100)
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
          onAnnotationSelect(filtered[nextIndex]!.id);
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

  const highlightLinkedAnnotations = useCallback(
    (annotationIdParam: string) => {
      const details = linkingDetailsCache[annotationIdParam];
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
            onAnnotationSelect(annotationId);
            const newExpanded = { [annotationId]: true };
            setExpanded(newExpanded);

            highlightLinkedAnnotations(annotationId);
          } else {
            const newExpanded = { [annotationId]: !expanded[annotationId] };
            setExpanded(newExpanded);

            if (newExpanded[annotationId]) {
              highlightLinkedAnnotations(annotationId);
            } else if (onLinkedAnnotationsOrderChange) {
              onLinkedAnnotationsOrderChange([]);
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

        {/* Assessment Progress */}
        {assessableAnnotations.length > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Assessed:</span>
            <span className="text-xs text-muted-foreground font-medium">
              {assessedCount}/{assessableAnnotations.length} (
              {assessmentPercentage}%)
            </span>
            <div className="flex-1 bg-muted/30 rounded-full h-1">
              <div
                className="bg-muted-foreground h-1 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${assessmentPercentage}%` }}
              />
            </div>
          </div>
        )}
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
        {(isLoading || isGlobalLoading) && filtered.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-40 flex items-center justify-center pointer-events-none z-10">
            <LoadingSpinner />
            {isGlobalLoading && (
              <span className="ml-2 text-sm text-muted-foreground">
                Loading linking data...
              </span>
            )}
          </div>
        )}
        {isLoading && filtered.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-base font-medium text-foreground">
              Loading annotations…
            </p>
            {totalAnnotations! > 0 && (
              <>
                <div className="w-full max-w-sm mt-6 px-4">
                  <Progress
                    value={loadingProgress}
                    className="h-3 bg-muted border border-border"
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground font-medium">
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

              const handleClick = createHandleClick(annotation.id);

              return (
                <div
                  key={`annotation-${annotation.id}`}
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
                    canEdit={canEdit && !!session?.user}
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
                    hasAssessing={hasAssessing}
                    canHaveAssessing={canHaveAssessing}
                    onAssessingToggle={handleAssessingToggle}
                    onCommentUpdate={handleCommentUpdate}
                    getCommentBody={getCommentBody}
                    hasComment={hasComment}
                    getCommentText={getCommentText}
                    session={session}
                    getClassifyingBody={getClassifyingBody}
                    hasClassification={hasClassification}
                    getClassificationLabel={getClassificationLabel}
                    getClassificationId={getClassificationId}
                    onClassificationUpdate={handleClassificationUpdate}
                  />

                  {isExpanded && linkingWidgetProps[annotation.id] && (
                    <div className="px-4 pb-4">
                      <LinkingAnnotationWidget
                        {...linkingWidgetProps[annotation.id]}
                        defaultTab="link"
                        onSave={(data) =>
                          handleSaveLinkingAnnotation(annotation, data)
                        }
                        onRefreshAnnotations={() => {
                          onRefreshAnnotations?.();
                          invalidateLinkingCache();
                          invalidateGlobalCache();
                          setTimeout(() => {
                            forceRefreshLinking().catch(() => {});
                            refetchGlobalLinking();
                          }, 200);
                        }}
                        onGlobalRefresh={async () => {
                          invalidateGlobalCache();
                          invalidateLinkingCache();

                          refetchGlobalLinking();

                          await new Promise<void>((resolve) => {
                            setTimeout(resolve, 300);
                          });
                          refetchGlobalLinking();
                          if (onRefreshAnnotations) {
                            onRefreshAnnotations();
                          }
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
