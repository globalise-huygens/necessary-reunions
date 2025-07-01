'use client';

import { Badge } from '@/components/Badge';
import { analyzeAnnotations, extractGeoData } from '@/lib/iiif-helpers';
import {
  Calendar,
  Eye,
  FileText,
  Globe,
  Image,
  Map,
  MessageSquare,
  Users,
} from 'lucide-react';
import React from 'react';

interface CollectionStatusProps {
  manifest: any;
  currentCanvas?: any;
}

export function CollectionStatus({
  manifest,
  currentCanvas,
}: CollectionStatusProps) {
  if (!manifest) return null;

  const canvases = manifest.items || manifest.sequences?.[0]?.canvases || [];
  const totalCanvases = canvases.length;

  // Analyze current canvas
  const canvasAnalysis = currentCanvas
    ? analyzeAnnotations(currentCanvas)
    : null;
  const geoData = currentCanvas ? extractGeoData(currentCanvas) : null;

  // Analyze whole collection
  const collectionStats = canvases.reduce(
    (acc: any, canvas: any) => {
      const analysis = analyzeAnnotations(canvas);
      const geo = extractGeoData(canvas);

      acc.totalAnnotations += analysis.total;
      acc.hasGeoref = acc.hasGeoref || !!geo;
      acc.canvasesWithAnnotations += analysis.hasMeaningful ? 1 : 0;
      acc.canvasesWithGeoref += geo ? 1 : 0;

      return acc;
    },
    {
      totalAnnotations: 0,
      hasGeoref: false,
      canvasesWithAnnotations: 0,
      canvasesWithGeoref: 0,
    },
  );

  const features = [
    {
      icon: FileText,
      label: `${totalCanvases} item${totalCanvases !== 1 ? 's' : ''}`,
      active: totalCanvases > 0,
      type: 'info',
    },
    {
      icon: MessageSquare,
      label: `${collectionStats.totalAnnotations} annotation${
        collectionStats.totalAnnotations !== 1 ? 's' : ''
      }`,
      active: collectionStats.totalAnnotations > 0,
      type: collectionStats.totalAnnotations > 0 ? 'success' : 'muted',
    },
    {
      icon: Map,
      label: `${collectionStats.canvasesWithGeoref} georeferenced`,
      active: collectionStats.hasGeoref,
      type: collectionStats.hasGeoref ? 'success' : 'muted',
    },
  ];

  const currentCanvasFeatures = currentCanvas
    ? [
        {
          icon: Eye,
          label: 'Current item',
          active: true,
          type: 'info',
        },
        {
          icon: MessageSquare,
          label: `${canvasAnalysis?.total || 0} annotation${
            (canvasAnalysis?.total || 0) !== 1 ? 's' : ''
          }`,
          active: (canvasAnalysis?.total || 0) > 0,
          type: (canvasAnalysis?.total || 0) > 0 ? 'success' : 'muted',
        },
        {
          icon: Map,
          label: geoData ? 'Mapped' : 'No map data',
          active: !!geoData,
          type: geoData ? 'success' : 'muted',
        },
      ]
    : [];

  return (
    <div className="space-y-3">
      {/* Collection Overview */}
      <div>
        <h4 className="text-sm font-medium mb-2">Collection Features</h4>
        <div className="flex flex-wrap gap-1">
          {features.map((feature, index) => (
            <Badge
              key={index}
              variant={feature.type as any}
              className="text-xs"
            >
              <feature.icon className="h-3 w-3 mr-1" />
              {feature.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Current Canvas */}
      {currentCanvas && (
        <div>
          <h4 className="text-sm font-medium mb-2">Current Item</h4>
          <div className="flex flex-wrap gap-1">
            {currentCanvasFeatures.map((feature, index) => (
              <Badge
                key={index}
                variant={feature.type as any}
                className="text-xs"
              >
                <feature.icon className="h-3 w-3 mr-1" />
                {feature.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Special Features Detection */}
      {collectionStats.hasGeoref && (
        <div className="text-xs text-muted-foreground">
          <Globe className="h-3 w-3 inline mr-1" />
          Map view available for georeferenced items
        </div>
      )}
    </div>
  );
}
