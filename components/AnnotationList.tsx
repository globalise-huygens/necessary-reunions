'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';
import { Trash2 } from 'lucide-react';

interface AnnotationListProps {
  annotations: Annotation[];
  onAnnotationSelect: (id: string) => void;
  onAnnotationPrepareDelete?: (anno: Annotation) => void;
  canEdit: boolean;
  showTextspotting: boolean;
  showIconography: boolean;
  onFilterChange: (mot: 'textspotting' | 'iconography') => void;
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
  onAnnotationPrepareDelete,
  canEdit,
  showTextspotting,
  showIconography,
  onFilterChange,
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
    if (gen.label?.toLowerCase().includes('loghi')) return 'Loghi';
    if (gen.label) return gen.label;
    return gen.id;
  };

  const filtered = annotations.filter((a) => {
    const m = a.motivation?.toLowerCase();
    if (m === 'textspotting') return showTextspotting;
    if (m === 'iconography' || m === 'iconograpy') return showIconography;
    return true;
  });

  const displayCount = totalCount ?? filtered.length;

  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-4 py-2 border-b text-xs text-gray-500 flex space-x-4">
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showTextspotting}
            onChange={() => onFilterChange('textspotting')}
            className="mr-1 accent-[hsl(var(--primary))]"
          />
          <span>Textspotting</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showIconography}
            onChange={() => onFilterChange('iconography')}
            className="mr-1 accent-[hsl(var(--secondary))]"
          />
          <span>Iconography</span>
        </label>
      </div>

      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Showing {displayCount} of {annotations.length}
      </div>

      <div className="overflow-auto flex-1" ref={listRef}>
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-500">Loading annotations…</p>
            {totalAnnotations! > 0 && (
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
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No annotations for this image
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((annotation) => {
              let bodies = getBodies(annotation);

              if (
                (annotation.motivation === 'iconography' ||
                  annotation.motivation === 'iconograpy') &&
                bodies.length === 0
              ) {
                bodies = [
                  {
                    type: 'TextualBody',
                    value: 'Icon',
                    format: 'text/plain',
                    generator: { id: '', label: 'Icon' },
                    created: new Date().toISOString(),
                  } as any,
                ];
              }

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
                  className={`p-4 flex items-start justify-between hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1">
                    {/* <span className="inline-block mb-2 px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-800">
                      {annotation.motivation}
                    </span> */}

                    <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 items-center break-words">
                      {bodies
                        .sort((a, b) => {
                          const la = getGeneratorLabel(a);
                          const lb = getGeneratorLabel(b);
                          if (la === 'Loghi' && lb !== 'Loghi') return -1;
                          if (lb === 'Loghi' && la !== 'Loghi') return 1;
                          return 0;
                        })
                        .map((body, idx) => {
                          const label = getGeneratorLabel(body);
                          const badgeColor =
                            label === 'MapReader'
                              ? 'bg-brand-secondary text-black'
                              : 'bg-brand-primary text-white';
                          return (
                            <React.Fragment key={idx}>
                              <span
                                className={`inline-block px-1 py-px text-xs font-semibold rounded ${badgeColor}`}
                              >
                                {label}
                              </span>
                              <span className="text-sm text-black break-words">
                                {body.value}
                              </span>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 bg-gray-50 p-3 rounded text-sm space-y-2 break-words">
                        <div className="text-xs text-gray-400">
                          <strong>ID:</strong> {annotation.id.split('/').pop()}
                        </div>
                        <div>
                          <strong>Target source:</strong>{' '}
                          {annotation.target.source}
                        </div>
                        <div>
                          <strong>Selector type:</strong>{' '}
                          {annotation.target.selector.type}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnnotationPrepareDelete?.(annotation);
                    }}
                    disabled={!canEdit}
                    aria-label="Delete annotation"
                    className={`ml-4 p-1 ${
                      canEdit
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
