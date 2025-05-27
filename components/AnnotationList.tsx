'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';
import { Progress } from './Progress';
import {
  Trash2,
  ChevronRight,
  ChevronDown,
  GlobeLock,
  Link2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AnnotationLinker } from './AnnotationLinker';
import { useSession } from 'next-auth/react';
import { useAllAnnotations } from '@/hooks/use-all-annotations';

interface AnnotationListProps {
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
}

const GeoTaggingWidget = dynamic(
  () => import('./GeoTaggingWidget').then((mod) => mod.GeoTaggingWidget),
  { ssr: false, loading: () => <LoadingSpinner /> },
);

export function AnnotationList({
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
}: Omit<AnnotationListProps, 'annotations'> & {
  linkingMode?: boolean;
  setLinkingMode?: (v: boolean) => void;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  onLinkCreated?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: session } = useSession();

  const {
    annotations,
    isLoading: hookLoading,
    refresh,
    getEtag,
  } = useAllAnnotations(canvasId);
  isLoading = typeof isLoading === 'boolean' ? isLoading : hookLoading;

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

  const filtered = annotations.filter((a) => {
    const m = a.motivation?.toLowerCase();
    if (m === 'textspotting') return showTextspotting;
    if (m === 'iconography' || m === 'iconograpy') return showIconography;
    return true;
  });

  const displayCount = totalCount ?? filtered.length;

  const getLinkingAnnotations = (annotationId: string) =>
    annotations.filter(
      (a) =>
        a.motivation === 'linking' &&
        Array.isArray(a.target) &&
        a.target.includes(annotationId),
    );
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
    return annotations.find((a) => {
      let targetIds: string[] = [];
      if (typeof a.target === 'string') targetIds = [a.target];
      else if (Array.isArray(a.target)) {
        targetIds = a.target
          .map((t) => (typeof t === 'string' ? t : t?.id))
          .filter(Boolean);
      } else if (a.target && typeof a.target === 'object') {
        targetIds = [a.target.id];
      }
      return a.motivation === 'linking' && targetIds.includes(annotationId);
    });
  };

  const [pendingGeotags, setPendingGeotags] = useState<Record<string, any>>({});

  return (
    <div className="h-full border-l bg-white flex flex-col">
      <div className="px-4 py-2 border-b text-xs text-gray-500 flex space-x-4">
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showTextspotting}
            onChange={() => onFilterChange('textspotting')}
            className="mr-1 accent-[hsl(var(--primary))]"
          />
          <span>Texts (AI)</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showIconography}
            onChange={() => onFilterChange('iconography')}
            className="mr-1 accent-[hsl(var(--secondary))]"
          />
          <span>Icons (AI)</span>
        </label>
      </div>

      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Showing {displayCount} of {annotations.length}
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

              const geotagAnno = annotations.find((a) => {
                let targetIds: string[] = [];
                if (typeof a.target === 'string') {
                  targetIds = [a.target];
                } else if (Array.isArray(a.target)) {
                  targetIds = a.target
                    .map((t) =>
                      typeof t === 'string'
                        ? t
                        : t && typeof t === 'object'
                        ? t.id
                        : undefined,
                    )
                    .filter(Boolean);
                } else if (a.target && typeof a.target === 'object') {
                  targetIds = [a.target.id];
                }
                return (
                  targetIds.includes(annotation.id) &&
                  Array.isArray(a.body) &&
                  a.body.some(
                    (b) =>
                      b.type === 'SpecificResource' &&
                      (b.purpose === 'geotagging' ||
                        b.purpose === 'identifying') &&
                      b.source &&
                      b.source.label &&
                      b.source.id,
                  )
                );
              });
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
                  className={`p-4 flex items-start justify-between hover:bg-gray-50 relative transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
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
                  {isLinked && !isExpanded && (
                    <span
                      className="absolute right-4 top-4 text-blue-500"
                      title="Linked annotation"
                    >
                      <Link2 size={18} />
                    </span>
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
                        className="text-gray-800"
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        strokeWidth={2.2}
                        className="text-gray-800"
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
                            {geotag.source.label}
                          </span>
                        </React.Fragment>
                      )}
                    </div>

                    {isExpanded && (
                      <>
                        <div
                          className="mt-3 bg-gray-50 rounded text-sm space-y-2 break-words whitespace-pre-wrap max-w-none p-2"
                          style={{ boxSizing: 'border-box' }}
                        >
                          <div className="text-[8px] text-gray-400 whitespace-pre-wrap">
                            <strong>ID:</strong>{' '}
                            {annotation.id.split('/').pop()}
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
                        </div>
                        {/* Link Annotations Section */}
                        <div className="mt-4">
                          <AnnotationLinker
                            annotations={annotations}
                            session={session}
                            onLinkCreated={() => {
                              refresh();
                              onRefreshAnnotations?.();
                              setPendingGeotags((prev) => ({
                                ...prev,
                                [annotation.id]: undefined,
                              }));
                            }}
                            linkingMode={linkingMode}
                            setLinkingMode={setLinkingMode}
                            selectedIds={selectedIds}
                            setSelectedIds={setSelectedIds}
                            existingLink={(() => {
                              const geotagAnno = getGeotagAnnoFor(
                                annotation.id,
                              );
                              const etag =
                                geotagAnno && geotagAnno.id
                                  ? getEtag(geotagAnno.id)
                                  : undefined;
                              return geotagAnno && etag
                                ? { ...geotagAnno, etag }
                                : undefined;
                            })()}
                            pendingGeotag={pendingGeotags[annotation.id]}
                            expandedStyle={true}
                          />
                        </div>
                      </>
                    )}
                  </div>

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
