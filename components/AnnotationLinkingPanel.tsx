'use client';

import { Button } from '@/components/Button';
import { ChevronDown, ChevronUp, Link2, X } from 'lucide-react';
import React, { memo } from 'react';

export const LinkingPanel = memo(
  ({
    isOpen,
    onClose,
    selectedIds,
    setSelectedIds,
    annotations,
    currentAnnotationId,
    onSave,
    isSaving,
    session,
  }: {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    annotations: any[];
    currentAnnotationId: string | null;
    onSave: () => void;
    isSaving: boolean;
    session: any;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="absolute inset-0 bg-background border-l border-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Link Annotations</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {selectedIds.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">
                Selected Annotations ({selectedIds.length})
              </h4>

              <div className="space-y-2">
                {selectedIds.map((id, index) => {
                  const anno = annotations.find((a) => a.id === id);
                  if (!anno) return null;

                  const isCurrent = id === currentAnnotationId;
                  const title =
                    anno.motivation === 'iconography' ||
                    anno.motivation === 'iconograpy'
                      ? 'Icon'
                      : (Array.isArray(anno.body) && anno.body[0]?.value) ||
                        'Untitled';

                  const canMoveUp = index > 0;
                  const canMoveDown = index < selectedIds.length - 1;

                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-2 p-3 rounded border ${
                        isCurrent
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{title}</div>
                        {isCurrent && (
                          <div className="text-xs text-primary">
                            Current annotation
                          </div>
                        )}
                      </div>

                      {/* Reordering controls */}
                      {selectedIds.length > 1 && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (canMoveUp) {
                                const newIds = [...selectedIds];
                                [newIds[index], newIds[index - 1]] = [
                                  newIds[index - 1],
                                  newIds[index],
                                ];
                                setSelectedIds(newIds);
                              }
                            }}
                            disabled={!canMoveUp}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (canMoveDown) {
                                const newIds = [...selectedIds];
                                [newIds[index], newIds[index + 1]] = [
                                  newIds[index + 1],
                                  newIds[index],
                                ];
                                setSelectedIds(newIds);
                              }
                            }}
                            disabled={!canMoveDown}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newIds = selectedIds.filter(
                            (selectedId) => selectedId !== id,
                          );
                          setSelectedIds(newIds);
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {selectedIds.length < 2 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                  Select at least 2 annotations to create a link
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No annotations selected</p>
              <p className="text-sm mt-1">
                Click annotations in the image viewer to start building a link
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedIds.length >= 2 ? (
                <span className="text-green-600">✓ Ready to save link</span>
              ) : (
                <span>Select at least 2 annotations</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={selectedIds.length < 2 || isSaving || !session}
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Link'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

LinkingPanel.displayName = 'LinkingPanel';
