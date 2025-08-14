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
import { invalidateLinkingCache } from '@/hooks/use-linking-annotations';
import { useToast } from '@/hooks/use-toast';
import {
  deleteLinkingRelationship,
  getLinkingAnnotationsForAnnotation,
} from '@/lib/viewer/linking-validation';
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

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23587158' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

const GeoTagMap = dynamic(
  () => import('./GeoTagMap').then((mod) => ({ default: mod.GeoTagMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 bg-muted/30 rounded flex items-center justify-center border border-border">
        <div className="text-sm text-muted-foreground">Loading map...</div>
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

    // Add throttling to prevent excessive API calls
    const lastFetchRef = useRef<string | null>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const selected = selectedIds !== undefined ? selectedIds : internalSelected;
    const setSelected = setSelectedIds || setInternalSelected;
    const userSession = session || { user: { name: 'Demo User' } };

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

          // Extract point selection data from linking annotation body
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

        if (selectedAnnotationId) {
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
          }, 50);
        }

        if (motivation === 'linking') {
          setInternalSelected([]);
          if (setSelectedIds) {
            setSelectedIds([]);
          }
          setSelectedPoint(null); // Clear point selection when deleting linking annotation
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
        // Validate data before saving
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
          setTimeout(() => {
            fetchExistingLinkingData(selectedAnnotationId, true);
          }, 100);
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
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Current Links
            </div>

            {loadingExistingData ? (
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                Loading existing links...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Existing Linking Section */}
                {existingLinkingData.linking && (
                  <div
                    className={`p-3 border rounded-md ${
                      isLinkingMode
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-primary/5 border-primary/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-primary">
                          <Link className="h-4 w-4 inline mr-1" />
                          Linked
                          {isLinkingMode && (
                            <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              EDITING
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-primary/70">
                          {Array.isArray(existingLinkingData.linking.target)
                            ? existingLinkingData.linking.target.length - 1
                            : 0}{' '}
                          connections
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
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
                          className="h-5 px-1.5 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                        >
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
                          className="h-5 px-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Delete
                        </Button>
                      </div>
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
                          Location
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
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {!existingLinkingData.linking &&
                  !existingLinkingData.geotagging && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                      No links yet
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
                              disabled={idx === 0}
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
              Add location info
            </div>

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
              Select a point on the image to link with annotations
            </div>

            {currentlySelectedForLinking.length === 0 && !selectedPoint && (
              <div className="p-4 bg-muted/20 border border-border rounded-lg text-center">
                <div className="text-sm text-muted-foreground">
                  Select annotations in the Link tab first, then add a point
                  selection here.
                </div>
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
            />
          </TabsContent>
        </Tabs>
      </Card>
    );
  },
);

export default LinkingAnnotationWidget;
