import { EditableAnnotationText } from '@/components/viewer/EditableAnnotationText';
import type { Annotation } from '@/lib/types';
import {
  Check,
  CheckCheck,
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
  hasAssessing: (annotation: Annotation) => boolean;
  canHaveAssessing: (annotation: Annotation) => boolean;
  onAssessingToggle: (annotation: Annotation) => Promise<void>;
}

const FastEnhancementIndicators = memo(function FastEnhancementIndicators({
  annotation,
  linkedAnnotationsOrder,
  isAnnotationLinkedDebug,
  hasGeotagData,
  hasPointSelection,
  hasAssessing,
  canHaveAssessing,
}: {
  annotation: Annotation;
  linkedAnnotationsOrder: string[];
  isAnnotationLinkedDebug: (id: string) => boolean;
  hasGeotagData: (id: string) => boolean;
  hasPointSelection: (id: string) => boolean;
  hasAssessing: (annotation: Annotation) => boolean;
  canHaveAssessing: (annotation: Annotation) => boolean;
}) {
  const hasEnhancements = useMemo(
    () =>
      hasGeotagData(annotation.id) ||
      hasPointSelection(annotation.id) ||
      isAnnotationLinkedDebug(annotation.id) ||
      (canHaveAssessing(annotation) && hasAssessing(annotation)),
    [
      annotation,
      hasGeotagData,
      hasPointSelection,
      isAnnotationLinkedDebug,
      canHaveAssessing,
      hasAssessing,
    ],
  );

  const isInOrder = useMemo(
    () => linkedAnnotationsOrder?.includes(annotation.id),
    [linkedAnnotationsOrder, annotation.id],
  );

  if (!hasEnhancements && !isInOrder) return null;

  const orderPosition = isInOrder
    ? linkedAnnotationsOrder.indexOf(annotation.id) + 1
    : null;

  return (
    <div className="flex items-center gap-1">
      {isInOrder && (
        <div className="flex items-center gap-0.5">
          <div
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium border border-primary/30"
            title={`Position ${orderPosition} in linking order`}
          >
            {orderPosition}
          </div>
          <div title="Linked to other annotations">
            <Share2 className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
      )}

      {/* Compact geotag indicator */}
      {hasGeotagData(annotation.id) && (
        <div
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-secondary/15 border border-secondary/30"
          title="Has geographic location"
        >
          <MapPin className="h-2 w-2 text-secondary" />
        </div>
      )}

      {/* Compact point selection indicator */}
      {hasPointSelection(annotation.id) && (
        <div
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent/15 border border-accent/30"
          title="Has point selection on image"
        >
          <Plus className="h-2 w-2 text-accent" />
        </div>
      )}

      {/* Compact linking indicator for non-ordered linked annotations */}
      {!isInOrder && isAnnotationLinkedDebug(annotation.id) && (
        <div
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 border border-primary/30"
          title="Linked to other annotations"
        >
          <Share2 className="h-2 w-2 text-primary" />
        </div>
      )}
    </div>
  );
});

