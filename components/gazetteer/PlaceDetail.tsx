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

          {/* 3. Map Recognition Timeline */}
          {place.textRecognitionSources &&
            place.textRecognitionSources.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                  <Clock className="w-6 h-6" />
                  <span>Discovery Timeline</span>
                </h2>
                <p className="text-muted-foreground mb-6">
                  How this place was identified and recognized on historical
                  maps:
                </p>

                <div className="space-y-4">
                  {place.textRecognitionSources
                    .sort((a, b) => {
                      // Sort by map date if available, otherwise by creation date
                      const dateA = place.mapInfo?.date || a.created || '';
                      const dateB = place.mapInfo?.date || b.created || '';
                      return dateA.localeCompare(dateB);
                    })
                    .map((source, index) => (
                      <div
                        key={index}
                        className="border-l-4 border-primary pl-6 py-4 bg-gray-50 rounded-r-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-medium text-foreground">
                              "{source.text}"
                            </h3>
                            {place.mapInfo?.date && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Found on map from {place.mapInfo.date}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              source.source === 'human'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {source.source === 'human'
                              ? 'Human Transcribed'
                              : 'AI Recognized'}
                          </Badge>
                        </div>

                        {source.created && (
                          <p className="text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Identified:{' '}
                            {new Date(source.created).toLocaleDateString()}
                          </p>
                        )}

                        {source.creator && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Verified by: {source.creator.label}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

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
                  {place.category.toLowerCase()} on historical maps. Different
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
              <span>Historical Maps</span>
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
                          {place.mapInfo.dimensions.height} pixels
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
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
                          Viewer
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
