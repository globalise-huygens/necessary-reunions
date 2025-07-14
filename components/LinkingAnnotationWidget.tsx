'use client';

import { Annotation, GeoSearchResult, LinkingAnnotation, LinkingBody, PointSelector } from '@/lib/types';
import { ChevronDown, ChevronUp, Link, MapPin, Plus, Save, Trash2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

// Dynamically import the map component to avoid SSR issues
const GeoTagMap = dynamic(() => import('./GeoTagMap'), { 
  ssr: false,
  loading: () => <div className="h-48 w-full bg-muted/30 rounded-lg flex items-center justify-center">Loading map...</div>
}) as React.ComponentType<{ selectedLocation?: GeoSearchResult | null; className?: string }>;

interface LinkingAnnotationWidgetProps {
  annotation: Annotation;
  availableAnnotations: Annotation[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: (linkingAnnotation: LinkingAnnotation) => void;
  onDelete?: (linkingAnnotation: LinkingAnnotation) => void;
  onAnnotationSelect: (annotationId: string) => void;
  existingLinkingAnnotation?: LinkingAnnotation | null;
  canEdit: boolean;
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
}: LinkingAnnotationWidgetProps) {
  const { data: session } = useSession();
  const [linkedAnnotations, setLinkedAnnotations] = useState<string[]>(
    existingLinkingAnnotation?.target || []
  );
  const [geoSearchQuery, setGeoSearchQuery] = useState('');
  const [geoSearchResults, setGeoSearchResults] = useState<GeoSearchResult[]>([]);
  const [selectedGeoLocation, setSelectedGeoLocation] = useState<GeoSearchResult | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointSelector | null>(
    existingLinkingAnnotation?.body?.find(b => b.purpose === 'highlighting')?.selector || null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'geotag' | 'point'>('link');

  const handleGeoSearch = async () => {
    if (!geoSearchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          geoSearchQuery
        )}&limit=5&addressdetails=1`
      );
      const results = await response.json();
      setGeoSearchResults(results);
    } catch (error) {
      console.error('Error searching geo locations:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLinkedAnnotation = (annotationId: string) => {
    if (!linkedAnnotations.includes(annotationId) && annotationId !== annotation.id) {
      setLinkedAnnotations(prev => [...prev, annotationId]);
      onAnnotationSelect(annotationId);
    }
  };

  const handleRemoveLinkedAnnotation = (annotationId: string) => {
    setLinkedAnnotations(prev => prev.filter(id => id !== annotationId));
  };

  const handleMoveAnnotation = (from: number, to: number) => {
    const newOrder = [...linkedAnnotations];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setLinkedAnnotations(newOrder);
  };

  const handleSave = () => {
    if (!session?.user) return;

    const user = session.user as any;
    const linkingBody: LinkingBody[] = [];

    // Add identifying body if geo location is selected
    if (selectedGeoLocation) {
      linkingBody.push({
        type: 'SpecificResource',
        purpose: 'identifying',
        source: {
          id: `https://data.globalise.huygens.knaw.nl/place/${selectedGeoLocation.place_id}`,
          type: 'Place',
          label: selectedGeoLocation.display_name,
          defined_by: `POINT(${selectedGeoLocation.lon} ${selectedGeoLocation.lat})`,
        },
        creator: {
          id: user.id || user.email,
          type: 'Person',
          label: user.label || user.name || 'Unknown User',
        },
        created: new Date().toISOString(),
      });

      // Add geotagging body
      linkingBody.push({
        type: 'SpecificResource',
        purpose: 'geotagging',
        source: {
          id: `https://data.globalise.huygens.knaw.nl/place/${selectedGeoLocation.place_id}`,
          type: 'Feature',
          properties: {
            title: selectedGeoLocation.display_name,
            description: selectedGeoLocation.display_name,
          },
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(selectedGeoLocation.lon), parseFloat(selectedGeoLocation.lat)],
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

    // Add highlighting body if point is selected
    if (selectedPoint) {
      linkingBody.push({
        type: 'SpecificResource',
        purpose: 'highlighting',
        source: {
          id: annotation.target?.source || '',
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

    const linkingAnnotation: LinkingAnnotation = {
      id: existingLinkingAnnotation?.id || '',
      type: 'Annotation',
      motivation: 'linking',
      target: [annotation.id, ...linkedAnnotations],
      body: linkingBody,
      creator: {
        id: user.id || user.email,
        type: 'Person',
        label: user.label || user.name || 'Unknown User',
      },
      created: existingLinkingAnnotation?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    onSave(linkingAnnotation);
  };

  const hasLinkedAnnotations = linkedAnnotations.length > 0;
  const hasGeoLocation = !!selectedGeoLocation;
  const hasPoint = !!selectedPoint;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Linking Annotation</span>
          <div className="flex gap-1">
            {hasLinkedAnnotations && (
              <div title="Has linked annotations">
                <Link className="h-3 w-3 text-primary" />
              </div>
            )}
            {hasGeoLocation && (
              <div title="Has geo location">
                <MapPin className="h-3 w-3 text-secondary" />
              </div>
            )}
            {hasPoint && (
              <div title="Has selected point">
                <Plus className="h-3 w-3 text-accent" />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              onClick={handleSave}
              size="sm"
              variant="secondary"
              disabled={!hasLinkedAnnotations && !hasGeoLocation && !hasPoint}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          )}
          <Button
            onClick={onToggleExpand}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <Card className="mt-3 p-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="link" className="flex items-center gap-1">
                <Link className="h-3 w-3" />
                Link ({linkedAnnotations.length})
              </TabsTrigger>
              <TabsTrigger value="geotag" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Geotag {hasGeoLocation && '✓'}
              </TabsTrigger>
              <TabsTrigger value="point" className="flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Point {hasPoint && '✓'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Link annotations together in reading order (top to bottom)
              </div>
              
              {linkedAnnotations.length > 0 && (
                <div className="space-y-2">
                  {linkedAnnotations.map((annoId, index) => {
                    const linkedAnno = availableAnnotations.find(a => a.id === annoId);
                    if (!linkedAnno) return null;
                    
                    return (
                      <div
                        key={annoId}
                        className="flex items-center gap-2 p-2 bg-muted/30 rounded border"
                      >
                        <span className="text-xs font-mono bg-primary text-primary-foreground px-1 rounded">
                          {index + 2}
                        </span>
                        <span className="flex-1 text-sm truncate">
                          {linkedAnno.id.split('/').pop()}
                        </span>
                        <div className="flex gap-1">
                          {index > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMoveAnnotation(index, index - 1)}
                            >
                              ↑
                            </Button>
                          )}
                          {index < linkedAnnotations.length - 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMoveAnnotation(index, index + 1)}
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
              
              <div className="flex gap-2">
                <Input
                  placeholder="Search for a location..."
                  value={geoSearchQuery}
                  onChange={(e) => setGeoSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGeoSearch()}
                />
                <Button onClick={handleGeoSearch} disabled={isSearching}>
                  Search
                </Button>
              </div>

              {geoSearchResults.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {geoSearchResults.map((result) => (
                    <div
                      key={result.place_id}
                      className={`p-2 border rounded cursor-pointer transition-colors ${
                        selectedGeoLocation?.place_id === result.place_id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedGeoLocation(result)}
                    >
                      <div className="text-sm font-medium">{result.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {result.lat}, {result.lon}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedGeoLocation && (
                <div className="space-y-3">
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded">
                    <div className="text-sm font-medium">Selected Location:</div>
                    <div className="text-sm">{selectedGeoLocation.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedGeoLocation.lat}, {selectedGeoLocation.lon}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedGeoLocation(null)}
                      className="mt-2"
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <GeoTagMap selectedLocation={selectedGeoLocation} />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="point" className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Select a point on the image (click in image viewer to set)
              </div>
              
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
                    Clear Point
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No point selected. Click on the image to set a point.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}