const LazyExpandedContent = memo(function LazyExpandedContent({
  annotation,
  linkingDetailsCache,
  hasAssessing,
  canHaveAssessing,
}: {
  annotation: Annotation;
  linkingDetailsCache: Record<string, any>;
  hasAssessing: (annotation: Annotation) => boolean;
  canHaveAssessing: (annotation: Annotation) => boolean;
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
        {canHaveAssessing(annotation) && (
          <div>
            <span className="font-medium text-primary">Assessment:</span>{' '}
            <span
              className={`text-muted-foreground ${
                hasAssessing(annotation)
                  ? 'text-chart-2'
                  : 'text-muted-foreground/70'
              }`}
            >
              {hasAssessing(annotation) ? 'Checked' : 'Not checked'}
            </span>
          </div>
        )}
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
          <div className="font-medium text-accent mb-2 flex items-center gap-2">
            Further Information
          </div>
          <div className="space-y-3 text-xs">
            {linkingDetailsCache[annotation.id].linkedAnnotations &&
              linkingDetailsCache[annotation.id].linkedAnnotations.length >
                0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Share2 className="h-3 w-3 text-primary" />
                    <span className="font-medium text-primary">
                      Linked annotations (
                      {
                        linkingDetailsCache[annotation.id].linkedAnnotations
                          .length
                      }
                      ):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {linkingDetailsCache[
                      annotation.id
                    ].linkedAnnotationTexts.map(
                      (text: string, index: number) => (
                        <div key={index} className="relative">
                          <div className="bg-primary/10 border border-primary/20 rounded px-2 py-1 text-xs text-primary max-w-[120px] truncate">
                            {text.length > 15
                              ? text.substring(0, 15) + '...'
                              : text}
                          </div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                            {index + 1}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {linkingDetailsCache[annotation.id].geotagging && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3 text-secondary" />
                  <span className="font-medium text-primary">Location:</span>
                </div>
                <div className="ml-4 space-y-1">
                  <div className="text-muted-foreground font-medium">
                    {linkingDetailsCache[annotation.id].geotagging.name}
                    {linkingDetailsCache[annotation.id].geotagging.type && (
                      <span className="text-xs text-muted-foreground/70 ml-1">
                        ({linkingDetailsCache[annotation.id].geotagging.type})
                      </span>
                    )}
                  </div>
                  {linkingDetailsCache[annotation.id].geotagging.coordinates &&
                    linkingDetailsCache[annotation.id].geotagging.coordinates
                      .length >= 2 &&
                    typeof linkingDetailsCache[annotation.id].geotagging
                      .coordinates[0] === 'number' &&
                    typeof linkingDetailsCache[annotation.id].geotagging
                      .coordinates[1] === 'number' && (
                      <div className="text-xs text-muted-foreground/80">
                        Coordinates:{' '}
                        {linkingDetailsCache[
                          annotation.id
                        ].geotagging.coordinates[0].toFixed(4)}
                        ,{' '}
                        {linkingDetailsCache[
                          annotation.id
                        ].geotagging.coordinates[1].toFixed(4)}
                      </div>
                    )}
                </div>
              </div>
            )}

            {linkingDetailsCache[annotation.id].pointSelection && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Plus className="h-3 w-3 text-accent" />
                  <span className="font-medium text-primary">
                    Point Selection:
                  </span>
                </div>
                <div className="ml-4 space-y-1">
                  <div className="text-muted-foreground font-medium">
                    Image coordinates: x:{' '}
                    {linkingDetailsCache[annotation.id].pointSelection.x}, y:{' '}
                    {linkingDetailsCache[annotation.id].pointSelection.y}
                  </div>
                </div>
              </div>
            )}

            {/* {linkingDetailsCache[annotation.id].otherPurposes &&
              linkingDetailsCache[annotation.id].otherPurposes.length > 0 && (
                <div>
                  <span className="font-medium text-primary">
                    Other enhancements:
                  </span>
                  <div className="ml-2 text-muted-foreground">
                    {linkingDetailsCache[annotation.id].otherPurposes.join(
                      ', ',
                    )}
                  </div>
                </div>
              )} */}
          </div>
        </div>
      )}
    </div>
  );
});

