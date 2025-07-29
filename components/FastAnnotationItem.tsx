import type { Annotation } from '@/lib/types';
import {
  ChevronDown,
  ChevronRight,
  Image,
  MapPin,
  Plus,
  Share2,
  Trash2,
  Type,
  User,
} from 'lucide-react';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { EditableAnnotationText } from './EditableAnnotationText';

interface AnnotationItemProps {
  annotation: Annotation;
  isSelected: boolean;
  isExpanded: boolean;
  isCurrentlyEditing: boolean;
  isSaving: boolean;
  isPointSelectionMode: boolean;
  canEdit: boolean;
  optimisticUpdates: Record<string, string>;
  editingAnnotationId: string | null;
  linkedAnnotationsOrder: string[];
  linkingDetailsCache: Record<string, any>;
  onClick: () => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onFinishEdit: () => void;
  onAnnotationUpdate: (
    annotation: Annotation,
    newValue: string,
  ) => Promise<void>;
  onOptimisticUpdate: (annotation: Annotation, newValue: string) => void;
  onAnnotationPrepareDelete?: (id: string) => void;
  getBodies: (annotation: Annotation) => any[];
  getLoghiBody: (annotation: Annotation) => any;
  isTextAnnotation: (annotation: Annotation) => boolean;
  hasGeotagData: (id: string) => boolean;
  hasPointSelection: (id: string) => boolean;
  isAnnotationLinkedDebug: (id: string) => boolean;
}

