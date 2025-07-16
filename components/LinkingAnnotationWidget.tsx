import {
  ChevronDown,
  ChevronUp,
  Link,
  MapPin,
  Plus,
  Save,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { PointSelector } from './PointSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

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
  onSave?: () => void;
  annotations?: Annotation[];
  availableAnnotations?: Annotation[];
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  session?: any;
  alreadyLinkedIds?: string[];
}

export function LinkingAnnotationWidget(
  props: LinkingAnnotationWidgetProps,
): React.ReactElement | null {
  const {
    canEdit = true,
    isExpanded = true,
    onToggleExpand = () => {},
    onSave = () => {},
    annotations = [],
    availableAnnotations = [],
    selectedIds,
    setSelectedIds,
    session,
    alreadyLinkedIds = [],
  } = props;
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const selected = selectedIds !== undefined ? selectedIds : internalSelected;
  const setSelected = setSelectedIds || setInternalSelected;
  const userSession = session || { user: { name: 'Demo User' } };

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

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
    onSave();
  };
  const handleEnablePointSelectionMode = () => {
    setSelectedPoint({ x: 100, y: 200 });
  };

  if (!canEdit) return null;

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="p-0 h-auto"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        <div className="flex items-center gap-1">
          <Link className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Linking Annotation</span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!userSession?.user || isSaving}
          className="ml-auto"
        >
          <Save className="h-3 w-3 mr-1" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {isExpanded && (
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
              <div className="text-xs text-muted-foreground mb-1">
                Select annotations to link:
              </div>
              <div className="flex flex-wrap gap-2">
                {availableAnnotations.map((anno) => (
                  <Button
                    key={anno.id}
                    size="sm"
                    variant={selected.includes(anno.id) ? 'default' : 'outline'}
                    className={`text-xs ${
                      alreadyLinkedIds.includes(anno.id) &&
                      !selected.includes(anno.id)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    onClick={() => handleSelect(anno.id)}
                    disabled={
                      alreadyLinkedIds.includes(anno.id) &&
                      !selected.includes(anno.id)
                    }
                  >
                    {getAnnotationLabel(anno)}
                  </Button>
                ))}
              </div>
              {selected.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    Linked annotations (reading order):
                  </div>
                  <ol className="flex flex-col gap-1">
                    {selected.map((id, idx) => {
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
                              className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
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
                              className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                              disabled={idx === selected.length - 1}
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
                              setSelected(selected.filter((x) => x !== id))
                            }
                            aria-label="Remove target"
                            type="button"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="geotag" className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Add geographical location information
            </div>
            <Input
              placeholder="Search for a location..."
              value={''}
              onChange={() => {}}
            />
            {selectedLocation && (
              <div className="p-3 bg-accent/5 border border-accent/20 rounded">
                <div className="text-sm font-medium mb-1">
                  Selected Location:
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedLocation.display_name}
                </div>
                <div className="text-xs">
                  Lat: {selectedLocation.lat}, Lon: {selectedLocation.lon}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedLocation(null)}
                  className="mt-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="point" className="space-y-3">
            <div className="text-sm text-muted-foreground mb-2">
              Select a point on the image (click in image viewer to set)
            </div>
            <PointSelector
              value={selectedPoint}
              onChange={setSelectedPoint}
              existingAnnotations={annotations}
              disabled={!canEdit}
              expandedStyle={true}
              currentAnnotationId={undefined}
            />
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}
