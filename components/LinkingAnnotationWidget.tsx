'use client';

import 'leaflet/dist/leaflet.css';
import { useToast } from '@/hooks/use-toast';
import {
  Annotation,
  GeoSearchResult,
  LinkingAnnotation,
  LinkingBody,
  PointSelector,
} from '@/lib/types';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Link,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

// Dynamically import GeoTagMap to avoid SSR issues with Leaflet
const GeoTagMap = dynamic(() => import('./GeoTagMap'), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full rounded-lg border bg-gray-100 flex items-center justify-center">
      Loading map...
    </div>
  ),
});

interface LinkingAnnotationWidgetProps {
  annotation: Annotation;
  availableAnnotations: Annotation[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: (linkingAnnotation: LinkingAnnotation) => Promise<void>;
  onDelete?: (linkingAnnotation: LinkingAnnotation) => void;
  onAnnotationSelect: (annotationId: string) => void;
  existingLinkingAnnotation?: LinkingAnnotation | null;
  canEdit: boolean;
  onEnablePointSelection?: (
    handler: (point: { x: number; y: number }) => void,
  ) => void;
  onDisablePointSelection?: () => void;
  onAddToLinkingOrder?: (annotationId: string) => void;
  onRemoveFromLinkingOrder?: (annotationId: string) => void;
  onClearLinkingOrder?: () => void;
  linkedAnnotationsOrder?: string[];
  onRefreshLinkingAnnotations?: () => void;
  canvasId?: string;
}

export function LinkingAnnotationWidget({
  annotation,
  availableAnnotations,
  isExpanded,
  onToggleExpand,
  onSave,
  onDelete,
  onAnnotationSelect,
  existingLinkingAnnotation,
  canEdit,
  onEnablePointSelection,
  onDisablePointSelection,
  onAddToLinkingOrder,
  onRemoveFromLinkingOrder,
  onClearLinkingOrder,
  linkedAnnotationsOrder = [],
  onRefreshLinkingAnnotations,
  canvasId = '',
}: LinkingAnnotationWidgetProps) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [linkedAnnotations, setLinkedAnnotations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] =
    useState<GeoSearchResult | null>(null);
  const [geoSearchQuery, setGeoSearchQuery] = useState('');
  const [geoSearchResults, setGeoSearchResults] = useState<GeoSearchResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PointSelector | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setGeoSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query,
          )}&limit=5&addressdetails=1`,
        );
        const results = await response.json();
        setGeoSearchResults(results);
      } catch (error) {
        console.error('Error searching geo locations:', error);
        setGeoSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(geoSearchQuery);
  }, [geoSearchQuery, debouncedSearch]);

  useEffect(() => {
    if (existingLinkingAnnotation) {
      if (existingLinkingAnnotation.target) {
        const targets = Array.isArray(existingLinkingAnnotation.target)
          ? existingLinkingAnnotation.target
          : [existingLinkingAnnotation.target];

        const linkedIds = targets
          .map((target: string) => {
            if (typeof target === 'string' && target.includes('/')) {
              return target.split('/').pop() || target;
            }
            return target;
          })
          .filter((id: string) => id !== annotation.id);

        setLinkedAnnotations(linkedIds);
      }

      if (
        existingLinkingAnnotation.body &&
        existingLinkingAnnotation.body.length > 0
      ) {
        const geoBody = existingLinkingAnnotation.body.find(
          (item) => item.purpose === 'geotagging',
        );
        if (
          geoBody?.source &&
          'geometry' in geoBody.source &&
          geoBody.source.geometry
        ) {
          setSelectedLocation({
            lat: geoBody.source.geometry.coordinates[1]?.toString() || '',
            lon: geoBody.source.geometry.coordinates[0]?.toString() || '',
            display_name: geoBody.source.label || 'Selected Location',
            place_id: Date.now().toString(),
            type: 'way',
            class: 'place',
            importance: 0.5,
            boundingbox: ['0', '0', '0', '0'],
          });
        }

        const pointBody = existingLinkingAnnotation.body.find(
          (item) => item.purpose === 'highlighting',
        );
        if (pointBody?.selector) {
          setSelectedPoint(pointBody.selector);
        }
      }
    }
  }, [existingLinkingAnnotation, annotation.id]);

  const handleAddLinkedAnnotation = (annotationId: string) => {
    if (
      !linkedAnnotations.includes(annotationId) &&
      annotationId !== annotation.id
    ) {
      setLinkedAnnotations((prev) => [...prev, annotationId]);
      onAnnotationSelect(annotationId);
      onAddToLinkingOrder?.(annotationId);
    }
  };

  const handleRemoveLinkedAnnotation = (annotationId: string) => {
    setLinkedAnnotations((prev) => prev.filter((id) => id !== annotationId));
    onRemoveFromLinkingOrder?.(annotationId);
  };

  const handleMoveAnnotation = (from: number, to: number) => {
    const newOrder = [...linkedAnnotations];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setLinkedAnnotations(newOrder);

    newOrder.forEach((id) => onAddToLinkingOrder?.(id));
  };

  const handleEnablePointSelectionMode = () => {
    const pointHandler = (point: { x: number; y: number }) => {
      setSelectedPoint({
        type: 'PointSelector',
        x: point.x,
        y: point.y,
      });
      onDisablePointSelection?.();
    };

    onEnablePointSelection?.(pointHandler);
  };

  const handleLocationSelect = (location: GeoSearchResult) => {
    setSelectedLocation(location);
  };

  const handleSave = async () => {
    if (!session?.user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to save linking annotations.',
      });
      return;
    }

    setIsSaving(true);
    const isEdit = !!existingLinkingAnnotation?.id;

    try {
      const user = session.user as any;
      const linkingBodies: LinkingBody[] = [];

      if (selectedLocation) {
        linkingBodies.push({
          type: 'SpecificResource',
          purpose: 'geotagging',
          source: {
            id: `https://data.globalise.huygens.knaw.nl/place/${Date.now()}`,
            type: 'Feature',
            properties: {
              title: selectedLocation.display_name,
              description: selectedLocation.display_name,
            },
            geometry: {
              type: 'Point',
              coordinates: [
                parseFloat(selectedLocation.lon),
                parseFloat(selectedLocation.lat),
              ],
            },
          },
          creator: {
            id: user.id || user.email,
            type: 'Person',
            label: user.label || user.name || 'Unknown User',
          },
          created: new Date().toISOString(),
        });
      }

      if (selectedPoint) {
        linkingBodies.push({
          type: 'SpecificResource',
          purpose: 'highlighting',
          source: {
            id: `https://iiif.globalise.huygens.knaw.nl/manifest/canvas/${
              canvasId || 'unknown'
            }`,
            type: 'Canvas',
          },
          selector: selectedPoint,
          creator: {
            id: user.id || user.email,
            type: 'Person',
            label: user.label || user.name || 'Unknown User',
          },
          created: new Date().toISOString(),
        });
      }

      const createTargetUrl = (annotationId: string) => {
        if (annotationId.startsWith('https://')) {
          return annotationId;
        }
        return `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${annotationId}`;
      };

      const linkingAnnotation: LinkingAnnotation = {
        id: existingLinkingAnnotation?.id || '',
        type: 'Annotation',
        motivation: 'linking',
        target: [
          createTargetUrl(annotation.id),
          ...linkedAnnotations.map(createTargetUrl),
        ],
        body: linkingBodies,
        creator: {
          id: user.id || user.email,
          type: 'Person',
          label: user.label || user.name || 'Unknown User',
        },
        created: existingLinkingAnnotation?.created || new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      await onSave(linkingAnnotation);

      if (onRefreshLinkingAnnotations) {
        onRefreshLinkingAnnotations();
      }

      const features = [];
      if (selectedLocation) features.push('geo-location');
      if (selectedPoint) features.push('point selection');
      if (linkedAnnotations.length > 0)
        features.push(
          `${linkedAnnotations.length} linked annotation${
            linkedAnnotations.length > 1 ? 's' : ''
          }`,
        );

      const featuresText =
        features.length > 0 ? ` with ${features.join(', ')}` : '';

      toast({
        title: isEdit
          ? 'Linking Annotation Updated'
          : 'Linking Annotation Created',
        description: `Successfully ${
          isEdit ? 'updated' : 'created'
        } linking annotation${featuresText}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const isConflict =
        errorMessage.includes('already') || errorMessage.includes('linked');

      toast({
        title: 'Save Failed',
        description: isConflict
          ? 'One or more annotations are already part of another linking annotation. Please remove them from existing links first.'
          : `Failed to ${
              isEdit ? 'update' : 'create'
            } linking annotation. Please try again.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return null;
  }

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
          disabled={!session?.user || isSaving}
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

            {existingLinkingAnnotation && existingLinkingAnnotation.target && (
              <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="text-sm font-medium text-blue-900">
                  This annotation is part of a linking chain:
                </div>
                {(() => {
                  const targets = Array.isArray(
                    existingLinkingAnnotation.target,
                  )
                    ? existingLinkingAnnotation.target
                    : [existingLinkingAnnotation.target];

                  const allLinkedIds = targets.map((target: string) => {
                    if (typeof target === 'string' && target.includes('/')) {
                      return target.split('/').pop() || target;
                    }
                    return target;
                  });

                  return allLinkedIds.map((linkedId, index) => {
                    const linkedAnno =
                      availableAnnotations.find((a) => a.id === linkedId) ||
                      (linkedId === annotation.id ? annotation : null);

                    if (!linkedAnno) return null;

                    const isCurrentAnnotation = linkedId === annotation.id;

                    return (
                      <div
                        key={linkedId}
                        className={`flex items-center justify-between p-2 border rounded text-xs ${
                          isCurrentAnnotation
                            ? 'bg-primary/10 border-primary/30 font-medium'
                            : 'bg-white border-gray/20'
                        }`}
                      >
                        <span
                          className={`flex-1 truncate ${
                            isCurrentAnnotation ? 'text-primary' : ''
                          }`}
                          onClick={() =>
                            !isCurrentAnnotation && onAnnotationSelect(linkedId)
                          }
                        >
                          {index + 1}. {linkedAnno.body?.value || linkedId}
                          {isCurrentAnnotation && ' (current)'}
                        </span>
                        {!isCurrentAnnotation && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onAnnotationSelect(linkedId)}
                              className="h-6 w-6 p-0"
                              title="View this annotation"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {linkedAnnotations.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Linked Annotations:
                </div>
                {linkedAnnotations.map((annoId, index) => {
                  const linkedAnno = availableAnnotations.find(
                    (a) => a.id === annoId,
                  );
                  if (!linkedAnno) return null;

                  return (
                    <div
                      key={annoId}
                      className="flex items-center justify-between p-2 bg-accent/5 border border-accent/20 rounded text-xs"
                    >
                      <span className="flex-1 truncate">
                        {index + 1}. {linkedAnno.body?.value || annoId}
                      </span>
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleMoveAnnotation(index, index - 1)
                            }
                          >
                            ↑
                          </Button>
                        )}
                        {index < linkedAnnotations.length - 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleMoveAnnotation(index, index + 1)
                            }
                          >
                            ↓
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLinkedAnnotation(annoId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Click annotations in the image viewer to add them to this link
            </div>
          </TabsContent>

          <TabsContent value="geotag" className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Add geographical location information
            </div>

            <Input
              placeholder="Search for a location..."
              value={geoSearchQuery}
              onChange={(e) => setGeoSearchQuery(e.target.value)}
            />

            {isSearching && (
              <div className="text-xs text-muted-foreground">Searching...</div>
            )}

            <GeoTagMap
              selectedLocation={selectedLocation}
              searchResults={geoSearchResults}
              onLocationSelect={handleLocationSelect}
            />

            {geoSearchResults.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Search Results (click markers on map to select):
                </div>
                {geoSearchResults.slice(0, 3).map((result) => (
                  <button
                    key={result.place_id}
                    onClick={() => handleLocationSelect(result)}
                    className="w-full text-left p-2 text-xs hover:bg-accent/10 rounded border"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}

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
            <div className="text-sm text-muted-foreground">
              Select a point on the image (click in image viewer to set)
            </div>

            <Button
              onClick={handleEnablePointSelectionMode}
              className="w-full"
              variant="outline"
            >
              Select Point on Image
            </Button>

            {selectedPoint ? (
              <div className="p-3 bg-accent/5 border border-accent/20 rounded">
                <div className="text-sm font-medium">Selected Point:</div>
                <div className="text-sm">
                  X: {selectedPoint.x}, Y: {selectedPoint.y}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedPoint(null)}
                  className="mt-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No point selected
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
