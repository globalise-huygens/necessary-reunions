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

            {/* Build comprehensive timeline from ALL maps with their annotations */}
            {(() => {
              // Collect all unique maps with their associated text annotations
              const mapTimeline: Array<{
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
              }> = [];

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
                const primaryAnnotations =
                  place.textRecognitionSources?.map((source) => ({
                    text: source.text,
                    source: source.source,
                    isHumanVerified: source.isHumanVerified,
                    created: source.created,
                  })) || [];

                mapTimeline.push({
                  date: place.mapInfo.date || 'Unknown date',
                  title: place.mapInfo.title,
                  permalink: place.mapInfo.permalink,
                  canvasId: place.canvasId || place.mapInfo.canvasId,
                  mapId: place.mapInfo.id,
                  annotationTexts: primaryAnnotations,
                  isPrimary: true,
                  dimensions: place.mapInfo.dimensions,
                });
              }

              // Add all additional map references with their specific annotations
              if (place.mapReferences) {
                place.mapReferences.forEach((mapRef) => {
                  // Find annotations specifically for this map reference
                  const mapAnnotations =
                    annotationsByMap[mapRef.canvasId] || [];

                  // If no specific annotations found, include some general ones
                  const finalAnnotations =
                    mapAnnotations.length > 0
                      ? mapAnnotations
                      : place.textRecognitionSources
                          ?.slice(0, 2)
                          .map((source) => ({
                            text: source.text,
                            source: source.source,
                            isHumanVerified: source.isHumanVerified,
                            created: source.created,
                          })) || [];

                  mapTimeline.push({
                    date: 'Historical period', // Most map references don't have specific dates
                    title: mapRef.mapTitle,
                    canvasId: mapRef.canvasId,
                    mapId: mapRef.mapId,
                    annotationTexts: finalAnnotations,
                    isPrimary: false,
                    gridSquare: mapRef.gridSquare,
                    pageNumber: mapRef.pageNumber,
                  });
                });
              }

              // Sort by date (primary maps with real dates first, then historical period)
              mapTimeline.sort((a, b) => {
                // Primary maps first
                if (a.isPrimary && !b.isPrimary) return -1;
                if (!a.isPrimary && b.isPrimary) return 1;

                // Then by date
                if (a.date === 'Unknown date' || a.date === 'Historical period')
                  return 1;
                if (b.date === 'Unknown date' || b.date === 'Historical period')
                  return -1;
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
              {/* Primary map (from mapInfo) */}
              {place.mapInfo && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        {place.mapInfo.title}
                      </h3>
                      {place.mapInfo.date && (
                        <p className="text-sm text-muted-foreground mb-2">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Created: {place.mapInfo.date}
                        </p>
                      )}
                      {place.mapInfo.dimensions && (
                        <p className="text-sm text-muted-foreground">
                          Dimensions: {place.mapInfo.dimensions.width} ×{' '}
                          {place.mapInfo.dimensions.height}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-row gap-2 ml-4">
                      {place.mapInfo.permalink && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(place.mapInfo!.permalink, '_blank')
                          }
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                      )}
                      {place.canvasId && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            place.canvasId &&
                            window.open(
                              `/viewer?canvas=${encodeURIComponent(
                                place.canvasId,
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
              )}

              {/* Additional map references */}
              {place.mapReferences && place.mapReferences.length > 0 && (
                <>
                  {place.mapReferences.map((mapRef, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            {mapRef.mapTitle}
                          </h3>
                          {mapRef.gridSquare && (
                            <p className="text-sm text-muted-foreground">
                              Grid Reference: {mapRef.gridSquare}
                            </p>
                          )}
                          {mapRef.pageNumber && (
                            <p className="text-sm text-muted-foreground">
                              Page: {mapRef.pageNumber}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          {mapRef.canvasId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/viewer?canvas=${encodeURIComponent(
                                    mapRef.canvasId,
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
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