const FastEnhancementIndicators = memo(function FastEnhancementIndicators({
  annotation,
  linkedAnnotationsOrder,
  isAnnotationLinkedDebug,
  hasGeotagData,
  hasPointSelection,
}: {
  annotation: Annotation;
  linkedAnnotationsOrder: string[];
  isAnnotationLinkedDebug: (id: string) => boolean;
  hasGeotagData: (id: string) => boolean;
  hasPointSelection: (id: string) => boolean;
}) {
  const hasEnhancements = useMemo(
    () =>
      hasGeotagData(annotation.id) ||
      hasPointSelection(annotation.id) ||
      isAnnotationLinkedDebug(annotation.id),
    [annotation.id, hasGeotagData, hasPointSelection, isAnnotationLinkedDebug],
  );

  const isInOrder = useMemo(
    () => linkedAnnotationsOrder?.includes(annotation.id),
    [linkedAnnotationsOrder, annotation.id],
  );

  if (!hasEnhancements && !isInOrder) return null;

  return (
    <div className="flex items-center gap-1.5">
      {isInOrder && (
        <div className="flex items-center gap-1">
          <Share2 className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      {hasGeotagData(annotation.id) && (
        <MapPin className="h-3.5 w-3.5 text-secondary" />
      )}
      {hasPointSelection(annotation.id) && (
        <Plus className="h-3.5 w-3.5 text-accent" />
      )}
    </div>
  );
});

const LazyExpandedContent = memo(function LazyExpandedContent({
  annotation,
  linkingDetailsCache,
}: {
  annotation: Annotation;
  linkingDetailsCache: Record<string, any>;
}) {
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsContentLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!isContentLoaded) {
    return (
      <div className="h-24 bg-accent/5 rounded-lg border border-accent/20 animate-pulse" />
    );
  }

  return (
    <div className="bg-accent/5 p-4 rounded-lg text-xs space-y-3 border border-accent/20">
      <div className="grid gap-2">
        <div>
          <span className="font-medium text-primary">ID:</span>{' '}
          <span className="font-mono text-muted-foreground">
            {annotation.id.split('/').pop()}
          </span>
        </div>
        {annotation.creator && (
          <div>
            <span className="font-medium text-primary">Modified by:</span>{' '}
            <span className="text-muted-foreground">
              {annotation.creator.label}
            </span>
          </div>
        )}
        {annotation.modified && (
          <div>
            <span className="font-medium text-primary">Modified:</span>{' '}
            <span className="text-muted-foreground">
              {new Date(annotation.modified).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {linkingDetailsCache[annotation.id] && (
        <div className="pt-3 border-t border-accent/30">
          <div className="font-medium text-accent mb-2">
            Linking Information
          </div>
          <div className="text-xs text-muted-foreground">
            Enhanced annotation with additional data
          </div>
        </div>
      )}
    </div>
  );
});

const AnnotationIcon = memo(function AnnotationIcon({
  annotation,
  isTextAnnotation,
}: {
  annotation: Annotation;
  isTextAnnotation: (annotation: Annotation) => boolean;
}) {
  if (isTextAnnotation(annotation)) {
    return (
      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
        <Type className="h-4 w-4 text-primary" />
        {annotation.creator && (
          <div title="Modified by human">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
      <Image className="h-4 w-4 text-primary" />
      {annotation.creator && (
        <div title="Modified by human">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
});

export const FastAnnotationItem = memo(function FastAnnotationItem({
  annotation,
  isSelected,
  isExpanded,
  isCurrentlyEditing,
  isSaving,
  isPointSelectionMode,
  canEdit,
  optimisticUpdates,
  editingAnnotationId,
  linkedAnnotationsOrder,
  linkingDetailsCache,
  onClick,
  onStartEdit,
  onCancelEdit,
  onFinishEdit,
  onAnnotationUpdate,
  onOptimisticUpdate,
  onAnnotationPrepareDelete,
  getBodies,
  getLoghiBody,
  isTextAnnotation,
  hasGeotagData,
  hasPointSelection,
  isAnnotationLinkedDebug,
}: AnnotationItemProps) {
  const isInLinkingOrder = useMemo(
    () => linkedAnnotationsOrder?.includes(annotation.id) || false,
    [linkedAnnotationsOrder, annotation.id],
  );

  const displayValue = useMemo(() => {
    if (isTextAnnotation(annotation)) {
      const loghiBody = getLoghiBody(annotation);
      const fallbackBody =
        loghiBody ||
        getBodies(annotation).find(
          (body) => body.value && body.value.trim().length > 0,
        );
      const originalValue = fallbackBody?.value || '';
      return optimisticUpdates[annotation.id] ?? originalValue;
    }
    return '';
  }, [
    annotation,
    optimisticUpdates,
    isTextAnnotation,
    getLoghiBody,
    getBodies,
  ]);

  const itemClassName = useMemo(() => {
    const baseClasses =
      'p-4 border-l-2 transition-all duration-100 relative group';
    const stateClasses = isCurrentlyEditing
      ? 'bg-accent/10 border-l-accent shadow-md ring-1 ring-accent/30 cursor-default'
      : isPointSelectionMode
      ? 'cursor-crosshair'
      : 'cursor-pointer';

    const selectionClasses = isSelected
      ? isExpanded
        ? 'bg-accent/8 border-l-accent shadow-md'
        : 'bg-accent/5 border-l-accent shadow-sm'
      : isInLinkingOrder
      ? 'bg-secondary/10 border-l-secondary/50 shadow-sm hover:bg-secondary/15 hover:shadow-md'
      : 'border-l-transparent hover:bg-muted/50 hover:border-l-muted-foreground/30 hover:shadow-sm';

    const savingClasses = isSaving ? 'opacity-75' : '';

    return `${baseClasses} ${stateClasses} ${selectionClasses} ${savingClasses}`;
  }, [
    isCurrentlyEditing,
    isPointSelectionMode,
    isSelected,
    isExpanded,
    isInLinkingOrder,
    isSaving,
  ]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAnnotationPrepareDelete?.(annotation.id);
    },
    [annotation.id, onAnnotationPrepareDelete],
  );

  return (
    <div
      className={itemClassName}
      onClick={onClick}
      role="button"
      aria-expanded={isExpanded}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Main content row */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1 pr-4">
          <AnnotationIcon
            annotation={annotation}
            isTextAnnotation={isTextAnnotation}
          />

          <div className="flex-1 min-w-0">
            {isTextAnnotation(annotation) ? (
              <EditableAnnotationText
                annotation={annotation}
                value={displayValue}
                placeholder={
                  displayValue
                    ? 'Click to edit text...'
                    : 'No text recognized - click to add...'
                }
                canEdit={canEdit ?? false}
                onUpdate={onAnnotationUpdate}
                onOptimisticUpdate={onOptimisticUpdate}
                className="text-sm leading-relaxed"
                isEditing={editingAnnotationId === annotation.id}
                onStartEdit={() => onStartEdit(annotation.id)}
                onCancelEdit={onCancelEdit}
                onFinishEdit={onFinishEdit}
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                {annotation.motivation === 'iconography' ||
                annotation.motivation === 'iconograpy'
                  ? 'Iconography annotation'
                  : 'Unknown annotation type'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <FastEnhancementIndicators
            annotation={annotation}
            linkedAnnotationsOrder={linkedAnnotationsOrder}
            isAnnotationLinkedDebug={isAnnotationLinkedDebug}
            hasGeotagData={hasGeotagData}
            hasPointSelection={hasPointSelection}
          />

          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={!canEdit}
              className="p-1.5 rounded-md transition-colors duration-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center">
              {isSelected ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-100" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-100" />
                )
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors duration-100" />
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div
          className="mt-4 animate-in slide-in-from-top-2 duration-150"
          style={{
            willChange: 'height, opacity',
            contain: 'layout style paint',
          }}
        >
          <LazyExpandedContent
            annotation={annotation}
            linkingDetailsCache={linkingDetailsCache}
          />
        </div>
      )}
    </div>
  );
});

export default FastAnnotationItem;
