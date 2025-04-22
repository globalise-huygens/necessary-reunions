'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { AnnotationPanel } from '@/components/annotation-panel';
// import { EditHistory } from "@/components/edit-history"
import { getLocalizedValue, extractAnnotations } from '@/lib/iiif-helpers';
import { BookOpen, Layers, Map, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface MetadataSidebarProps {
  manifest: any;
  currentCanvas: number;
  activeTab: 'metadata' | 'annotations' | 'geo';
  onChange: (updatedManifest: any) => void;
}

export function MetadataSidebar({
  manifest,
  currentCanvas,
  activeTab,
  onChange,
}: MetadataSidebarProps) {
  // Get the current canvas
  const canvas = manifest.items?.[currentCanvas];

  const [detailedGeoData, setDetailedGeoData] = useState<any>(null);
  const [allmapsAnnotation, setAllmapsAnnotation] = useState<any>(null);

  // Use useEffect to fetch georeferencing data when the canvas changes
  useEffect(() => {
    if (activeTab === 'geo' && canvas) {
      const fetchGeoreferencingData = async () => {
        // First, try to find Allmaps annotation
        const annotation = await findAllmapsAnnotation(canvas);
        if (annotation) {
          console.log('Found Allmaps annotation for metadata:', annotation);
          setAllmapsAnnotation(annotation);
        } else {
          setAllmapsAnnotation(null);
        }

        // Also extract detailed geo data for backward compatibility
        const geoData = extractDetailedGeoData(canvas);
        setDetailedGeoData(geoData);

        // If we have a georeferencing URL, fetch the data
        if (geoData && geoData.georeferencingUrl) {
          try {
            const response = await fetch(geoData.georeferencingUrl);
            if (response.ok) {
              const data = await response.json();
              setDetailedGeoData({
                ...geoData,
                gcps: data.gcps || geoData.gcps,
                transformation: data.transformation || geoData.transformation,
                resourceExtent:
                  data.resourceExtent || data.extent || geoData.resourceExtent,
              });
            }
          } catch (err) {
            console.error('Error fetching georeferencing data:', err);
          }
        }
      };

      fetchGeoreferencingData();
    } else {
      setDetailedGeoData(null);
      setAllmapsAnnotation(null);
    }
  }, [canvas, activeTab, currentCanvas]);

  // Helper function to find Allmaps annotation in canvas
  const findAllmapsAnnotation = async (canvas: any): Promise<any> => {
    if (!canvas.annotations || !Array.isArray(canvas.annotations)) {
      return null;
    }

    // Look through annotation pages
    for (const annoPage of canvas.annotations) {
      // Check if this is a georeferencing annotation page
      if (
        annoPage.id &&
        (annoPage.id.includes('georeferencing') ||
          annoPage.id.includes('allmaps')) &&
        annoPage.type === 'AnnotationPage'
      ) {
        try {
          console.log('Fetching georeferencing annotation:', annoPage.id);

          // Determine if this is a local file
          const isLocalFile =
            !annoPage.id.startsWith('http') ||
            annoPage.id.includes('localhost') ||
            annoPage.id.includes('127.0.0.1');

          // Fetch the annotation data
          const response = await fetch(annoPage.id, {
            // Force cache for local files, no-store for external
            cache: isLocalFile ? 'force-cache' : 'no-store',
          });

          if (!response.ok) {
            console.error(`Failed to fetch annotation: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log('Fetched georeferencing data:', data);

          // Check if this is a georeferencing annotation
          if (
            data.body &&
            (data.body._allmaps ||
              data.body.transformation ||
              data.body.gcps ||
              data.transformation ||
              data.gcps)
          ) {
            return data;
          }

          // If it's an annotation page with items, check each item
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              if (
                item.body &&
                (item.body._allmaps ||
                  item.body.transformation ||
                  item.body.gcps ||
                  item.transformation ||
                  item.gcps)
              ) {
                return item;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching annotation:', error);
        }
      }

      // Check items in the annotation page
      if (annoPage.items && Array.isArray(annoPage.items)) {
        for (const anno of annoPage.items) {
          // Check for georeferencing annotation
          if (
            anno.body &&
            (anno.body._allmaps ||
              anno.body.transformation ||
              anno.body.gcps ||
              anno.transformation ||
              anno.gcps)
          ) {
            return anno;
          }

          // Check for external annotation reference
          if (
            anno.id &&
            (anno.id.includes('georeferencing') || anno.id.includes('allmaps'))
          ) {
            try {
              console.log('Fetching referenced annotation:', anno.id);

              // Determine if this is a local file
              const isLocalFile =
                !anno.id.startsWith('http') ||
                anno.id.includes('localhost') ||
                anno.id.includes('127.0.0.1');

              const response = await fetch(anno.id, {
                // Force cache for local files, no-store for external
                cache: isLocalFile ? 'force-cache' : 'no-store',
              });

              if (!response.ok) {
                console.error(`Failed to fetch annotation: ${response.status}`);
                continue;
              }

              const data = await response.json();
              if (
                data.body &&
                (data.body._allmaps ||
                  data.body.transformation ||
                  data.body.gcps ||
                  data.transformation ||
                  data.gcps)
              ) {
                return data;
              }
            } catch (error) {
              console.error('Error fetching annotation:', error);
            }
          }
        }
      }
    }

    return null;
  };

  const extractDetailedGeoData = (canvas: any) => {
    if (!canvas) return null;

    const geoData = {
      coordinates: null,
      projection: null,
      boundingBox: null,
      georeferencingUrl: null,
      gcps: null,
      transformation: null,
      resourceExtent: null,
    };

    // First check for annotations that link to external georeferencing files
    if (canvas.annotations) {
      for (const annoPage of canvas.annotations) {
        // Check if this is a georeferencing annotation page
        if (
          annoPage.id &&
          annoPage.id.includes('georeferencing') &&
          annoPage.type === 'AnnotationPage'
        ) {
          geoData.georeferencingUrl = annoPage.id;
        }

        // Also check individual items
        if (annoPage.items) {
          for (const anno of annoPage.items) {
            // Check for links to georeferencing files
            if (anno.id && anno.id.includes('georeferencing')) {
              geoData.georeferencingUrl = anno.id;
            }

            // Check for geo motivations or geo selectors
            if (
              anno.motivation === 'georeferencing' ||
              (anno.body && anno.body.type === 'GeoJSON') ||
              (anno.target &&
                anno.target.selector &&
                anno.target.selector.type === 'GeoJSON')
            ) {
              // Extract geo data
              if (anno.body && anno.body.value) {
                try {
                  const geoJson =
                    typeof anno.body.value === 'string'
                      ? JSON.parse(anno.body.value)
                      : anno.body.value;

                  if (geoJson.coordinates) {
                    geoData.coordinates = geoJson.coordinates;
                  }
                  if (geoJson.properties && geoJson.properties.projection) {
                    geoData.projection = geoJson.properties.projection;
                  }
                  if (geoJson.bbox) {
                    geoData.boundingBox = geoJson.bbox;
                  }
                  if (geoJson.gcps) {
                    geoData.gcps = geoJson.gcps;
                  }
                  if (geoJson.transformation) {
                    geoData.transformation = geoJson.transformation;
                  }
                } catch (e) {
                  console.error('Error parsing GeoJSON:', e);
                }
              }

              // Check for projection in the annotation
              if (anno.body && anno.body.projection) {
                geoData.projection = anno.body.projection;
              }

              // Check for GCPs in the annotation
              if (anno.body && anno.body.gcps) {
                geoData.gcps = anno.body.gcps;
              }

              // Check for transformation in the annotation
              if (anno.body && anno.body.transformation) {
                geoData.transformation = anno.body.transformation;
              }
            }
          }
        }
      }
    }

    return geoData;
  };

  // If the active tab is annotations or history, render those components
  if (activeTab === 'annotations') {
    return (
      <AnnotationPanel
        manifest={manifest}
        currentCanvas={currentCanvas}
        onChange={onChange}
      />
    );
  }

  // if (activeTab === "history") {
  //   return <EditHistory manifest={manifest} />
  // }

  // For metadata tab, render general metadata information
  if (activeTab === 'metadata') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="space-y-6">
            {/* Manifest Metadata */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                Manifest Information
              </h3>
              <Card className="shadow-none">
                <CardContent className="p-3 space-y-3 text-sm">
                  {/* Label */}
                  {manifest.label && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        Title
                      </div>
                      <div className="break-words whitespace-normal">
                        {getLocalizedValue(manifest.label)}
                      </div>
                    </div>
                  )}

                  {/* Summary or Description */}
                  {(manifest.summary || manifest.description) && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        Description
                      </div>
                      <div className="break-words whitespace-normal">
                        {getLocalizedValue(
                          manifest.summary || manifest.description,
                        )}
                      </div>
                    </div>
                  )}

                  {/* Provider */}
                  {manifest.provider && manifest.provider.length > 0 && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        Provider
                      </div>
                      <div className="break-words whitespace-normal">
                        {manifest.provider
                          .map(
                            (p: any) => p.label && getLocalizedValue(p.label),
                          )
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Rights */}
                  {manifest.rights && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        Rights
                      </div>
                      <div className="break-words whitespace-normal">
                        {typeof manifest.rights === 'string' ? (
                          <a
                            href={manifest.rights}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            License Information
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          JSON.stringify(manifest.rights)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Required Statement */}
                  {manifest.requiredStatement && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        {getLocalizedValue(manifest.requiredStatement.label) ||
                          'Attribution'}
                      </div>
                      <div className="break-words whitespace-normal">
                        {getLocalizedValue(manifest.requiredStatement.value)}
                      </div>
                    </div>
                  )}

                  {/* Homepage */}
                  {manifest.homepage && manifest.homepage.length > 0 && (
                    <div>
                      <div className="font-medium text-xs text-muted-foreground">
                        Homepage
                      </div>
                      <div className="space-y-1">
                        {manifest.homepage.map((home: any, i: number) => (
                          <div
                            key={i}
                            className="break-words whitespace-normal"
                          >
                            <a
                              href={home.id || home['@id']}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              {getLocalizedValue(home.label) || 'Visit Source'}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata Array */}
                  {manifest.metadata && manifest.metadata.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <div className="font-medium text-xs text-muted-foreground mb-2">
                        Additional Metadata
                      </div>
                      {manifest.metadata.map((meta: any, i: number) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <div className="font-medium text-xs">
                            {getLocalizedValue(meta.label)}
                          </div>
                          <div className="text-sm mt-1 break-words whitespace-normal">
                            {(() => {
                              const value = getLocalizedValue(meta.value);
                              if (!value) return null;

                              // Function to strip HTML tags and extract URLs
                              const stripHtmlAndExtractUrls = (
                                html: string,
                              ) => {
                                // Check if the string contains HTML tags
                                if (
                                  html.includes('<a href="') ||
                                  html.includes('<a target="_blank" href="')
                                ) {
                                  // Extract URL from href attribute
                                  const hrefMatch =
                                    html.match(/href="([^"]+)"/);
                                  if (hrefMatch && hrefMatch[1]) {
                                    return hrefMatch[1]; // Return just the URL
                                  }
                                }

                                // If no HTML or no href found, return the original string with tags stripped
                                return html.replace(/<[^>]*>/g, '');
                              };

                              const cleanValue = stripHtmlAndExtractUrls(value);

                              // Check if the clean value is a URL
                              const urlRegex = /^(https?:\/\/[^\s]+)$/;
                              if (
                                typeof cleanValue === 'string' &&
                                urlRegex.test(cleanValue)
                              ) {
                                return (
                                  <a
                                    href={cleanValue}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-block break-all"
                                  >
                                    {cleanValue}
                                  </a>
                                );
                              }

                              return cleanValue;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Canvas/Image Metadata */}
            {canvas && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  Current Image Information
                </h3>
                <Card className="shadow-none">
                  <CardContent className="p-3 space-y-3 text-sm">
                    {/* Label */}
                    {canvas.label && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Title
                        </div>
                        <div className="break-words whitespace-normal">
                          {getLocalizedValue(canvas.label)}
                        </div>
                      </div>
                    )}

                    {/* Dimensions */}
                    {(canvas.width || canvas.height) && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Dimensions
                        </div>
                        <div className="break-words whitespace-normal">
                          {canvas.width} × {canvas.height} pixels
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    {canvas.duration && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Duration
                        </div>
                        <div className="break-words whitespace-normal">
                          {canvas.duration}s
                        </div>
                      </div>
                    )}

                    {/* Metadata Array */}
                    {canvas.metadata && canvas.metadata.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <div className="font-medium text-xs text-muted-foreground mb-2">
                          Additional Metadata
                        </div>
                        {canvas.metadata
                          .filter(
                            (meta: any) =>
                              getLocalizedValue(meta.label).toLowerCase() !==
                              'title',
                          )
                          .map((meta: any, i: number) => (
                            <div key={i} className="mb-3 last:mb-0">
                              <div className="font-medium text-xs">
                                {getLocalizedValue(meta.label)}
                              </div>
                              <div className="text-sm mt-1 break-words whitespace-normal">
                                {(() => {
                                  const value = getLocalizedValue(meta.value);
                                  if (!value) return null;

                                  // Function to strip HTML tags and extract URLs
                                  const stripHtmlAndExtractUrls = (
                                    html: string,
                                  ) => {
                                    // Check if the string contains HTML tags
                                    if (
                                      html.includes('<a href="') ||
                                      html.includes('<a target="_blank" href="')
                                    ) {
                                      // Extract URL from href attribute
                                      const hrefMatch =
                                        html.match(/href="([^"]+)"/);
                                      if (hrefMatch && hrefMatch[1]) {
                                        return hrefMatch[1]; // Return just the URL
                                      }
                                    }

                                    // If no HTML or no href found, return the original string with tags stripped
                                    return html.replace(/<[^>]*>/g, '');
                                  };

                                  const cleanValue =
                                    stripHtmlAndExtractUrls(value);

                                  // Check if the clean value is a URL
                                  const urlRegex = /^(https?:\/\/[^\s]+)$/;
                                  if (
                                    typeof cleanValue === 'string' &&
                                    urlRegex.test(cleanValue)
                                  ) {
                                    return (
                                      <a
                                        href={cleanValue}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline inline-block break-all"
                                      >
                                        {cleanValue}
                                      </a>
                                    );
                                  }

                                  return cleanValue;
                                })()}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Canvas Annotations */}
            {canvas &&
              (() => {
                const annotations = extractAnnotations(canvas);
                if (annotations.length > 0) {
                  return (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        Image Annotations
                      </h3>
                      <div className="space-y-3">
                        {annotations.map((anno: any, index: number) => (
                          <Card key={anno.id || index} className="shadow-none">
                            <CardContent className="p-3 space-y-2 text-sm">
                              {/* Label */}
                              {anno.label && (
                                <div className="font-medium">{anno.label}</div>
                              )}

                              {/* Body Value */}
                              {anno.body?.value && (
                                <div className="break-words whitespace-normal">
                                  {anno.body.value}
                                </div>
                              )}

                              {/* Motivation */}
                              {anno.motivation && (
                                <div className="flex flex-wrap gap-1">
                                  {anno.motivation.map(
                                    (m: string, i: number) => (
                                      <Badge key={i} variant="outline">
                                        {m}
                                      </Badge>
                                    ),
                                  )}
                                </div>
                              )}

                              {/* Created & Creator */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                {anno.created && (
                                  <div>
                                    Created:{' '}
                                    {new Date(anno.created).toLocaleString()}
                                  </div>
                                )}
                                {anno.creator && <div>By: {anno.creator}</div>}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
          </div>
        </div>
      </div>
    );
  }

  // For geo tab, render only map/georeferencing related information
  if (activeTab === 'geo') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="space-y-6">
            {/* Show different alerts based on whether georeferencing data is available */}
            {allmapsAnnotation || detailedGeoData ? (
              allmapsAnnotation ? (
                <Alert variant="default">
                  <Map className="h-4 w-4" />
                  <AlertTitle>Geographic Information Available</AlertTitle>
                  <AlertDescription>
                    This image has Allmaps georeferencing data with{' '}
                    {allmapsAnnotation.body?.features?.length || 0} control
                    points. The image will be displayed on the map in the main
                    view.
                  </AlertDescription>
                </Alert>
              ) : detailedGeoData?.gcps?.length > 0 ? (
                <Alert variant="default">
                  <Map className="h-4 w-4" />
                  <AlertTitle>Geographic Information Available</AlertTitle>
                  <AlertDescription>
                    This image has {detailedGeoData.gcps.length} ground control
                    points for georeferencing. The image will be displayed on
                    the map in the main view.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="default">
                  <Map className="h-4 w-4" />
                  <AlertTitle>No Geographic Information</AlertTitle>
                  <AlertDescription>
                    This image does not have georeferencing data available. The
                    map view will show a standard map without the image overlay.
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <Alert variant="default">
                <Map className="h-4 w-4" />
                <AlertTitle>No Geographic Information</AlertTitle>
                <AlertDescription>
                  This image does not have georeferencing data available. The
                  map view will show a standard map without the image overlay.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Map className="h-5 w-5 text-muted-foreground" />
                Geographic Information
              </h3>

              {allmapsAnnotation ? (
                <Card className="shadow-none">
                  <CardContent className="p-3 space-y-3 text-sm">
                    {/* Source JSON */}
                    {(() => {
                      // Try to find the georeferencing annotation URL from the canvas
                      if (canvas && canvas.annotations) {
                        const georeferencingAnnotation =
                          canvas.annotations.find(
                            (anno: any) =>
                              anno.id && anno.id.includes('/georeferencing/'),
                          );

                        if (
                          georeferencingAnnotation &&
                          georeferencingAnnotation.id
                        ) {
                          return (
                            <div>
                              <div className="font-medium text-xs text-muted-foreground">
                                Source JSON
                              </div>
                              <div className="mt-1 break-all">
                                <a
                                  href={georeferencingAnnotation.id}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                  {georeferencingAnnotation.id
                                    .split('/')
                                    .pop() || 'View JSON'}
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </div>
                            </div>
                          );
                        }
                      }

                      // Fallback to allmapsAnnotation.id if no georeferencing annotation is found
                      if (allmapsAnnotation && allmapsAnnotation.id) {
                        return (
                          <div>
                            <div className="font-medium text-xs text-muted-foreground">
                              Source JSON
                            </div>
                            <div className="mt-1 break-all">
                              <a
                                href={allmapsAnnotation.id}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                {allmapsAnnotation.id.split('/').pop() ||
                                  'View JSON'}
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {/* Map ID */}
                    {allmapsAnnotation.body?._allmaps?.id && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Allmaps Map ID
                        </div>
                        <div className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded break-all">
                          {allmapsAnnotation.body._allmaps.id}
                        </div>
                      </div>
                    )}

                    {/* Transformation Type */}
                    {allmapsAnnotation.body?.transformation?.type && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Transformation Type
                        </div>
                        <Badge variant="outline" className="mt-1 break-words">
                          {allmapsAnnotation.body.transformation.type}
                        </Badge>
                      </div>
                    )}

                    {/* Number of Control Points */}
                    {allmapsAnnotation.body?.features && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Control Points
                        </div>
                        <div className="mt-1">
                          {allmapsAnnotation.body.features.length} point
                          {allmapsAnnotation.body.features.length !== 1
                            ? 's'
                            : ''}
                        </div>
                      </div>
                    )}

                    {/* Created and Modified Dates */}
                    <div className="grid grid-cols-2 gap-2">
                      {allmapsAnnotation.created && (
                        <div>
                          <div className="font-medium text-xs text-muted-foreground">
                            Created
                          </div>
                          <div
                            className="mt-1"
                            title={new Date(
                              allmapsAnnotation.created,
                            ).toLocaleString()}
                          >
                            {formatDistanceToNow(
                              new Date(allmapsAnnotation.created),
                              { addSuffix: true },
                            )}
                          </div>
                        </div>
                      )}

                      {allmapsAnnotation.modified && (
                        <div>
                          <div className="font-medium text-xs text-muted-foreground">
                            Modified
                          </div>
                          <div
                            className="mt-1"
                            title={new Date(
                              allmapsAnnotation.modified,
                            ).toLocaleString()}
                          >
                            {formatDistanceToNow(
                              new Date(allmapsAnnotation.modified),
                              { addSuffix: true },
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Scale and Area */}
                    <div className="grid grid-cols-2 gap-2">
                      {allmapsAnnotation.body?._allmaps?.scale && (
                        <div>
                          <div className="font-medium text-xs text-muted-foreground">
                            Approximate Scale
                          </div>
                          <div className="mt-1">
                            1:
                            {Math.round(
                              allmapsAnnotation.body._allmaps.scale,
                            ).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {allmapsAnnotation.body?._allmaps?.area && (
                        <div>
                          <div className="font-medium text-xs text-muted-foreground">
                            Area
                          </div>
                          <div className="mt-1">
                            {Math.round(
                              allmapsAnnotation.body._allmaps.area,
                            ).toLocaleString()}{' '}
                            sq units
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GCPs Preview */}
                    {allmapsAnnotation.body?.features &&
                      allmapsAnnotation.body.features.length > 0 && (
                        <div>
                          <div className="font-medium text-xs text-muted-foreground">
                            Control Points Preview
                          </div>
                          <div className="mt-1 max-h-60 overflow-auto border rounded-md">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-1">#</th>
                                  <th className="text-left p-1">Image (px)</th>
                                  <th className="text-left p-1">
                                    Geo (lat, lng)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {allmapsAnnotation.body.features.map(
                                  (feature: any, index: number) => (
                                    <tr
                                      key={index}
                                      className="border-b last:border-0"
                                    >
                                      <td className="p-1">{index + 1}</td>
                                      <td className="p-1 font-mono">
                                        {feature.properties?.pixelCoords?.[0].toFixed(
                                          0,
                                        )}
                                        ,
                                        {feature.properties?.pixelCoords?.[1].toFixed(
                                          0,
                                        )}
                                      </td>
                                      <td className="p-1 font-mono">
                                        {feature.geometry?.coordinates?.[1].toFixed(
                                          5,
                                        )}
                                        ,
                                        {feature.geometry?.coordinates?.[0].toFixed(
                                          5,
                                        )}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    {/* NavPlace Information */}
                    {(() => {
                      // Check for navPlace data in the annotation or canvas
                      const hasNavPlace =
                        allmapsAnnotation?.body?.navPlace ||
                        canvas?.navPlace ||
                        (detailedGeoData && detailedGeoData.navPlace);

                      if (hasNavPlace) {
                        const navPlaceData =
                          allmapsAnnotation?.body?.navPlace ||
                          canvas?.navPlace ||
                          detailedGeoData.navPlace;

                        return (
                          <div>
                            <div className="font-medium text-xs text-muted-foreground mt-4">
                              NavPlace Boundary
                            </div>
                            <div className="mt-1 max-h-60 overflow-auto border rounded-md">
                              <pre className="p-2 text-xs font-mono">
                                {typeof navPlaceData === 'string'
                                  ? navPlaceData
                                  : JSON.stringify(navPlaceData, null, 2)}
                              </pre>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              This image has a defined geographic boundary using
                              the IIIF navPlace extension.
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              ) : detailedGeoData ? (
                <Card className="shadow-none">
                  <CardContent className="p-3 space-y-3 text-sm">
                    {detailedGeoData.georeferencingUrl && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Georeferencing File
                        </div>
                        <div className="mt-1 break-words">
                          <a
                            href={detailedGeoData.georeferencingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            {detailedGeoData.georeferencingUrl.split('/').pop()}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {detailedGeoData.gcps && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Ground Control Points (GCPs)
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto max-h-60">
                          {JSON.stringify(detailedGeoData.gcps, null, 2)}
                        </pre>
                      </div>
                    )}

                    {detailedGeoData.transformation && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Transformation Matrix
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {JSON.stringify(
                            detailedGeoData.transformation,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}

                    {detailedGeoData.projection && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Projection
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {typeof detailedGeoData.projection === 'string'
                            ? detailedGeoData.projection
                            : JSON.stringify(
                                detailedGeoData.projection,
                                null,
                                2,
                              )}
                        </pre>
                      </div>
                    )}

                    {detailedGeoData.resourceExtent && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Resource Extent
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {JSON.stringify(
                            detailedGeoData.resourceExtent,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}

                    {detailedGeoData.coordinates && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Coordinates
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {JSON.stringify(detailedGeoData.coordinates, null, 2)}
                        </pre>
                      </div>
                    )}

                    {detailedGeoData.boundingBox && (
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">
                          Bounding Box
                        </div>
                        <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {JSON.stringify(detailedGeoData.boundingBox, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-sm text-center py-4">
                  <p>No geographic information available for this image.</p>
                  <p className="mt-2">
                    The map view is displayed in the main content area.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