const AnnotationIcon = memo(function AnnotationIcon({
  annotation,
  isTextAnnotation,
  getBodies,
}: {
  annotation: Annotation;
  isTextAnnotation: (annotation: Annotation) => boolean;
  getBodies: (annotation: Annotation) => any[];
}) {
  const isHumanCreated = (annotation: Annotation) => {
    if (annotation.creator) {
      return true;
    }

    const bodies = getBodies(annotation);
    return bodies.some((body) => body.creator && !body.generator);
  };

  if (isTextAnnotation(annotation)) {
    return (
      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
        <Type className="h-4 w-4 text-primary" />
        {isHumanCreated(annotation) && (
          <div title="Created/Modified by human">
            <User className="h-3 w-3 text-secondary" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
      <Image className="h-4 w-4 text-primary" />
      {isHumanCreated(annotation) && (
        <div title="Created/Modified by human">
          <User className="h-3 w-3 text-secondary" />
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
  hasAssessing,
  canHaveAssessing,
  onAssessingToggle,
}: AnnotationItemProps) {
  const isInLinkingOrder = useMemo(
    () => linkedAnnotationsOrder?.includes(annotation.id) || false,
    [linkedAnnotationsOrder, annotation.id],
  );

  const displayValue = useMemo(() => {
    if (isTextAnnotation(annotation)) {
      const bodies = getBodies(annotation);
      
      // Priority 1: Human-created bodies (no generator)
      const humanBody = bodies.find(
        (body) => !body.generator && body.value && body.value.trim().length > 0,
      );
      
      if (humanBody) {
        return optimisticUpdates[annotation.id] ?? humanBody.value;
      }
      
      // Priority 2: Loghi AI bodies
      const loghiBody = bodies.find(
        (body) =>
          body.generator &&
          (body.generator.label?.toLowerCase().includes('loghi') ||
            body.generator.id?.includes('loghi')) &&
          body.value &&
          body.value.trim().length > 0,
      );
      
      if (loghiBody) {
        return optimisticUpdates[annotation.id] ?? loghiBody.value;
      }
      
      // Priority 3: Other AI bodies
      const otherAiBody = bodies.find(
        (body) =>
          body.generator &&
          !(
            body.generator.label?.toLowerCase().includes('loghi') ||
            body.generator.id?.includes('loghi')
          ) &&
          body.value &&
          body.value.trim().length > 0,
      );
      
      const originalValue = otherAiBody?.value || '';
      return optimisticUpdates[annotation.id] ?? originalValue;
    }
    return '';
  }, [
    annotation,
    optimisticUpdates,
    isTextAnnotation,
    getBodies,
  ]);

  const itemClassName = useMemo(() => {
    const baseClasses =
      'p-4 border-l-2 transition-all duration-200 relative group';
    const stateClasses = isCurrentlyEditing
      ? 'bg-accent/10 border-l-accent shadow-md ring-1 ring-accent/30 cursor-default'
      : isPointSelectionMode
      ? 'cursor-crosshair'
      : 'cursor-pointer';

    const selectionClasses = isSelected
      ? isExpanded
        ? 'bg-accent/12 border-l-accent shadow-lg ring-1 ring-accent/20'
        : 'bg-accent/8 border-l-accent shadow-md'
      : isInLinkingOrder
      ? 'bg-primary/8 border-l-primary/60 shadow-md hover:bg-primary/12 hover:shadow-lg hover:border-l-primary/80'
      : 'border-l-transparent hover:bg-muted/50 hover:border-l-muted-foreground/30 hover:shadow-sm';

    const savingClasses = isSaving ? 'opacity-75 animate-pulse' : '';

    const linkingGlowClasses =
      isInLinkingOrder && !isSelected
        ? 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:pointer-events-none'
        : '';

    return `${baseClasses} ${stateClasses} ${selectionClasses} ${savingClasses} ${linkingGlowClasses}`;
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

  const handleAssessmentToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit || !canHaveAssessing(annotation)) return;

      try {
        await onAssessingToggle(annotation);
      } catch (error) {
        console.error('Error toggling assessment:', error);
      }
    },
    [annotation, canEdit, canHaveAssessing, onAssessingToggle],
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
            getBodies={getBodies}
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
            hasAssessing={hasAssessing}
            canHaveAssessing={canHaveAssessing}
          />

          <div className="flex items-center gap-1">
            {canHaveAssessing(annotation) && (
              <button
                onClick={handleAssessmentToggle}
                disabled={!canEdit}
                className={`p-1.5 rounded-md transition-colors duration-100 ${
                  hasAssessing(annotation)
                    ? 'text-chart-2 hover:text-chart-2/80 hover:bg-chart-2/10'
                    : 'text-muted-foreground hover:text-chart-2 hover:bg-chart-2/10'
                }`}
                title={
                  hasAssessing(annotation)
                    ? 'Mark as unchecked'
                    : 'Mark as checked'
                }
              >
                {hasAssessing(annotation) ? (
                  <CheckCheck className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            )}

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
            hasAssessing={hasAssessing}
            canHaveAssessing={canHaveAssessing}
          />
        </div>
      )}
    </div>
  );
});

export default FastAnnotationItem;
