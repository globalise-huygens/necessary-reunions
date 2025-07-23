import {
  deleteLinkingRelationship,
  getLinkingAnnotationsForAnnotation,
} from '@/lib/linking-validation';
import {
  ChevronDown,
  ChevronUp,
  Link,
  MapPin,
  Plus,
  Save,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { ValidationDisplay } from './LinkingValidation';
import { PointSelector } from './PointSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

const GeoTagMap = dynamic(
  () => import('./GeoTagMap').then((mod) => ({ default: mod.GeoTagMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 bg-gray-100 rounded flex items-center justify-center">
        Loading map...
      </div>
    ),
  },
);

interface Annotation {
  id: string;
  motivation?: string;
  body?: any;
  label?: string;
  shortLabel?: string;
}

interface LinkingAnnotationWidgetProps {
  canEdit?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSave?: (data: {
    linkedIds: string[];
    geotag?: any;
    point?: any;
  }) => Promise<void>;
  annotations?: Annotation[];
  availableAnnotations?: Annotation[];
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  session?: any;
  alreadyLinkedIds?: string[];
  initialGeotag?: {
    marker: [number, number];
    label: string;
    originalResult: any;
  };
  onEnablePointSelection?: (
    handler: (point: { x: number; y: number }) => void,
  ) => void;
  onDisablePointSelection?: () => void;
  onPointChange?: (point: { x: number; y: number } | null) => void;
  initialPoint?: { x: number; y: number } | null;
  selectedAnnotationsForLinking?: string[];
  onEnableLinkingMode?: () => void;
  onDisableLinkingMode?: () => void;
  isLinkingMode?: boolean;
  selectedAnnotationId?: string | null;
  onRefreshAnnotations?: () => void;
  canvasId?: string; // Add canvasId prop
}

/**
 * LinkingAnnotationWidget - Enhanced linking system with individual deletion capabilities
 *
 * Key features:
 * - Fetches and displays existing linking data when an annotation is selected
 * - Individual deletion of linking, geotagging, and point selection relationships
 * - Auto-populates linked annotations, geotags, and points when an annotation is selected
 * - Shows all linked points when selecting an annotation
 *
 * Usage:
 * <LinkingAnnotationWidget
 *   selectedAnnotationId={selectedAnnotationId} // Pass the currently selected annotation ID
 *   onRefreshAnnotations={refreshAnnotations}   // Callback to refresh annotations after deletion
 *   // ... other props
 * />
 */
export function LinkingAnnotationWidget(
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
    onEnablePointSelection,
    onDisablePointSelection,
    onPointChange,
    initialPoint,
    selectedAnnotationsForLinking = [],
    onEnableLinkingMode,
    onDisableLinkingMode,
    isLinkingMode = false,
    selectedAnnotationId,
    onRefreshAnnotations,
    canvasId,
  } = props;

  const [isSaving, setIsSaving] = useState(false);
  const [selectedGeotag, setSelectedGeotag] = useState<any>(
    initialGeotag?.originalResult || null,
  );
  const [selectedPoint, setSelectedPoint] = useState<any>(initialPoint || null);
  const [error, setError] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [isPointSelectionActive, setIsPointSelectionActive] = useState(false);

  // Add state for existing linking data
  const [existingLinkingData, setExistingLinkingData] = useState<{
    linking?: any;
    geotagging?: any;
    pointSelection?: any;
  }>({});
  const [loadingExistingData, setLoadingExistingData] = useState(false);

  const componentId = useRef(
    `widget-${Math.random().toString(36).substr(2, 9)}`,
  );

  React.useEffect(() => {
    if (onPointChange) {
      onPointChange(selectedPoint);
    }
  }, [selectedPoint, onPointChange]);

  const selected = selectedIds !== undefined ? selectedIds : internalSelected;
  const setSelected = setSelectedIds || setInternalSelected;
  const userSession = session || { user: { name: 'Demo User' } };

  const currentlySelectedForLinking = (() => {
    // If we're in active linking mode and have selectedAnnotationsForLinking, use those
    if (isLinkingMode && selectedAnnotationsForLinking.length > 0) {
      return selectedAnnotationsForLinking;
    }
    // Otherwise, use the internal selected state (which includes fetched existing data)
    return selected;
  })();

  React.useEffect(() => {
    if (selectedAnnotationsForLinking.length > 0 && !selectedIds) {
      setInternalSelected(selectedAnnotationsForLinking);
    }
  }, [selectedAnnotationsForLinking, selectedIds]);

  // Fetch existing linking data when an annotation is selected
  React.useEffect(() => {
    if (selectedAnnotationId) {
      fetchExistingLinkingData(selectedAnnotationId);
    } else {
      setExistingLinkingData({});
    }
  }, [selectedAnnotationId]);

  const fetchExistingLinkingData = async (annotationId: string) => {
    try {
      setLoadingExistingData(true);
      setError(null);
      const links = await getLinkingAnnotationsForAnnotation(
        annotationId,
        canvasId,
      );
      console.log('LinkingAnnotationWidget: Fetched existing links:', links);
      setExistingLinkingData(links);

      // Auto-populate linked annotations, geotag, and point data
      if (links.linking && links.linking.target) {
        const linkedIds = Array.isArray(links.linking.target)
          ? links.linking.target
          : [links.linking.target];

        console.log('LinkingAnnotationWidget: Setting linked IDs:', linkedIds);

        // Always update the internal selected state with existing linked IDs
        setInternalSelected(linkedIds);

        // If there's a setSelectedIds function, also update the external state
        if (setSelectedIds) {
          setSelectedIds(linkedIds);
        }
      } else {
        console.log('LinkingAnnotationWidget: No existing linking data found');
        // Clear selected annotations if no linking data found
        setInternalSelected([]);
        if (setSelectedIds) {
          setSelectedIds([]);
        }
      }

      // Auto-populate geotag data
      if (links.geotagging && links.geotagging.body) {
        const geotagBody = Array.isArray(links.geotagging.body)
          ? links.geotagging.body.find((b: any) => b.purpose === 'geotagging')
          : links.geotagging.body;
        if (geotagBody) {
          setSelectedGeotag(geotagBody);
        }
      }

      // Auto-populate point data
      if (links.pointSelection && links.pointSelection.body) {
        const pointBody = Array.isArray(links.pointSelection.body)
          ? links.pointSelection.body.find(
              (b: any) => b.selector?.type === 'PointSelector',
            )
          : links.pointSelection.body;
        if (pointBody && pointBody.selector) {
          setSelectedPoint({
            x: pointBody.selector.x,
            y: pointBody.selector.y,
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching existing linking data:', err);
      setError('Failed to load existing linking information');
    } finally {
      setLoadingExistingData(false);
    }
  };

  const handleDeleteExistingLink = async (
    linkingId: string,
    motivation: 'linking' | 'geotagging' | 'point_selection',
  ) => {
    try {
      setError(null);
      await deleteLinkingRelationship(linkingId, motivation);

      // Refresh the existing data
      if (selectedAnnotationId) {
        await fetchExistingLinkingData(selectedAnnotationId);
      }

      // Clear local state for the deleted type
      if (motivation === 'linking') {
        setInternalSelected([]);
        if (setSelectedIds) {
          setSelectedIds([]);
        }
      } else if (motivation === 'geotagging') {
        setSelectedGeotag(null);
      } else if (motivation === 'point_selection') {
        setSelectedPoint(null);
        setIsPointSelectionActive(false);
        // Notify parent that point was cleared
        if (onPointChange) {
          onPointChange(null);
        }
        if (onDisablePointSelection) {
          onDisablePointSelection();
        }
      }

      // Notify parent to refresh annotations
      onRefreshAnnotations?.();
    } catch (err: any) {
      console.error(`Error deleting ${motivation} link:`, err);
      setError(`Failed to delete ${motivation} relationship: ${err.message}`);
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
    const newOrder = [...selected];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setSelected(newOrder);
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        linkedIds: currentlySelectedForLinking,
        geotag: selectedGeotag,
        point: selectedPoint,
      });
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred during save.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) return null;

  const handleStartPointSelection = () => {
    if (onEnablePointSelection) {
      setIsPointSelectionActive(true);
      setTimeout(() => {
        onEnablePointSelection((point: { x: number; y: number }) => {
          if (
            point &&
            typeof point.x === 'number' &&
            typeof point.y === 'number'
          ) {
            setSelectedPoint(point);
            setIsPointSelectionActive(false);
            if (onDisablePointSelection) {
              onDisablePointSelection();
            }
          } else {
          }
        });
      }, 0);
    }
  };

  const handleClearPoint = () => {
    setSelectedPoint(null);
    setIsPointSelectionActive(false);
    if (onDisablePointSelection) {
      onDisablePointSelection();
    }
  };

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Link className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Linking Annotation</span>
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
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {/* Show save error message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mb-2">
          {error}
        </div>
      )}

      {/* Show existing linking data for selected annotation */}
      {selectedAnnotationId && (
        <div className="mb-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Existing Links for Selected Annotation
          </div>

          {loadingExistingData ? (
            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              Loading existing links...
            </div>
          ) : (
            <div className="space-y-2">
              {/* Existing Linking Section */}
              {existingLinkingData.linking && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-primary">
                        <Link className="h-4 w-4 inline mr-1" />
                        Linked Annotations
                      </div>
                      <div className="text-xs text-primary/70">
                        Connected to{' '}
                        {Array.isArray(existingLinkingData.linking.target)
                          ? existingLinkingData.linking.target.length - 1
                          : 0}{' '}
                        other annotation(s)
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDeleteExistingLink(
                          existingLinkingData.linking.id,
                          'linking',
                        )
                      }
                      className="h-5 px-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Delete Link
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing Geotagging Section */}
              {existingLinkingData.geotagging && (
                <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-secondary-foreground">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        Geotagged Location
                      </div>
                      <div className="text-xs text-secondary-foreground/70">
                        Location information attached
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDeleteExistingLink(
                          existingLinkingData.geotagging.id,
                          'geotagging',
                        )
                      }
                      className="h-5 px-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Delete Geotag
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing Point Selection Section */}
              {existingLinkingData.pointSelection && (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-accent-foreground">
                        <Plus className="h-4 w-4 inline mr-1" />
                        Selected Point
                      </div>
                      <div className="text-xs text-accent-foreground/70">
                        Point coordinates attached
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDeleteExistingLink(
                          existingLinkingData.pointSelection.id,
                          'point_selection',
                        )
                      }
                      className="h-5 px-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Delete Point
                    </Button>
                  </div>
                </div>
              )}

              {!existingLinkingData.linking &&
                !existingLinkingData.geotagging &&
                !existingLinkingData.pointSelection && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                    No existing linking data found for this annotation
                  </div>
                )}
            </div>
          )}
        </div>
      )}
      <Tabs defaultValue="link" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="link" className="text-xs">
            <Link className="h-3 w-3 mr-1" />
            Link
          </TabsTrigger>
          <TabsTrigger value="geotag" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            Geotag
          </TabsTrigger>
          <TabsTrigger value="point" className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Point
          </TabsTrigger>
        </TabsList>
        <TabsContent value="link" className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Link annotations together in reading order
          </div>

          {/* Validation display */}
          {currentlySelectedForLinking.length > 1 && (
            <ValidationDisplay
              annotationIds={currentlySelectedForLinking}
              motivation="linking"
            />
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            {currentlySelectedForLinking.length === 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground mb-1">
                  No annotations selected for linking
                </div>
                <div className="p-3 bg-muted/30 rounded-md text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                    Select annotations in the image viewer to link them together
                  </div>
                  {onEnableLinkingMode && (
                    <Button
                      size="sm"
                      onClick={onEnableLinkingMode}
                      disabled={!canEdit || isLinkingMode}
                      className="inline-flex items-center gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      {isLinkingMode
                        ? 'Linking Mode Active'
                        : 'Enable Linking Mode'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-1">
                  Selected annotations (reading order):
                </div>
                <ol className="flex flex-col gap-1">
                  {currentlySelectedForLinking.map((id, idx) => {
                    // Lookup by full ID
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
                            (b: any) => b.generator?.label || b.generator?.name,
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
                        <span className="flex-1 truncate" title={displayLabel}>
                          {displayLabel}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 text-gray-400 hover:text-primary disabled:opacity-30"
                            disabled={idx === 0}
                            onClick={() => {
                              const newOrder = [...currentlySelectedForLinking];
                              const swapIdx = idx - 1;
                              if (swapIdx >= 0) {
                                [newOrder[idx], newOrder[swapIdx]] = [
                                  newOrder[swapIdx],
                                  newOrder[idx],
                                ];
                                setSelected(newOrder);
                              }
                            }}
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
                              idx === currentlySelectedForLinking.length - 1
                            }
                            onClick={() => {
                              const newOrder = [...currentlySelectedForLinking];
                              const swapIdx = idx + 1;
                              if (swapIdx < newOrder.length) {
                                [newOrder[idx], newOrder[swapIdx]] = [
                                  newOrder[swapIdx],
                                  newOrder[idx],
                                ];
                                setSelected(newOrder);
                              }
                            }}
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
                {isLinkingMode && onDisableLinkingMode && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onDisableLinkingMode}
                      className="inline-flex items-center gap-2"
                    >
                      <X className="h-3 w-3" />
                      Exit Linking Mode
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
        <TabsContent value="geotag" className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Add geographical location information
          </div>

          {/* Validation for geotagging */}
          {currentlySelectedForLinking.length > 0 && (
            <ValidationDisplay
              annotationIds={currentlySelectedForLinking}
              motivation="geotagging"
            />
          )}

          <GeoTagMap
            key={componentId.current}
            onGeotagSelected={(geotag) =>
              setSelectedGeotag(geotag.originalResult)
            }
            initialGeotag={initialGeotag}
          />
        </TabsContent>
        <TabsContent value="point" className="space-y-3">
          <div className="text-sm text-muted-foreground mb-2">
            Select a point on the image (click in image viewer to set)
          </div>

          {/* Validation for point selection */}
          {currentlySelectedForLinking.length > 0 && (
            <ValidationDisplay
              annotationIds={currentlySelectedForLinking}
              motivation="point_selection"
            />
          )}
          <div className="space-y-2">
            {selectedPoint ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-secondary/10 border border-secondary/30 rounded-md">
                  <MapPin className="w-4 h-4 text-secondary flex-shrink-0" />
                  <div className="flex-1 text-sm min-w-0">
                    <div className="font-medium text-secondary-foreground">
                      Point selected
                    </div>
                    <div className="text-xs text-secondary-foreground/70 truncate">
                      Coordinates: ({selectedPoint.x}, {selectedPoint.y})
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearPoint}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                    disabled={!canEdit}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartPointSelection}
                  disabled={!canEdit || isPointSelectionActive}
                  className="w-full justify-center items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  {isPointSelectionActive
                    ? 'Click on image...'
                    : 'Change Point'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {isPointSelectionActive ? (
                  <div className="bg-secondary/10 border border-secondary/30 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full animate-pulse"
                        style={{ backgroundColor: '#d4a548' }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-secondary-foreground text-sm">
                          Click on the Image
                        </div>
                        <div className="text-xs text-secondary-foreground/70">
                          Your cursor has changed. Click anywhere on the image
                          to select a point.
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsPointSelectionActive(false);
                          if (onDisablePointSelection) {
                            onDisablePointSelection();
                          }
                        }}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartPointSelection}
                    disabled={!canEdit || !onEnablePointSelection}
                    className="w-full justify-center items-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Select Point
                  </Button>
                )}
                {!onEnablePointSelection && !isPointSelectionActive && (
                  <div className="text-xs text-muted-foreground text-center">
                    Point selection requires an active image viewer
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
