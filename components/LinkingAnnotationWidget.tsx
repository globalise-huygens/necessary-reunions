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
}

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
  } = props;

  const [isSaving, setIsSaving] = useState(false);
  const [selectedGeotag, setSelectedGeotag] = useState<any>(
    initialGeotag?.originalResult || null,
  );
  const [selectedPoint, setSelectedPoint] = useState<any>(initialPoint || null);
  const [error, setError] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [isPointSelectionActive, setIsPointSelectionActive] = useState(false);

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

  const currentlySelectedForLinking =
    selectedAnnotationsForLinking.length > 0
      ? selectedAnnotationsForLinking
      : selected;

  React.useEffect(() => {
    if (selectedAnnotationsForLinking.length > 0 && !selectedIds) {
      setInternalSelected(selectedAnnotationsForLinking);
    }
  }, [selectedAnnotationsForLinking, selectedIds]);

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
            currentlySelectedForLinking.length === 0
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
                        className="flex items-center bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6 transition-colors hover:bg-blue-50 group shadow-sm"
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
                            className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
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
                            className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
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
          <div className="space-y-2">
            {selectedPoint ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 text-sm min-w-0">
                    <div className="font-medium text-green-800">
                      Point selected
                    </div>
                    <div className="text-xs text-green-600 truncate">
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
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full animate-pulse"
                        style={{ backgroundColor: '#d4a548' }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-amber-900 text-sm">
                          Click on the Image
                        </div>
                        <div className="text-xs text-amber-700">
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
