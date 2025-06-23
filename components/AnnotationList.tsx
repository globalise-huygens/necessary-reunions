'use client';

import React, { useEffect, useRef, useState, Suspense, useMemo } from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';
import {
  Trash2,
  ChevronRight,
  ChevronDown,
  GlobeLock,
  Link2,
  Plus,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AnnotationLinker } from './AnnotationLinker';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface AnnotationListProps {
  annotations?: Annotation[];
  onAnnotationSelect: (id: string) => void;
  onAnnotationPrepareDelete?: (anno: Annotation) => void;
  canEdit: boolean;
  showTextspotting: boolean;
  showIconography: boolean;
  onFilterChange: (mot: 'textspotting' | 'iconography') => void;
  isLoading?: boolean;
  totalCount?: number;
  selectedAnnotationId?: string | null;
  loadingProgress?: number;
  loadedAnnotations?: number;
  totalAnnotations?: number;
  onRefreshAnnotations?: () => void;
  canvasId: string;
  manifestId?: string;
  onSaveViewport?: (viewport: any) => void;
  onOptimisticAnnotationAdd?: (anno: Annotation) => void;
  onCurrentPointSelectorChange?: (
    point: { x: number; y: number } | null,
  ) => void;
}

const GeoTaggingWidget = dynamic(
  () => import('./GeoTaggingWidget').then((mod) => mod.GeoTaggingWidget),
  { ssr: false, loading: () => <LoadingSpinner /> },
);

