'use client';

import { MapPin } from 'lucide-react';
import type { PlaceHierarchy } from '../../lib/gazetteer/types';

interface PartOfSectionProps {
  partOf: PlaceHierarchy[];
}

export function PartOfSection({ partOf }: PartOfSectionProps) {
  if (partOf.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5" />
        Part Of
      </h2>

      <div className="space-y-3">
        {partOf.map((parent, index) => {
          // Show classification if available
          const classification = parent.classified_as?.[0]?._label;

          return (
            <div
              key={`parent-${parent.id || index}`}
              className="p-3 bg-muted/20 rounded-lg border border-border"
            >
              <p className="text-base font-medium text-foreground">
                {parent.label}
              </p>

              {classification && (
                <p className="text-sm text-muted-foreground mt-1">
                  Type: {classification}
                </p>
              )}

              {parent.type && parent.type !== 'Place' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {parent.type}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Hierarchical relationships from GLOBALISE and NeRu place thesauri
      </p>
    </div>
  );
}
