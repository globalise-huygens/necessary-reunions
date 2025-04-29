'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';

interface AnnotationListProps {
  annotations: Annotation[];
  onAnnotationSelect: (id: string) => void;
  isLoading?: boolean;
  totalCount?: number;
  selectedAnnotationId?: string | null;
  loadingProgress?: number;
  loadedAnnotations?: number;
  totalAnnotations?: number;
}

export function AnnotationList({
  annotations,
  onAnnotationSelect,
  isLoading = false,
  totalCount,
  selectedAnnotationId = null,
  loadingProgress = 0,
  loadedAnnotations = 0,
  totalAnnotations = 0,
}: AnnotationListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Scroll selected item into view
  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedAnnotationId]);

  const getBodies = (annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b) => b.type === 'TextualBody');
  };

  const getGeneratorLabel = (body: any) => {
    const gen = body.generator;
    if (!gen) return 'Unknown';
    if (gen.id.includes('MapTextPipeline')) return 'MapReader';
    if (gen.label) return 'Loghi';
    return gen.id;
  };

  const displayCount = totalCount ?? annotations.length;

  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Showing {displayCount} of {annotations.length}
      </div>

      <div className="overflow-auto flex-1" ref={listRef}>
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-500">Loading annotations…</p>
            {totalAnnotations > 0 && (
              <>
                <div className="w-full max-w-xs mt-4 px-4">
                  <Progress value={loadingProgress} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Loaded {loadedAnnotations} of {totalAnnotations} (
                  {Math.round(loadingProgress)}%)
                </p>
              </>
            )}
          </div>
        ) : annotations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No annotations for this image
          </div>
        ) : (
          <div className="divide-y">
            {annotations.map((annotation) => {
              const bodies = getBodies(annotation).sort((a, b) => {
                const la = getGeneratorLabel(a),
                  lb = getGeneratorLabel(b);
                if (la === 'Loghi' && lb !== 'Loghi') return -1;
                if (lb === 'Loghi' && la !== 'Loghi') return 1;
                return 0;
              });

              const isSelected = annotation.id === selectedAnnotationId;
              const isExpanded = !!expanded[annotation.id];

              const handleClick = () => {
                if (annotation.id !== selectedAnnotationId) {
                  onAnnotationSelect(annotation.id);
                  setExpanded({});
                } else {
                  setExpanded((prev) => ({
                    ...prev,
                    [annotation.id]: !prev[annotation.id],
                  }));
                }
              };

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  {/* SUMMARY ROW */}
                  <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 items-center break-words">
                    {bodies.map((body, idx) => {
                      const label = getGeneratorLabel(body);
                      const value = String(body.value);
                      const badgeColor =
                        label === 'MapReader'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700';

                      return (
                        <React.Fragment key={idx}>
                          <span
                            className={`inline-block px-1 py-px text-xs font-semibold rounded ${badgeColor}`}
                          >
                            {label}
                          </span>
                          <span className="text-sm text-black break-words">
                            {value}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* DETAILS */}
                  {isExpanded && (
                    <div className="mt-3 bg-gray-50 p-3 rounded text-sm space-y-2 break-words">
                      <div className="text-xs text-gray-400">
                        <strong>ID:</strong> {annotation.id.split('/').pop()}
                      </div>
                      <div>
                        <strong>Motivation:</strong>{' '}
                        <span className="break-words">
                          {annotation.motivation}
                        </span>
                      </div>
                      <div>
                        <strong>Target source:</strong>{' '}
                        <span className="break-words">
                          {annotation.target.source}
                        </span>
                      </div>
                      <div>
                        <strong>Selector type:</strong>{' '}
                        <span>{annotation.target.selector.type}</span>
                      </div>
                      {/* place holder fields */}
                      <div>
                        <strong>Preferred label:</strong>
                      </div>
                      <div>
                        <strong>Alternative labels:</strong>
                      </div>
                      <div>
                        <strong>Coordinates:</strong>
                      </div>
                      <div>
                        <strong>Place types:</strong>
                      </div>
                      <div>
                        <strong>Temporal scope:</strong>
                      </div>
                      <div>
                        <strong>Source (Map):</strong>{' '}
                      </div>
                      <div>
                        <strong>Remarks:</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
