'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  arePixelCoordinates,
  formatCoordinatesForDisplay,
  getCoordinateTypeLabel,
  shouldDisplayCoordinates,
} from '@/lib/gazetteer/coordinate-utils';
import type { GazetteerPlace } from '@/lib/gazetteer/types';
import {
  ArrowLeft,
  Bot,
  Calendar,
  ExternalLink,
  Eye,
  Globe,
  Map,
  MapPin,
  User,
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
        } else {
          setError('Failed to load place details');
        }
        return;
      }

      const placeData = await response.json();
      setPlace(placeData);
    } catch (err) {
      setError('Failed to load place details');
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
            <Link href="/gazetteer">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Gazetteer
              </Button>
            </Link>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h1 className="text-3xl font-heading text-primary">
                    {place.name}
                  </h1>
                  <Badge variant="secondary">{place.category}</Badge>
                </div>

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <div className="text-right text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {
                            formatCoordinatesForDisplay(place.coordinates)
                              .formatted
                          }
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Modern Name */}
              {place.modernName && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      <strong>Modern Name:</strong> {place.modernName}
                    </span>
                  </div>
                </div>
              )}

              {/* Alternative Names */}
              {(place.alternativeNames?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Alternative Names:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {place.alternativeNames?.map((name, index) => (
                      <Badge key={index} variant="outline">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Annotations */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Textual Evidence</span>
              </h2>

              {(place.annotations?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {place.annotations?.map((annotation, index) => (
                    <div key={annotation.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            "{annotation.value}"
                          </span>
                          {annotation.source === 'ai-generated' ? (
                            <Bot className="w-4 h-4 text-blue-500" />
                          ) : (
                            <User className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <Badge
                          variant={
                            annotation.source === 'ai-generated'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {annotation.source === 'ai-generated'
                            ? 'AI'
                            : 'Manual'}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(
                                annotation.created,
                              ).toLocaleDateString()}
                            </span>
                          </span>

                          {annotation.creator && (
                            <span className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{annotation.creator.label}</span>
                            </span>
                          )}
                        </div>

                        {annotation.canvasId && (
                          <div className="flex items-center space-x-1">
                            <Map className="w-3 h-3" />
                            <Link
                              href={`/viewer?canvas=${encodeURIComponent(
                                annotation.canvasId,
                              )}`}
                              className="text-primary hover:underline"
                            >
                              View on Map
                              <ExternalLink className="w-3 h-3 inline ml-1" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">
                  No textual annotations found for this place.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Facts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-heading text-primary mb-4">
                Quick Facts
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <Badge variant="secondary">{place.category}</Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Annotations:</span>
                  <span className="font-medium">
                    {place.annotations?.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Map References:</span>
                  <span className="font-medium">
                    {place.mapReferences?.length}
                  </span>
                </div>

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Latitude:</span>
                        <span className="font-mono">
                          {place.coordinates.y.toFixed(6)}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Longitude:</span>
                        <span className="font-mono">
                          {place.coordinates.x.toFixed(6)}°
                        </span>
                      </div>
                    </>
                  )}

                {place.coordinates &&
                  arePixelCoordinates(place.coordinates) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Map Position:</span>
                      <span className="font-mono text-xs">
                        x:{place.coordinates.x}, y:{place.coordinates.y}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* Map References */}
            {(place.mapReferences?.length ?? 0) > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-heading text-primary mb-4 flex items-center space-x-2">
                  <Map className="w-5 h-5" />
                  <span>Map References</span>
                </h3>

                <div className="space-y-3">
                  {place.mapReferences?.map((ref, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="space-y-1 text-sm">
                        {ref.mapTitle && (
                          <div className="font-medium">{ref.mapTitle}</div>
                        )}

                        {ref.gridSquare && (
                          <div className="text-gray-600">
                            Grid: {ref.gridSquare}
                          </div>
                        )}

                        {ref.pageNumber && (
                          <div className="text-gray-600">
                            Page: {ref.pageNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-heading text-primary mb-4">
                Explore
              </h3>

              <div className="space-y-3">
                {place.canvasId && (
                  <Link
                    href={`/viewer?canvas=${encodeURIComponent(
                      place.canvasId,
                    )}`}
                  >
                    <Button className="w-full">
                      <Map className="w-4 h-4 mr-2" />
                      View on Map
                    </Button>
                  </Link>
                )}

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const url = `https://www.google.com/maps?q=${
                          place.coordinates!.y
                        },${place.coordinates!.x}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </Button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
