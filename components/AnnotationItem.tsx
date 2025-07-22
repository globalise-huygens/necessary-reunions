'use client';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Link2,
  MapPin,
  Trash2,
} from 'lucide-react';
import React, { memo, useCallback, useMemo } from 'react';
import { AnnotationEditor } from './AnnotationLinkEditor';
import { Badge } from './Badge';
import { Button } from './Button';

const MemoizedBadge = memo(Badge);
MemoizedBadge.displayName = 'MemoizedBadge';

const MemoizedButton = memo(Button);
MemoizedButton.displayName = 'MemoizedButton';

export const AnnotationItem = memo(
  ({
    annotation,
    isSelected,
    isExpanded,
    capabilities,
    title,
    preview,
    geotag,
    linkedIds,
    canEdit,
    onAnnotationSelect,
    onExpandToggle,
    onEnsureExpanded,
    onDeleteAnnotation,
    getBodies,
    getGeneratorLabel,
    session,
    annotations,
    onRefreshAnnotations,
    onLinkCreated,
    onCurrentPointSelectorChange,
    linkingMode,
    setLinkingMode,
    selectedIds,
    setSelectedIds,
    getEtag,
    canvasId,
    manifestId,
    onSaveViewport,
    onOptimisticAnnotationAdd,
    onAnnotationInLinkingMode,
    pendingGeotags,
    setPendingGeotags,
    toast,
  }: {
    annotation: any;
    isSelected: boolean;
    isExpanded: boolean;
    capabilities: any;
    title: string;
    preview: string;
    geotag: any;
    linkedIds: string[];
    canEdit: boolean;
    onAnnotationSelect: (id: string) => void;
    onExpandToggle: (id: string) => void;
    onEnsureExpanded: (id: string) => void;
    onDeleteAnnotation: (annotation: any) => void;
    getBodies: (annotation: any) => any[];
    getGeneratorLabel: (body: any) => string;
    session: any;
    annotations: any[];
    onRefreshAnnotations?: () => void;
    onLinkCreated?: () => void;
    onCurrentPointSelectorChange?: (
      point: { x: number; y: number } | null,
    ) => void;
    linkingMode?: boolean;
    setLinkingMode?: (v: boolean) => void;
    selectedIds?: string[];
    setSelectedIds?: (ids: string[]) => void;
    getEtag: (id: string) => string | undefined;
    canvasId: string;
    manifestId?: string;
    onSaveViewport?: (viewport: any) => void;
    onOptimisticAnnotationAdd?: (anno: any) => void;
    onAnnotationInLinkingMode?: (annotationId: string | null) => void;
    pendingGeotags: Record<string, any>;
    setPendingGeotags: React.Dispatch<
      React.SetStateAction<Record<string, any>>
    >;
    toast: any;
  }) => {
    const bodies = useMemo(() => {
      const annotationBodies = getBodies(annotation);

      if (
        (annotation.motivation === 'iconography' ||
          annotation.motivation === 'iconograpy') &&
        annotationBodies.length === 0
      ) {
        return [
          {
            type: 'TextualBody',
            value: 'Icon',
            format: 'text/plain',
            generator: { id: '', label: 'Icon' },
            created: new Date().toISOString(),
          } as any,
        ];
      }

      return annotationBodies;
    }, [annotation, getBodies]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (e && e.target instanceof HTMLElement) {
          const tag = e.target.tagName.toLowerCase();
          if (
            ['input', 'textarea', 'button', 'select', 'label'].includes(tag)
          ) {
            return;
          }
        }
        onAnnotationSelect(annotation.id);
      },
      [annotation.id, onAnnotationSelect],
    );

    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onExpandToggle(annotation.id);
        if (!isSelected) {
          onAnnotationSelect(annotation.id);
        }
      },
      [annotation.id, isSelected, onExpandToggle, onAnnotationSelect],
    );

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeleteAnnotation(annotation);
      },
      [annotation, onDeleteAnnotation],
    );

    return (
      <div
        className={`border rounded-lg p-2 transition-all duration-200 overflow-hidden ${
          isSelected
            ? 'bg-primary/10 border-primary shadow-md'
            : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
        }`}
      >
        {/* Main content area */}
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex-1 cursor-pointer min-w-0" onClick={handleClick}>
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {title}
                  </h4>
                  {preview && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {preview}
                    </p>
                  )}
                </div>

                {/* Capability indicators */}
                <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
                  {capabilities.hasLinks && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Linked"
                    >
                      <Link2 className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                  {capabilities.hasGeotag && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Located"
                    >
                      <MapPin className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                  {capabilities.hasPointSelector && (
                    <MemoizedBadge
                      variant="secondary"
                      className="text-xs p-1 whitespace-nowrap"
                      title="Mapped"
                    >
                      <Globe className="w-3 h-3" />
                    </MemoizedBadge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* Expand button */}
            <MemoizedButton
              variant="ghost"
              size="sm"
              onClick={handleExpandClick}
              className="text-muted-foreground hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-1" />
                  <span className="text-xs hidden sm:inline">Edit</span>
                </>
              )}
              <span className="sr-only">
                {isExpanded ? 'Collapse' : 'Expand'} editing options
              </span>
            </MemoizedButton>

            {/* Delete button */}
            <MemoizedButton
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              disabled={!canEdit}
              className={`${
                canEdit
                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="sr-only">Delete annotation</span>
            </MemoizedButton>
          </div>
        </div>

        {/* Expanded editing interface */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="max-w-full">
              <AnnotationEditor
                annotation={annotation}
                session={session}
                geotag={geotag}
                linkedIds={linkedIds}
                annotations={annotations}
                onRefreshAnnotations={onRefreshAnnotations}
                onLinkCreated={onLinkCreated}
                onCurrentPointSelectorChange={onCurrentPointSelectorChange}
                linkingMode={linkingMode}
                setLinkingMode={setLinkingMode}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                getEtag={getEtag}
                canvasId={canvasId}
                manifestId={manifestId}
                onSaveViewport={onSaveViewport}
                onOptimisticAnnotationAdd={onOptimisticAnnotationAdd}
                onAnnotationInLinkingMode={onAnnotationInLinkingMode}
                onAnnotationSelect={onAnnotationSelect}
                onEnsureExpanded={onEnsureExpanded}
                pendingGeotags={pendingGeotags}
                setPendingGeotags={setPendingGeotags}
                toast={toast}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);

AnnotationItem.displayName = 'AnnotationItem';
