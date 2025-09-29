import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/shared/Tabs';
import { useLinkingMode } from '@/components/viewer/LinkingModeContext';
import { ValidationDisplay } from '@/components/viewer/LinkingValidation';
import { PointSelector } from '@/components/viewer/PointSelector';
import { invalidateBulkLinkingCache } from '@/hooks/use-bulk-linking-annotations';
import { invalidateLinkingCache } from '@/hooks/use-linking-annotations';
import { useToast } from '@/hooks/use-toast';
import {
  deleteLinkingRelationship,
  getLinkingAnnotationsForAnnotation,
} from '@/lib/viewer/linking-validation';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Image,
  Link,
  MapPin,
  Plus,
  Save,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useRef, useState } from 'react';

// Dynamic import for GeoTagMap to prevent SSR issues with Leaflet
const GeoTagMap = dynamic(
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

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23587158' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

interface Annotation {
  id: string;
  motivation?: string;
  body?: any;
  label?: string;
  shortLabel?: string;
}

interface LinkingAnnotationWidgetProps {
  annotations: any[];
  currentlySelectedForLinking: string[];
  isLinkingMode: boolean;
  onSelectionChange: (annotationIds: string[]) => void;
  onCreateLinkingAnnotation: (
    linkedAnnotationIds: string[],
    selectedGeotag?: any,
  ) => Promise<void>;
  onUpdateLinkingAnnotation: (
    linkingAnnotationId: string,
    linkedAnnotationIds: string[],
    selectedGeotag?: any,
  ) => Promise<void>;
  onDeleteLinkingAnnotation: (linkingAnnotationId: string) => Promise<void>;
  onDeleteLinkedAnnotation: (
    linkingAnnotationId: string,
    targetId: string,
  ) => Promise<void>;
  onDeleteGeotag: (linkingAnnotationId: string) => Promise<void>;
  onRefreshAnnotations?: () => void;
  canEdit: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
  alreadyLinkedIds?: string[];
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
  viewer?: any; // Add viewer prop
}

export const LinkingAnnotationWidget = React.memo(
  function LinkingAnnotationWidget(
    props: LinkingAnnotationWidgetProps,
  ): React.ReactElement | null {
    const {
      canEdit = true,
      isExpanded = true,
      onToggleExpand = () => {},
      onSave = async () => {},
      annotations = [],
      availableAnnotations = [],
      selectedIds,
      setSelectedIds,
      session,
      alreadyLinkedIds = [],
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
    } = props;

    const linkingModeContext = useLinkingMode();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [selectedGeotag, setSelectedGeotag] = useState<any>(
      initialGeotag?.originalResult || null,
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
      `widget-${Math.random().toString(36).substr(2, 9)}`,
    );

    const lastFetchRef = useRef<string | null>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const selected = selectedIds !== undefined ? selectedIds : internalSelected;
    const setSelected = setSelectedIds || setInternalSelected;
    const userSession = session || { user: { name: 'Demo User' } };

    // Add the same helper functions from AnnotationList
    const getBodies = (annotation: any) => {
      const bodies = Array.isArray(annotation.body)
        ? annotation.body
        : ([annotation.body] as any[]);
      return bodies.filter((b: any) => b.type === 'TextualBody');
    };

    const getAnnotationText = React.useCallback((annotation: any) => {
      const bodies = getBodies(annotation);

      // Priority 1: Human-created bodies (no generator)
      const humanBody = bodies.find(
        (body: any) =>
          !body.generator && body.value && body.value.trim().length > 0,
      );

      if (humanBody) {
        return humanBody.value;
      }

      // Priority 2: Loghi AI bodies
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

      // Priority 3: Other AI bodies
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

    // Create a comprehensive linking details cache similar to AnnotationList
    const linkingDetailsCache = React.useMemo(() => {
      const cache: Record<string, any> = {};

      // Process all annotations to build comprehensive linking details
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

        // Check if this annotation has linking data
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

            // Check for point selection in linking annotation body
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

        // Check for geotagging data
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
              const props = source.properties;
              if (props.title) {
                extractedName = props.title;
              } else if (props.preferredTitle) {
                extractedName = props.preferredTitle;
              } else if (props.display_name) {
                extractedName = props.display_name;
              }
              if (props.type) {
                extractedType = props.type;
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

        // Only cache if we have meaningful details
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
      if (isLinkingMode && selectedAnnotationsForLinking.length > 0) {
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
        fetchExistingLinkingData(selectedAnnotationId);
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

    const fetchExistingLinkingData = async (
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

        if (forceRefresh && canvasId) {
          invalidateLinkingCache(canvasId);
        }

        const links = await getLinkingAnnotationsForAnnotation(
          annotationId,
          canvasId,
        );
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
            setSelectedGeotag(geotagBody);
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
      } catch (err: any) {
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

        // Invalidate caches immediately after deletion
        if (canvasId) {
          invalidateLinkingCache(canvasId);
          invalidateBulkLinkingCache(canvasId);
        }

        if (selectedAnnotationId) {
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
            onRefreshAnnotations?.();
          }, 300);
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
      } catch (err: any) {
        const errorMessage = `Failed to delete ${motivation} relationship: ${err.message}`;
        setError(errorMessage);

        toast({
          title: 'Delete Failed',
          description: errorMessage,
        });
      }
    };

    function getAnnotationLabel(anno: Annotation | undefined) {
      if (!anno) return 'Unknown';
      if (anno.motivation === 'iconography' || anno.motivation === 'iconograpy')
        return 'Icon annotation';
      if (Array.isArray(anno.body) && anno.body.length > 0) {
        const textBody = anno.body.find(
          (b: any) => typeof b.value === 'string' && b.value.trim().length > 0,
        );
        if (textBody && textBody.value)
          return textBody.value.length > 30
            ? textBody.value.slice(0, 30) + '…'
            : textBody.value;
      }
      return 'Text annotation';
    }

    function handleSelect(id: string) {
      if (alreadyLinkedIds.includes(id) && !selected.includes(id)) {
        setError('This annotation is already linked elsewhere.');
        return;
      }
      setError(null);
      if (selected.includes(id)) {
        setSelected(selected.filter((x) => x !== id));
      } else {
        setSelected([...selected, id]);
      }
    }

    function moveSelected(idx: number, dir: -1 | 1) {
      const newOrder = [...currentlySelectedForLinking];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
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

    const handleClearPoint = () => {
      setSelectedPoint(null);
      setIsPointSelectionActive(false);
      if (onPointChange) {
        onPointChange(null);
      }
      if (onDisablePointSelection) {
        onDisablePointSelection();
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
          !selectedPoint
        ) {
          throw new Error(
            'Nothing to save - please select annotations, add geotag, or set point selection',
          );
        }

        if (
          currentlySelectedForLinking.length === 1 &&
          !selectedGeotag &&
          !selectedPoint
        ) {
          throw new Error(
            'Need at least 2 annotations to link, or add geotag/point selection data',
          );
        }

        await onSave({
          linkedIds: currentlySelectedForLinking,
          geotag: selectedGeotag,
          point: selectedPoint,
          existingLinkingId: existingAnnotationId,
        });

        const isUpdating = !!existingAnnotationId;
        if (!isUpdating) {
          setForceUpdate((prev) => prev + 1);
        }

        if (selectedAnnotationId) {
          // Invalidate both individual and bulk caches immediately
          if (canvasId) {
            invalidateLinkingCache(canvasId);
            invalidateBulkLinkingCache(canvasId);
          }

          onRefreshAnnotations?.();
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
          }, 100);
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
            onRefreshAnnotations?.();
          }, 500);
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
            onRefreshAnnotations?.();
          }, 1000);
        }

        const locationName =
          selectedGeotag?.display_name ||
          selectedGeotag?.label ||
          selectedGeotag?.properties?.title;
        const parts = [];

        if (selectedGeotag && locationName) {
          parts.push(`location: ${locationName}`);
        } else if (selectedGeotag) {
          parts.push('geographic data');
        }

        if (selectedPoint) {
          parts.push('point selection');
        }

        if (currentlySelectedForLinking.length > 1) {
          parts.unshift(`${currentlySelectedForLinking.length} annotations`);
        }

        const contextInfo =
          parts.length > 0 ? ` with ${parts.join(' and ')}` : '';
        const title = isUpdating
          ? 'Linking annotation updated'
          : 'Linking annotation saved';
        const description = `Successfully ${
          isUpdating ? 'updated' : 'saved'
        } link between ${currentlySelectedForLinking.length} annotation${
          currentlySelectedForLinking.length > 1 ? 's' : ''
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

    if (!canEdit) return null;

    React.useEffect(() => {
      return () => {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        lastFetchRef.current = null;
      };
    }, []);

    return (
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Link className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Link Annotations</span>
          </div>
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
            className="ml-auto"
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving
              ? existingLinkingData.linking
                ? 'Updating...'
                : 'Saving...'
              : existingLinkingData.linking
              ? 'Update'
              : 'Save'}
          </Button>
        </div>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mb-2">
            {error}
          </div>
        )}

        {selectedAnnotationId && (
          <div className="mb-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Current Links & Data
            </div>

            {loadingExistingData ? (
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                Loading...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Linked Annotations */}
                {existingLinkingData.linking && (
                  <div className="p-3 border rounded-md bg-primary/5 border-primary/20">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-primary flex items-center gap-2">
                          <Link className="h-4 w-4" />
                          Linked Annotations
                          {isLinkingMode && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              EDITING
                            </span>
                          )}
                        </div>

                        {/* Connected annotations list */}
                        {Array.isArray(existingLinkingData.linking.target) &&
                          existingLinkingData.linking.target.length > 1 && (
                            <div className="mt-2 space-y-2">
                              <div className="text-xs text-primary/70 font-medium">
                                {existingLinkingData.linking.target.length}{' '}
                                linked annotations:
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {existingLinkingData.linking.target.map(
                                  (targetId: string, index: number) => {
                                    const shortId =
                                      targetId.split('/').pop() || '';
                                    const annotation = annotations.find(
                                      (a) => a.id === targetId,
                                    );
                                    const isCurrentAnnotation =
                                      targetId === selectedAnnotationId;
                                    const linkingDetails =
                                      linkingDetailsCache[targetId];

                                    if (!annotation) return null;

                                    const annotationText =
                                      getAnnotationText(annotation);
                                    const isIcon =
                                      annotation.motivation === 'iconography' ||
                                      annotation.motivation === 'iconograpy';

                                    return (
                                      <div
                                        key={targetId}
                                        className={`p-2 rounded border transition-colors ${
                                          isCurrentAnnotation
                                            ? 'bg-primary/20 border-primary/40'
                                            : 'bg-primary/10 border-primary/30 hover:bg-primary/15'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-xs font-mono text-primary/60 w-6">
                                              {index + 1}.
                                            </span>
                                            {isIcon ? (
                                              <Image className="h-3 w-3 text-primary/80" />
                                            ) : (
                                              <Type className="h-3 w-3 text-primary/80" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-mono text-primary/60 mb-1">
                                              {shortId}{' '}
                                              {isCurrentAnnotation &&
                                                '(current)'}
                                            </div>
                                            <div className="text-xs text-primary/90">
                                              {isIcon ? (
                                                <span className="italic">
                                                  Icon annotation
                                                </span>
                                              ) : annotationText ? (
                                                <span className="line-clamp-2">
                                                  {annotationText}
                                                </span>
                                              ) : (
                                                <span className="italic text-primary/60">
                                                  (Empty text)
                                                </span>
                                              )}
                                            </div>

                                            {/* Show enhancement details */}
                                            {linkingDetails && (
                                              <div className="mt-1 flex items-center gap-1">
                                                {linkingDetails.geotagging && (
                                                  <div className="flex items-center gap-1 text-xs text-secondary">
                                                    <MapPin className="h-2 w-2" />
                                                    <span>
                                                      {
                                                        linkingDetails
                                                          .geotagging.name
                                                      }
                                                    </span>
                                                  </div>
                                                )}
                                                {linkingDetails.pointSelection && (
                                                  <div className="flex items-center gap-1 text-xs text-accent">
                                                    <Plus className="h-2 w-2" />
                                                    <span>
                                                      (
                                                      {
                                                        linkingDetails
                                                          .pointSelection.x
                                                      }
                                                      ,{' '}
                                                      {
                                                        linkingDetails
                                                          .pointSelection.y
                                                      }
                                                      )
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}

                        {/* Point selection info */}
                        {existingLinkingData.linking.body &&
                          Array.isArray(existingLinkingData.linking.body) &&
                          (() => {
                            const pointBody =
                              existingLinkingData.linking.body.find(
                                (b: any) =>
                                  b.purpose === 'selecting' &&
                                  b.selector?.type === 'PointSelector',
                              );
                            return pointBody ? (
                              <div className="mt-3 p-2 bg-accent/10 border border-accent/30 rounded">
                                <div className="text-xs font-medium text-accent flex items-center gap-1">
                                  <Plus className="h-3 w-3" />
                                  Point Selection
                                </div>
                                <div className="text-xs text-accent/80 mt-1">
                                  Coordinates: ({pointBody.selector.x},{' '}
                                  {pointBody.selector.y})
                                </div>
                                <div className="text-xs text-accent/60 mt-1">
                                  Shown on all linked annotations
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-amber-600/80">
                                • No point selected
                              </div>
                            );
                          })()}

                        {/* Creation info */}
                        <div className="mt-2 text-xs text-primary/60">
                          {existingLinkingData.linking.creator && (
                            <div>
                              By:{' '}
                              {existingLinkingData.linking.creator.label ||
                                'Unknown'}
                            </div>
                          )}
                          {existingLinkingData.linking.modified && (
                            <div>
                              {new Date(
                                existingLinkingData.linking.modified,
                              ).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 ml-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (onEnableLinkingMode) {
                              const currentLinkedIds = Array.isArray(
                                existingLinkingData.linking.target,
                              )
                                ? existingLinkingData.linking.target
                                : [existingLinkingData.linking.target];

                              linkingModeContext.clearLinkingSelection();
                              currentLinkedIds.forEach((id: string) =>
                                linkingModeContext.addAnnotationToLinking(id),
                              );

                              setInternalSelected(currentLinkedIds);
                              if (setSelectedIds) {
                                setSelectedIds(currentLinkedIds);
                              }

                              onEnableLinkingMode();
                            }
                          }}
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDeleteExistingLink(
                              existingLinkingData.linking.id,
                              'linking',
                            )
                          }
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Geographic Location */}
                {existingLinkingData.geotagging && (
                  <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-secondary-foreground flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Location
                        </div>

                        {/* Location details */}
                        {(() => {
                          const geotagBody = Array.isArray(
                            existingLinkingData.geotagging.body,
                          )
                            ? existingLinkingData.geotagging.body.find(
                                (b: any) => b.purpose === 'geotagging',
                              )
                            : existingLinkingData.geotagging.body;

                          if (geotagBody?.source) {
                            const source = geotagBody.source;
                            let locationName =
                              source.label || 'Unknown Location';
                            let locationType = source.type || 'Place';

                            if (source.properties) {
                              const props = source.properties;
                              if (props.title) locationName = props.title;
                              else if (props.preferredTitle)
                                locationName = props.preferredTitle;
                              else if (props.display_name)
                                locationName = props.display_name;
                              if (props.type) locationType = props.type;
                            }

                            return (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs">
                                  <span className="font-medium">Name:</span>{' '}
                                  {locationName}
                                </div>
                                <div className="text-xs">
                                  <span className="font-medium">Type:</span>{' '}
                                  {locationType}
                                </div>
                                {source.geometry?.coordinates && (
                                  <div className="text-xs">
                                    <span className="font-medium">
                                      Coordinates:
                                    </span>{' '}
                                    {source.geometry.coordinates.join(', ')}
                                  </div>
                                )}
                                {source.coordinates?.latitude &&
                                  source.coordinates?.longitude && (
                                    <div className="text-xs">
                                      <span className="font-medium">
                                        Coordinates:
                                      </span>{' '}
                                      {source.coordinates.longitude},{' '}
                                      {source.coordinates.latitude}
                                    </div>
                                  )}
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Creation info */}
                        <div className="mt-2 text-xs text-secondary-foreground/60">
                          {existingLinkingData.geotagging.creator && (
                            <div>
                              By:{' '}
                              {existingLinkingData.geotagging.creator.label ||
                                'Unknown'}
                            </div>
                          )}
                          {existingLinkingData.geotagging.modified && (
                            <div>
                              {new Date(
                                existingLinkingData.geotagging.modified,
                              ).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 ml-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Switch to geotag tab
                            const tabsTrigger = document.querySelector(
                              '[value="geotag"]',
                            ) as HTMLElement;
                            if (tabsTrigger) {
                              tabsTrigger.click();
                            }
                          }}
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs border-secondary/30 text-secondary hover:bg-secondary hover:text-secondary-foreground"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDeleteExistingLink(
                              existingLinkingData.geotagging.id,
                              'geotagging',
                            )
                          }
                          disabled={!canEdit}
                          className="h-6 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* No data state */}
                {!existingLinkingData.linking &&
                  !existingLinkingData.geotagging && (
                    <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded border border-dashed border-muted-foreground/30 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Link className="h-4 w-4" />
                        <MapPin className="h-4 w-4" />
                        <Plus className="h-4 w-4" />
                      </div>
                      No links or data yet
                      <div className="text-xs text-muted-foreground/70 mt-1">
                        Use the tabs below to add links, location, or point data
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
        {/* @ts-ignore */}
        <Tabs defaultValue="link" className="w-full">
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
            <div className="text-sm text-muted-foreground">
              Connect annotations in reading order
            </div>

            {/* Current Selection Summary */}
            {currentlySelectedForLinking.length > 0 && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-sm font-medium text-primary flex items-center gap-2 mb-2">
                  <Link className="h-4 w-4" />
                  Current Selection ({currentlySelectedForLinking.length})
                </div>
                <div className="text-xs text-primary/80">
                  {currentlySelectedForLinking.length === 1
                    ? 'Select at least one more annotation to create a link'
                    : `Ready to link ${currentlySelectedForLinking.length} annotations together`}
                </div>
                {currentlySelectedForLinking.length > 1 && (
                  <div className="text-xs text-primary/60 mt-1">
                    Click Save to persist this linking relationship
                  </div>
                )}
              </div>
            )}

            {/* Validation display - commented out to prevent popup issues */}
            {/* {currentlySelectedForLinking.length > 1 && (
              <ValidationDisplay
                annotationIds={currentlySelectedForLinking}
                motivation="linking"
              />
            )} */}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              {/* Show linking mode status when active */}
              {isLinkingMode && (
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

              {currentlySelectedForLinking.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    No annotations selected
                  </div>
                  {!isLinkingMode && (
                    <div className="p-3 bg-muted/30 rounded-md text-center">
                      <div className="text-sm text-muted-foreground mb-2">
                        Click annotations to connect them
                      </div>
                      {onEnableLinkingMode && (
                        <Button
                          size="sm"
                          onClick={() => {
                            linkingModeContext.clearLinkingSelection();

                            if (currentlySelectedForLinking.length > 0) {
                              currentlySelectedForLinking.forEach(
                                (id: string) =>
                                  linkingModeContext.addAnnotationToLinking(id),
                              );
                            }

                            onEnableLinkingMode();
                          }}
                          disabled={!canEdit}
                          className="inline-flex items-center gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          {currentlySelectedForLinking.length > 0
                            ? 'Continue Linking'
                            : 'Start Linking'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-1">
                    Connected annotations:
                  </div>
                  <ol className="flex flex-col gap-1">
                    {currentlySelectedForLinking.map((id, idx) => {
                      let anno = availableAnnotations.find((a) => a.id === id);
                      if (!anno) anno = annotations.find((a) => a.id === id);

                      function getAnnotationDisplayLabel(
                        annotation: Annotation | undefined,
                        fallbackId?: string,
                      ): string {
                        if (!annotation) {
                          if (fallbackId) {
                            const foundAnno = annotations.find(
                              (a) => a.id === fallbackId,
                            );
                            if (foundAnno) {
                              return getAnnotationDisplayLabel(foundAnno);
                            }
                            return 'Text annotation';
                          }
                          return 'Unknown annotation';
                        }
                        if (
                          annotation.motivation === 'iconography' ||
                          annotation.motivation === 'iconograpy'
                        ) {
                          return 'Icon annotation';
                        }
                        let bodies = Array.isArray(annotation.body)
                          ? annotation.body
                          : [];
                        if (bodies.length > 0) {
                          const loghiBody = bodies.find((b: any) =>
                            b.generator?.label?.toLowerCase().includes('loghi'),
                          );
                          if (loghiBody && loghiBody.value) {
                            return `"${loghiBody.value}" (textspotting)`;
                          }
                          if (bodies[0]?.value) {
                            const textContent = bodies[0].value;
                            const contentPreview =
                              textContent.length > 30
                                ? textContent.substring(0, 30) + '...'
                                : textContent;
                            const isAutomated = bodies.some(
                              (b: any) =>
                                b.generator?.label || b.generator?.name,
                            );
                            const typeLabel = isAutomated
                              ? 'automated text'
                              : 'human annotation';
                            return `"${contentPreview}" (${typeLabel})`;
                          }
                        }
                        return 'Text annotation';
                      }

                      if (!anno) {
                        return (
                          <li
                            key={id}
                            className="flex items-center bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6"
                          >
                            <span className="text-red-600">
                              Missing annotation: {id}
                            </span>
                          </li>
                        );
                      }

                      let displayLabel = getAnnotationDisplayLabel(anno, id);
                      return (
                        <li
                          key={id}
                          className="flex items-center bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6 transition-colors hover:bg-primary/5 hover:border-primary/20 group shadow-sm"
                          style={{
                            fontWeight: 400,
                            fontSize: '0.85rem',
                            maxWidth: 320,
                          }}
                        >
                          <span className="text-gray-400 mr-1 w-4 text-right select-none">
                            {idx + 1}.
                          </span>
                          <span
                            className="flex-1 truncate"
                            title={displayLabel}
                          >
                            {displayLabel}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-gray-400 hover:text-primary disabled:opacity-30"
                              disabled={!canEdit || idx === 0}
                              onClick={() => moveSelected(idx, -1)}
                              aria-label="Move up"
                              type="button"
                            >
                              ▲
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-gray-400 hover:text-primary disabled:opacity-30"
                              disabled={
                                !canEdit ||
                                idx === currentlySelectedForLinking.length - 1
                              }
                              onClick={() => moveSelected(idx, 1)}
                              aria-label="Move down"
                              type="button"
                            >
                              ▼
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                            disabled={!canEdit}
                            onClick={() =>
                              setSelected(
                                currentlySelectedForLinking.filter(
                                  (x) => x !== id,
                                ),
                              )
                            }
                            aria-label="Remove from linking"
                            type="button"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          </TabsContent>
          {/* @ts-ignore */}
          <TabsContent value="geotag" className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Add geographic location information
            </div>

            {/* Show current geotag data if exists */}
            {selectedGeotag && (
              <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-secondary-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Current Geographic Selection
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs">
                        <span className="font-medium">Name:</span>{' '}
                        {selectedGeotag.display_name ||
                          selectedGeotag.label ||
                          selectedGeotag.properties?.title ||
                          selectedGeotag.properties?.preferredTitle ||
                          'Unknown Location'}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Type:</span>{' '}
                        {selectedGeotag.type ||
                          selectedGeotag.properties?.type ||
                          'Place'}
                      </div>
                      {(selectedGeotag.geometry?.coordinates ||
                        (selectedGeotag.coordinates?.latitude &&
                          selectedGeotag.coordinates?.longitude)) && (
                        <div className="text-xs">
                          <span className="font-medium">Coordinates:</span>{' '}
                          {selectedGeotag.geometry?.coordinates
                            ? selectedGeotag.geometry.coordinates.join(', ')
                            : `${selectedGeotag.coordinates.longitude}, ${selectedGeotag.coordinates.latitude}`}
                        </div>
                      )}
                      <div className="text-xs text-secondary-foreground/70">
                        This location will be associated with the annotation
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedGeotag(null)}
                    disabled={!canEdit}
                    className="h-6 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Validation for geotagging - commented out to prevent popup issues */}
            {/* {currentlySelectedForLinking.length > 0 && (
              <ValidationDisplay
                annotationIds={currentlySelectedForLinking}
                motivation="geotagging"
              />
            )} */}

            <GeoTagMap
              key={componentId.current}
              onGeotagSelected={(geotag) =>
                setSelectedGeotag(geotag.originalResult)
              }
              onGeotagCleared={() => setSelectedGeotag(null)}
              initialGeotag={initialGeotag}
              showClearButton={!!selectedGeotag}
            />
          </TabsContent>

          {/* Point Selection Tab */}
          <TabsContent value="point" className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Select a point on the image to mark the exact location
            </div>

            {/* Show current point data if exists */}
            {selectedPoint && (
              <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-accent flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Current Point Selection
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs">
                        <span className="font-medium">X coordinate:</span>{' '}
                        {selectedPoint.x}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Y coordinate:</span>{' '}
                        {selectedPoint.y}
                      </div>
                      <div className="text-xs text-accent/70">
                        This point will be visible on all linked annotations
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearPoint}
                    disabled={!canEdit}
                    className="h-6 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Show notice for existing linking annotation without point data */}
            {existingLinkingData.linking && !selectedPoint && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-amber-600 mt-0.5">⚠️</div>
                  <div className="text-sm">
                    <div className="font-medium text-amber-800 mb-1">
                      No point selected for this link
                    </div>
                    <div className="text-amber-700 text-xs leading-relaxed">
                      This linking annotation exists but has no point marker on
                      the image. Select a point below and save to show the link
                      location on all connected maps.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentlySelectedForLinking.length === 0 &&
              !selectedPoint &&
              !existingLinkingData.linking && (
                <div className="p-4 bg-muted/20 border border-border rounded-lg text-center">
                  No point selected
                </div>
              )}

            <PointSelector
              value={selectedPoint}
              onChange={handlePointChange}
              canvasId={canvasId}
              disabled={!canEdit}
              expandedStyle={true}
              existingAnnotations={availableAnnotations}
              currentAnnotationId={selectedAnnotationId}
              onStartSelecting={handleStartPointSelection}
              viewer={props.viewer} // Pass viewer prop
            />
          </TabsContent>
        </Tabs>
      </Card>
    );
  },
);

export default LinkingAnnotationWidget;
