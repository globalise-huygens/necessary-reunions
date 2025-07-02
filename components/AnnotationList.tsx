'use client';

import type { Annotation } from '@/lib/types';
import { Bot, Image, Trash2, Type, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useEffect, useRef, useState } from 'react';
import { EditableAnnotationText } from './EditableAnnotationText';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';

interface AnnotationListProps {
  annotations: Annotation[];
  onAnnotationSelect: (id: string) => void;
  onAnnotationPrepareDelete?: (anno: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  canEdit: boolean;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  onFilterChange: (
    filterType: 'ai-text' | 'ai-icons' | 'human-text' | 'human-icons',
  ) => void;
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
  onAnnotationUpdate,
  canEdit,
  showAITextspotting,
  showAIIconography,
  showHumanTextspotting,
  showHumanIconography,
  onFilterChange,
  isLoading = false,
  totalCount,
  selectedAnnotationId = null,
  loadingProgress = 0,
  loadedAnnotations = 0,
  totalAnnotations = 0,
}: AnnotationListProps) {
  const { data: session } = useSession();
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

  const getLoghiBody = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    return bodies.find(
      (body) =>
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('loghi'),
    );
  };

  const getGeneratorLabel = (body: any) => {
    const gen = body.generator;
    if (!gen) return 'Unknown';
    if (gen.id.includes('MapTextPipeline')) return 'MapReader';
    if (gen.label?.toLowerCase().includes('loghi')) return 'Loghi';
    if (gen.label) return gen.label;
    return gen.id;
  };

  const isAIGenerated = (annotation: Annotation) => {
    if (annotation.creator) {
      return false;
    }

    const bodies = getBodies(annotation);
    const hasAIGenerator = bodies.some(
      (body) =>
        body.generator?.id?.includes('MapTextPipeline') ||
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('segment_icons.py'),
    );

    const hasTargetAIGenerator =
      annotation.target?.generator?.id?.includes('segment_icons.py');

    return hasAIGenerator || hasTargetAIGenerator;
  };

  const isHumanCreated = (annotation: Annotation) => {
    return !!annotation.creator;
  };

  const isTextAnnotation = (annotation: Annotation) => {
    return annotation.motivation === 'textspotting';
  };

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

  const handleAnnotationUpdate = async (
    annotation: Annotation,
    newValue: string,
  ) => {
    const annotationName = annotation.id.split('/').pop()!;

    try {
      let updatedAnnotation = { ...annotation };

      if (annotation.motivation === 'textspotting') {
        const bodies = getBodies(annotation);
        const loghiBody = getLoghiBody(annotation);

        if (loghiBody) {
          const updatedBodies = bodies.map((body) =>
            body === loghiBody ? { ...body, value: newValue } : body,
          );
          updatedAnnotation.body = updatedBodies;
        } else {
          const newBody = {
            type: 'TextualBody',
            value: newValue,
            format: 'text/plain',
            purpose: 'supplementing',
            generator: {
              id: 'https://hdl.handle.net/10622/X2JZYY',
              type: 'Software',
              label:
                'GLOBALISE Loghi Handwritten Text Recognition Model - August 2023',
            },
          };
          updatedAnnotation.body = Array.isArray(annotation.body)
            ? [...annotation.body, newBody]
            : [annotation.body, newBody];
        }

        updatedAnnotation.creator = {
          id: `https://orcid.org/${
            (session?.user as any)?.id || '0000-0000-0000-0000'
          }`,
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        };
        updatedAnnotation.modified = new Date().toISOString();
      } else if (
        annotation.motivation === 'iconography' ||
        annotation.motivation === 'iconograpy'
      ) {
        const descriptionBody = {
          type: 'TextualBody',
          value: newValue,
          format: 'text/plain',
          purpose: 'describing',
        };
        updatedAnnotation.body = Array.isArray(annotation.body)
          ? [...annotation.body, descriptionBody]
          : [descriptionBody];

        updatedAnnotation.creator = {
          id: `https://orcid.org/${
            (session?.user as any)?.id || '0000-0000-0000-0000'
          }`,
          type: 'Person',
          label: (session?.user as any)?.label || 'Unknown User',
        };
        updatedAnnotation.modified = new Date().toISOString();
      }

      const res = await fetch(
        `/api/annotations/${encodeURIComponent(annotationName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAnnotation),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Update failed: ${res.status}`);
      }

      const result = await res.json();
      onAnnotationUpdate?.(result);
    } catch (error) {
      console.error('Failed to update annotation:', error);
      throw error;
    }
  };

  const filtered = annotations.filter((annotation) => {
    const isAI = isAIGenerated(annotation);
    const isHuman = isHumanCreated(annotation);
    const isText = isTextAnnotation(annotation);
    const isIcon = isIconAnnotation(annotation);

    // Check specific combinations
    if (isAI && isText && showAITextspotting) return true;
    if (isAI && isIcon && showAIIconography) return true;
    if (isHuman && isText && showHumanTextspotting) return true;
    if (isHuman && isIcon && showHumanIconography) return true;

    return false;
  });

  const displayCount = totalCount ?? filtered.length;

  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Filters</div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showAITextspotting}
                onChange={() => onFilterChange('ai-text')}
                className="accent-primary scale-75"
              />
              <Bot className="h-3 w-3 text-primary" />
              <Type className="h-3 w-3 text-primary" />
              <span className="text-foreground">AI Text</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showAIIconography}
                onChange={() => onFilterChange('ai-icons')}
                className="accent-primary scale-75"
              />
              <Bot className="h-3 w-3 text-primary" />
              <Image className="h-3 w-3 text-primary" />
              <span className="text-foreground">AI Icons</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showHumanTextspotting}
                onChange={() => onFilterChange('human-text')}
                className="accent-secondary scale-75"
              />
              <User className="h-3 w-3 text-secondary" />
              <Type className="h-3 w-3 text-secondary" />
              <span className="text-foreground">Human Text</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showHumanIconography}
                onChange={() => onFilterChange('human-icons')}
                className="accent-secondary scale-75"
              />
              <User className="h-3 w-3 text-secondary" />
              <Image className="h-3 w-3 text-secondary" />
              <span className="text-foreground">Human Icons</span>
            </label>
          </div>
        </div>
      </div>

      <div className="px-3 py-1 border-b text-xs text-muted-foreground">
        {displayCount} of {annotations.length}
      </div>

      <div className="overflow-auto flex-1" ref={listRef}>
        {isLoading && filtered.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-40 flex items-center justify-center pointer-events-none z-10">
            <LoadingSpinner />
          </div>
        )}
        {isLoading && filtered.length === 0 ? (
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
          <div className="divide-y relative">
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
                  className={`p-4 flex items-start justify-between border-l-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/5 border-l-primary shadow-sm'
                      : 'border-l-transparent hover:bg-muted/30 hover:border-l-muted-foreground/20'
                  }`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1">
                    {annotation.motivation === 'textspotting' ? (
                      <div className="flex items-center gap-3">
                        <Type className="h-4 w-4 text-primary flex-shrink-0" />
                        {(() => {
                          const loghiBody = getLoghiBody(annotation);
                          const loghiValue = loghiBody?.value || '';
                          return (
                            <EditableAnnotationText
                              annotation={annotation}
                              value={loghiValue}
                              placeholder="Click to edit recognized text..."
                              canEdit={canEdit}
                              onUpdate={handleAnnotationUpdate}
                              className="flex-1"
                            />
                          );
                        })()}
                      </div>
                    ) : annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy' ? (
                      <div className="flex items-start gap-3">
                        <Image className="h-4 w-4 text-secondary flex-shrink-0 mt-1" />
                        {(() => {
                          const descriptionBody = bodies.find(
                            (body) =>
                              body.purpose === 'describing' ||
                              (!body.purpose && body.value),
                          );
                          const descriptionValue = descriptionBody?.value || '';
                          return (
                            <EditableAnnotationText
                              annotation={annotation}
                              value={descriptionValue}
                              placeholder="Click to add description..."
                              multiline={true}
                              canEdit={canEdit}
                              onUpdate={handleAnnotationUpdate}
                              className="flex-1"
                            />
                          );
                        })()}
                      </div>
                    ) : (
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
                    )}

                    {isExpanded && (
                      <div className="mt-4 bg-muted/30 p-4 rounded-lg text-xs space-y-3 border border-border/50">
                        <div className="grid gap-2">
                          <div>
                            <span className="font-medium text-primary">
                              ID:
                            </span>{' '}
                            <span className="font-mono text-muted-foreground">
                              {annotation.id.split('/').pop()}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">
                              Target source:
                            </span>{' '}
                            <span className="break-all text-muted-foreground">
                              {annotation.target.source}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">
                              Selector type:
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {annotation.target.selector.type}
                            </span>
                          </div>
                          {annotation.creator && (
                            <div>
                              <span className="font-medium text-primary">
                                Modified by:
                              </span>{' '}
                              <span className="text-muted-foreground">
                                {annotation.creator.label}
                              </span>
                            </div>
                          )}
                          {annotation.modified && (
                            <div>
                              <span className="font-medium text-primary">
                                Modified:
                              </span>{' '}
                              <span className="text-muted-foreground">
                                {new Date(annotation.modified).toLocaleString()}
                              </span>
                            </div>
                          )}
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
                    className={`ml-4 p-2 rounded-md transition-colors ${
                      canEdit
                        ? 'text-destructive hover:text-destructive-foreground hover:bg-destructive/10'
                        : 'text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
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
