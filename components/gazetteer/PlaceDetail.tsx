'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { GazetteerPlace } from '@/lib/gazetteer/types';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Map,
  MapPin,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface PlaceDetailProps {
  slug: string;
}

export function PlaceDetail({ slug }: PlaceDetailProps) {
  const [place, setPlace] = useState<GazetteerPlace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlace();
  }, [slug]);

  const fetchPlace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/gazetteer/places/${slug}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Place not found');
        } else if (response.status === 504) {
          setError(
            'Request timed out. The server is taking too long to load this place. Please try again later.',
          );
        } else {
          setError('Failed to load place details');
        }
        return;
      }

      const placeData = await response.json();
      setPlace(placeData);
    } catch (err) {
      setError(
        'Failed to load place details. Please check your connection and try again.',
      );
      console.error('Error fetching place:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="h-full overflow-auto bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {error || 'Place not found'}
            </h3>
            <div className="space-y-4">
              <Link href="/gazetteer">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Gazetteer
                </Button>
              </Link>
              {error && error.includes('timed out') && (
                <div>
                  <Button onClick={fetchPlace} variant="default">
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        {/* Navigation */}
        <div>
          <Link href="/gazetteer">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gazetteer
            </Button>
          </Link>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* 1. Place Title/Preferred Label */}
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-4xl font-heading text-primary mb-2">
              {place.name}
            </h1>
            <p className="text-lg text-muted-foreground">
              Historical place from early modern Kerala maps
            </p>
          </div>

          {/* 2. Alternative Names from Database */}
          {(place.alternativeNames?.length ?? 0) > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>Alternative Names</span>
              </h2>
              <p className="text-muted-foreground mb-4">
                Historical name variants from different sources and periods:
              </p>
              <div className="flex flex-wrap gap-2">
                {place.alternativeNames?.map((name, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-base py-2 px-4"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 3. Historical Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
              <Clock className="w-6 h-6" />
              <span>Historical Timeline</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              The history of this place as recorded in historic maps over time:
            </p>

            {/* Build comprehensive timeline from ALL maps with deduplication */}
            {(() => {
              // Define map entry type
              type MapEntry = {
                date: string;
                title: string;
                permalink?: string;
                canvasId?: string;
                mapId?: string;
                annotationTexts: Array<{
                  text: string;
                  source: 'human' | 'ai-pipeline' | 'loghi-htr';
                  isHumanVerified?: boolean;
                  created?: string;
                }>;
                isPrimary: boolean;
                dimensions?: { width: number; height: number };
                gridSquare?: string;
                pageNumber?: string;
                sources: string[];
              };

              // Collect all unique maps with their associated text annotations
              const mapsByTitle: Record<string, MapEntry> = {};

              // Group text annotations by their target map
              const annotationsByMap: Record<string, any[]> = {};

              // Process all text recognition sources to group by map
              if (place.textRecognitionSources) {
                place.textRecognitionSources.forEach((textSource) => {
                  const mapKey = textSource.targetId || 'unknown-map';
                  if (!annotationsByMap[mapKey]) {
                    annotationsByMap[mapKey] = [];
                  }
                  annotationsByMap[mapKey].push({
                    text: textSource.text,
                    source: textSource.source,
                    isHumanVerified: textSource.isHumanVerified,
                    created: textSource.created,
                    targetId: textSource.targetId,
                  });
                });
              }

              // Add primary map with its annotations
              if (place.mapInfo) {
                const primaryCanvasId =
                  place.canvasId || place.mapInfo.canvasId;
                const primaryMapId = place.mapInfo.id;

                // Find textRecognitionSources that match this specific canvas/map
                const primaryAnnotations =
                  place.textRecognitionSources
                    ?.filter((source) => {
                      // Match by canvas ID or map ID from the targetId
                      return (
                        source.targetId.includes(primaryCanvasId) ||
                        source.targetId.includes(primaryMapId)
                      );
                    })
                    .map((source) => ({
                      text: source.text,
                      source: source.source,
                      isHumanVerified: source.isHumanVerified,
                      created: source.created,
                      targetId: source.targetId,
                    })) || [];

                console.log('DEBUG: Primary map annotations:', {
                  mapTitle: place.mapInfo.title,
                  primaryCanvasId,
                  primaryMapId,
                  totalTextRecognitionSources:
                    place.textRecognitionSources?.length || 0,
                  filteredAnnotations: primaryAnnotations.length,
                  sampleAnnotations: primaryAnnotations.slice(0, 3),
                });

                const mapTitle = place.mapInfo.title;
                mapsByTitle[mapTitle] = {
                  date: place.mapInfo.date || 'Unknown date',
                  title: mapTitle,
                  permalink: place.mapInfo.permalink,
                  canvasId: primaryCanvasId,
                  mapId: place.mapInfo.id,
                  annotationTexts: primaryAnnotations,
                  isPrimary: true,
                  dimensions: place.mapInfo.dimensions,
                  sources: ['primary'],
                };
              }

              // Add all additional map references, merging with existing maps
              if (place.mapReferences) {
                place.mapReferences.forEach((mapRef) => {
                  // Find textRecognitionSources that match this specific map/canvas
                  const finalAnnotations =
                    place.textRecognitionSources
                      ?.filter((source) => {
                        // Match by canvas ID or map ID from the targetId
                        return (
                          source.targetId.includes(mapRef.canvasId) ||
                          source.targetId.includes(mapRef.mapId)
                        );
                      })
                      .map((source) => ({
                        text: source.text,
                        source: source.source,
                        isHumanVerified: source.isHumanVerified,
                        created: source.created,
                        targetId: source.targetId,
                      })) || [];

                  console.log('DEBUG: Map reference annotations:', {
                    mapTitle: mapRef.mapTitle,
                    canvasId: mapRef.canvasId,
                    mapId: mapRef.mapId,
                    totalTextRecognitionSources:
                      place.textRecognitionSources?.length || 0,
                    filteredAnnotations: finalAnnotations.length,
                    sampleAnnotations: finalAnnotations.slice(0, 3),
                  });

                  // Try to extract date from map title or use unknown
                  let mapDate = 'Date?';

                  // Check if this is the same map as the primary mapInfo
                  if (place.mapInfo && mapRef.mapId === place.mapInfo.id) {
                    mapDate = place.mapInfo.date || 'Date?';
                  } else {
                    // Try to extract date from map title if it contains year patterns
                    const titleDateMatch = mapRef.mapTitle.match(
                      /(\d{4})[-\/]?(\d{4})?/,
                    );
                    if (titleDateMatch) {
                      if (titleDateMatch[2]) {
                        mapDate = `${titleDateMatch[1]}/${titleDateMatch[2]}`;
                      } else {
                        mapDate = titleDateMatch[1];
                      }
                    }
                  }

                  const mapTitle = mapRef.mapTitle;

                  // Check if we already have this map title
                  if (mapsByTitle[mapTitle]) {
                    // Merge with existing map data
                    const existingMap = mapsByTitle[mapTitle];

                    // Combine annotations, avoiding duplicates
                    const combinedAnnotations = [
                      ...existingMap.annotationTexts,
                    ];
                    finalAnnotations.forEach((newAnnotation) => {
                      const isDuplicate = combinedAnnotations.some(
                        (existing) =>
                          existing.text === newAnnotation.text &&
                          existing.source === newAnnotation.source,
                      );
                      if (!isDuplicate) {
                        combinedAnnotations.push(newAnnotation);
                      }
                    });

                    // Update the existing map with merged data
                    existingMap.annotationTexts = combinedAnnotations;
                    existingMap.sources.push('reference');

                    // Add grid square and page number if available and not already set
                    if (mapRef.gridSquare && !existingMap.gridSquare) {
                      existingMap.gridSquare = mapRef.gridSquare;
                    }
                    if (mapRef.pageNumber && !existingMap.pageNumber) {
                      existingMap.pageNumber = mapRef.pageNumber;
                    }
                  } else {
                    // Add as new map
                    mapsByTitle[mapTitle] = {
                      date: mapDate,
                      title: mapTitle,
                      canvasId: mapRef.canvasId,
                      mapId: mapRef.mapId,
                      annotationTexts: finalAnnotations,
                      isPrimary: false,
                      gridSquare: mapRef.gridSquare,
                      pageNumber: mapRef.pageNumber,
                      sources: ['reference'],
                    };
                  }
                });
              }

              // Convert to array and sort
              const mapTimeline: MapEntry[] = Object.values(mapsByTitle);

              // Sort by date (unknown dates with ? at top, then primary maps, then by actual dates)
              mapTimeline.sort((a: MapEntry, b: MapEntry) => {
                // Unknown dates (with ?) go to top as requested
                if (a.date === 'Date?' && b.date !== 'Date?') return -1;
                if (b.date === 'Date?' && a.date !== 'Date?') return 1;
                if (a.date === 'Date?' && b.date === 'Date?') return 0;

                // Primary maps next
                if (a.isPrimary && !b.isPrimary) return -1;
                if (!a.isPrimary && b.isPrimary) return 1;

                // Then by actual date
                if (a.date === 'Unknown date') return 1;
                if (b.date === 'Unknown date') return -1;
                return a.date.localeCompare(b.date);
              });
              return (
                <div className="space-y-6">
                  {mapTimeline.map((mapEntry, index) => (
                    <div key={index} className="relative">
                      {/* Timeline connector */}
                      {index < mapTimeline.length - 1 && (
                        <div className="absolute left-6 top-16 h-6 w-0.5 bg-primary/30"></div>
                      )}

                      <div className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-primary text-white">
                          <Map className="w-6 h-6" />
                        </div>

                        {/* Timeline content */}
                        <div className="flex-1 bg-gray-50 rounded-lg p-4 border">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-lg font-semibold text-foreground">
                                  {mapEntry.date}
                                  {(() => {
                                    // Get textspotting values from the place data, not just this map
                                    if (
                                      !place.textRecognitionSources ||
                                      place.textRecognitionSources.length === 0
                                    ) {
                                      return null;
                                    }

                                    // Group all textspotting sources by targetId to get the best text for each
                                    const textsByTarget: Record<
                                      string,
                                      { text: string; priority: number }
                                    > = {};

                                    place.textRecognitionSources.forEach(
                                      (source) => {
                                        const targetId =
                                          source.targetId || 'unknown';

                                        // Prioritize: human > loghi-htr > ai-pipeline
                                        const currentPriority =
                                          source.source === 'human'
                                            ? 1
                                            : source.source === 'loghi-htr'
                                            ? 2
                                            : 3;

                                        // Keep the text with the best (lowest) priority for each target
                                        if (
                                          !textsByTarget[targetId] ||
                                          textsByTarget[targetId].priority >
                                            currentPriority
                                        ) {
                                          textsByTarget[targetId] = {
                                            text: source.text,
                                            priority: currentPriority,
                                          };
                                        }
                                      },
                                    );

                                    // Get all unique text values and join with spaces
                                    const textValues = Object.values(
                                      textsByTarget,
                                    )
                                      .map((item) => item.text.trim())
                                      .filter((text) => text.length > 0);

                                    if (textValues.length === 0) {
                                      return null;
                                    }

                                    return (
                                      <span className="text-base font-normal text-muted-foreground">
                                        — {textValues.join(' ')}
                                      </span>
                                    );
                                  })()}
                                </h3>
                              </div>

                              {/* Annotation texts spotted on this map - made more prominent */}
                              {mapEntry.annotationTexts &&
                                mapEntry.annotationTexts.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                      Text Annotations Found:
                                    </h4>
                                    <div className="space-y-2">
                                      {mapEntry.annotationTexts.map(
                                        (annotation, textIndex) => (
                                          <div
                                            key={textIndex}
                                            className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                                          >
                                            <div className="flex items-center gap-3">
                                              <Badge
                                                variant={
                                                  annotation.isHumanVerified
                                                    ? 'default'
                                                    : 'secondary'
                                                }
                                                className={`text-base py-1 px-3 font-semibold ${
                                                  annotation.isHumanVerified
                                                    ? 'bg-green-100 text-green-800 border-green-200'
                                                    : annotation.source ===
                                                      'loghi-htr'
                                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                                }`}
                                              >
                                                "{annotation.text}"
                                              </Badge>

                                              {/* Source indicator */}
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {annotation.source ===
                                                'human' ? (
                                                  <>👤 Human verified</>
                                                ) : annotation.source ===
                                                  'loghi-htr' ? (
                                                  <>🤖 AI-HTR</>
                                                ) : (
                                                  <>⚡ AI Pipeline</>
                                                )}
                                                {annotation.isHumanVerified && (
                                                  <span className="ml-1 text-green-600">
                                                    ✓
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Creation date */}
                                            {annotation.created && (
                                              <div className="text-xs text-muted-foreground">
                                                {new Date(
                                                  annotation.created,
                                                ).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                              {/* Map name - smaller and less prominent, avoid duplication */}
                              {mapEntry.title &&
                                !mapEntry.annotationTexts?.some(
                                  (annotation) =>
                                    mapEntry.title
                                      .toLowerCase()
                                      .includes(
                                        annotation.text.toLowerCase(),
                                      ) ||
                                    annotation.text
                                      .toLowerCase()
                                      .includes(mapEntry.title.toLowerCase()),
                                ) && (
                                  <p className="text-sm text-muted-foreground mb-3 italic">
                                    {mapEntry.title}
                                  </p>
                                )}

                              {/* Map details */}
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {mapEntry.gridSquare && (
                                  <p>Grid Reference: {mapEntry.gridSquare}</p>
                                )}
                                {mapEntry.pageNumber && (
                                  <p>Page: {mapEntry.pageNumber}</p>
                                )}
                                {mapEntry.dimensions && (
                                  <p>
                                    Dimensions: {mapEntry.dimensions.width} ×{' '}
                                    {mapEntry.dimensions.height}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-row gap-2 ml-4">
                              {mapEntry.permalink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    window.open(mapEntry.permalink, '_blank')
                                  }
                                >
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  Archive
                                </Button>
                              )}
                              {mapEntry.canvasId && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    mapEntry.canvasId &&
                                    window.open(
                                      `/viewer?canvas=${encodeURIComponent(
                                        mapEntry.canvasId,
                                      )}`,
                                      '_blank',
                                    )
                                  }
                                >
                                  <Map className="w-4 h-4 mr-1" />
                                  View Map
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Recognition timeline */}
                  {place.textRecognitionSources &&
                    place.textRecognitionSources.length > 0 && (
                      <div className="mt-8 pt-6 border-t">
                        <h3 className="text-lg font-semibold text-primary mb-4">
                          Modern Recognition
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          How this historical place was digitally identified and
                          verified:
                        </p>

                        <div className="space-y-3">
                          {place.textRecognitionSources
                            .sort((a, b) => {
                              const dateA = a.created || '';
                              const dateB = b.created || '';
                              return dateA.localeCompare(dateB);
                            })
                            .map((source, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                  {source.source === 'human' ? '👤' : '🤖'}
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">
                                      Text "{source.text}" identified
                                    </span>
                                    <Badge
                                      variant={
                                        source.source === 'human'
                                          ? 'default'
                                          : 'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {source.source === 'human'
                                        ? 'Human'
                                        : source.source === 'loghi-htr'
                                        ? 'AI-HTR'
                                        : 'AI'}
                                    </Badge>
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    {source.created && (
                                      <span>
                                        {new Date(
                                          source.created,
                                        ).toLocaleDateString()}
                                        {source.creator &&
                                          ` • Verified by ${
                                            source.creator.label ||
                                            'Human annotator'
                                          }`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })()}
          </div>

          {/* 4. Place Descriptions */}
          {place.description && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>Description</span>
              </h2>
              <div className="prose prose-lg max-w-none">
                <p className="text-foreground leading-relaxed">
                  {place.description}
                </p>
              </div>
            </div>
          )}

          {/* 5. Place Type with Iconography */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
              <Map className="w-6 h-6" />
              <span>Place Type</span>
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Badge variant="secondary" className="text-lg py-2 px-4 mb-3">
                  {place.category}
                </Badge>
                <p className="text-muted-foreground">
                  This location was categorized as a{' '}
                  {place.category.toLowerCase()} on historic maps. Different
                  symbols and notations were used by cartographers to indicate
                  the type and importance of settlements and geographical
                  features.
                </p>
              </div>
              {/* TODO: Add iconography section when icon data is available */}
            </div>
          </div>

          {/* 6. Modern Place Information */}
          {place.modernName && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Navigation className="w-6 h-6" />
                <span>Modern Location</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Current Name
                  </h3>
                  <p className="text-xl text-foreground">{place.modernName}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => {
                      const searchQuery = encodeURIComponent(
                        place.modernName || place.name,
                      );
                      window.open(
                        `https://www.openstreetmap.org/search?query=${searchQuery}`,
                        '_blank',
                      );
                    }}
                  >
                    <Globe className="w-4 h-4" />
                    <span>View on OpenStreetMap</span>
                    <ExternalLink className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => {
                      const searchQuery = encodeURIComponent(
                        place.modernName || place.name,
                      );
                      window.open(
                        `https://www.wikidata.org/w/index.php?search=${searchQuery}`,
                        '_blank',
                      );
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Search Wikidata</span>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 7. Maps References */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
              <Map className="w-6 h-6" />
              <span>Historic Maps</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              Maps where this place appears, with links to original archive
              sources:
            </p>

            <div className="space-y-4">
              {(() => {
                // Combine primary map and map references with complete deduplication
                const allMaps: Record<
                  string,
                  {
                    title: string;
                    date?: string;
                    dimensions?: { width: number; height: number };
                    canvasIds: string[];
                    mapIds: string[];
                    gridSquares: string[];
                    pageNumbers: string[];
                    permalink?: string;
                    isPrimary: boolean;
                  }
                > = {};

                // Add primary map first
                if (place.mapInfo) {
                  const title = place.mapInfo.title;
                  allMaps[title] = {
                    title,
                    date: place.mapInfo.date,
                    dimensions: place.mapInfo.dimensions,
                    canvasIds: place.canvasId ? [place.canvasId] : [],
                    mapIds: place.mapInfo.id ? [place.mapInfo.id] : [],
                    gridSquares: [],
                    pageNumbers: [],
                    permalink: place.mapInfo.permalink,
                    isPrimary: true,
                  };
                }

                // Add/merge map references
                if (place.mapReferences) {
                  place.mapReferences.forEach((mapRef) => {
                    const title = mapRef.mapTitle;

                    if (allMaps[title]) {
                      // Merge with existing map
                      const existing = allMaps[title];
                      if (
                        mapRef.canvasId &&
                        !existing.canvasIds.includes(mapRef.canvasId)
                      ) {
                        existing.canvasIds.push(mapRef.canvasId);
                      }
                      if (
                        mapRef.mapId &&
                        !existing.mapIds.includes(mapRef.mapId)
                      ) {
                        existing.mapIds.push(mapRef.mapId);
                      }
                      if (
                        mapRef.gridSquare &&
                        !existing.gridSquares.includes(mapRef.gridSquare)
                      ) {
                        existing.gridSquares.push(mapRef.gridSquare);
                      }
                      if (
                        mapRef.pageNumber &&
                        !existing.pageNumbers.includes(mapRef.pageNumber)
                      ) {
                        existing.pageNumbers.push(mapRef.pageNumber);
                      }
                    } else {
                      // Add as new map
                      allMaps[title] = {
                        title,
                        canvasIds: mapRef.canvasId ? [mapRef.canvasId] : [],
                        mapIds: mapRef.mapId ? [mapRef.mapId] : [],
                        gridSquares: mapRef.gridSquare
                          ? [mapRef.gridSquare]
                          : [],
                        pageNumbers: mapRef.pageNumber
                          ? [mapRef.pageNumber]
                          : [],
                        isPrimary: false,
                      };
                    }
                  });
                }

                return Object.values(allMaps).map((mapData, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      mapData.isPrimary ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          {mapData.title}
                        </h3>
                        {mapData.date && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Created: {mapData.date}
                          </p>
                        )}
                        {mapData.dimensions && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Dimensions: {mapData.dimensions.width} ×{' '}
                            {mapData.dimensions.height}
                          </p>
                        )}
                        {mapData.gridSquares.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Grid Reference: {mapData.gridSquares.join(', ')}
                          </p>
                        )}
                        {mapData.pageNumbers.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Page: {mapData.pageNumbers.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-row gap-2 ml-4">
                        {/* Archive button */}
                        {mapData.permalink && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(mapData.permalink!, '_blank')
                            }
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Archive
                          </Button>
                        )}
                        {/* View button for the first available canvas */}
                        {mapData.canvasIds.length > 0 && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/viewer?canvas=${encodeURIComponent(
                                  mapData.canvasIds[0],
                                )}`,
                                '_blank',
                              )
                            }
                          >
                            <Map className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
