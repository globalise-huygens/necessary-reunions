'use client';

import { Input } from '@/components/shared/Input';
import { Textarea } from '@/components/shared/Textarea';
import { cn } from '@/lib/shared/utils';
import type { Annotation } from '@/lib/types';
import { Check, Edit2, Loader2, Save, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

interface EditableAnnotationTextProps {
  annotation: Annotation;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  canEdit: boolean;
  onUpdate: (annotation: Annotation, newValue: string) => Promise<void>;
  onOptimisticUpdate?: (annotation: Annotation, newValue: string) => void;
  className?: string;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onFinishEdit?: () => void;
  // New props for commenting
  isComment?: boolean;
  allowEmpty?: boolean;
}

export const EditableAnnotationText = React.memo(
  function EditableAnnotationText({
    annotation,
    value,
    placeholder = 'Click to add text...',
    multiline = false,
    canEdit,
    onUpdate,
    onOptimisticUpdate,
    className,
    isEditing = false,
    onStartEdit,
    onCancelEdit,
    onFinishEdit,
    isComment = false,
    allowEmpty = false,
  }: EditableAnnotationTextProps) {
    const [editValue, setEditValue] = useState(value);
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const originalValueRef = useRef(value);

    React.useEffect(() => {
      if (!isEditing) {
        if (editValue !== value) {
          setEditValue(value);
        }
        originalValueRef.current = value;
        setValidationError(null);
      }
    }, [value, isEditing, editValue]);

    const handleStartEdit = useCallback(() => {
      if (!canEdit || !onStartEdit) return;
      setEditValue(value);
      originalValueRef.current = value;
      setValidationError(null);
      onStartEdit();
    }, [canEdit, value, onStartEdit]);

    const handleWrapperClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleStartEdit();
      },
      [handleStartEdit],
    );

    const handleSave = useCallback(async () => {
      setIsLoading(true);

      const trimmedValue = editValue.trim();

      // For comments, allow empty values (to delete comments)
      if (!allowEmpty && (!trimmedValue || trimmedValue.length === 0)) {
        setIsLoading(false);
        setValidationError(
          'Text cannot be empty. Please enter some text or cancel editing.',
        );
        return;
      }

      setValidationError(null);

      if (trimmedValue === originalValueRef.current?.trim()) {
        setIsLoading(false);
        onFinishEdit?.();
        return;
      }

      if (onOptimisticUpdate) {
        onOptimisticUpdate(annotation, trimmedValue);
      }

      onFinishEdit?.();

      try {
        await onUpdate(annotation, trimmedValue);
        originalValueRef.current = trimmedValue;
      } catch (error) {
        if (onOptimisticUpdate) {
          onOptimisticUpdate(annotation, originalValueRef.current);
        }

        setEditValue(originalValueRef.current);
        onStartEdit?.();
      } finally {
        setIsLoading(false);
      }
    }, [
      annotation,
      editValue,
      onUpdate,
      onFinishEdit,
      onOptimisticUpdate,
      onStartEdit,
      allowEmpty,
    ]);

    const handleCancel = useCallback(() => {
      setEditValue(originalValueRef.current);
      setValidationError(null);

      if (onOptimisticUpdate) {
        onOptimisticUpdate(annotation, originalValueRef.current);
      }

      onCancelEdit?.();
    }, [annotation, onOptimisticUpdate, onCancelEdit]);

    const handleValueChange = useCallback(
      (newValue: string) => {
        setEditValue(newValue);

        if (!allowEmpty && newValue.trim().length === 0) {
          setValidationError('Text cannot be empty.');
        } else {
          if (validationError) {
            setValidationError(null);
          }
        }
      },
      [validationError, allowEmpty],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          handleSave();
        }
        if (e.key === 'Escape') {
          handleCancel();
        }
      },
      [handleSave, handleCancel, multiline],
    );

    const InputComponent = useMemo(
      () => (multiline ? Textarea : Input),
      [multiline],
    );

    const saveButtonClass = useMemo(
      () =>
        'p-1.5 text-white bg-primary hover:bg-primary/90 rounded-md transition-colors duration-150 disabled:opacity-50 transform active:scale-95',
      [],
    );

    const cancelButtonClass = useMemo(
      () =>
        'p-1.5 text-white bg-destructive hover:bg-destructive/90 rounded-md transition-colors duration-150 disabled:opacity-50 transform active:scale-95',
      [],
    );

    if (!canEdit && !value) {
      return null;
    }

    if (isEditing) {
      return (
        <div
          className={cn(
            'flex flex-col items-start gap-2 animate-in fade-in duration-150 w-full',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex w-full items-start gap-2">
            <InputComponent
              value={editValue}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
              disabled={isLoading}
              className={cn(
                'flex-1 text-sm transition-all duration-150',
                multiline && 'min-h-[60px] resize-none',
                'focus:shadow-sm focus:ring-2',
                validationError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                  : 'border-primary/30 focus:border-primary focus:ring-primary/20',
              )}
              style={{
                willChange: 'contents',
                transform: 'translateZ(0)',
              }}
            />
            <div className="flex gap-1 mt-1 animate-in slide-in-from-right duration-200">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className={saveButtonClass}
                title="Save"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className={cancelButtonClass}
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {validationError && (
            <div className="text-xs text-red-500 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
              {validationError}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={cn(
          'group flex items-start gap-2 cursor-pointer rounded-md px-2 py-1.5 -mx-2 -my-1.5 transition-all duration-150',
          canEdit &&
            'hover:bg-muted/50 hover:border hover:border-primary/20 hover:shadow-sm',
          !value && 'border border-dashed border-muted-foreground/30',
          className,
        )}
        onClick={handleWrapperClick}
      >
        <span
          className={cn(
            'flex-1 text-sm leading-relaxed transition-colors duration-150',
            !value && 'text-muted-foreground italic',
            canEdit && 'group-hover:text-primary',
          )}
        >
          {value || placeholder}
        </span>
        {canEdit && (
          <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-100 transform group-hover:scale-110 mt-1 flex-shrink-0" />
        )}
      </div>
    );
  },
);
