'use client';

import React, { useEffect, useRef } from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './Button';
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
    // Ensure body is array of TextualBody
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body as any];
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
    <div className="h-full border-l bg-white">
      <div className="overflow-auto h-[calc(100vh-10rem)]" ref={listRef}>
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-500">Loading annotations...</p>
            {totalAnnotations > 0 && (
              <>
                <div className="w-full max-w-xs mt-4 px-4">
                  <Progress value={loadingProgress} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Loaded {loadedAnnotations} of {totalAnnotations} annotations (
                  {Math.round(loadingProgress)}%)
                </p>
              </>
            )}
          </div>
        ) : annotations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-500">No annotations for this image</p>
          </div>
        ) : (
          <div className="divide-y">
            {annotations.map((annotation) => {
              const bodies = getBodies(annotation);
              const isSelected = annotation.id === selectedAnnotationId;

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onAnnotationSelect(annotation.id)}
                >
                  {bodies.map((body, idx) => {
                    const label = getGeneratorLabel(body);
                    const value = String(body.value);
                    const badgeColor =
                      label === 'MapReader'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700';
                    return (
                      <div key={idx} className="flex items-center mb-1">
                        <span
                          className={`inline-block px-1 text-xs font-semibold rounded mr-2 ${badgeColor}`}
                        >
                          {label}
                        </span>
                        <span
                          className="font-medium text-sm"
                          style={{ color: isSelected ? '#1e3a8a' : '#374151' }}
                        >
                          {value}
                        </span>
                      </div>
                    );
                  })}
                  <div className="mt-1 text-xs text-gray-500 flex items-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        isSelected ? 'bg-blue-600' : 'bg-blue-500'
                      }`}
                    ></span>
                    {annotation.motivation || 'No motivation'} -{' '}
                    {annotation.id.split('/').pop()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
