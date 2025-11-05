'use client';

import { MapPin } from 'lucide-react';
import Link from 'next/link';
import type { PlaceHierarchy } from '../../lib/gazetteer/types';

interface PartOfSectionProps {
  partOf: PlaceHierarchy[];
}

export function PartOfSection({ partOf }: PartOfSectionProps) {
  if (partOf.length === 0) {
    return null;
  }

  // Helper to create slug from place label
  const createSlug = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5" />
        Part Of
      </h2>

      <div className="space-y-3">
        {partOf.map((parent, index) => {
          const slug = createSlug(parent.label);
          const isGlobalise = parent.id.includes(
            'id.necessaryreunions.org/place/',
          );

          // Show classification if available
          const classification = parent.classified_as?.[0]?._label;

          return (
            <div
              key={`parent-${parent.id || index}`}
              className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border border-border"
            >
              <div className="flex-1">
                {isGlobalise ? (
                  <Link
                    href={`/gazetteer/${slug}`}
                    className="text-base font-medium text-primary hover:underline"
                  >
                    {parent.label}
                  </Link>
                ) : (
                  <span className="text-base font-medium text-foreground">
                    {parent.label}
                  </span>
                )}

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

              {isGlobalise && (
                <Link
                  href={`/gazetteer/${slug}`}
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  View place →
                </Link>
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