export function AnnotationList({
  annotations: propsAnnotations = [],
  onAnnotationSelect,
  onAnnotationPrepareDelete,
  canEdit,
  showTextspotting,
  showIconography,
  onFilterChange,
  isLoading = false,
  totalCount,
  selectedAnnotationId = null,
  loadingProgress = 0,
  loadedAnnotations = 0,
  totalAnnotations = 0,
  onRefreshAnnotations,
  linkingMode,
  setLinkingMode,
  selectedIds,
  setSelectedIds,
  onLinkCreated,
  canvasId,
  manifestId,
  isLinkingLoading = false,
  onSaveViewport,
  onOptimisticAnnotationAdd,
  onCurrentPointSelectorChange,
  getEtag: propsGetEtag,
}: AnnotationListProps & {
  linkingMode?: boolean;
  setLinkingMode?: (v: boolean) => void;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  onLinkCreated?: () => void;
  isLinkingLoading?: boolean;
  getEtag?: (id: string) => string | undefined;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

  const annotations = propsAnnotations;

  const getEtag = propsGetEtag || ((id: string) => undefined);

  useEffect(() => {
    console.log('📋 AnnotationList received annotations:', {
      total: annotations.length,
      iconographyCount: annotations.filter(
        (a) => a.motivation === 'iconography' || a.motivation === 'iconograpy',
      ).length,
      iconographyIds: annotations
        .filter(
          (a) =>
            a.motivation === 'iconography' || a.motivation === 'iconograpy',
        )
        .map((a) => a.id),
      allMotivations: [...new Set(annotations.map((a) => a.motivation))],
    });
  }, [annotations]);

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

  const getGeotagBody = (annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.find(
      (b) =>
        b.type === 'SpecificResource' &&
        (b.purpose === 'geotagging' || b.purpose === 'identifying') &&
        b.source &&
        b.source.label &&
        b.source.id,
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

  const filtered = useMemo(() => {
    return annotations.filter((a) => {
      const m = a.motivation?.toLowerCase();
      if (m === 'textspotting') return showTextspotting;
      if (m === 'iconography' || m === 'iconograpy') return showIconography;
      return true;
    });
  }, [annotations, showTextspotting, showIconography]);

  const displayCount = totalCount ?? filtered.length;

  const linkingAnnotationsMap = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    annotations.forEach((a) => {
      if (a.motivation === 'linking' && Array.isArray(a.target)) {
        a.target.forEach((targetId: string) => {
          if (!map.has(targetId)) {
            map.set(targetId, []);
          }
          map.get(targetId)!.push(a);
        });
      }
    });
    return map;
  }, [annotations]);

  const geotagAnnotationsMap = useMemo(() => {
    const map = new Map<string, Annotation>();
    annotations.forEach((a) => {
      if (a.motivation === 'linking') {
        let targetIds: string[] = [];
        if (typeof a.target === 'string') targetIds = [a.target];
        else if (Array.isArray(a.target)) {
          targetIds = a.target
            .map((t) => (typeof t === 'string' ? t : t?.id))
            .filter(Boolean);
        } else if (a.target && typeof a.target === 'object') {
          targetIds = [a.target.id];
        }

        const bodies = Array.isArray(a.body) ? a.body : [a.body];
        const hasGeotag = bodies.some(
          (b) =>
            b.type === 'SpecificResource' &&
            (b.purpose === 'geotagging' || b.purpose === 'identifying') &&
            b.source &&
            b.source.label &&
            b.source.id,
        );

        if (hasGeotag) {
          targetIds.forEach((targetId) => {
            map.set(targetId, a);
          });
        }
      }
    });
    return map;
  }, [annotations]);

  const getLinkingAnnotations = (annotationId: string) =>
    linkingAnnotationsMap.get(annotationId) || [];

  const getLinkedAnnotationIds = (annotationId: string) => {
    const links = getLinkingAnnotations(annotationId);
    const ids = new Set<string>();
    links.forEach((link) => {
      (link.target || []).forEach((tid: string) => {
        if (tid !== annotationId) ids.add(tid);
      });
    });
    return Array.from(ids);
  };

  const getGeotagAnnoFor = (annotationId: string) => {
    return geotagAnnotationsMap.get(annotationId);
  };

  const [pendingGeotags, setPendingGeotags] = useState<Record<string, any>>({});

  return (
    <div className="h-full border-l border-border bg-card flex flex-col">
      <div className="px-4 py-3 border-b border-border text-xs text-muted-foreground flex space-x-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTextspotting}
            onChange={() => onFilterChange('textspotting')}
            className="accent-primary"
          />
          <span>Texts (AI)</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showIconography}
            onChange={() => onFilterChange('iconography')}
            className="accent-secondary"
          />
          <span>Icons (AI)</span>
        </label>
      </div>

      <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground bg-muted/30">
        Showing {displayCount} of {annotations.length}
      </div>

      <div className="overflow-auto flex-1" ref={listRef}>
        {isLoading && filtered.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-muted-foreground">
              Loading annotations…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
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

              const geotagAnno = getGeotagAnnoFor(annotation.id);
              const geotag = geotagAnno ? getGeotagBody(geotagAnno) : undefined;

              const isSelected = annotation.id === selectedAnnotationId;
              const isExpanded = annotation.id === expandedId;

              const linkedIds = getLinkedAnnotationIds(annotation.id);
              const isLinked = linkedIds.length > 0;

              return (
                <div
                  key={annotation.id}
                  ref={(el) => {
                    if (el) itemRefs.current[annotation.id] = el;
                  }}
                  className={`p-4 flex items-start justify-between hover:bg-muted/50 relative transition-colors cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-primary/10 border-l-primary'
                      : 'border-l-transparent hover:border-l-muted'
                  } ${isExpanded ? 'flex-col items-start' : ''}`}
                  onClick={(e) => {
                    if (e && e.target instanceof HTMLElement) {
                      const tag = e.target.tagName.toLowerCase();
                      if (
                        [
                          'input',
                          'textarea',
                          'button',
                          'select',
                          'label',
                        ].includes(tag)
                      ) {
                        return;
                      }
                    }
                    onAnnotationSelect(annotation.id);
                  }}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  {!isExpanded && (
                    <div className="absolute right-[19px] bottom-[14px] flex gap-2 items-center">
                      {geotag && (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-secondary/20 text-secondary border border-secondary/30 p-1"
                          title="Geotagged"
                        >
                          <GlobeLock className="w-3 h-3" />
                        </span>
                      )}
                      {isLinkingLoading ? (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground p-1"
                          title="Loading links…"
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              display: 'inline-block',
                            }}
                          >
                            <LoadingSpinner />
                          </span>
                        </span>
                      ) : isLinked ? (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 p-1"
                          title="Linked annotation(s)"
                        >
                          <Link2 className="w-3 h-3" />
                        </span>
                      ) : null}
                    </div>
                  )}
                  <button
                    className={`absolute left-2 top-5 z-10 transition-transform duration-50 ease-linear`}
                    style={{
                      outline: 'none',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    tabIndex={0}
                    aria-label={
                      isExpanded ? 'Collapse details' : 'Expand details'
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId((prev) =>
                        prev === annotation.id ? null : annotation.id,
                      );
                      if (selectedAnnotationId !== annotation.id) {
                        onAnnotationSelect(annotation.id);
                      }
                      setTimeout(() => {
                        const el = itemRefs.current[annotation.id];
                        if (el) {
                          el.scrollIntoView({
                            behavior: 'auto',
                            block: 'nearest',
                          });
                        }
                      }, 0);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown
                        size={20}
                        strokeWidth={2.2}
                        className="text-foreground"
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        strokeWidth={2.2}
                        className="text-foreground"
                      />
                    )}
                  </button>
                  <div className="flex-1 ml-7">
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
                      {geotag && (
                        <React.Fragment>
                          <span className="bg-muted text-black justify-center items-center inline-flex p-1  text-xs font-semibold rounded gap-1">
                            <GlobeLock className="mr-2 h-3 w-3" />
                          </span>
                          <span className="text-sm text-gray-700">
                            {geotag.source.label}{' '}
                            {geotag.source?.type
                              ? `(${geotag.source.type})`
                              : ''}
                          </span>
                        </React.Fragment>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="w-full bg-white border-t border-gray-200 mt-3 px-2 py-3">
                      <div
                        className="bg-gray-50 rounded text-sm space-y-2 break-words whitespace-pre-wrap p-3"
                        style={{ boxSizing: 'border-box' }}
                      >
                        <div className="text-[8px] text-gray-400 whitespace-pre-wrap">
                          <strong>ID:</strong> {annotation.id.split('/').pop()}
                        </div>
                        <div className="whitespace-pre-wrap">
                          <strong>GeoTag:</strong>{' '}
                          {geotag ? (
                            geotag.source.properties?.title ||
                            geotag.source.label
                          ) : (
                            <span className="text-gray-400">
                              not yet defined
                            </span>
                          )}
                        </div>
                        <div>
                          <strong>Type:</strong>{' '}
                          {geotag ? geotag.source.type : 'not yet defined'}
                        </div>
                        {geotag &&
                          (geotag.created || geotag.creator?.label) && (
                            <div className="mt-3 text-xs text-gray-500">
                              {geotag.created && (
                                <>
                                  <strong>Created:</strong>{' '}
                                  {new Date(geotag.created).toLocaleString()}{' '}
                                  <br />
                                </>
                              )}
                              {geotag.creator?.label && (
                                <>by {geotag.creator.label}</>
                              )}
                            </div>
                          )}
                        {linkedIds.length > 0 && (
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center justify-center rounded-full bg-muted text-black p-1"
                                title="Linked Annotations"
                              >
                                <Link2 className="w-4 h-4" />
                              </span>
                              <span className="text-xs text-gray-700 font-semibold">
                                Linked Annotations (reading order):
                              </span>
                            </div>
                            <div className="flex flex-row flex-wrap gap-2 items-center mt-1">
                              {(() => {
                                const linkingAnnos = getLinkingAnnotations(
                                  annotation.id,
                                );
                                let orderedIds: string[] = [];
                                if (
                                  linkingAnnos.length > 0 &&
                                  Array.isArray(linkingAnnos[0].target)
                                ) {
                                  orderedIds = linkingAnnos[0].target;
                                } else {
                                  orderedIds = [annotation.id];
                                }
                                return orderedIds.map((lid, index) => {
                                  const linkedAnno = annotations.find(
                                    (a) => a.id === lid,
                                  );
                                  let label = lid;
                                  if (linkedAnno) {
                                    if (
                                      linkedAnno.motivation === 'iconography' ||
                                      linkedAnno.motivation === 'iconograpy'
                                    ) {
                                      label = 'Icon';
                                    } else if (Array.isArray(linkedAnno.body)) {
                                      const loghiBody = linkedAnno.body.find(
                                        (b: any) =>
                                          b.generator?.label
                                            ?.toLowerCase()
                                            .includes('loghi'),
                                      );
                                      if (loghiBody && loghiBody.value) {
                                        label = loghiBody.value;
                                      } else if (linkedAnno.body[0]?.value) {
                                        label = linkedAnno.body[0].value;
                                      }
                                    }
                                  }
                                  const isCurrent = lid === annotation.id;
                                  const sequenceNumber = index + 1;

                                  return (
                                    <span
                                      key={lid}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                                        isCurrent
                                          ? 'bg-blue-200 text-blue-900 border border-blue-400'
                                          : 'bg-red-100 text-red-800 border border-red-300'
                                      }`}
                                    >
                                      <span
                                        className={`${
                                          isCurrent
                                            ? 'bg-blue-600'
                                            : 'bg-red-600'
                                        } text-white rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold`}
                                      >
                                        {sequenceNumber}
                                      </span>
                                      {label}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <AnnotationLinker
                          annotations={annotations}
                          session={session}
                          currentAnnotationId={annotation.id}
                          onLinkCreated={() => {
                            onRefreshAnnotations?.();
                            setPendingGeotags((prev) => ({
                              ...prev,
                              [annotation.id]: undefined,
                            }));
                            toast({
                              title: 'Success',
                              description: 'Link created successfully.',
                            });
                          }}
                          linkingMode={linkingMode}
                          setLinkingMode={setLinkingMode}
                          selectedIds={selectedIds}
                          setSelectedIds={setSelectedIds}
                          existingLink={(() => {
                            const linkingAnnos = getLinkingAnnotations(
                              annotation.id,
                            );
                            if (linkingAnnos.length > 0) {
                              const linkingAnno = linkingAnnos[0];
                              let etag = linkingAnno.id
                                ? getEtag(linkingAnno.id)
                                : undefined;

                              if (!etag && (linkingAnno as any).etag) {
                                etag = (linkingAnno as any).etag;
                              }

                              return etag
                                ? { ...linkingAnno, etag }
                                : linkingAnno;
                            }
                            return undefined;
                          })()}
                          pendingGeotag={pendingGeotags[annotation.id]}
                          expandedStyle={true}
                          canvasId={canvasId}
                          manifestId={manifestId}
                          onSaveViewport={onSaveViewport}
                          onOptimisticAnnotationAdd={onOptimisticAnnotationAdd}
                        />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnnotationPrepareDelete?.(annotation);
                    }}
                    disabled={!canEdit}
                    aria-label="Delete annotation"
                    className={`ml-4 p-1 ${
                      canEdit
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="h-5 w-5" />
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
