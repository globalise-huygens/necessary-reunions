/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-use-before-define */

import {
  Image,
  Link,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useRef, useState } from 'react';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/Card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/shared/Tabs';
import { useLinkingMode } from '../../components/viewer/LinkingModeContext';
import { PointSelector } from '../../components/viewer/PointSelector';
import { invalidateGlobalLinkingCache } from '../../hooks/use-global-linking-annotations';
import { invalidateLinkingCache } from '../../hooks/use-linking-annotations';
import { useToast } from '../../hooks/use-toast';
import { deleteLinkingRelationship } from '../../lib/viewer/linking-validation';

const geoTagMap = dynamic(
  () => import('./GeoTagMap').then((mod) => ({ default: mod.GeoTagMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Loading map...</div>
      </div>
    ),
  },
);

interface LinkingAnnotationWidgetProps {
  annotations: any[];
  isLinkingMode: boolean;
  onRefreshAnnotations?: () => void;
  canEdit: boolean;
  onSave?: (data: {
    linkedIds: string[];
    geotag?: any;
    point?: any;
    existingLinkingId?: string | null;
  }) => Promise<void>;
  availableAnnotations?: any[];
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  session?: any;
  initialGeotag?: any;
  initialPoint?: { x: number; y: number } | null;
  selectedAnnotationsForLinking?: string[];
  onEnableLinkingMode?: () => void;
  onDisableLinkingMode?: () => void;
  selectedAnnotationId?: string;
  canvasId?: string;
  onLinkedAnnotationsOrderChange?: (orderedIds: string[]) => void;
  onEnablePointSelection?: () => void;
  onDisablePointSelection?: () => void;
  onPointChange?: (point: { x: number; y: number } | null) => void;
  viewer?: any;
  defaultTab?: 'link' | 'geotag' | 'point';
  onGlobalRefresh?: () => void;
}

export const LinkingAnnotationWidget = React.memo(
  function LinkingAnnotationWidget(
    props: LinkingAnnotationWidgetProps,
  ): React.ReactElement | null {
    const {
      canEdit = true,
      onSave = async () => {},
      annotations = [],
      availableAnnotations = [],
      selectedIds,
      setSelectedIds,
      session,
      initialGeotag,
      initialPoint,
      selectedAnnotationsForLinking = [],
      onEnableLinkingMode,
      onDisableLinkingMode,
      isLinkingMode = false,
      selectedAnnotationId,
      onRefreshAnnotations,
      canvasId,
      onLinkedAnnotationsOrderChange,
      onEnablePointSelection,
      onDisablePointSelection,
      onPointChange,
      defaultTab = 'link',
      onGlobalRefresh,
    } = props;

    const linkingModeContext = useLinkingMode();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedGeotag, setSelectedGeotag] = useState<any>(
      initialGeotag || null,
    );
    const [selectedPoint, setSelectedPoint] = useState<{
      x: number;
      y: number;
    } | null>(initialPoint || null);
    const [isPointSelectionActive, setIsPointSelectionActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [internalSelected, setInternalSelected] = useState<string[]>([]);

    const [existingLinkingData, setExistingLinkingData] = useState<{
      linking?: any;
      geotagging?: any;
    }>({});
    const [loadingExistingData, setLoadingExistingData] = useState(false);
    const [hasManuallyReordered, setHasManuallyReordered] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);

    const componentId = useRef(
      `widget-${Math.random().toString(36).slice(2, 11)}`,
    );

    const lastFetchRef = useRef<string | null>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastAvailableAnnotationsLengthRef = useRef<number>(0);

    const selected = selectedIds !== undefined ? selectedIds : internalSelected;
    const setSelected = setSelectedIds || setInternalSelected;
    const userSession = session || { user: { name: 'Demo User' } };

    const getBodies = (annotation: any) => {
      const bodies = Array.isArray(annotation.body)
        ? annotation.body
        : ([annotation.body] as any[]);
      return bodies.filter((b: any) => b.type === 'TextualBody');
    };

    const getAnnotationText = React.useCallback((annotation: any) => {
      const bodies = getBodies(annotation);

      const humanBody = bodies.find(
        (body: any) =>
          !body.generator && body.value && body.value.trim().length > 0,
      );

      if (humanBody) {
        return humanBody.value;
      }

      const loghiBody = bodies.find(
        (body: any) =>
          body.generator &&
          (body.generator.label?.toLowerCase().includes('loghi') ||
            body.generator.id?.includes('loghi')) &&
          body.value &&
          body.value.trim().length > 0,
      );

      if (loghiBody) {
        return loghiBody.value;
      }

      const otherAiBody = bodies.find(
        (body: any) =>
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
        const inputShortId = annotationId.split('/').pop();
        return a.id === annotationId || shortId === inputShortId;
      });
      if (!annotation) return '(Not found)';

      if (
        annotation.motivation === 'iconography' ||
        annotation.motivation === 'iconograpy'
      ) {
        return '(Icon annotation)';
      }

      const text = getAnnotationText(annotation);
      return text || '(Empty)';
    };

    const linkingDetailsCache = React.useMemo(() => {
      const cache: Record<string, any> = {};

      annotations.forEach((annotation) => {
        let details: {
          linkedAnnotations: string[];
          linkedAnnotationTexts: string[];
          readingOrder: string[];
          currentAnnotationText: string;
          otherPurposes: string[];
          pointSelection?: {
            purpose: string;
            x?: number;
            y?: number;
          };
          geotagging?: {
            name: string;
            type: string;
            coordinates?: [number, number];
            body?: any;
          };
        } | null = null;

        if (existingLinkingData.linking) {
          const targets = Array.isArray(existingLinkingData.linking.target)
            ? existingLinkingData.linking.target
            : [existingLinkingData.linking.target];

          if (targets.includes(annotation.id)) {
            details = {
              linkedAnnotations: targets
                .map((target: any) =>
                  typeof target === 'string' ? target.split('/').pop() : '',
                )
                .filter((id: any): id is string => Boolean(id)),
              linkedAnnotationTexts: [],
              readingOrder: [],
              currentAnnotationText: '',
              otherPurposes: [],
            };

            details.linkedAnnotationTexts = details.linkedAnnotations.map(
              (id: string) => getAnnotationTextById(id),
            );

            if (
              existingLinkingData.linking.body &&
              Array.isArray(existingLinkingData.linking.body)
            ) {
              const pointBody = existingLinkingData.linking.body.find(
                (b: any) =>
                  b?.purpose === 'selecting' &&
                  b.selector?.type === 'PointSelector',
              );
              if (pointBody) {
                details.pointSelection = {
                  purpose: 'selecting',
                  x: pointBody.selector.x,
                  y: pointBody.selector.y,
                };
              }
            }
          }
        }

        if (existingLinkingData.geotagging) {
          if (!details) {
            details = {
              linkedAnnotations: [],
              linkedAnnotationTexts: [],
              readingOrder: [],
              currentAnnotationText: '',
              otherPurposes: [],
            };
          }

          const geotagBody = Array.isArray(existingLinkingData.geotagging.body)
            ? existingLinkingData.geotagging.body.find(
                (b: any) => b.purpose === 'geotagging',
              )
            : existingLinkingData.geotagging.body;

          if (geotagBody?.source) {
            const source = geotagBody.source as any;
            let extractedName = source.label || 'Unknown Location';
            let extractedType = source.type || 'Place';

            if (source.properties) {
              const properties = source.properties;
              if (properties.title) {
                extractedName = properties.title;
              } else if (properties.preferredTitle) {
                extractedName = properties.preferredTitle;
              } else if (properties.display_name) {
                extractedName = properties.display_name;
              }
              if (properties.type) {
                extractedType = properties.type;
              }
            }

            details.geotagging = {
              name: extractedName,
              type: extractedType,
              body: geotagBody,
            };

            if (source.geometry?.coordinates) {
              details.geotagging.coordinates = source.geometry.coordinates;
            } else if (
              source.coordinates?.latitude &&
              source.coordinates?.longitude
            ) {
              details.geotagging.coordinates = [
                source.coordinates.longitude,
                source.coordinates.latitude,
              ];
            }
          }
        }

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
    }, [annotations, existingLinkingData, getAnnotationTextById]);

    const currentlySelectedForLinking = React.useMemo(() => {
      if (hasManuallyReordered) {
        return selected;
      }
      if (
        isLinkingMode &&
        selectedAnnotationsForLinking.length > 0 &&
        selected.length === 0
      ) {
        return selectedAnnotationsForLinking;
      }
      return selected;
    }, [
      hasManuallyReordered,
      selected,
      isLinkingMode,
      selectedAnnotationsForLinking,
      forceUpdate,
    ]);

    React.useEffect(() => {
      if (selectedAnnotationsForLinking.length > 0 && !selectedIds) {
        setInternalSelected(selectedAnnotationsForLinking);
      }
    }, [selectedAnnotationsForLinking, selectedIds]);

    React.useEffect(() => {
      setSelectedPoint(initialPoint || null);
    }, [initialPoint]);

    React.useEffect(() => {
      if (selectedAnnotationId) {
        setHasManuallyReordered(false);
        const isFirstLoad = lastFetchRef.current !== selectedAnnotationId;
        fetchExistingLinkingData(selectedAnnotationId, isFirstLoad);
      } else {
        setExistingLinkingData({});
        setInternalSelected([]);
        if (setSelectedIds) {
          setSelectedIds([]);
        }
        setSelectedGeotag(null);
        setSelectedPoint(null);
      }
    }, [selectedAnnotationId]);

    React.useEffect(() => {
      const currentLength = availableAnnotations?.length || 0;

      if (
        selectedAnnotationId &&
        availableAnnotations &&
        currentLength !== lastAvailableAnnotationsLengthRef.current
      ) {
        lastAvailableAnnotationsLengthRef.current = currentLength;
        fetchExistingLinkingData(selectedAnnotationId, true);
      }
    }, [availableAnnotations?.length, selectedAnnotationId]);

    const extractLinkingDataFromGlobal = (annotationId: string) => {
      if (!availableAnnotations || availableAnnotations.length === 0) {
        return { linking: null, geotagging: null };
      }

      const linkingAnnotations = availableAnnotations.filter(
        (ann: any) =>
          ann.motivation === 'linking' &&
          ann.target &&
          (Array.isArray(ann.target)
            ? ann.target.includes(annotationId)
            : ann.target === annotationId),
      );

      if (linkingAnnotations.length === 0) {
        return { linking: null, geotagging: null };
      }

      const primaryLinking = linkingAnnotations[0];

      const linking = { ...primaryLinking };
      let geotagging = null;

      if (primaryLinking.body) {
        const bodies = Array.isArray(primaryLinking.body)
          ? primaryLinking.body
          : [primaryLinking.body];

        const geotagBody = bodies.find((b: any) => b.purpose === 'geotagging');
        if (geotagBody) {
          geotagging = {
            ...primaryLinking,
            body: geotagBody,
          };
        }
      }

      return { linking, geotagging };
    };

    const fetchExistingLinkingData = (
      annotationId: string,
      forceRefresh = false,
    ) => {
      if (!forceRefresh && lastFetchRef.current === annotationId) {
        return;
      }

      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      lastFetchRef.current = annotationId;

      try {
        setLoadingExistingData(true);
        setError(null);

        const links = extractLinkingDataFromGlobal(annotationId);
        setExistingLinkingData(links);

        if (links.linking && links.linking.target) {
          const linkedIds = Array.isArray(links.linking.target)
            ? links.linking.target
            : [links.linking.target];

          setInternalSelected(linkedIds);

          if (setSelectedIds) {
            setSelectedIds(linkedIds);
          }

          if (isLinkingMode) {
            linkingModeContext.clearLinkingSelection();
            linkedIds.forEach((id: string) =>
              linkingModeContext.addAnnotationToLinking(id),
            );
          }
        } else {
          setInternalSelected([]);
          if (setSelectedIds) {
            setSelectedIds([]);
          }
          if (isLinkingMode) {
            linkingModeContext.clearLinkingSelection();
          }
        }

        if (links.geotagging && links.geotagging.body) {
          const geotagBody = Array.isArray(links.geotagging.body)
            ? links.geotagging.body.find((b: any) => b.purpose === 'geotagging')
            : links.geotagging.body;
          if (geotagBody) {
            // Extract the source from the body for consistent format with new selections
            // This ensures both new and existing geotags have the same structure
            const source = geotagBody.source;
            if (source) {
              // Preserve the original body format for display but use source for saving
              setSelectedGeotag({
                ...source,
                displayName:
                  source._label || source.label || source.properties?.title,
                originalResult: source,
              });
            } else {
              setSelectedGeotag(geotagBody);
            }
          }
        } else {
          setSelectedGeotag(null);
        }

        if (links.linking && links.linking.body) {
          const bodies = Array.isArray(links.linking.body)
            ? links.linking.body
            : [links.linking.body];

          const pointSelectorBody = bodies.find(
            (b: any) =>
              b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
          );
          if (pointSelectorBody && pointSelectorBody.selector) {
            setSelectedPoint({
              x: pointSelectorBody.selector.x,
              y: pointSelectorBody.selector.y,
            });
          } else {
            setSelectedPoint(null);
          }
        } else {
          setSelectedPoint(null);
        }
      } catch {
        setError('Failed to load existing linking information');
      } finally {
        setLoadingExistingData(false);
      }
    };

    const handleDeleteExistingLink = async (
      linkingId: string,
      motivation: 'linking' | 'geotagging',
    ) => {
      try {
        setError(null);
        await deleteLinkingRelationship(linkingId, motivation);

        if (canvasId) {
          invalidateLinkingCache(canvasId);
        }
        invalidateGlobalLinkingCache();

        if (onGlobalRefresh) {
          onGlobalRefresh();
        }

        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        if (selectedAnnotationId) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 300);
          });
          fetchExistingLinkingData(selectedAnnotationId, true);
        }

        if (motivation === 'linking') {
          setInternalSelected([]);
          if (setSelectedIds) {
            setSelectedIds([]);
          }
          setSelectedPoint(null);
        } else if (motivation === 'geotagging') {
          setSelectedGeotag(null);
        }

        onRefreshAnnotations?.();

        const motivationLabels = {
          linking: 'annotation links',
          geotagging: 'geotag',
        };

        toast({
          title: 'Deleted Successfully',
          description: `Removed ${motivationLabels[motivation]} from annotation.`,
        });
      } catch {
        const errorMessage = `Failed to delete ${motivation} relationship`;
        setError(errorMessage);

        toast({
          title: 'Delete Failed',
          description: errorMessage,
        });
      }
    };

    const handleDeleteBodyPurpose = async (
      purpose: 'geotagging' | 'selecting',
    ) => {
      if (!existingLinkingData.linking) return;

      const confirmed = window.confirm(
        `Are you sure you want to remove the ${purpose === 'geotagging' ? 'geotag' : 'point selection'} from this linking annotation? The linked annotations will remain intact.`,
      );

      if (!confirmed) return;

      try {
        setError(null);
        setIsSaving(true);

        const currentBody = Array.isArray(existingLinkingData.linking.body)
          ? existingLinkingData.linking.body
          : existingLinkingData.linking.body
            ? [existingLinkingData.linking.body]
            : [];

        const purposesToRemove =
          purpose === 'geotagging'
            ? ['identifying', 'geotagging']
            : ['selecting'];

        const filteredBody = currentBody.filter(
          (b: any) => !purposesToRemove.includes(b.purpose),
        );

        const updatedAnnotation = {
          ...existingLinkingData.linking,
          body: filteredBody,
          modified: new Date().toISOString(),
        };

        const annotationId = existingLinkingData.linking.id;
        const encodedId = encodeURIComponent(encodeURIComponent(annotationId));
        const response = await fetch(`/api/annotations/linking/${encodedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAnnotation),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Update failed: ${response.status}`,
          );
        }

        if (canvasId) {
          invalidateLinkingCache(canvasId);
        }
        invalidateGlobalLinkingCache();

        if (onGlobalRefresh) {
          onGlobalRefresh();
        }

        if (purpose === 'geotagging') {
          setSelectedGeotag(null);
        } else {
          setSelectedPoint(null);
        }

        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        if (selectedAnnotationId) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 300);
          });
          fetchExistingLinkingData(selectedAnnotationId, true);
        }

        toast({
          title: 'Removed Successfully',
          description: `Removed ${purpose === 'geotagging' ? 'geotag' : 'point selection'} while preserving other data.`,
        });
      } catch (deleteError: unknown) {
        const errorMessage =
          deleteError instanceof Error
            ? deleteError.message
            : `Failed to remove ${purpose} data`;
        setError(errorMessage);

        toast({
          title: 'Update Failed',
          description: errorMessage,
        });
      } finally {
        setIsSaving(false);
      }
    };

    // Sync NeRu geotag with current dataset
    const handleSyncNeRuGeotag = async (globId: string) => {
      if (!existingLinkingData.linking || !globId) return;

      try {
        setIsSyncing(true);
        setError(null);

        // Fetch fresh data from NeRu dataset
        const response = await fetch(
          `/api/neru/places?glob_id=${encodeURIComponent(globId)}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch NeRu place data');
        }

        const data = await response.json();
        if (!data.features || data.features.length === 0) {
          throw new Error(
            `Place with glob_id "${globId}" not found in dataset`,
          );
        }

        const neruPlace = data.features[0].originalData;
        const title = neruPlace._label;

        // Extract coordinates from WKT
        let coords: [number, number] = [0, 0];
        if (neruPlace.defined_by) {
          const match = neruPlace.defined_by.match(/POINT \(([^ ]+) ([^ ]+)\)/);
          if (match && match[1] && match[2]) {
            coords = [parseFloat(match[1]), parseFloat(match[2])];
          }
        }

        // Build updated body items
        const currentBody = Array.isArray(existingLinkingData.linking.body)
          ? existingLinkingData.linking.body
          : existingLinkingData.linking.body
            ? [existingLinkingData.linking.body]
            : [];

        // Filter out old geotag/identifying bodies
        const filteredBody = currentBody.filter(
          (b: any) => b.purpose !== 'geotagging' && b.purpose !== 'identifying',
        );

        // Add fresh identifying body
        filteredBody.push({
          purpose: 'identifying',
          type: 'SpecificResource',
          source: {
            id:
              neruPlace.id ||
              `https://id.necessaryreunions.org/place/${globId}`,
            type: 'Place',
            label: title,
            _label: title,
            glob_id: globId,
            defined_by:
              neruPlace.defined_by || `POINT(${coords[0]} ${coords[1]})`,
            classified_as: neruPlace.classified_as,
            identified_by: neruPlace.identified_by,
            coord_certainty: neruPlace.coord_certainty,
          },
        });

        // Add fresh geotagging body
        filteredBody.push({
          purpose: 'geotagging',
          type: 'SpecificResource',
          source: {
            id:
              neruPlace.id ||
              `https://id.necessaryreunions.org/place/${globId}`,
            type: 'Feature',
            properties: {
              title: title,
              description: title,
              glob_id: globId,
              classified_as: neruPlace.classified_as,
              coord_certainty: neruPlace.coord_certainty,
            },
            geometry: {
              type: 'Point',
              coordinates: coords,
            },
            _label: title,
            glob_id: globId,
            classified_as: neruPlace.classified_as,
            identified_by: neruPlace.identified_by,
            defined_by: neruPlace.defined_by,
            coord_certainty: neruPlace.coord_certainty,
          },
        });

        // Update the annotation
        const updatedAnnotation = {
          ...existingLinkingData.linking,
          body: filteredBody,
          modified: new Date().toISOString(),
        };

        const annotationId = existingLinkingData.linking.id;
        const encodedId = encodeURIComponent(encodeURIComponent(annotationId));
        const updateResponse = await fetch(
          `/api/annotations/linking/${encodedId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedAnnotation),
          },
        );

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Update failed: ${updateResponse.status}`,
          );
        }

        // Invalidate caches and refresh
        if (canvasId) {
          invalidateLinkingCache(canvasId);
        }
        invalidateGlobalLinkingCache();

        if (onGlobalRefresh) {
          onGlobalRefresh();
        }

        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        if (selectedAnnotationId) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 300);
          });
          fetchExistingLinkingData(selectedAnnotationId, true);
        }

        const hasNewCoords = coords[0] !== 0 || coords[1] !== 0;
        toast({
          title: 'Synced with Dataset',
          description: hasNewCoords
            ? `Updated geotag with coordinates: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`
            : 'Geotag updated (no coordinates available in dataset)',
        });
      } catch (syncError: unknown) {
        const errorMessage =
          syncError instanceof Error
            ? syncError.message
            : 'Failed to sync with NeRu dataset';
        setError(errorMessage);

        toast({
          title: 'Sync Failed',
          description: errorMessage,
        });
      } finally {
        setIsSyncing(false);
      }
    };

    function moveSelected(idx: number, dir: -1 | 1) {
      const newOrder = [...currentlySelectedForLinking];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return;
      const temp = newOrder[idx]!;
      newOrder[idx] = newOrder[swapIdx]!;
      newOrder[swapIdx] = temp;
      setSelected(newOrder);
      setHasManuallyReordered(true);
      setForceUpdate((prev) => prev + 1);

      if (onLinkedAnnotationsOrderChange) {
        onLinkedAnnotationsOrderChange(newOrder);
      }

      if (isLinkingMode && selectedAnnotationsForLinking.length > 0) {
        linkingModeContext.clearLinkingSelection();
        newOrder.forEach((id: string) =>
          linkingModeContext.addAnnotationToLinking(id),
        );
      }
    }

    const handleStartPointSelection = () => {
      setIsPointSelectionActive(true);
      if (onEnablePointSelection) {
        onEnablePointSelection();
      }
    };

    const handlePointChange = (point: { x: number; y: number } | null) => {
      setSelectedPoint(point);
      setIsPointSelectionActive(false);
      if (onPointChange) {
        onPointChange(point);
      }
      if (onDisablePointSelection) {
        onDisablePointSelection();
      }
    };

    const handleSave = async () => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      setError(null);

      const existingAnnotationId = existingLinkingData.linking?.id || null;

      try {
        if (
          currentlySelectedForLinking.length === 0 &&
          !selectedGeotag &&
          !selectedPoint &&
          !existingAnnotationId
        ) {
          throw new Error(
            'Nothing to save - please select annotations, add geotag, or set point selection',
          );
        }

        if (
          !existingAnnotationId &&
          currentlySelectedForLinking.length === 1 &&
          !selectedGeotag &&
          !selectedPoint
        ) {
          throw new Error(
            'Need at least 2 annotations to link, or add geotag/point selection data',
          );
        }

        if (existingAnnotationId && currentlySelectedForLinking.length > 0) {
          if (
            currentlySelectedForLinking.length === 1 &&
            !selectedGeotag &&
            !selectedPoint
          ) {
            throw new Error(
              'A linking annotation needs at least 2 annotations, or add geotag/point data',
            );
          }
        }

        const geotagToSave = selectedGeotag?.originalResult || selectedGeotag;
        console.log('[LinkingAnnotationWidget] Saving with geotag:', {
          selectedGeotag,
          originalResult: selectedGeotag?.originalResult,
          geotagToSave,
          geotagKeys: geotagToSave ? Object.keys(geotagToSave) : null,
        });

        await onSave({
          linkedIds: currentlySelectedForLinking,
          geotag: geotagToSave,
          point: selectedPoint,
          existingLinkingId: existingAnnotationId,
        });

        const isUpdating = !!existingAnnotationId;
        if (!isUpdating) {
          setForceUpdate((prev) => prev + 1);
        }

        if (canvasId) {
          invalidateLinkingCache(canvasId);
        }
        invalidateGlobalLinkingCache();

        if (onGlobalRefresh) {
          onGlobalRefresh();
        }

        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        // Single refresh after save - wait for global refresh to complete
        if (selectedAnnotationId) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 500);
          });
          fetchExistingLinkingData(selectedAnnotationId, true);
        }

        const locationName =
          selectedGeotag?.displayName || selectedGeotag?.label;
        const parts = [];

        if (selectedGeotag && locationName) {
          parts.push(`location: ${locationName}`);
        } else if (selectedGeotag) {
          parts.push('geographic data');
        }

        if (selectedPoint) {
          parts.push('point selection');
        }

        let annotationCount = currentlySelectedForLinking.length;
        if (
          isUpdating &&
          annotationCount === 0 &&
          existingLinkingData.linking?.target
        ) {
          const existingTargets = Array.isArray(
            existingLinkingData.linking.target,
          )
            ? existingLinkingData.linking.target
            : [existingLinkingData.linking.target];
          annotationCount = existingTargets.length;
        }

        if (annotationCount > 1) {
          parts.unshift(`${annotationCount} annotations`);
        }

        const contextInfo =
          parts.length > 0 ? ` with ${parts.join(' and ')}` : '';
        const title = isUpdating
          ? 'Linking annotation updated'
          : 'Linking annotation saved';
        const description = `Successfully ${
          isUpdating ? 'updated' : 'saved'
        } link between ${annotationCount} annotation${
          annotationCount > 1 ? 's' : ''
        }${contextInfo}`;

        toast({
          title,
          description,
        });

        if (isLinkingMode && onDisableLinkingMode) {
          setTimeout(() => {
            onDisableLinkingMode();
          }, 1000);
        }

        if (isPointSelectionActive && onDisablePointSelection) {
          setTimeout(() => {
            setIsPointSelectionActive(false);
            onDisablePointSelection();
          }, 1000);
        }
      } catch (e: any) {
        const errorMessage =
          e.message || 'An unknown error occurred during save.';
        setError(errorMessage);

        const isUpdating = !!existingAnnotationId;

        toast({
          title: isUpdating ? 'Failed to update' : 'Failed to save',
          description: errorMessage,
        });
      } finally {
        setIsSaving(false);
      }
    };

    React.useEffect(() => {
      return () => {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        lastFetchRef.current = null;
      };
    }, []);

    if (!canEdit) return null;

    return (
      <Card className="mt-3 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Link className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Linking</span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              !userSession?.user ||
              isSaving ||
              (currentlySelectedForLinking.length === 0 &&
                !selectedGeotag &&
                !selectedPoint)
            }
            className="ml-auto h-7"
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mb-2">
            {error}
          </div>
        )}

        {selectedAnnotationId && loadingExistingData && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
              Loading...
            </div>
          </div>
        )}
        {/* @ts-ignore */}
        <Tabs defaultValue={defaultTab} className="w-full">
          {/* @ts-ignore */}
          <TabsList className="grid w-full grid-cols-3">
            {/* @ts-ignore */}
            <TabsTrigger value="link" className="text-xs">
              <Link className="h-3 w-3 mr-1" />
              Link
            </TabsTrigger>
            {/* @ts-ignore */}
            <TabsTrigger value="geotag" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              Geotag
            </TabsTrigger>
            {/* @ts-ignore */}
            <TabsTrigger value="point" className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Point
            </TabsTrigger>
          </TabsList>
          {/* @ts-ignore */}
          <TabsContent value="link" className="space-y-3">
            {!isLinkingMode &&
              currentlySelectedForLinking.length === 0 &&
              !existingLinkingData.linking?.target && (
                <div className="p-4 bg-muted/30 rounded-lg text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No linked annotations yet
                  </p>
                  {onEnableLinkingMode && (
                    <Button
                      size="sm"
                      onClick={() => {
                        linkingModeContext.clearLinkingSelection();
                        onEnableLinkingMode();
                      }}
                      disabled={!canEdit}
                      className="inline-flex items-center gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      Start Linking
                    </Button>
                  )}
                </div>
              )}

            {(() => {
              const displayedLinks =
                currentlySelectedForLinking.length > 0
                  ? currentlySelectedForLinking
                  : existingLinkingData.linking?.target
                    ? Array.isArray(existingLinkingData.linking.target)
                      ? existingLinkingData.linking.target
                      : [existingLinkingData.linking.target]
                    : [];

              if (displayedLinks.length === 0) {
                return null;
              }

              return (
                <div className="p-2 border rounded bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Link className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        {displayedLinks.length} Linked
                      </span>
                      {isLinkingMode && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          EDITING
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {onEnableLinkingMode && !isLinkingMode && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            linkingModeContext.clearLinkingSelection();
                            currentlySelectedForLinking.forEach((id: string) =>
                              linkingModeContext.addAnnotationToLinking(id),
                            );
                            onEnableLinkingMode();
                          }}
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs"
                          title="Add more annotations"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                      {existingLinkingData.linking && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleDeleteExistingLink(
                              existingLinkingData.linking.id,
                              'linking',
                            )
                          }
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          title="Delete all links"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {displayedLinks.map((targetId: string, index: number) => {
                      const annotation = annotations.find(
                        (a) => a.id === targetId,
                      );
                      const isCurrentAnnotation =
                        targetId === selectedAnnotationId;
                      const linkingDetails = linkingDetailsCache[targetId];

                      if (!annotation) return null;

                      const annotationText = getAnnotationText(annotation);
                      const isIcon =
                        annotation.motivation === 'iconography' ||
                        annotation.motivation === 'iconograpy';

                      return (
                        <div
                          key={targetId}
                          className={`p-1.5 rounded border text-xs flex items-center gap-2 ${
                            isCurrentAnnotation
                              ? 'bg-primary/15 border-primary/30'
                              : 'bg-primary/5 border-primary/20'
                          }`}
                        >
                          <span className="text-primary/60 w-4 font-medium">
                            {index + 1}.
                          </span>
                          {isIcon ? (
                            <Image className="h-3 w-3 text-primary/80 flex-shrink-0" />
                          ) : (
                            <Type className="h-3 w-3 text-primary/80 flex-shrink-0" />
                          )}
                          <span className="flex-1 truncate text-primary/90">
                            {isIcon ? 'Icon' : annotationText || '(Empty)'}
                          </span>
                          {linkingDetails?.geotagging && (
                            <MapPin className="h-2.5 w-2.5 text-secondary flex-shrink-0" />
                          )}
                          {linkingDetails?.pointSelection && (
                            <Plus className="h-2.5 w-2.5 text-accent flex-shrink-0" />
                          )}

                          <div className="flex items-center gap-0.5 ml-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSelected(index, -1);
                              }}
                              disabled={!canEdit || index === 0}
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                              title="Move up"
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 15l7-7 7 7"
                                />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSelected(index, 1);
                              }}
                              disabled={
                                !canEdit || index === displayedLinks.length - 1
                              }
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                              title="Move down"
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newOrder = displayedLinks.filter(
                                  (id: string) => id !== targetId,
                                );
                                setSelected(newOrder);
                                setHasManuallyReordered(true);
                                setForceUpdate((prev) => prev + 1);
                                if (onLinkedAnnotationsOrderChange) {
                                  onLinkedAnnotationsOrderChange(newOrder);
                                }
                              }}
                              disabled={!canEdit}
                              className="h-5 w-5 p-0 hover:bg-destructive/10 text-destructive"
                              title="Remove from link"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              {isLinkingMode && !existingLinkingData.linking?.target && (
                <div className="p-2 bg-primary/10 border border-primary/30 rounded-md text-center">
                  <div className="text-xs text-primary font-medium flex items-center justify-center gap-1">
                    <Link className="h-3 w-3" />
                    Click annotations to connect them
                  </div>
                  {onDisableLinkingMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const currentSelection = currentlySelectedForLinking;

                        setInternalSelected(currentSelection);
                        if (setSelectedIds) {
                          setSelectedIds(currentSelection);
                        }

                        setHasManuallyReordered(true);
                        setForceUpdate((prev) => prev + 1);

                        linkingModeContext.exitLinkingMode();
                        onDisableLinkingMode();

                        if (
                          onLinkedAnnotationsOrderChange &&
                          currentSelection.length > 1
                        ) {
                          setTimeout(() => {
                            onLinkedAnnotationsOrderChange(currentSelection);
                          }, 200);
                        }

                        toast({
                          title: 'Linking Mode Exited',
                          description: `Selection updated. Use the Save button to persist your linking annotation.`,
                        });
                      }}
                      className="mt-2 h-6 px-2 text-xs"
                      disabled={isSaving}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Done
                    </Button>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          {/* @ts-ignore */}
          <TabsContent value="geotag" className="space-y-3">
            {!selectedGeotag &&
              existingLinkingData.linking?.body &&
              Array.isArray(existingLinkingData.linking.body) &&
              (() => {
                const geotagBody = existingLinkingData.linking.body.find(
                  (b: any) => b.purpose === 'geotagging',
                );
                const globId =
                  geotagBody?.source?.glob_id ||
                  geotagBody?.source?.properties?.glob_id;
                const hasCoordinates =
                  geotagBody?.source?.geometry?.coordinates &&
                  (geotagBody.source.geometry.coordinates[0] !== 0 ||
                    geotagBody.source.geometry.coordinates[1] !== 0);

                return geotagBody ? (
                  <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-secondary-foreground flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Current Location
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="text-xs">
                            <span className="font-medium">Name:</span>{' '}
                            {geotagBody.source?.properties?.title ||
                              geotagBody.source?.label ||
                              'Location'}
                          </div>
                          {globId && (
                            <div className="text-xs">
                              <span className="font-medium">ID:</span>{' '}
                              <span className="font-mono">{globId}</span>
                            </div>
                          )}
                          {geotagBody.source?.properties?.type && (
                            <div className="text-xs">
                              <span className="font-medium">Type:</span>{' '}
                              {geotagBody.source.properties.type}
                            </div>
                          )}
                          {hasCoordinates ? (
                            <div className="text-xs">
                              <span className="font-medium">Coordinates:</span>{' '}
                              {geotagBody.source.geometry.coordinates.join(
                                ', ',
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                              No coordinates available
                            </div>
                          )}
                        </div>
                        {globId && (
                          <div className="mt-2 pt-2 border-t border-secondary/30">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncNeRuGeotag(globId)}
                              disabled={!canEdit || isSaving || isSyncing}
                              className="h-6 px-2 text-xs"
                              title="Manually refresh from latest NeRu dataset"
                            >
                              <RefreshCw
                                className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`}
                              />
                              {isSyncing ? 'Syncing...' : 'Refresh'}
                            </Button>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Geotags sync automatically when the dataset
                              updates
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBodyPurpose('geotagging')}
                        disabled={!canEdit || isSaving}
                        className="h-6 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        title="Remove geotag"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}

            {React.createElement(geoTagMap, {
              key: componentId.current,
              onGeotagSelected: (geotag: any) => {
                console.log(
                  '[LinkingAnnotationWidget] onGeotagSelected received:',
                  geotag,
                );
                setSelectedGeotag(geotag);
              },
              onGeotagCleared: () => setSelectedGeotag(null),
              initialGeotag: initialGeotag,
              showClearButton: !!selectedGeotag,
            })}
          </TabsContent>

          <TabsContent value="point" className="space-y-3">
            {!selectedPoint &&
              existingLinkingData.linking?.body &&
              Array.isArray(existingLinkingData.linking.body) &&
              (() => {
                const pointBody = existingLinkingData.linking.body.find(
                  (b: any) =>
                    b.purpose === 'selecting' &&
                    b.selector?.type === 'PointSelector',
                );
                return pointBody ? (
                  <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-accent flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Current Point
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="text-xs">
                            <span className="font-medium">X:</span>{' '}
                            {pointBody.selector.x}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Y:</span>{' '}
                            {pointBody.selector.y}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBodyPurpose('selecting')}
                        disabled={!canEdit || isSaving}
                        className="h-6 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        title="Remove point"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}

            <PointSelector
              value={selectedPoint}
              onChange={handlePointChange}
              canvasId={canvasId}
              disabled={!canEdit}
              expandedStyle={true}
              existingAnnotations={availableAnnotations}
              currentAnnotationId={selectedAnnotationId}
              onStartSelecting={handleStartPointSelection}
              viewer={props.viewer}
              hideDisplay={false}
            />
          </TabsContent>
        </Tabs>
      </Card>
    );
  },
);

export default LinkingAnnotationWidget;
