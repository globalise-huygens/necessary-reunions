/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
'use client';

import {
  BookOpen,
  Calendar,
  Globe,
  Info,
  Layers,
  Link as LinkIcon,
  Map as MapIcon,
  MessageSquare,
  Tag,
  User,
} from 'lucide-react';
import React from 'react';
import { Badge } from '../../components/shared/Badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/shared/Card';
import { ScrollArea } from '../../components/shared/ScrollArea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/shared/Tabs';

interface Annotation {
  id?: string;
  motivation: string[];
  label?: string;
  body: string | object;
  created?: string;
  creator?: string;
}

interface MetadataViewerProps {
  manifest: any;
  currentCanvas: number;
}

export function MetadataViewer({
  manifest,
  currentCanvas,
}: MetadataViewerProps) {
  const canvas = manifest.items?.[currentCanvas];

  const localized = (map: any): string | null => {
    if (!map) return null;
    if (typeof map === 'string') return map;
    if (Array.isArray(map)) return map.join(', ');
    const en = map.en || map['en'];
    if (en) return Array.isArray(en) ? en.join(', ') : en;
    const first = Object.values(map)[0];
    return Array.isArray(first)
      ? first.join(', ')
      : typeof first === 'string'
        ? first
        : null;
  };

  const collection = {
    label: localized(manifest.label),
    description: localized(manifest.summary || manifest.description),
    provider: manifest.provider
      ?.map((p: any) => localized(p.label))
      .filter(Boolean),
    rights: manifest.rights,
    statement: manifest.requiredStatement && {
      label: localized(manifest.requiredStatement.label),
      value: localized(manifest.requiredStatement.value),
    },
    homepage: manifest.homepage?.map((h: any) => ({
      label: localized(h.label),
      url: h.id || h['@id'],
    })),
    metadata: manifest.metadata?.map((m: any) => ({
      label: localized(m.label),
      value: localized(m.value),
    })),
  };

  const canvasInfo = canvas && {
    label: localized(canvas.label),
    width: canvas.width,
    height: canvas.height,
    duration: canvas.duration,
    metadata: canvas.metadata?.map((m: any) => ({
      label: localized(m.label),
      value: localized(m.value),
    })),
  };

  const getGeoData = () => {
    if (!canvas) return null;
    const data: any = {};
    canvas.annotations?.forEach((page: any) =>
      page.items?.forEach((anno: any) => {
        if (anno.body?.value) {
          try {
            const j =
              typeof anno.body.value === 'string'
                ? JSON.parse(anno.body.value)
                : anno.body.value;
            if (j.projection) data.projection = j.projection;
            if (j.coordinates) data.coordinates = j.coordinates;
            if (j.bbox) data.boundingBox = j.bbox;
          } catch {}
        }
      }),
    );
    return Object.keys(data).length ? data : null;
  };
  const geoData = getGeoData();

  const getAnnotations = () => {
    if (!canvas) return [];
    return (
      canvas.annotations?.flatMap((page: any) =>
        page.items
          ?.filter((a: any) => a.motivation && a.body)
          .map((a: any) => ({
            id: a.id || a['@id'],
            motivation: Array.isArray(a.motivation)
              ? a.motivation
              : [a.motivation],
            label: a.label && localized(a.label),
            body: a.body.value || a.body,
            created: a.created,
            creator: a.creator?.name || a.creator?.id,
          })),
      ) || []
    );
  };
  const annotations = getAnnotations();

  const renderLink = (url: string, label?: string) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1"
    >
      {label || url} <LinkIcon className="h-3 w-3" />
    </a>
  );

  const renderList = (items: any[]) => (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={`provider-${item}`}>{item}</div>
      ))}
    </div>
  );

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
              <span>Image</span>
            </TabsTrigger>
            <TabsTrigger value="geo" className="flex items-center gap-1">
              <MapIcon className="h-4 w-4" />
              <span>Geo</span>
            </TabsTrigger>
            <TabsTrigger
              value="annotations"
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Annotations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manifest">
            <ScrollArea className="h-[500px] pr-4 space-y-6">
              {collection.label && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    Title
                  </h3>
                  <p className="mt-1">{collection.label}</p>
                </div>
              )}
              {collection.description && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    Description
                  </h3>
                  <p className="mt-1">{collection.description}</p>
                </div>
              )}
              {collection.provider?.length && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    Provider
                  </h3>
                  {renderList(collection.provider)}
                </div>
              )}
              {collection.rights && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    Rights
                  </h3>
                  {typeof collection.rights === 'string'
                    ? renderLink(collection.rights)
                    : JSON.stringify(collection.rights)}
                </div>
              )}
              {collection.statement && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    {collection.statement.label || 'Attribution'}
                  </h3>
                  <p className="mt-1">{collection.statement.value}</p>
                </div>
              )}
              {collection.homepage?.length && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    Homepage
                  </h3>
                  {collection.homepage.map(
                    (h: { url: string; label?: string }) => (
                      <div key={`homepage-${h.url}`}>
                        {renderLink(h.url, h.label)}
                      </div>
                    ),
                  )}
                </div>
              )}
              {collection.metadata?.length && (
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    Metadata
                  </h3>
                  {collection.metadata.map(
                    (m: { label: string; value: string }) => (
                      <div
                        key={`manifest-metadata-${m.label}`}
                        className="border-b pb-2 last:border-0"
                      >
                        <div className="font-medium">{m.label}</div>
                        <div className="text-sm mt-1">{m.value}</div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="canvas">
            <ScrollArea className="h-[500px] pr-4 space-y-6">
              {canvasInfo ? (
                <>
                  {canvasInfo.label && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        Title
                      </h3>
                      <p className="mt-1">{canvasInfo.label}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      Dimensions
                    </h3>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <div>Width: {canvasInfo.width}</div>
                      <div>Height: {canvasInfo.height}</div>
                      {canvasInfo.duration && (
                        <div className="col-span-2">
                          Duration: {canvasInfo.duration}s
                        </div>
                      )}
                    </div>
                  </div>
                  {canvasInfo.metadata?.length && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        Metadata
                      </h3>
                      {canvasInfo.metadata.map(
                        (m: { label: string; value: string }) => (
                          <div
                            key={`canvas-metadata-${m.label}`}
                            className="border-b pb-2 last:border-0"
                          >
                            <div className="text-sm">{m.value}</div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No image metadata.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="geo">
            <ScrollArea className="h-[500px] pr-4 space-y-6">
              {geoData ? (
                <>
                  {geoData.projection && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-muted-foreground" />
                        Projection
                      </h3>
                      <pre className="mt-1 font-mono text-sm bg-muted/50 p-2 rounded">
                        {typeof geoData.projection === 'string'
                          ? geoData.projection
                          : JSON.stringify(geoData.projection, null, 2)}
                      </pre>
                    </div>
                  )}
                  {geoData.coordinates && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-muted-foreground" />
                        Coordinates
                      </h3>
                      <pre className="mt-1 font-mono text-sm bg-muted/50 p-2 rounded overflow-auto">
                        {JSON.stringify(geoData.coordinates, null, 2)}
                      </pre>
                    </div>
                  )}
                  {geoData.boundingBox && (
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-muted-foreground" />
                        Bounding Box
                      </h3>
                      <pre className="mt-1 font-mono text-sm bg-muted/50 p-2 rounded overflow-auto">
                        {JSON.stringify(geoData.boundingBox, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No geo data.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="annotations">
            <ScrollArea className="h-[500px] pr-4 space-y-4">
              {annotations.length ? (
                annotations.map((a: Annotation, i: number) => (
                  <Card key={`annotation-${a.id || i}`} className="p-3">
                    <div className="space-y-2">
                      {a.label && <h4 className="font-medium">{a.label}</h4>}
                      <div className="flex flex-wrap gap-1">
                        {a.motivation.map((m: string) => (
                          <Badge key={`motivation-${m}`} variant="outline">
                            {m}
                          </Badge>
                        ))}
                      </div>
                      {a.body && (
                        <p className="text-sm mt-1">
                          {typeof a.body === 'string'
                            ? a.body
                            : JSON.stringify(a.body)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        {a.created && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.created).toLocaleString()}
                          </div>
                        )}
                        {a.creator && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {a.creator}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No annotations.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
