'use client';

import type { Annotation } from '@/lib/types';
import { Bot, Image, Search, Trash2, Type, User, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditableAnnotationText } from './EditableAnnotationText';
import { Input } from './Input';
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
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null,
  );
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, string>
  >({});
  const [savingAnnotations, setSavingAnnotations] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedAnnotationId && itemRefs.current[selectedAnnotationId]) {
      itemRefs.current[selectedAnnotationId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedAnnotationId]);

  // Keyboard shortcut to focus search (Ctrl/Cmd + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const getAnnotationText = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    const loghiBody = getLoghiBody(annotation);
    const fallbackBody =
      loghiBody ||
      bodies.find((body) => body.value && body.value.trim().length > 0);
    return fallbackBody?.value || '';
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
    if (annotation.motivation === 'textspotting') {
      return true;
    }

    const bodies = getBodies(annotation);
    const hasTextualContent = bodies.some(
      (body) =>
        body.type === 'TextualBody' &&
        body.value &&
        body.value.trim().length > 0 &&
        body.purpose !== 'describing' &&
        !body.value.toLowerCase().includes('icon'),
    );

    return hasTextualContent;
  };

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

  const handleOptimisticUpdate = useCallback(
    (annotation: Annotation, newValue: string) => {
      setOptimisticUpdates((prev) => {
        if (prev[annotation.id] === newValue) {
          return prev;
        }
        return {
          ...prev,
          [annotation.id]: newValue,
        };
      });
    },
    [],
  );

  const handleAnnotationUpdate = async (
    annotation: Annotation,
    newValue: string,
  ) => {
    if (!isTextAnnotation(annotation)) {
      console.warn('Updates are only allowed for text annotations');
      return;
    }

    const trimmedValue = newValue.trim();
    if (!trimmedValue || trimmedValue.length === 0) {
      throw new Error(
        'Textspotting annotations must have a text value. Text cannot be empty.',
      );
    }

    const annotationName = annotation.id.split('/').pop()!;

    setSavingAnnotations((prev) => new Set(prev).add(annotation.id));

    try {
      let updatedAnnotation = { ...annotation };

      const bodies = getBodies(annotation);
      const loghiBody = getLoghiBody(annotation);

      if (loghiBody) {
        const updatedBodies = bodies.map((body) =>
          body === loghiBody ? { ...body, value: trimmedValue } : body,
        );
        updatedAnnotation.body = updatedBodies;
      } else {
        const existingTextBody = bodies.find(
          (body) => body.type === 'TextualBody' && body.value,
        );

        if (existingTextBody) {
          const updatedBodies = bodies.map((body) =>
            body === existingTextBody ? { ...body, value: trimmedValue } : body,
          );
          updatedAnnotation.body = updatedBodies;
        } else {
          const newBody = {
            type: 'TextualBody',
            value: trimmedValue,
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
      }

      // Ensure motivation is set to textspotting for text annotations
      updatedAnnotation.motivation = 'textspotting';

      updatedAnnotation.creator = {
        id: `https://orcid.org/${
          (session?.user as any)?.id || '0000-0000-0000-0000'
        }`,
        type: 'Person',
        label: (session?.user as any)?.label || 'Unknown User',
      };
      updatedAnnotation.modified = new Date().toISOString();

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

      setOptimisticUpdates((prev) => {
        const { [annotation.id]: removed, ...rest } = prev;
        return rest;
      });

      onAnnotationUpdate?.(result);
    } catch (error) {
      console.error('Failed to update annotation:', error);

      setOptimisticUpdates((prev) => {
        const { [annotation.id]: removed, ...rest } = prev;
        return rest;
      });

      throw error;
    } finally {
      setSavingAnnotations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
  };

  const handleStartEdit = (annotationId: string) => {
    setEditingAnnotationId(annotationId);
  };

  const handleCancelEdit = () => {
    setEditingAnnotationId(null);
    if (editingAnnotationId) {
      setOptimisticUpdates((prev) => {
        const { [editingAnnotationId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleFinishEdit = () => {
    setEditingAnnotationId(null);
  };

  const relevantAnnotations = annotations.filter((annotation) => {
    return isTextAnnotation(annotation) || isIconAnnotation(annotation);
  });

  const filtered = relevantAnnotations.filter((annotation) => {
    const isAI = isAIGenerated(annotation);
    const isHuman = isHumanCreated(annotation);
    const isText = isTextAnnotation(annotation);
    const isIcon = isIconAnnotation(annotation);

    // Check if annotation matches filter criteria
    let matchesFilter = false;
    if (isAI && isText && showAITextspotting) matchesFilter = true;
    if (isAI && isIcon && showAIIconography) matchesFilter = true;
    if (isHuman && isText && showHumanTextspotting) matchesFilter = true;
    if (isHuman && isIcon && showHumanIconography) matchesFilter = true;

    if (!matchesFilter) return false;

    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      const annotationText = getAnnotationText(annotation).toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      // Split query into words and check if all words are found in the annotation text
      const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
      const matchesAllWords = queryWords.every((word) =>
        annotationText.includes(word),
      );

      return matchesAllWords;
    }

    return true;
  });

  const displayCount = totalCount ?? filtered.length;
  const totalRelevantCount = relevantAnnotations.length;

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

      {/* Search Bar */}
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search annotations... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Showing {displayCount} annotation{displayCount !== 1 ? 's' : ''}
        {searchQuery && (
          <span className="ml-1 text-primary">for "{searchQuery}"</span>
        )}
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
                  Loading annotations ({Math.round(loadingProgress)}%)
                </p>
              </>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? (
              <div className="space-y-2">
                <p>No annotations found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:text-primary/80 text-sm underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              'No annotations for this image'
            )}
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
              const isCurrentlyEditing = editingAnnotationId === annotation.id;
              const isSaving = savingAnnotations.has(annotation.id);

              const handleClick = () => {
                if (
                  editingAnnotationId &&
                  editingAnnotationId !== annotation.id
                ) {
                  handleCancelEdit();
                }

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
                  className={`p-4 flex items-start justify-between border-l-2 transition-all duration-150 cursor-pointer relative ${
                    isCurrentlyEditing
                      ? 'bg-blue-50 border-l-blue-500 shadow-md ring-1 ring-blue-200 transform scale-[1.01]'
                      : isSelected
                      ? 'bg-primary/5 border-l-primary shadow-sm'
                      : 'border-l-transparent hover:bg-muted/30 hover:border-l-muted-foreground/20 hover:shadow-sm'
                  } ${isSaving ? 'opacity-75' : ''}`}
                  onClick={handleClick}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1">
                    {isTextAnnotation(annotation) ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Type className="h-4 w-4 text-primary" />
                          {annotation.creator && (
                            <div
                              title="Modified by human"
                              className="flex items-center"
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {(() => {
                          const loghiBody = getLoghiBody(annotation);
                          const fallbackBody =
                            loghiBody ||
                            getBodies(annotation).find(
                              (body) =>
                                body.value && body.value.trim().length > 0,
                            );
                          const originalValue = fallbackBody?.value || '';
                          const displayValue =
                            optimisticUpdates[annotation.id] ?? originalValue;

                          return (
                            <EditableAnnotationText
                              annotation={annotation}
                              value={displayValue}
                              placeholder={
                                displayValue
                                  ? 'Click to edit text...'
                                  : 'No text recognized - click to add...'
                              }
                              canEdit={canEdit}
                              onUpdate={handleAnnotationUpdate}
                              onOptimisticUpdate={handleOptimisticUpdate}
                              className="flex-1"
                              isEditing={editingAnnotationId === annotation.id}
                              onStartEdit={() => handleStartEdit(annotation.id)}
                              onCancelEdit={handleCancelEdit}
                              onFinishEdit={handleFinishEdit}
                            />
                          );
                        })()}
                      </div>
                    ) : annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                          <Image className="h-4 w-4 text-secondary" />
                          {annotation.creator && (
                            <div
                              title="Modified by human"
                              className="flex items-center"
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">
                            Iconography annotation
                          </span>
                          {bodies.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {bodies.map((body, idx) => {
                                const label = getGeneratorLabel(body);
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1"
                                  >
                                    <span className="font-medium">{label}</span>
                                    {body.value && <span>: {body.value}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1">
                          <span className="text-xs">?</span>
                        </div>
                        <div className="flex-1 text-sm text-muted-foreground">
                          Unknown annotation type
                        </div>
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
