'use client';

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
  const getAnnotationText = (annotation: Annotation): string => {
    if (typeof annotation.body === 'string') {
      return annotation.body;
    }

    if (annotation.body) {
      if (typeof annotation.body === 'object') {
        if ('value' in annotation.body && annotation.body.value) {
          return String(annotation.body.value);
        }

        if ('purpose' in annotation.body && annotation.body.purpose) {
          return String(annotation.body.purpose);
        }
      }

      if (Array.isArray(annotation.body)) {
        const textBody = annotation.body.find(
          (item) =>
            item.type === 'TextualBody' ||
            item.purpose === 'commenting' ||
            item.value,
        );

        if (textBody && textBody.value) {
          return String(textBody.value);
        }
      }
    }

    return `Annotation ${annotation.id.split('/').pop()}`;
  };

  const displayCount =
    totalCount !== undefined ? totalCount : annotations.length;

  return (
    <div className="h-full border-l bg-white">
      <div className="overflow-auto h-[calc(100vh-10rem)]">
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
              const text = getAnnotationText(annotation);
              const isSelected = annotation.id === selectedAnnotationId;

              return (
                <div
                  key={annotation.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onAnnotationSelect(annotation.id)}
                >
                  <div
                    className={`font-medium text-sm ${
                      isSelected ? 'text-blue-700' : ''
                    }`}
                  >
                    {text}
                  </div>
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
