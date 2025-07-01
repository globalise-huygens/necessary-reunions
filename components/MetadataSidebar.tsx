'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Card, CardContent } from '@/components/Card';
import { useAllAnnotations } from '@/hooks/use-all-annotations';
import { extractAnnotations, getLocalizedValue } from '@/lib/iiif-helpers';
import { formatDistanceToNow } from 'date-fns';
import {
  BookOpen,
  ExternalLink,
  Layers,
  Map as MapIcon,
  MessageSquare,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AnnotationList } from './AnnotationList';

interface MetadataSidebarProps {
  manifest: any;
  currentCanvas: number;
  activeTab: 'metadata' | 'annotations' | 'geo';
  onChange: (m: any) => void;
}

export function MetadataSidebar({
  manifest,
  currentCanvas,
  activeTab,
  onChange,
}: MetadataSidebarProps) {
  const canvas = manifest.items?.[currentCanvas];
  const [allmapsAnno, setAllmapsAnno] = useState<any>(null);
  const [detailed, setDetailed] = useState<any>(null);
  const [showTextspotting, setShowTextspotting] = useState(true);
  const [showIconography, setShowIconography] = useState(true);

  const handleFilterChange = (mot: 'textspotting' | 'iconography') => {
    if (mot === 'textspotting') {
      setShowTextspotting((v) => !v);
    } else {
      setShowIconography((v) => !v);
    }
  };

  const renderField = (label: string, content: React.ReactNode) => (
    <div>
      <div className="font-medium text-xs text-muted-foreground">{label}</div>
      <div className="break-words whitespace-normal">{content}</div>
    </div>
  );

  useEffect(() => {
    if (activeTab !== 'geo' || !canvas) {
      setAllmapsAnno(null);
      setDetailed(null);
      return;
    }
    (async () => {
      const anno = await findAllmapsAnnotation(canvas);
      setAllmapsAnno(anno);
      let geo = extractDetailedGeoData(canvas);
      if (geo?.georeferencingUrl) {
        try {
          const res = await fetch(geo.georeferencingUrl);
          if (res.ok) geo = { ...geo, ...(await res.json()) };
        } catch {}
      }
      setDetailed(geo);
    })();
  }, [canvas, activeTab, currentCanvas]);

  if (activeTab === 'annotations') {
    const { annotations, isLoading } = useAllAnnotations(canvas?.id ?? '');

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnnotationList
          key={canvas?.id}
          annotations={annotations}
          isLoading={isLoading}
          onAnnotationSelect={(id) => console.log('Selected annotation:', id)}
          onAnnotationUpdate={() => {}}
          canEdit={false}
          showTextspotting={showTextspotting}
          showIconography={showIconography}
          onFilterChange={handleFilterChange}
        />
      </div>
    );
  }

  if (activeTab === 'metadata') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-4 py-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" /> Manifest
              Information
            </h3>
            <Card className="shadow-none">
              <CardContent className="p-3 space-y-3 text-sm">
                {manifest.label &&
                  renderField('Title', getLocalizedValue(manifest.label))}
                {(manifest.summary || manifest.description) &&
                  renderField(
                    'Description',
                    getLocalizedValue(manifest.summary || manifest.description),
                  )}
                {manifest.provider?.length > 0 &&
                  renderField(
                    'Provider',
                    manifest.provider
                      .map((p: any) => getLocalizedValue(p.label))
                      .filter(Boolean)
                      .join(', '),
                  )}
                {manifest.rights &&
                  renderField(
                    'Rights',
                    typeof manifest.rights === 'string' ? (
                      <a
                        href={manifest.rights}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                      >
                        License Information <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      JSON.stringify(manifest.rights)
                    ),
                  )}
                {manifest.requiredStatement &&
                  renderField(
                    getLocalizedValue(manifest.requiredStatement.label) ||
                      'Attribution',
                    getLocalizedValue(manifest.requiredStatement.value),
                  )}
                {manifest.homepage?.length > 0 &&
                  renderField(
                    'Homepage',
                    manifest.homepage.map((h: any, i: number) => (
                      <a
                        key={i}
                        href={h.id || h['@id']}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all"
                      >
                        {getLocalizedValue(h.label) || 'Visit Source'}{' '}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )),
                  )}
                {manifest.metadata?.length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-3">
                    <div className="font-medium text-xs text-muted-foreground">
                      Additional Metadata
                    </div>
                    {manifest.metadata.map((m: any, i: number) => {
                      const v = getLocalizedValue(m.value) || '';
                      const text = v.replace(/<[^>]*>/g, '');
                      const urlMatch = text.match(/https?:\/\/\S+/);
                      return (
                        <div key={i}>
                          <div className="font-medium text-xs">
                            {getLocalizedValue(m.label)}
                          </div>
                          <div className="text-sm mt-1 break-words whitespace-normal">
                            {urlMatch ? (
                              <a
                                href={urlMatch[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block break-all"
                              >
                                {urlMatch[0]}
                              </a>
                            ) : (
                              text
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Canvas-level info */}
          {canvas && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" /> Current
                Image Information
              </h3>
              <Card className="shadow-none">
                <CardContent className="p-3 space-y-3 text-sm">
                  {canvas.label &&
                    renderField('Title', getLocalizedValue(canvas.label))}
                  {(canvas.width || canvas.height) &&
                    renderField(
                      'Dimensions',
                      `${canvas.width} × ${canvas.height} pixels`,
                    )}
                  {canvas.duration &&
                    renderField('Duration', `${canvas.duration}s`)}
                  {canvas.metadata?.length > 0 && (
                    <div className="border-t pt-2 mt-2 space-y-3">
                      <div className="font-medium text-xs text-muted-foreground">
                        Additional Metadata
                      </div>
                      {canvas.metadata
                        .filter(
                          (m: any) =>
                            getLocalizedValue(m.label).toLowerCase() !==
                            'title',
                        )
                        .map((m: any, i: number) => (
                          <div key={i}>
                            {renderField(
                              getLocalizedValue(m.label),
                              getLocalizedValue(m.value).replace(
                                /<[^>]*>/g,
                                '',
                              ),
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Image annotations */}
          {canvas && extractAnnotations(canvas).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />{' '}
                Image Annotations
              </h3>
              {extractAnnotations(canvas).map((a: any, i: number) => (
                <Card key={a.id || i} className="shadow-none">
                  <CardContent className="p-3 space-y-2 text-sm">
                    {a.label && <div className="font-medium">{a.label}</div>}
                    {a.body?.value && (
                      <div className="break-words whitespace-normal">
                        {a.body.value}
                      </div>
                    )}
                    {a.motivation && (
                      <div className="flex flex-wrap gap-1">
                        {a.motivation.map((m: string, j: number) => (
                          <Badge key={j} variant="outline">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      {a.created && (
                        <div>
                          Created: {formatDistanceToNow(new Date(a.created))}{' '}
                          ago
                        </div>
                      )}
                      {a.creator && <div>By: {a.creator}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'geo') {
    const hasGeo = allmapsAnno || detailed?.gcps?.length > 0;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-4 py-4 space-y-6">
          <Alert variant="default">
            <MapIcon className="h-4 w-4" />
            <AlertTitle>
              {hasGeo
                ? 'Geographic Information Available'
                : 'No Geographic Information'}
            </AlertTitle>
            <AlertDescription>
              {hasGeo
                ? `This image has ${
                    allmapsAnno
                      ? allmapsAnno.body?.features?.length
                      : detailed.gcps.length
                  } control point${
                    (allmapsAnno
                      ? allmapsAnno.body.features.length
                      : detailed.gcps.length) !== 1
                      ? 's'
                      : ''
                  }.`
                : 'This image does not have georeferencing data.'}
            </AlertDescription>
          </Alert>

          {allmapsAnno ? (
            <Card className="shadow-none">
              <CardContent className="p-3 space-y-3 text-sm">
                {(() => {
                  const src =
                    canvas.annotations?.find((p: any) =>
                      p.id?.includes('georeferencing'),
                    )?.id || allmapsAnno.id;
                  return (
                    src &&
                    renderField(
                      'Source JSON',
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all"
                      >
                        {src.split('/').pop()}{' '}
                        <ExternalLink className="h-3 w-3" />
                      </a>,
                    )
                  );
                })()}
                {allmapsAnno.body?._allmaps?.id &&
                  renderField('Map ID', allmapsAnno.body._allmaps.id)}
                {allmapsAnno.body?.transformation?.type &&
                  renderField(
                    'Transformation Type',
                    <Badge variant="outline">
                      {allmapsAnno.body.transformation.type}
                    </Badge>,
                  )}
                {allmapsAnno.body?.features &&
                  renderField(
                    'Control Points',
                    <div className="mt-1 space-y-1 text-xs font-mono">
                      {allmapsAnno.body.features.map((f: any, idx: number) => (
                        <div key={idx}>{`
                          ${idx + 1}: ${f.properties.resourceCoords[0].toFixed(
                          0,
                        )},${f.properties.resourceCoords[1].toFixed(
                          0,
                        )} → ${f.geometry.coordinates[1].toFixed(
                          5,
                        )},${f.geometry.coordinates[0].toFixed(5)}`}</div>
                      ))}
                    </div>,
                  )}
              </CardContent>
            </Card>
          ) : detailed ? (
            <Card className="shadow-none">
              <CardContent className="p-3 space-y-3 text-sm">
                {detailed.georeferencingUrl &&
                  renderField(
                    'Georeferencing File',
                    <a
                      href={detailed.georeferencingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all"
                    >
                      {detailed.georeferencingUrl.split('/').pop()}{' '}
                      <ExternalLink className="h-3 w-3" />
                    </a>,
                  )}
                {detailed.gcps &&
                  renderField(
                    'GCPs',
                    <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto max-h-60">
                      {JSON.stringify(detailed.gcps, null, 2)}
                    </pre>,
                  )}
                {detailed.transformation &&
                  renderField(
                    'Transformation',
                    <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                      {JSON.stringify(detailed.transformation, null, 2)}
                    </pre>,
                  )}
                {detailed.projection &&
                  renderField(
                    'Projection',
                    typeof detailed.projection === 'string' ? (
                      detailed.projection
                    ) : (
                      <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                        {JSON.stringify(detailed.projection, null, 2)}
                      </pre>
                    ),
                  )}
                {detailed.resourceExtent &&
                  renderField(
                    'Resource Extent',
                    <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                      {JSON.stringify(detailed.resourceExtent, null, 2)}
                    </pre>,
                  )}
                {detailed.coordinates &&
                  renderField(
                    'Coordinates',
                    <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                      {JSON.stringify(detailed.coordinates, null, 2)}
                    </pre>,
                  )}
                {detailed.boundingBox &&
                  renderField(
                    'Bounding Box',
                    <pre className="mt-1 font-mono text-xs bg-slate-100 p-2 rounded overflow-auto">
                      {JSON.stringify(detailed.boundingBox, null, 2)}
                    </pre>,
                  )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-sm text-center py-4">
              No geographic information available.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

async function findAllmapsAnnotation(canvas: any): Promise<any> {
  for (const page of canvas.annotations || []) {
    if (page.id?.includes('georeferencing') && page.type === 'AnnotationPage') {
      try {
        const res = await fetch(page.id, {
          cache: page.id.startsWith('http') ? 'no-store' : 'force-cache',
        });
        if (res.ok) {
          const data = await res.json();
          if (
            data.body?._allmaps ||
            data.body?.transformation ||
            data.body?.gcps
          )
            return data;
          for (const item of data.items || [])
            if (
              item.body?._allmaps ||
              item.body?.transformation ||
              item.body?.gcps
            )
              return item;
        }
      } catch {}
    }
    for (const anno of page.items || []) {
      if (anno.body?._allmaps || anno.body?.transformation || anno.body?.gcps)
        return anno;
      if (anno.id?.includes('georeferencing')) {
        try {
          const res = await fetch(anno.id, {
            cache: anno.id.startsWith('http') ? 'no-store' : 'force-cache',
          });
          if (res.ok) {
            const data = await res.json();
            if (
              data.body?._allmaps ||
              data.body?.transformation ||
              data.body?.gcps
            )
              return data;
          }
        } catch {}
      }
    }
  }
  return null;
}

function extractDetailedGeoData(canvas: any) {
  const geo: any = {
    georeferencingUrl: null,
    gcps: null,
    transformation: null,
    projection: null,
    resourceExtent: null,
    coordinates: null,
    boundingBox: null,
  };
  for (const page of canvas.annotations || []) {
    if (page.id?.includes('georeferencing')) geo.georeferencingUrl = page.id;
    for (const anno of page.items || []) {
      if (anno.id?.includes('georeferencing')) geo.georeferencingUrl = anno.id;
      if (anno.body?.value) {
        try {
          const g =
            typeof anno.body.value === 'string'
              ? JSON.parse(anno.body.value)
              : anno.body.value;
          geo.coordinates = g.coordinates || geo.coordinates;
          geo.projection = g.properties?.projection || geo.projection;
          geo.boundingBox = g.bbox || geo.boundingBox;
          geo.gcps = g.gcps || geo.gcps;
          geo.transformation = g.transformation || geo.transformation;
        } catch {}
      }
      geo.projection = anno.body?.projection || geo.projection;
      geo.gcps = anno.body?.gcps || geo.gcps;
      geo.transformation = anno.body?.transformation || geo.transformation;
    }
  }
  return geo;
}
