'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs';
import { Badge } from '@/components/Badge';
import { ScrollArea } from '@/components/ScrollArea';
import {
  Info,
  Map,
  MessageSquare,
  Tag,
  Link,
  Calendar,
  User,
  Globe,
  BookOpen,
  Layers,
} from 'lucide-react';

interface MetadataViewerProps {
  manifest: any;
  currentCanvas: number;
}

export function MetadataViewer({
  manifest,
  currentCanvas,
}: MetadataViewerProps) {
  const canvas = manifest.items?.[currentCanvas];

  const collectionMetadata = {
    label: getLocalizedValue(manifest.label),
    description: getLocalizedValue(manifest.summary || manifest.description),
    provider: manifest.provider
      ?.map((p: any) => p.label && getLocalizedValue(p.label))
      .filter(Boolean),
    rights: manifest.rights,
    requiredStatement: manifest.requiredStatement && {
      label: getLocalizedValue(manifest.requiredStatement.label),
      value: getLocalizedValue(manifest.requiredStatement.value),
    },
    homepage: manifest.homepage?.map((h: any) => ({
      label: getLocalizedValue(h.label),
      url: h.id || h['@id'],
    })),
    metadata: manifest.metadata?.map((m: any) => ({
      label: getLocalizedValue(m.label),
      value: getLocalizedValue(m.value),
    })),
  };

  // Extract canvas metadata
  const canvasMetadata = canvas
    ? {
        label: getLocalizedValue(canvas.label),
        width: canvas.width,
        height: canvas.height,
        duration: canvas.duration,
        metadata: canvas.metadata?.map((m: any) => ({
          label: getLocalizedValue(m.label),
          value: getLocalizedValue(m.value),
        })),
      }
    : null;

  // Extract georeferencing information
  const geoData = extractGeoData(canvas);

  // Extract annotations with their motivations
  const annotations = extractAnnotations(canvas);

  // Helper function to extract localized values from IIIF language maps
  function getLocalizedValue(languageMap: any, preferredLanguage = 'en') {
    if (!languageMap) return null;

    // Handle string values
    if (typeof languageMap === 'string') return languageMap;

    // Handle arrays directly
    if (Array.isArray(languageMap)) return languageMap.join(', ');

    // Handle language maps
    if (languageMap[preferredLanguage]) {
      return Array.isArray(languageMap[preferredLanguage])
        ? languageMap[preferredLanguage].join(', ')
        : languageMap[preferredLanguage];
    }

    // Fall back to any available language
    const firstLang = Object.keys(languageMap)[0];
    if (firstLang) {
      return Array.isArray(languageMap[firstLang])
        ? languageMap[firstLang].join(', ')
        : languageMap[firstLang];
    }

    return null;
  }

  // Extract georeferencing data from canvas
  function extractGeoData(canvas: any) {
    if (!canvas) return null;

    const geoData = {
      coordinates: null,
      projection: null,
      boundingBox: null,
    };

    // Look for geo annotations
    if (canvas.annotations) {
      for (const annoPage of canvas.annotations) {
        if (annoPage.items) {
          for (const anno of annoPage.items) {
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
                } catch (e) {
                  console.error('Error parsing GeoJSON:', e);
                }
              }

              // Check for projection in the annotation
              if (anno.body && anno.body.projection) {
                geoData.projection = anno.body.projection;
              }
            }
          }
        }
      }
    }

    return geoData.coordinates || geoData.projection || geoData.boundingBox
      ? geoData
      : null;
  }

  // Extract annotations with their motivations
  function extractAnnotations(canvas: any) {
    if (!canvas || !canvas.annotations) return [];

    const result = [];

    for (const annoPage of canvas.annotations) {
      if (annoPage.items) {
        for (const anno of annoPage.items) {
          // Skip annotations without motivation or body
          if (!anno.motivation || !anno.body) continue;

          // Skip annotations that are just for the image service
          if (anno.body.service && anno.motivation === 'painting') continue;

          result.push({
            id: anno.id || anno['@id'],
            motivation: Array.isArray(anno.motivation)
              ? anno.motivation
              : [anno.motivation],
            label: anno.label ? getLocalizedValue(anno.label) : null,
            body: anno.body,
            target: anno.target,
            created: anno.created,
            creator: anno.creator
              ? anno.creator.name ||
                (anno.creator.label && getLocalizedValue(anno.creator.label)) ||
                anno.creator.id ||
                anno.creator['@id']
              : null,
          });
        }
      }
    }

    return result;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata Information</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="manifest">
          <TabsList className="mb-4">
            <TabsTrigger value="manifest" className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>Manifest</span>
            </TabsTrigger>
            <TabsTrigger value="canvas" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              <span>Current Image</span>
            </TabsTrigger>
            <TabsTrigger value="geo" className="flex items-center gap-1">
              <Map className="h-4 w-4" />
              <span>Geo Data</span>
            </TabsTrigger>
            <TabsTrigger
              value="annotations"
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Annotations</span>
            </TabsTrigger>
          </TabsList>

          {/* Manifest Metadata */}
          <TabsContent value="manifest">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {collectionMetadata.label && (
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      Title
                    </h3>
                    <p className="mt-1">{collectionMetadata.label}</p>
                  </div>
                )}

                {collectionMetadata.description && (
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      Description
                    </h3>
                    <p className="mt-1">{collectionMetadata.description}</p>
                  </div>
                )}

                {collectionMetadata.provider &&
                  collectionMetadata.provider.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        Provider
                      </h3>
                      <div className="mt-1">
                        {collectionMetadata.provider.map(
                          (provider: string, i: number) => (
                            <div key={i}>{provider}</div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {collectionMetadata.rights && (
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      Rights
                    </h3>
                    <p className="mt-1">
                      {typeof collectionMetadata.rights === 'string' ? (
                        <a
                          href={collectionMetadata.rights}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {collectionMetadata.rights}
                          <Link className="h-3 w-3" />
                        </a>
                      ) : (
                        JSON.stringify(collectionMetadata.rights)
                      )}
                    </p>
                  </div>
                )}

                {collectionMetadata.requiredStatement && (
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      {collectionMetadata.requiredStatement.label ||
                        'Attribution'}
                    </h3>
                    <p className="mt-1">
                      {collectionMetadata.requiredStatement.value}
                    </p>
                  </div>
                )}

                {collectionMetadata.homepage &&
                  collectionMetadata.homepage.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        Homepage
                      </h3>
                      <div className="mt-1">
                        {collectionMetadata.homepage.map(
                          (home: { label: string; url: string }, i: number) => (
                            <div key={i}>
                              <a
                                href={home.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {home.label || home.url}
                                <Link className="h-3 w-3" />
                              </a>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {collectionMetadata.metadata &&
                  collectionMetadata.metadata.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        Additional Metadata
                      </h3>
                      <div className="mt-3 space-y-3">
                        {collectionMetadata.metadata.map(
                          (
                            meta: { label: string; value: string },
                            i: number,
                          ) => (
                            <div
                              key={i}
                              className="border-b pb-2 last:border-0"
                            >
                              <div className="font-medium">{meta.label}</div>
                              <div className="text-sm mt-1">{meta.value}</div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Canvas/Image Metadata */}
          <TabsContent value="canvas">
            <ScrollArea className="h-[500px] pr-4">
              {canvasMetadata ? (
                <div className="space-y-6">
                  {canvasMetadata.label && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        Title
                      </h3>
                      <p className="mt-1">{canvasMetadata.label}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      Dimensions
                    </h3>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-medium">Width:</span>{' '}
                        {canvasMetadata.width}px
                      </div>
                      <div>
                        <span className="font-medium">Height:</span>{' '}
                        {canvasMetadata.height}px
                      </div>
                      {canvasMetadata.duration && (
                        <div className="col-span-2">
                          <span className="font-medium">Duration:</span>{' '}
                          {canvasMetadata.duration}s
                        </div>
                      )}
                    </div>
                  </div>

                  {canvasMetadata.metadata &&
                    canvasMetadata.metadata.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <Tag className="h-5 w-5 text-muted-foreground" />
                          Additional Metadata
                        </h3>
                        <div className="mt-3 space-y-3">
                          {canvasMetadata.metadata.map(
                            (
                              meta: { label: string; value: string },
                              i: number,
                            ) => (
                              <div
                                key={i}
                                className="border-b pb-2 last:border-0"
                              >
                                <div className="text-sm mt-1">{meta.value}</div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No image metadata available.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Georeferencing Data */}
          <TabsContent value="geo">
            <ScrollArea className="h-[500px] pr-4">
              {geoData ? (
                <div className="space-y-6">
                  {geoData.projection && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Map className="h-5 w-5 text-muted-foreground" />
                        Projection
                      </h3>
                      <p className="mt-1 font-mono text-sm bg-slate-100 p-2 rounded">
                        {typeof geoData.projection === 'string'
                          ? geoData.projection
                          : JSON.stringify(geoData.projection, null, 2)}
                      </p>
                    </div>
                  )}

                  {geoData.coordinates && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Map className="h-5 w-5 text-muted-foreground" />
                        Coordinates
                      </h3>
                      <pre className="mt-1 font-mono text-sm bg-slate-100 p-2 rounded overflow-auto">
                        {JSON.stringify(geoData.coordinates, null, 2)}
                      </pre>
                    </div>
                  )}

                  {geoData.boundingBox && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Map className="h-5 w-5 text-muted-foreground" />
                        Bounding Box
                      </h3>
                      <pre className="mt-1 font-mono text-sm bg-slate-100 p-2 rounded overflow-auto">
                        {JSON.stringify(geoData.boundingBox, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No georeferencing data available for this image.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Annotations with Motivations */}
          <TabsContent value="annotations">
            <ScrollArea className="h-[500px] pr-4">
              {annotations.length > 0 ? (
                <div className="space-y-4">
                  {annotations.map((anno, index) => (
                    <Card key={index} className="p-3">
                      <div className="space-y-2">
                        {anno.label && (
                          <h4 className="font-medium">{anno.label}</h4>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {anno.motivation.map((m: string, i: number) => (
                            <Badge key={i} variant="outline">
                              {m}
                            </Badge>
                          ))}
                        </div>

                        {anno.body && anno.body.value && (
                          <p className="text-sm mt-1">
                            {typeof anno.body.value === 'string'
                              ? anno.body.value
                              : JSON.stringify(anno.body.value)}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          {anno.created && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(anno.created).toLocaleString()}
                            </div>
                          )}

                          {anno.creator && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {anno.creator}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No annotations with motivations found for this image.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
