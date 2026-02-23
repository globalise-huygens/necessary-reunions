/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Image,
  MapPin,
  MessageSquare,
  Plus,
  Share2,
  Tag,
  Trash2,
  Type,
  User,
} from 'lucide-react';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ClassificationSelector } from '../../components/viewer/ClassificationSelector';
import { EditableAnnotationText } from '../../components/viewer/EditableAnnotationText';
import type { Annotation } from '../../lib/types';

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
  onCommentUpdate?: (
    annotation: Annotation,
    newComment: string,
  ) => Promise<void>;
  getCommentBody?: (annotation: Annotation) => any;
  hasComment?: (annotation: Annotation) => boolean;
  getCommentText?: (annotation: Annotation) => string;
  session?: any;
  getClassifyingBody?: (annotation: Annotation) => any;
  hasClassification?: (annotation: Annotation) => boolean;
  getClassificationLabel?: (annotation: Annotation) => string;
  getClassificationId?: (annotation: Annotation) => string;
  onClassificationUpdate?: (
    annotation: Annotation,
    classificationId: string | null,
  ) => Promise<void>;
  onEditGeotag?: () => void;
  onEditPoint?: () => void;
}

const FastEnhancementIndicators = memo(function FastEnhancementIndicators({
  annotation,
  linkedAnnotationsOrder,
  isAnnotationLinkedDebug,
  hasGeotagData,
  hasPointSelection,
  hasAssessing,
  canHaveAssessing,
  hasComment,
  hasClassification,
}: {
  annotation: Annotation;
  linkedAnnotationsOrder: string[];
  isAnnotationLinkedDebug: (id: string) => boolean;
  hasGeotagData: (id: string) => boolean;
  hasPointSelection: (id: string) => boolean;
  hasAssessing: (annotation: Annotation) => boolean;
  canHaveAssessing: (annotation: Annotation) => boolean;
  hasComment?: (annotation: Annotation) => boolean;
  hasClassification?: (annotation: Annotation) => boolean;
}) {
  const hasEnhancements = useMemo(
    () =>
      hasGeotagData(annotation.id) ||
      hasPointSelection(annotation.id) ||
      isAnnotationLinkedDebug(annotation.id) ||
      (canHaveAssessing(annotation) && hasAssessing(annotation)) ||
      (hasComment && hasComment(annotation)) ||
      (hasClassification && hasClassification(annotation)),
    [
      annotation,
      hasGeotagData,
      hasPointSelection,
      isAnnotationLinkedDebug,
      canHaveAssessing,
      hasAssessing,
      hasComment,
      hasClassification,
    ],
  );

  const isInOrder = useMemo(
    () => linkedAnnotationsOrder.includes(annotation.id),
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

      {/* Compact comment indicator */}
      {hasComment && hasComment(annotation) && (
        <div
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-chart-2/15 border border-chart-2/30"
          title="Has comment"
        >
          <MessageSquare className="h-2 w-2 text-chart-2" />
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

      {/* Compact classification indicator */}
      {hasClassification && hasClassification(annotation) && (
        <div
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-chart-4/15 border border-chart-4/30"
          title="Has classification"
        >
          <Tag className="h-2 w-2 text-chart-4" />
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
  hasComment,
  getCommentText,
  onCommentUpdate,
  canEdit,
  session,
  hasClassification,
  getClassificationLabel,
  getClassificationId,
  onClassificationUpdate,
  onEditGeotag,
  onEditPoint,
}: {
  annotation: Annotation;
  linkingDetailsCache: Record<string, any>;
  hasAssessing: (annotation: Annotation) => boolean;
  canHaveAssessing: (annotation: Annotation) => boolean;
  hasComment?: (annotation: Annotation) => boolean;
  getCommentText?: (annotation: Annotation) => string;
  onCommentUpdate?: (
    annotation: Annotation,
    newComment: string,
  ) => Promise<void>;
  canEdit: boolean;
  session?: any;
  hasClassification?: (annotation: Annotation) => boolean;
  getClassificationLabel?: (annotation: Annotation) => string;
  getClassificationId?: (annotation: Annotation) => string;
  onClassificationUpdate?: (
    annotation: Annotation,
    classificationId: string | null,
  ) => Promise<void>;
  onEditGeotag?: () => void;
  onEditPoint?: () => void;
}) {
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [editingComment, setEditingComment] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsContentLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!isContentLoaded) {
    return (
      <div className="h-24 bg-accent/5 rounded-lg border border-accent/20 animate-pulse" />
    );
  }

  const commentText = getCommentText ? getCommentText(annotation) : '';
  const details = linkingDetailsCache[annotation.id];
  const isIconography =
    annotation.motivation === 'iconography' ||
    annotation.motivation === 'iconograpy';

  return (
    <div className="bg-accent/5 px-3 py-2 rounded-lg text-xs border border-accent/20 space-y-2">
      {/* Row 1: Comment + Classification side by side when both present */}
      {(canEdit && session?.user) || isIconography ? (
        <div
          className={`flex gap-3 ${isIconography && canEdit && session?.user ? 'flex-wrap' : ''}`}
        >
          {/* Comment (inline, compact) */}
          {canEdit && session?.user && (
            <div
              className={`min-w-0 ${isIconography ? 'flex-1 min-w-[140px]' : 'flex-1'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="h-2.5 w-2.5 text-chart-2 flex-shrink-0" />
                <span className="font-medium text-primary text-[11px]">
                  Comment
                </span>
              </div>
              <EditableAnnotationText
                annotation={annotation}
                value={commentText}
                placeholder="Add a comment..."
                multiline={true}
                canEdit={canEdit && !!session?.user}
                onUpdate={onCommentUpdate || (() => Promise.resolve())}
                className="text-xs"
                isEditing={editingComment}
                onStartEdit={() => setEditingComment(true)}
                onCancelEdit={() => setEditingComment(false)}
                onFinishEdit={() => setEditingComment(false)}
                allowEmpty={true}
              />
            </div>
          )}

          {/* Classification (inline, compact) */}
          {isIconography && (
            <div
              className={`min-w-0 ${canEdit && session?.user ? 'flex-1 min-w-[140px]' : 'flex-1'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="h-2.5 w-2.5 text-chart-4 flex-shrink-0" />
                <span className="font-medium text-primary text-[11px]">
                  Classification
                </span>
              </div>
              {canEdit && session?.user && onClassificationUpdate ? (
                <ClassificationSelector
                  annotation={annotation}
                  currentClassificationId={
                    getClassificationId ? getClassificationId(annotation) : ''
                  }
                  canEdit={canEdit && !!session?.user}
                  onClassificationUpdate={onClassificationUpdate}
                />
              ) : (
                <span className="text-muted-foreground">
                  {hasClassification && hasClassification(annotation)
                    ? getClassificationLabel
                      ? getClassificationLabel(annotation)
                      : 'Unknown'
                    : 'None'}
                </span>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Row 2: Metadata — compact 2-column grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <div className="truncate">
          <span className="font-medium text-primary">ID:</span>{' '}
          <span className="font-mono text-muted-foreground">
            {annotation.id.split('/').pop()}
          </span>
        </div>
        {canHaveAssessing(annotation) && (
          <div>
            <span className="font-medium text-primary">Status:</span>{' '}
            <span
              className={
                hasAssessing(annotation)
                  ? 'text-chart-2'
                  : 'text-muted-foreground/70'
              }
            >
              {hasAssessing(annotation) ? 'Checked' : 'Unchecked'}
            </span>
          </div>
        )}
        {annotation.creator && (
          <div className="truncate">
            <span className="font-medium text-primary">By:</span>{' '}
            <span className="text-muted-foreground">
              {annotation.creator.label}
            </span>
          </div>
        )}
        {annotation.modified && (
          <div className="truncate">
            <span className="font-medium text-primary">Modified:</span>{' '}
            <span className="text-muted-foreground">
              {new Date(annotation.modified).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Row 3: Enrichment summary — compact inline badges */}
      {details && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-accent/20">
          {details.linkedAnnotations &&
            details.linkedAnnotations.length > 0 && (
              <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-md px-1.5 py-0.5">
                <Share2 className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] text-primary font-medium">
                  {details.linkedAnnotations.length} linked
                </span>
              </div>
            )}

          {details.geotagging && (
            <div className="flex items-center gap-1 bg-secondary/10 border border-secondary/20 rounded-md px-1.5 py-0.5">
              <MapPin className="h-2.5 w-2.5 text-secondary" />
              <span className="text-[10px] text-secondary font-medium truncate max-w-[100px]">
                {details.geotagging.name}
              </span>
              {canEdit && onEditGeotag && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditGeotag();
                  }}
                  className="text-[10px] text-secondary/70 hover:text-secondary underline ml-0.5"
                >
                  Edit
                </button>
              )}
            </div>
          )}

          {details.pointSelection && (
            <div className="flex items-center gap-1 bg-accent/10 border border-accent/20 rounded-md px-1.5 py-0.5">
              <Plus className="h-2.5 w-2.5 text-accent" />
              <span className="text-[10px] text-accent font-medium">
                {details.pointSelection.x}, {details.pointSelection.y}
              </span>
              {canEdit && onEditPoint && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPoint();
                  }}
                  className="text-[10px] text-accent/70 hover:text-accent underline ml-0.5"
                >
                  Edit
                </button>
              )}
            </div>
          )}
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
  const isHumanCreated = (annot: Annotation) => {
    if (annot.creator) {
      return true;
    }

    const bodies = getBodies(annot);
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
  onCommentUpdate,
  getCommentBody,
  hasComment,
  getCommentText,
  session,
  getClassifyingBody,
  hasClassification,
  getClassificationLabel,
  getClassificationId,
  onClassificationUpdate,
  onEditGeotag,
  onEditPoint,
}: AnnotationItemProps) {
  const isInLinkingOrder = useMemo(
    () => linkedAnnotationsOrder.includes(annotation.id) || false,
    [linkedAnnotationsOrder, annotation.id],
  );

  const displayValue = useMemo(() => {
    if (isTextAnnotation(annotation)) {
      const bodies = getBodies(annotation);

      const textContentBodies = bodies.filter(
        (body) =>
          body.purpose !== 'assessing' &&
          body.purpose !== 'commenting' &&
          body.purpose !== 'describing',
      );

      const humanBody = textContentBodies.find(
        (body) => !body.generator && body.value && body.value.trim().length > 0,
      );

      if (humanBody) {
        return optimisticUpdates[annotation.id] ?? humanBody.value;
      }

      const loghiBody = textContentBodies.find(
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

      const otherAiBody = textContentBodies.find(
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
  }, [annotation, optimisticUpdates, isTextAnnotation, getBodies]);

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
      } catch {}
    },
    [annotation, canEdit, canHaveAssessing, onAssessingToggle],
  );

  return (
    <div
      className={itemClassName}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      aria-expanded={isExpanded}
      tabIndex={0}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Main content row - only use flex-wrap when actively editing to give text field more space */}
      <div
        className={`flex items-start justify-between ${
          isCurrentlyEditing ? 'flex-wrap gap-y-2' : ''
        }`}
      >
        <div
          className={`flex items-start gap-2 flex-1 pr-4 ${
            isCurrentlyEditing ? 'min-w-[200px]' : 'min-w-0'
          }`}
        >
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

        <div
          className={`flex items-center gap-2 flex-shrink-0 ${
            isCurrentlyEditing ? 'ml-auto' : ''
          }`}
        >
          <FastEnhancementIndicators
            annotation={annotation}
            linkedAnnotationsOrder={linkedAnnotationsOrder}
            isAnnotationLinkedDebug={isAnnotationLinkedDebug}
            hasGeotagData={hasGeotagData}
            hasPointSelection={hasPointSelection}
            hasAssessing={hasAssessing}
            canHaveAssessing={canHaveAssessing}
            hasComment={hasComment}
            hasClassification={hasClassification}
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
          className="mt-2 animate-in slide-in-from-top-2 duration-150"
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
            hasComment={hasComment}
            getCommentText={getCommentText}
            onCommentUpdate={onCommentUpdate}
            canEdit={canEdit}
            session={session}
            hasClassification={hasClassification}
            getClassificationLabel={getClassificationLabel}
            getClassificationId={getClassificationId}
            onClassificationUpdate={onClassificationUpdate}
            onEditGeotag={onEditGeotag}
            onEditPoint={onEditPoint}
          />
        </div>
      )}
    </div>
  );
});

export default FastAnnotationItem;
