'use client';

import type { Annotation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, Edit2, Loader2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface EditableAnnotationTextProps {
  annotation: Annotation;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  canEdit: boolean;
  onUpdate: (annotation: Annotation, newValue: string) => Promise<void>;
  className?: string;
}

export function EditableAnnotationText({
  annotation,
  value,
  placeholder = 'Click to add text...',
  multiline = false,
  canEdit,
  onUpdate,
  className,
}: EditableAnnotationTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartEdit = useCallback(() => {
    if (!canEdit) return;
    setEditValue(value);
    setIsEditing(true);
  }, [canEdit, value]);

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate(annotation, editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update annotation:', error);
      setEditValue(value);
    } finally {
      setIsLoading(false);
    }
  }, [annotation, editValue, value, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

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

  if (!canEdit && !value) {
    return null;
  }

  if (isEditing) {
    const InputComponent = multiline ? Textarea : Input;

    return (
      <div className={cn('flex items-start gap-2', className)}>
        <InputComponent
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          disabled={isLoading}
          className={cn(
            'flex-1 text-sm border-primary/30 focus:border-primary focus:ring-primary/20',
            multiline && 'min-h-[60px] resize-none',
          )}
        />
        <div className="flex gap-1 mt-1">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="p-1.5 text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
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
            className="p-1.5 text-white bg-destructive hover:bg-destructive/90 rounded-md transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-2 cursor-pointer rounded-md px-2 py-1.5 -mx-2 -my-1.5 transition-colors',
        canEdit && 'hover:bg-muted/50 hover:border hover:border-primary/20',
        !value && 'border border-dashed border-muted-foreground/30',
        className,
      )}
      onClick={handleStartEdit}
    >
      <span
        className={cn(
          'flex-1 text-sm leading-relaxed',
          !value && 'text-muted-foreground italic',
          canEdit && 'group-hover:text-primary',
        )}
      >
        {value || placeholder}
      </span>
      {canEdit && (
        <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
      )}
    </div>
  );
}
