'use client';

import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Map,
  MapPin,
  Target,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  getCategoryLabel,
  getCategoryUri,
} from '../../lib/gazetteer/poolparty-taxonomy';
import type { GazetteerPlace } from '../../lib/gazetteer/types';
import { MapSnippet } from './MapSnippet';

// eslint-disable-next-line @typescript-eslint/naming-convention
const ModernLocationMap = dynamic(() => import('./ModernLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-muted/30 rounded-lg flex items-center justify-center">
      <LoadingSpinner />
    </div>
  ),
});

interface PlaceDetailProps {
  slug: string;
}

export default function PlaceDetail({ slug }: PlaceDetailProps) {
  const [place, setPlace] = useState<GazetteerPlace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iconographyDef, setIconographyDef] = useState<string | null>(null);
  const [manifestData, setManifestData] = useState<
    Record<string, { date: string; permalink: string; title: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const isFetchingRef = useRef(false);

  // Helper to fetch IIIF manifest data from canvas URI
  const fetchManifestData = useCallback(async (canvasUri: string) => {
    try {
      // Extract manifest URI by removing canvas part
      const manifestUri = canvasUri.replace(/\/canvas\/.*$/, '');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(manifestUri, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const manifest = await response.json();

      // Extract title from label
      let title = '';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (manifest.label?.en?.[0]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        title = (manifest.label.en[0] as string) || '';
      }

      // Extract date and permalink from metadata
      let date = '';
      let permalink = '';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (manifest.metadata) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        manifest.metadata.forEach((field: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const labelEn = field.label?.en?.[0];
          if (labelEn === 'Date') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            date = (field.value?.en?.[0] as string) || '';
          } else if (labelEn === 'Permalink') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const rawPermalink = (field.value?.en?.[0] as string) || '';
            // Extract URL from HTML anchor tag if present
            const match = rawPermalink.match(/href="([^"]+)"/);
            permalink = match ? match[1] || '' : rawPermalink;
          }
        });
      }

      return { date, permalink, title };
    } catch {
      return null;
    }
  }, []);

  // Helper function to process place data (manifest, iconography, etc.)
  const processPlaceData = useCallback(
    async (placeData: any) => {
      setPlace(placeData);

      // Fetch manifest data for all canvas IDs
      const canvasIds = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (placeData.canvasId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        canvasIds.add(placeData.canvasId as string);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (placeData.mapReferences) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        placeData.mapReferences.forEach((ref: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (ref.canvasId) canvasIds.add(ref.canvasId as string);
        });
      }

      const manifestPromises = Array.from(canvasIds).map(async (canvasId) => {
        const data = await fetchManifestData(canvasId);
        return { canvasId, data };
      });

      const manifestResults = await Promise.all(manifestPromises);
      const newManifestData: Record<
        string,
        { date: string; permalink: string; title: string }
      > = {};
      manifestResults.forEach(({ canvasId, data }) => {
        if (data) {
          newManifestData[canvasId] = data;
        }
      });
      setManifestData(newManifestData);

      // Fetch iconography definition if category exists
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (placeData.category) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const categoryKey = ((placeData.category as string) || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_');
        try {
          const thesRes = await fetch('/iconography-thesaurus.json');
          const thesData = await thesRes.json();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const concept = thesData['@graph']?.find(
            (c: any) =>
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              c['@id'] === categoryKey ||
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
              c.prefLabel?.['@value']?.toLowerCase() ===
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                ((placeData.category as string) || '').toLowerCase(),
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (concept?.definition?.['@value']) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            setIconographyDef(concept.definition['@value']);
          }
        } catch {
          // Silently fail if thesaurus not available
        }
      }
    },
    [fetchManifestData],
  );

  const fetchPlace = useCallback(async () => {
    // Prevent concurrent fetches - check both ref and loading state
    if (isFetchingRef.current) {
      console.log('[PlaceDetail] Fetch already in progress, skipping...');
      return;
    }

    console.log('[PlaceDetail] Starting fetch for slug:', slug);
    isFetchingRef.current = true;

    // Use transition to avoid blocking
    setIsLoading(true);
    setError(null);
    setLoadingProgress('');

    try {
      // First try the direct API (searches first ~1600 places)
      setLoadingProgress('Searching database...');
      const response = await fetch(`/api/gazetteer/places/${slug}`);

      if (response.ok) {
        const placeData = await response.json();
        setLoadingProgress('');
        await processPlaceData(placeData);
        return;
      }

      // If 404 or 504 (timeout), do progressive client-side search
      if (response.status === 404 || response.status === 504) {
        console.log(
          `[PlaceDetail] Got ${response.status}, starting progressive search for:`,
          slug,
        );
        setLoadingProgress('Searching all pages for this place...');

        // Progressive search through all pages
        // Start from page 0 since the API search timed out and didn't complete
        let page = 0;
        const maxPages = 10; // Safety limit - we know data only goes to ~page 7

        while (page < maxPages) {
          const batchSize = 2; // Smaller batches to avoid timeout
          const startPage = page;
          const endPage = Math.min(page + batchSize, maxPages);

          setLoadingProgress(
            `Searching pages ${startPage + 1}-${endPage} (checked ${startPage * 100}+ places)...`,
          );

          // Load batch of pages in parallel with timeout handling
          const batchPromises = [];
          for (let p = startPage; p < endPage; p++) {
            batchPromises.push(
              fetch(`/api/gazetteer/linking-bulk?page=${p}`)
                .then((res) =>
                  res.ok ? res.json() : { places: [], hasMore: false },
                )
                .catch((err: Error) => {
                  console.warn(
                    `[PlaceDetail] Page ${p} failed (${err.message}), continuing...`,
                  );
                  return { places: [], hasMore: false };
                }),
            );
          }

          const batchResults = await Promise.all(batchPromises);

          // Log batch results
          console.log(
            `[PlaceDetail] Batch ${startPage}-${endPage - 1}: Got ${batchResults.length} results`,
          );
          const totalPlaces = batchResults.reduce(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (sum: number, r) => sum + ((r.places?.length as number) || 0),
            0,
          );
          console.log(`[PlaceDetail] Total places in batch: ${totalPlaces}`);

          // Search for place in all batch results
          for (const result of batchResults) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const places = result.places || [];

            // Log sample place names from this batch
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (places.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
              const sampleNames = places.slice(0, 3).map((p: any) => p.name);
              console.log(`[PlaceDetail] Sample places:`, sampleNames);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const matchedPlace = places.find((p: any) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              const placeSlug = ((p.name as string) || '')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
              return placeSlug === slug;
            });

            if (matchedPlace) {
              console.log(
                '[PlaceDetail] Found place on page:',
                page,
                matchedPlace,
              );
              setLoadingProgress('Found! Loading details...');
              await processPlaceData(matchedPlace);
              setLoadingProgress('');
              return;
            }
          }

          // Check if there are more pages
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const hasMore = batchResults.some((r) => r.hasMore === true);
          if (!hasMore) {
            break; // No more pages to search
          }

          page = endPage;
        }

        // Not found after exhaustive search
        setError('Place not found');
        return;
      }

      // Handle other errors
      if (response.status === 504) {
        setError(
          'Request timed out. The server is taking too long to load this place. Please try again later.',
        );
      } else {
        setError('Failed to load place details');
      }
    } catch (err) {
      console.error('[PlaceDetail] Error:', err);
      setError(
        'Failed to load place details. Please check your connection and try again.',
      );
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setLoadingProgress('');
    }
  }, [slug, processPlaceData]);

  useEffect(() => {
    // Prevent double-fetching on mount/strict mode
    if (isFetchingRef.current) {
      console.log('[PlaceDetail] Already fetching, skipping duplicate effect');
      return;
    }

    // Reset state when slug changes
    setPlace(null);
    setError(null);
    setLoadingProgress('');
    setIsLoading(true);

    fetchPlace().catch((err) => {
      console.error('Failed to fetch place:', err);
    });

    // Cleanup function to handle component unmount
    return () => {
      isFetchingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]); // Only re-fetch when slug changes

  if (isLoading) {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="w-full px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <LoadingSpinner />
            {loadingProgress && (
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {loadingProgress}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="w-full px-6 py-8">
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
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
    <div className="h-full overflow-auto bg-background">
      <div className="w-full px-6 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link href="/gazetteer">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gazetteer
            </Button>
          </Link>
        </div>

        {/* Two-column layout with wider left column for details, narrower right for map */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8 h-full">
          {/* Left column - Place details (takes 2/3 of space) */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-4xl font-heading text-primary mb-3 text-center">
                {place.name}
              </h1>
              <p className="text-lg text-muted-foreground text-center mb-4">
                Historical place from early modern Kerala maps
              </p>

              {/* Data Quality Badges - Moved from separate section */}
              <div className="flex flex-wrap justify-center gap-2 pb-4 mb-4 border-b">
                {place.hasHumanVerification && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </Badge>
                )}

                {place.isGeotagged && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Geotagged</span>
                  </Badge>
                )}

                {place.hasPointSelection && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1.5"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Point Selected</span>
                  </Badge>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Source Maps Count */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-primary">
                    <Map className="w-4 h-4" />
                    <span className="text-2xl font-bold">
                      {(() => {
                        const uniqueCanvasIds = new Set<string>();
                        if (place.canvasId) {
                          uniqueCanvasIds.add(place.canvasId);
                        }
                        if (place.mapReferences) {
                          place.mapReferences.forEach((ref) => {
                            if (ref.canvasId) {
                              uniqueCanvasIds.add(ref.canvasId);
                            }
                          });
                        }
                        // Also count from text recognition sources
                        if (place.textRecognitionSources) {
                          place.textRecognitionSources.forEach((src) => {
                            if (src.canvasUrl) {
                              uniqueCanvasIds.add(src.canvasUrl);
                            }
                          });
                        }
                        return uniqueCanvasIds.size;
                      })()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Source Maps
                  </span>
                </div>

                {/* Linked Annotations */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-primary">
                    <Target className="w-4 h-4" />
                    <span className="text-2xl font-bold">
                      {place.linkingAnnotationCount ?? 1}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(place.linkingAnnotationCount ?? 1) > 1
                      ? 'Occurrences'
                      : 'Occurrence'}
                  </span>
                </div>

                {/* Target Annotations (text + icons) */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-primary">
                    <FileText className="w-4 h-4" />
                    <span className="text-2xl font-bold">
                      {place.textRecognitionSources?.length ?? 0}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Targets</span>
                </div>

                {/* Annotation Area (approximate) */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-primary">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-2xl font-bold">
                      {(() => {
                        let totalArea = 0;
                        place.textRecognitionSources
                          ?.filter((s) => s.svgSelector)
                          .forEach((source) => {
                            const polygonMatch =
                              source.svgSelector?.match(/points="([^"]+)"/);
                            if (polygonMatch?.[1]) {
                              const points = polygonMatch[1]
                                .trim()
                                .split(/\s+/)
                                .map((pt) => {
                                  const coords = pt.split(',').map(Number);
                                  return {
                                    x: coords[0] ?? 0,
                                    y: coords[1] ?? 0,
                                  };
                                });
                              if (points.length >= 3) {
                                const minX = Math.min(
                                  ...points.map((p) => p.x),
                                );
                                const maxX = Math.max(
                                  ...points.map((p) => p.x),
                                );
                                const minY = Math.min(
                                  ...points.map((p) => p.y),
                                );
                                const maxY = Math.max(
                                  ...points.map((p) => p.y),
                                );
                                const area = (maxX - minX) * (maxY - minY);
                                totalArea += area;
                              }
                            }
                          });
                        // Convert to approximate square centimeters (assuming ~100 pixels per cm)
                        return Math.round(totalArea / 10000);
                      })()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    cm² area
                  </span>
                </div>
              </div>
            </div>

            {/* Alternative Names - Enhanced with Text Recognition */}
            {((place.alternativeNames?.length ?? 0) > 0 ||
              (place.textParts?.length ?? 0) > 0) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                  <FileText className="w-6 h-6" />
                  <span>Alternative Names</span>
                </h2>

                {/* Historical Sources (GAVOC + GLOBALISE) */}
                {(place.alternativeNames?.length ?? 0) > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span className="w-1 h-4 bg-primary rounded" />
                      Historical Sources
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {place.alternativeNames?.map((name) => (
                        <Badge
                          key={`alt-name-${place.id}-${name.replace(
                            /[^a-zA-Z0-9]/g,
                            '',
                          )}`}
                          variant="outline"
                          className="text-base py-2 px-4 bg-primary/5"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Recognition (AI & Human) */}
                {(place.textParts?.length ?? 0) > 0 &&
                  (() => {
                    // Deduplicate and group text parts
                    const uniqueTextParts = Array.from(
                      new Set(place.textParts?.map((tp) => tp.value) || []),
                    ).filter(
                      (value) =>
                        value !== place.name &&
                        !place.alternativeNames?.includes(value),
                    );

                    if (uniqueTextParts.length === 0) return null;

                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <span className="w-1 h-4 bg-primary rounded" />
                          Text Recognition (HTR + Human)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {uniqueTextParts.map((value) => (
                            <Badge
                              key={`text-part-${value}`}
                              variant="secondary"
                              className="text-base py-2 px-4"
                            >
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Map Snippets Section */}
            {place.textRecognitionSources &&
              place.textRecognitionSources.some(
                (source) => source.svgSelector && source.canvasUrl,
              ) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-heading text-primary mb-6 flex items-center space-x-2">
                    <ImageIcon className="w-6 h-6" />
                    <span>Map Snippets</span>
                  </h2>

                  <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                    {place.textRecognitionSources
                      .filter(
                        (source) => source.svgSelector && source.canvasUrl,
                      )
                      .slice(0, 12)
                      .map((source) => (
                        <MapSnippet
                          key={`snippet-${source.targetId}-${source.svgSelector?.slice(0, 30)}-${source.motivation || 'text'}`}
                          svgSelector={source.svgSelector!}
                          canvasUrl={source.canvasUrl!}
                          text={source.text}
                          source={source.source}
                          motivation={source.motivation}
                        />
                      ))}
                  </div>

                  {place.textRecognitionSources.filter(
                    (source) => source.svgSelector && source.canvasUrl,
                  ).length > 12 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      Showing 12 of{' '}
                      {
                        place.textRecognitionSources.filter(
                          (source) => source.svgSelector && source.canvasUrl,
                        ).length
                      }{' '}
                      snippets
                    </p>
                  )}
                </div>
              )}

            {/* Place Type */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Map className="w-6 h-6" />
                <span>Place Type</span>
              </h2>

              {(() => {
                // Extract place type from different sources
                const placeTypes: Array<{
                  type: string;
                  source: string;
                  confidence: 'high' | 'medium' | 'low';
                  icon: React.ReactNode;
                  details?: string;
                }> = [];

                // 1. Iconography classification (from classifying body)
                const iconographyAnnotations = place.textRecognitionSources
                  ?.filter((s) => s.motivation === 'iconography')
                  .filter((s) => s.classification); // Only include those with classification data

                if (
                  iconographyAnnotations &&
                  iconographyAnnotations.length > 0
                ) {
                  iconographyAnnotations.forEach((annotation) => {
                    const classification = annotation.classification;
                    if (!classification) return;

                    // Build details string with creator and date if available
                    let details = 'Classified from map icon';
                    if (classification.creator) {
                      details += ` by ${classification.creator.label}`;
                    }
                    if (classification.created) {
                      const date = new Date(classification.created);
                      details += ` (${date.toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })})`;
                    }

                    placeTypes.push({
                      type: classification.label,
                      source: 'Iconography classification',
                      confidence: 'high',
                      icon: (
                        <ImageIcon className="w-4 h-4 text-[hsl(var(--chart-2))]" />
                      ),
                      details,
                    });
                  });
                }

                // 2. Geotag place type (from linking annotation geotagging body)
                if (place.category && place.category !== 'place') {
                  const categoryLabel = getCategoryLabel(place.category);
                  placeTypes.push({
                    type: categoryLabel,
                    source: 'Geotag classification',
                    confidence: 'high',
                    icon: <MapPin className="w-4 h-4 text-primary" />,
                    details: place.isGeotagged
                      ? 'From geographic database'
                      : 'From place identification',
                  });
                }

                // 3. Inferred from place name (textspotting-based)
                const inferPlaceTypeFromName = (
                  name: string,
                ): string | null => {
                  const lowerName = name.toLowerCase();

                  if (
                    lowerName.includes('rivier') ||
                    lowerName.includes('river') ||
                    lowerName.includes('rio')
                  ) {
                    return 'River';
                  }
                  if (
                    lowerName.includes('eiland') ||
                    lowerName.includes('island') ||
                    lowerName.includes('ilha')
                  ) {
                    return 'Island';
                  }
                  if (
                    lowerName.includes('berg') ||
                    lowerName.includes('mountain')
                  ) {
                    return 'Mountain';
                  }
                  if (
                    lowerName.includes('kaap') ||
                    lowerName.includes('cape') ||
                    lowerName.includes('caap')
                  ) {
                    return 'Cape';
                  }
                  if (lowerName.includes('baai') || lowerName.includes('bay')) {
                    return 'Bay';
                  }
                  if (
                    lowerName.includes('meer') ||
                    lowerName.includes('lake')
                  ) {
                    return 'Lake';
                  }
                  if (
                    lowerName.includes('zee') ||
                    lowerName.includes('sea') ||
                    lowerName.includes('oceaan')
                  ) {
                    return 'Sea';
                  }
                  if (
                    lowerName.includes('fort') ||
                    lowerName.includes('castle') ||
                    lowerName.includes('kasteel')
                  ) {
                    return 'Fort';
                  }
                  if (
                    lowerName.includes('tempel') ||
                    lowerName.includes('temple') ||
                    lowerName.includes('pagood') ||
                    lowerName.includes('pagoda')
                  ) {
                    return 'Temple';
                  }
                  if (
                    lowerName.includes('stad') ||
                    lowerName.includes('city')
                  ) {
                    return 'City';
                  }
                  if (
                    lowerName.includes('dorp') ||
                    lowerName.includes('village')
                  ) {
                    return 'Village';
                  }
                  if (
                    lowerName.includes('koninkryk') ||
                    lowerName.includes('kingdom') ||
                    lowerName.includes('ryk')
                  ) {
                    return 'Kingdom';
                  }

                  return null;
                };

                const inferredType = inferPlaceTypeFromName(place.name);
                if (
                  inferredType &&
                  !placeTypes.some(
                    (pt) =>
                      pt.type.toLowerCase() === inferredType.toLowerCase(),
                  )
                ) {
                  placeTypes.push({
                    type: inferredType,
                    source: 'Inferred from name',
                    confidence: 'low',
                    icon: <FileText className="w-4 h-4 text-secondary" />,
                    details: `Based on text: "${place.name}"`,
                  });
                }

                return (
                  <div className="space-y-4">
                    {placeTypes.length > 0 ? (
                      <>
                        {/* Primary type (most confident) */}
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge
                              variant="secondary"
                              className="text-lg py-2 px-4"
                            >
                              {placeTypes[0]?.type}
                            </Badge>
                            {getCategoryUri(place.category) && (
                              <a
                                href={getCategoryUri(place.category) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                              >
                                <Globe className="w-3 h-3" />
                                PoolParty URI
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {iconographyDef && (
                            <p className="text-sm text-muted-foreground italic mb-3">
                              {iconographyDef}
                            </p>
                          )}
                        </div>

                        {/* All type identifications */}
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">
                            Type Identifications:
                          </h3>
                          <div className="space-y-2">
                            {placeTypes.map((placeType) => (
                              <div
                                key={`place-type-${placeType.source}-${placeType.type}`}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                  placeType.confidence === 'high'
                                    ? 'bg-card border-primary/20'
                                    : placeType.confidence === 'medium'
                                      ? 'bg-muted/30 border-muted'
                                      : 'bg-secondary/10 border-secondary/30'
                                }`}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {placeType.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-foreground">
                                      {placeType.type}
                                    </span>
                                    <Badge
                                      variant={
                                        placeType.confidence === 'high'
                                          ? 'default'
                                          : 'outline'
                                      }
                                      className="text-xs"
                                    >
                                      {placeType.confidence === 'high'
                                        ? 'High confidence'
                                        : placeType.confidence === 'medium'
                                          ? 'Medium confidence'
                                          : 'Inferred'}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {placeType.source}
                                    {placeType.details &&
                                      ` — ${placeType.details}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          No place type information available
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Historical Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Clock className="w-6 h-6" />
                <span>Timeline</span>
              </h2>

              {(() => {
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
                  linkingAnnotationId?: string;
                };

                const mapEntries: MapEntry[] = [];

                // Create an entry for each map reference (each linking annotation occurrence)
                if (place.mapReferences && place.mapReferences.length > 0) {
                  place.mapReferences.forEach((mapRef) => {
                    const manifestInfo = manifestData[mapRef.canvasId];

                    // Get annotations for this specific occurrence (canvas-specific)
                    const occurrenceAnnotations =
                      place.textRecognitionSources
                        ?.filter((source) => {
                          // Match by canvasUrl to get only annotations from this specific map
                          return source.canvasUrl === mapRef.canvasId;
                        })
                        .map((source) => ({
                          text: source.text,
                          source: source.source,
                          isHumanVerified: source.isHumanVerified,
                          created: source.created,
                          targetId: source.targetId,
                        })) || [];

                    const mapTitle =
                      manifestInfo?.title ||
                      mapRef.canvasId.split('/').slice(-2, -1)[0] ||
                      'Unknown Map';

                    mapEntries.push({
                      date: manifestInfo?.date || '?',
                      title: mapTitle,
                      permalink: manifestInfo?.permalink,
                      canvasId: mapRef.canvasId,
                      mapId: mapRef.mapId,
                      annotationTexts: occurrenceAnnotations,
                      isPrimary: false,
                      gridSquare: mapRef.gridSquare,
                      pageNumber: mapRef.pageNumber,
                      sources: ['occurrence'],
                      linkingAnnotationId: mapRef.linkingAnnotationId,
                    });
                  });
                }

                // Sort entries by date (most recent first, unknowns last)
                const mapTimeline: MapEntry[] = mapEntries.sort((a, b) => {
                  // Unknown dates go last
                  if (a.date === '?') return 1;
                  if (b.date === '?') return -1;

                  // Extract start year from date ranges like "1752/1757" or single years "1767"
                  const extractYear = (dateStr: string): number => {
                    const match = dateStr.match(/(\d{4})/);
                    return match?.[1] ? parseInt(match[1], 10) : 0;
                  };

                  const yearA = extractYear(a.date);
                  const yearB = extractYear(b.date);

                  // Sort descending (most recent first)
                  return yearB - yearA;
                });

                return (
                  <div className="space-y-6">
                    {/* Present day location */}
                    {(place.modernName || place.isGeotagged) && (
                      <div className="relative">
                        <div className="absolute left-6 top-16 h-6 w-0.5 bg-primary/30" />

                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-secondary text-white">
                            <MapPin className="w-6 h-6" />
                          </div>

                          <div className="flex-1 bg-secondary/5 rounded-lg p-4 border border-secondary/20">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-xl font-bold text-secondary">
                                    Present
                                  </h3>
                                  <span className="text-lg font-semibold text-foreground ml-2">
                                    — {place.modernName || place.name}
                                  </span>
                                </div>

                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <p>
                                    Modern location{' '}
                                    {place.isGeotagged
                                      ? 'identified via geographic database'
                                      : 'inferred from historical references'}
                                  </p>
                                  {place.coordinates && (
                                    <p>
                                      Coordinates: {place.coordinates.y}°N,{' '}
                                      {place.coordinates.x}°E
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-row gap-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
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
                                  <Globe className="w-4 h-4 mr-1" />
                                  Map
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {mapTimeline.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No map information available for this place</p>
                      </div>
                    ) : (
                      mapTimeline.map((mapEntry, index) => (
                        <div
                          key={`timeline-${mapEntry.linkingAnnotationId || index}`}
                          className="relative"
                        >
                          {mapTimeline.indexOf(mapEntry) <
                            mapTimeline.length - 1 && (
                            <div className="absolute left-6 top-16 h-6 w-0.5 bg-primary/30" />
                          )}

                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-primary text-white">
                              <Map className="w-6 h-6" />
                            </div>

                            <div className="flex-1 bg-gray-50 rounded-lg p-4 border">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-xl font-bold text-primary">
                                      {mapEntry.date}
                                      {(() => {
                                        // Use canvas-specific annotations from mapEntry
                                        if (
                                          mapEntry.annotationTexts.length === 0
                                        ) {
                                          return null;
                                        }

                                        // Check if there are any icons in THIS map entry
                                        const hasIcon =
                                          mapEntry.annotationTexts.some(
                                            (annotation) =>
                                              annotation.text === 'Icon',
                                          );

                                        // Get text values (excluding icons)
                                        const textValues =
                                          mapEntry.annotationTexts
                                            .filter(
                                              (annotation) =>
                                                annotation.text !== 'Icon',
                                            )
                                            .map((annotation) =>
                                              annotation.text.trim(),
                                            )
                                            .filter((text) => text.length > 0);

                                        if (
                                          textValues.length === 0 &&
                                          !hasIcon
                                        ) {
                                          return null;
                                        }

                                        return (
                                          <span className="text-lg font-semibold text-foreground ml-2">
                                            {textValues.length > 0 && (
                                              <>— {textValues.join(' ')}</>
                                            )}
                                            {hasIcon && (
                                              <span className="text-muted-foreground">
                                                {textValues.length > 0
                                                  ? ' + Icon'
                                                  : '— Icon'}
                                              </span>
                                            )}
                                          </span>
                                        );
                                      })()}
                                    </h3>
                                  </div>

                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    {mapEntry.title && (
                                      <p className="italic opacity-60">
                                        Map: {mapEntry.title}
                                      </p>
                                    )}
                                    {mapEntry.gridSquare && (
                                      <p>
                                        Grid Reference: {mapEntry.gridSquare}
                                      </p>
                                    )}
                                    {mapEntry.pageNumber && (
                                      <p>Page: {mapEntry.pageNumber}</p>
                                    )}
                                    {mapEntry.dimensions && (
                                      <p>
                                        Dimensions: {mapEntry.dimensions.width}{' '}
                                        × {mapEntry.dimensions.height}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-row gap-2 ml-4">
                                  {mapEntry.permalink && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open(
                                          mapEntry.permalink,
                                          '_blank',
                                        )
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
                      ))
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Description */}
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

            {/* Historical Notes & Remarks */}
            {place.comments && place.comments.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                  <FileText className="w-6 h-6" />
                  <span>Historical Notes</span>
                </h2>
                <div className="space-y-4">
                  {place.comments.map((comment) => (
                    <div
                      key={`comment-${place.id}-${comment.targetId}`}
                      className="border-l-4 border-primary/30 pl-4 py-2 bg-muted/20 rounded-r-lg"
                    >
                      <p className="text-foreground leading-relaxed mb-2">
                        {comment.value}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>
                          {comment.creator?.label || 'Human annotator'}
                        </span>
                        {comment.targetId && (
                          <>
                            <span>•</span>
                            <a
                              href={comment.targetId}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary flex items-center gap-1"
                            >
                              View annotation
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historic Maps */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Map className="w-6 h-6" />
                <span>Historic Maps</span>
              </h2>

              <div className="space-y-4">
                {(() => {
                  const allMaps: Array<{
                    title: string;
                    date?: string;
                    dimensions?: { width: number; height: number };
                    canvasId: string;
                    mapId: string;
                    gridSquare?: string;
                    pageNumber?: string;
                    permalink?: string;
                    isPrimary: boolean;
                    linkingAnnotationId?: string;
                  }> = [];

                  // Create one entry per map reference (each linking annotation occurrence)
                  if (place.mapReferences && place.mapReferences.length > 0) {
                    place.mapReferences.forEach((mapRef) => {
                      const manifestInfo = manifestData[mapRef.canvasId];
                      const title =
                        manifestInfo?.title ||
                        mapRef.canvasId.split('/').slice(-2, -1)[0] ||
                        'Unknown Map';

                      allMaps.push({
                        title,
                        date: manifestInfo?.date,
                        canvasId: mapRef.canvasId,
                        mapId: mapRef.mapId,
                        gridSquare: mapRef.gridSquare,
                        pageNumber: mapRef.pageNumber,
                        permalink: manifestInfo?.permalink,
                        isPrimary: false,
                        linkingAnnotationId: mapRef.linkingAnnotationId,
                      });
                    });
                  }

                  return allMaps.map((mapData) => (
                    <div
                      key={`historic-map-${mapData.linkingAnnotationId || mapData.canvasId}`}
                      className={`border rounded-lg p-4 ${
                        mapData.isPrimary ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            {mapData.title}
                          </h3>
                          {mapData.date ? (
                            <p className="text-sm text-muted-foreground mb-2">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              Created: {mapData.date}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mb-2">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              Date unknown
                            </p>
                          )}
                          {mapData.dimensions && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Dimensions: {mapData.dimensions.width} ×{' '}
                              {mapData.dimensions.height}
                            </p>
                          )}
                          {mapData.gridSquare && (
                            <p className="text-sm text-muted-foreground">
                              Grid Reference: {mapData.gridSquare}
                            </p>
                          )}
                          {mapData.pageNumber && (
                            <p className="text-sm text-muted-foreground">
                              Page: {mapData.pageNumber}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-row gap-2 ml-4">
                          {mapData.permalink && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(mapData.permalink, '_blank')
                              }
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Archive
                            </Button>
                          )}
                          {mapData.canvasId && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                window.open(
                                  `/viewer?canvas=${encodeURIComponent(
                                    mapData.canvasId,
                                  )}`,
                                  '_blank',
                                );
                              }}
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

          {/* Right column - Modern location map */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-heading text-primary mb-4 flex items-center space-x-2">
                <Globe className="w-6 h-6" />
                <span>Modern Location</span>
              </h2>

              {/* Smaller map container */}
              <div className="h-64 lg:h-80">
                {place.modernName || place.name ? (
                  <ModernLocationMap
                    placeName={place.modernName || place.name}
                    fallbackName={place.name}
                    coordinates={
                      place.coordinateType === 'geographic'
                        ? place.coordinates
                        : undefined
                    }
                    isGeotagged={place.isGeotagged}
                  />
                ) : (
                  <div className="h-full bg-muted/30 rounded-lg flex flex-col items-center justify-center text-center p-6">
                    <MapPin className="w-12 h-12 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-medium text-muted-foreground">
                      No location data available
                    </h3>
                  </div>
                )}
              </div>

              {/* Location information and links */}
              {place.modernName ? (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-3">
                    Current: {place.modernName}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
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
                      <span>OpenStreetMap</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
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
                      <span>Wikidata</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Search for:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                      onClick={() => {
                        const searchQuery = encodeURIComponent(place.name);
                        window.open(
                          `https://www.openstreetmap.org/search?query=${searchQuery}`,
                          '_blank',
                        );
                      }}
                    >
                      <Globe className="w-4 h-4" />
                      <span>Search OpenStreetMap</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                      onClick={() => {
                        const searchQuery = encodeURIComponent(place.name);
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
