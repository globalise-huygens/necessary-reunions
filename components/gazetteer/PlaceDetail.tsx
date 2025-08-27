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
            {/* Enhanced Header with Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h1 className="text-3xl font-heading text-primary">
                    {place.name}
                  </h1>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{place.category}</Badge>
                    {place.hasPointSelection && (
                      <Badge className="bg-secondary/20 text-secondary-foreground">
                        Precisely Located
                      </Badge>
                    )}
                    {place.isGeotagged && (
                      <Badge className="bg-chart-2/20 text-chart-2">
                        Geotagged
                      </Badge>
                    )}
                  </div>
                </div>

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <div className="text-right text-sm text-muted-foreground">
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

              {/* Historical Context Timeline */}
              {(place.created || place.mapInfo?.date) && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Historical Timeline
                  </h3>
                  <div className="space-y-2 text-sm">
                    {place.mapInfo?.date && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                        <span className="text-muted-foreground">
                          Map created:
                        </span>
                        <span className="font-medium text-foreground">
                          {place.mapInfo.date}
                        </span>
                      </div>
                    )}
                    {place.created && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-muted-foreground">
                          Digitally annotated:
                        </span>
                        <span className="font-medium text-foreground">
                          {new Date(place.created).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modern Name */}
              {place.modernName && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      <strong>Modern Name:</strong> {place.modernName}
                    </span>
                  </div>
                </div>
              )}

              {/* Alternative Names */}
              {(place.alternativeNames?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-primary mb-2">
                    Historical Name Variants:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {place.alternativeNames?.map((name, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-muted/30"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Variants show how place name appeared in different
                    historical sources
                  </p>
                </div>
              )}
            </div>

            {/* Historical Significance Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Historical Evidence</span>
              </h2>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-foreground">
                  Place documented in early modern Kerala maps from VOC
                  archives. Historians identified and verified location through
                  text recognition and manual annotation of historical
                  cartographic sources.
                </p>
              </div>

              {place.textRecognitionSources &&
              place.textRecognitionSources.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="text-sm text-foreground mb-2">
                      <strong>Identification method:</strong>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Place name recognised from{' '}
                      <span className="font-medium text-foreground">
                        {place.targetAnnotationCount}
                      </span>{' '}
                      annotation{place.targetAnnotationCount !== 1 ? 's' : ''}{' '}
                      using{' '}
                      <span className="font-medium text-foreground">
                        {place.textRecognitionSources.length}
                      </span>{' '}
                      different recognition method
                      {place.textRecognitionSources.length !== 1 ? 's' : ''}.
                      Human verification confirms accuracy of historical place
                      names.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-medium text-primary">
                      Text Recognition Results:
                    </h3>
                    {place.textRecognitionSources.map((source, index) => (
                      <div
                        key={index}
                        className="border border-border rounded-lg p-4 bg-card"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-lg text-foreground">
                              "{source.text}"
                            </span>
                            {source.source === 'human' ? (
                              <User className="w-4 h-4 text-chart-2" />
                            ) : source.source === 'loghi-htr' ? (
                              <Bot className="w-4 h-4 text-chart-1" />
                            ) : (
                              <Bot className="w-4 h-4 text-chart-3" />
                            )}
                          </div>
                          <Badge
                            className={
                              source.source === 'human'
                                ? 'bg-chart-2/20 text-chart-2 border-chart-2/30'
                                : source.source === 'loghi-htr'
                                ? 'bg-chart-1/20 text-chart-1 border-chart-1/30'
                                : 'bg-chart-3/20 text-chart-3 border-chart-3/30'
                            }
                          >
                            {source.source === 'human'
                              ? 'Human Verified'
                              : source.source === 'loghi-htr'
                              ? 'Loghi HTR'
                              : 'AI Recognition'}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                          {source.creator && (
                            <div className="flex items-center space-x-2">
                              <User className="w-3 h-3" />
                              <span>
                                <strong>Verified by historian:</strong>{' '}
                                {source.creator.label}
                              </span>
                            </div>
                          )}

                          {source.generator && (
                            <div className="flex items-center space-x-2">
                              <Bot className="w-3 h-3" />
                              <span>
                                <strong>Recognition system:</strong>{' '}
                                {source.generator.label ||
                                  'AI Recognition System'}
                              </span>
                            </div>
                          )}

                          {source.created && (
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-3 h-3" />
                              <span>
                                <strong>Date identified:</strong>{' '}
                                {new Date(source.created).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {source.source !== 'human' && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <strong>Note:</strong> Text automatically
                              recognised from historical map.
                              {source.source === 'loghi-htr'
                                ? ' Loghi HTR specialises in historical handwritten text recognition.'
                                : ' AI systems identify text that manual review may miss.'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (place.annotations?.length ?? 0) > 0 ? (
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

            {/* Map Information Section */}
            {place.mapInfo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-heading text-primary mb-4 flex items-center space-x-2">
                  <Map className="w-5 h-5" />
                  <span>Historical Map Context</span>
                </h2>

                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <h3 className="font-medium text-foreground mb-2">
                      {place.mapInfo.title}
                    </h3>
                    {place.mapInfo.date && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Created:</strong> {place.mapInfo.date}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Historical map from VOC (Dutch East India Company)
                      archives documenting early modern Kerala geography and
                      settlements as recorded by European traders and
                      administrators.
                    </p>
                  </div>

                  {place.mapInfo.dimensions && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="text-muted-foreground">Map Width</div>
                        <div className="font-medium text-foreground">
                          {place.mapInfo.dimensions.width.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="text-muted-foreground">Map Height</div>
                        <div className="font-medium text-foreground">
                          {place.mapInfo.dimensions.height.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-medium text-primary">
                      For Researchers:
                    </h4>
                    <div className="space-y-2">
                      {place.mapInfo.permalink && (
                        <Link
                          href={place.mapInfo.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-primary hover:text-secondary transition-colors p-2 rounded-lg hover:bg-primary/5"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View Original Archive Record</span>
                        </Link>
                      )}

                      {place.canvasId && (
                        <Link
                          href={`/viewer?canvas=${encodeURIComponent(
                            place.canvasId,
                          )}`}
                          className="flex items-center space-x-2 text-primary hover:text-secondary transition-colors p-2 rounded-lg hover:bg-primary/5"
                        >
                          <Map className="w-4 h-4" />
                          <span>Explore Interactive Map Viewer</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Regional Context Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Regional & Historical Context</span>
              </h2>

              <div className="space-y-4">
                <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">
                    Early Modern Kerala Context
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Place documented during European trading company presence
                    along Kerala coast. Maps represent European understanding of
                    local geography, trade routes, and settlements during
                    17th-18th centuries.
                  </p>
                </div>

                {place.category && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <h3 className="font-medium text-foreground mb-2">
                      Place Category: {place.category}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {place.category === 'place' &&
                        'Location identified as general settlement or landmark on historical maps.'}
                      {place.category === 'plaats' &&
                        'Recorded as settlement (Dutch: plaats) in VOC documentation.'}
                      {place.category === 'eiland' &&
                        'Mapped as island, important for navigation and trade.'}
                      {place.category === 'rivier' &&
                        'River significant for transportation and trade in early modern Kerala.'}
                      {place.category === 'berg' &&
                        'Mountain or hill serving as geographical landmark for navigation.'}
                      {place.category === 'kaap' &&
                        'Cape marked as important navigational point for ships along coast.'}
                      {place.category === 'baai' &&
                        'Bay providing shelter for ships and used for trade activities.'}
                      {place.category === 'meer' &&
                        'Lake noted as significant geographical feature in region.'}
                      {![
                        'place',
                        'plaats',
                        'eiland',
                        'rivier',
                        'berg',
                        'kaap',
                        'baai',
                        'meer',
                      ].includes(place.category) &&
                        'Location documented as important geographical or administrative feature.'}
                    </p>
                  </div>
                )}

                {(place.alternativeNames?.length ?? 0) > 0 && (
                  <div className="bg-chart-2/10 border border-chart-2/20 rounded-lg p-4">
                    <h3 className="font-medium text-foreground mb-2">
                      Language and Cultural Context
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Multiple name variants reflect multilingual nature of
                      early modern Kerala. Malayalam, Portuguese, Dutch, and
                      other languages influenced place name recordings.
                      Variations help researchers understand how different
                      communities and administrations referred to same
                      locations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Facts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-heading text-primary mb-4">
                At a Glance
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge
                    variant="secondary"
                    className="bg-secondary/20 text-secondary-foreground"
                  >
                    {place.category}
                  </Badge>
                </div>

                {place.targetAnnotationCount && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Evidence Sources:
                    </span>
                    <span className="font-medium text-foreground bg-primary/10 px-2 py-1 rounded">
                      {place.targetAnnotationCount}
                    </span>
                  </div>
                )}

                {place.textRecognitionSources && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Recognition Methods:
                    </span>
                    <span className="font-medium text-foreground bg-accent/20 px-2 py-1 rounded">
                      {place.textRecognitionSources.length}
                    </span>
                  </div>
                )}

                {place.hasPointSelection && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Precise Location:
                    </span>
                    <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30">
                      Verified
                    </Badge>
                  </div>
                )}

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latitude:</span>
                        <span className="font-mono text-foreground bg-muted/30 px-2 py-1 rounded text-sm">
                          {place.coordinates.y.toFixed(6)}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Longitude:
                        </span>
                        <span className="font-mono text-foreground bg-muted/30 px-2 py-1 rounded text-sm">
                          {place.coordinates.x.toFixed(6)}°
                        </span>
                      </div>
                    </div>
                  )}

                {place.coordinates &&
                  arePixelCoordinates(place.coordinates) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Map Position:
                      </span>
                      <span className="font-mono text-foreground bg-muted/30 px-2 py-1 rounded text-xs">
                        x:{place.coordinates.x}, y:{place.coordinates.y}
                      </span>
                    </div>
                  )}

                {/* Data Quality Indicator */}
                <div className="pt-3 border-t border-border">
                  <div className="text-sm text-muted-foreground mb-2">
                    Data Quality:
                  </div>
                  <div className="flex items-center space-x-2">
                    {place.textRecognitionSources?.some(
                      (s) => s.source === 'human',
                    ) ? (
                      <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30 text-xs">
                        Human Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        AI Recognized
                      </Badge>
                    )}
                    {place.hasPointSelection && (
                      <Badge className="bg-secondary/20 text-secondary-foreground text-xs">
                        Precisely Located
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Research Tools */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-heading text-primary mb-4">
                Research Tools
              </h3>

              <div className="space-y-3">
                {place.canvasId && (
                  <Link
                    href={`/viewer?canvas=${encodeURIComponent(
                      place.canvasId,
                    )}`}
                    className="block"
                  >
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      <Map className="w-4 h-4 mr-2" />
                      Explore Map Viewer
                    </Button>
                  </Link>
                )}

                {place.coordinates &&
                  shouldDisplayCoordinates(place.coordinates) && (
                    <Button
                      variant="outline"
                      className="w-full border-secondary text-secondary hover:bg-secondary/10"
                      onClick={() => {
                        const url = `https://www.google.com/maps?q=${
                          place.coordinates!.y
                        },${place.coordinates!.x}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Modern Location
                    </Button>
                  )}

                {place.mapInfo?.permalink && (
                  <Link
                    href={place.mapInfo.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-accent text-accent hover:bg-accent/10"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Original Archive
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Historical Context */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-heading text-primary mb-4">
                Historical Period
              </h3>

              <div className="space-y-3 text-sm">
                {place.mapInfo?.date && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="font-medium text-foreground">Map Era</div>
                    <div className="text-muted-foreground">
                      {place.mapInfo.date}
                    </div>
                  </div>
                )}

                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                  <div className="font-medium text-foreground">
                    Research Status
                  </div>
                  <div className="text-muted-foreground">
                    {place.created &&
                      `Digitized ${new Date(place.created).getFullYear()}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Part of Necessary Reunions project
                  </div>
                </div>
              </div>
            </div>

            {/* Related Places */}
            {(place.mapReferences?.length ?? 0) > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-heading text-primary mb-4 flex items-center space-x-2">
                  <Map className="w-5 h-5" />
                  <span>Map References</span>
                </h3>

                <div className="space-y-3">
                  {place.mapReferences?.map((ref, index) => (
                    <div
                      key={index}
                      className="border border-border rounded-lg p-3 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-1 text-sm">
                        {ref.mapTitle && (
                          <div className="font-medium text-foreground">
                            {ref.mapTitle}
                          </div>
                        )}

                        {ref.gridSquare && (
                          <div className="text-muted-foreground">
                            <span className="font-medium">Grid Reference:</span>{' '}
                            {ref.gridSquare}
                          </div>
                        )}

                        {ref.pageNumber && (
                          <div className="text-muted-foreground">
                            <span className="font-medium">Page:</span>{' '}
                            {ref.pageNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  References show other maps or documents where place appears.
                  Helps researchers trace historical significance and
                  documentation of location.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
