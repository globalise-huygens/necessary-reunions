/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import type { Annotation, Manifest } from '@/lib/types';
import { Image, Images, Info, Loader2, Map, MessageSquare } from 'lucide-react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TopNavigation } from '../../components/Navbar';
import { Button } from '../../components/shared/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/shared/Dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/shared/Sheet';
import { StatusBar } from '../../components/StatusBar';
import { AnnotationList } from '../../components/viewer/AnnotationList';
import { CollectionSidebar } from '../../components/viewer/CollectionSidebar';
import { ImageViewer } from '../../components/viewer/ImageViewer';
import { ManifestLoader } from '../../components/viewer/ManifestLoader';
import { MetadataSidebar } from '../../components/viewer/MetadataSidebar';
import { useAllAnnotations } from '../../hooks/use-all-annotations';
import { useGlobalLinkingAnnotations } from '../../hooks/use-global-linking-annotations';
import { useIsMobile } from '../../hooks/use-mobile';
import { useToast } from '../../hooks/use-toast';
import {
  getManifestCanvases,
  isImageCanvas,
  mergeLocalAnnotations,
  normalizeManifest,
} from '../../lib/viewer/iiif-helpers';

const allmapsMap = dynamic(() => import('./AllmapsMap'), { ssr: false });

interface ManifestViewerProps {
  showManifestLoader?: boolean;
  onManifestLoaderClose?: () => void;
}

export function ManifestViewer({
  showManifestLoader = false,
  onManifestLoaderClose,
}: ManifestViewerProps) {
  useEffect(() => {}, []);

  if (typeof window !== 'undefined') {
  }

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [currentCanvasIndex, setCurrentCanvasIndex] = useState(0);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'image' | 'annotation' | 'map'>(
    'image',
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [preserveViewport, setPreserveViewport] = useState(false);
  const [savedViewportState, setSavedViewportState] = useState<{
    center: any;
    zoom: number;
    bounds: any;
  } | null>(null);
  const [annotationBeingSaved, setAnnotationBeingSaved] = useState<
    string | null
  >(null);
  const [showAITextspotting, setShowAITextspotting] = useState(true);
  const [showAIIconography, setShowAIIconography] = useState(true);
  const [showHumanTextspotting, setShowHumanTextspotting] = useState(true);
  const [showHumanIconography, setShowHumanIconography] = useState(true);
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const [mobileView, setMobileView] = useState<
    'image' | 'annotation' | 'map' | 'gallery' | 'info'
  >('image');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isManifestLoaderOpen, setIsManifestLoaderOpen] =
    useState(showManifestLoader);
  const [manifestLoadedToast, setManifestLoadedToast] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [manifestErrorToast, setManifestErrorToast] = useState<string | null>(
    null,
  );
  const [annotationToast, setAnnotationToast] = useState<{
    title: string;
    description?: string;
  } | null>(null);

  const [isPointSelectionMode, setIsPointSelectionMode] = useState(false);
  const [currentDisplayPoint, setCurrentDisplayPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [linkedAnnotationsOrder, setLinkedAnnotationsOrder] = useState<
    string[]
  >([]);
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [selectedAnnotationsForLinking, setSelectedAnnotationsForLinking] =
    useState<string[]>([]);
  const [selectedPointLinkingId, setSelectedPointLinkingId] = useState<
    string | null
  >(null);
  const activePointSelectionHandlerRef = useRef<
    ((point: { x: number; y: number }) => void) | null
  >(null);

  const { toast: rawToast } = useToast();
  const { status } = useSession();
  const canEdit = status === 'authenticated';
  const canvasId = useMemo(() => {
    if (!manifest) {
      return '';
    }

    const canvases = getManifestCanvases(manifest);
    const canvas = canvases?.[currentCanvasIndex];
    const id = canvas?.id ?? '';

    return id;
  }, [manifest, currentCanvasIndex]);

  const { annotations, isLoading: isLoadingAnnotations } =
    useAllAnnotations(canvasId);

  const refreshAnnotations = useCallback(async () => {
    if (!canvasId) return;

    const { fetchAnnotations } = await import('../../lib/viewer/annoRepo');

    const all: Annotation[] = [];
    let page = 0;
    let more = true;

    while (more) {
      try {
        const { items, hasMore } = await fetchAnnotations({
          targetCanvasId: canvasId,
          page,
        });
        all.push(...items);
        more = hasMore;
        page++;
      } catch {
        break;
      }
    }

    try {
      const localResponse = await fetch('/api/annotations/local');
      if (localResponse.ok) {
        const { annotations: fetchedLocalAnnotations } =
          await localResponse.json();
        if (Array.isArray(fetchedLocalAnnotations)) {
          const canvasLocalAnnotations = fetchedLocalAnnotations.filter(
            (annotation: any) => {
              const targetSource =
                annotation.target?.source?.id || annotation.target?.source;
              return targetSource === canvasId;
            },
          );
          all.push(...canvasLocalAnnotations);
        }
      }
    } catch {}

    setLocalAnnotations(all);
  }, [canvasId]);

  const { getAnnotationsForCanvas, refetch: refetchGlobalLinking } =
    useGlobalLinkingAnnotations();

  const canvasLinkingAnnotations = getAnnotationsForCanvas(canvasId);

  const effectiveLinkingAnnotations = canvasLinkingAnnotations;

  useEffect(() => {
    if (canvasId && manifest) {
      refetchGlobalLinking();
    }
  }, [canvasId, manifest, refetchGlobalLinking]);

  const isMobile = useIsMobile();

  const isMounted = useRef(false);
  const isToastReady = useRef(false);
  const viewerRef = useRef<any>(null);
  const [viewerReady, setViewerReady] = useState(false);

  const handleViewerReady = useCallback(
    (viewer: any) => {
      viewerRef.current = viewer;
      setViewerReady(true);
    },
    [canvasId],
  );

  useEffect(() => {
    setViewerReady(false);
  }, [canvasId]);

  const safeToast = React.useCallback(
    (props: Parameters<typeof rawToast>[0]) => {
      if (isMounted.current && isToastReady.current) {
        try {
          return rawToast(props);
        } catch {}
      }
    },
    [rawToast],
  );

  const handleAnnotationSelect = useCallback(
    (annotationId: string) => {
      React.startTransition(() => {
        setSelectedAnnotationId(annotationId);

        if (selectedAnnotationId !== annotationId) {
          setPreserveViewport(false);
          setSavedViewportState(null);
          setAnnotationBeingSaved(null);

          setIsLinkingMode(false);
          setSelectedAnnotationsForLinking([]);
          setSelectedPointLinkingId(null);
          setLinkedAnnotationsOrder([]);
        }
      });
    },
    [selectedAnnotationId],
  );

  useEffect(() => {
    if (!selectedAnnotationId) {
      setCurrentDisplayPoint(null);
    }
  }, [selectedAnnotationId]);

  useEffect(() => {
    isMounted.current = true;
    setTimeout(() => {
      isToastReady.current = true;
    }, 200);
    return () => {
      isMounted.current = false;
      isToastReady.current = false;
    };
  }, []);

  const handleManifestLoaderClose = () => {
    setIsManifestLoaderOpen(false);
    if (onManifestLoaderClose) {
      onManifestLoaderClose();
    }
  };

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations, canvasId]);

  useEffect(() => {
    setSelectedAnnotationId(null);
  }, [currentCanvasIndex, viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadManifest().catch(() => {
        // Error handled in loadManifest
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  async function loadManifest() {
    setIsLoadingManifest(true);
    setManifestError(null);

    try {
      // EMERGENCY FIX: Use GitHub Pages directly to bypass 404 API issues
      const MANIFEST_URL =
        'https://globalise-huygens.github.io/necessary-reunions/manifest.json';

      const res = await fetch(MANIFEST_URL);
      if (!res.ok) {
        const fallbackData = {
          '@context': 'http://iiif.io/api/presentation/3/context.json',
          id: 'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
          type: 'Manifest',
          label: { en: ['Necessary Reunions (Direct Load)'] },
          items: [],
        };
        const enrichedData = await mergeLocalAnnotations(fallbackData);
        setManifest(enrichedData);
        return;
      }

      const data = await res.json();

      const normalizedData = normalizeManifest(data);
      const enrichedData = await mergeLocalAnnotations(normalizedData);

      setManifest(enrichedData);

      if (isMounted.current) {
        requestAnimationFrame(() => {
          if (isMounted.current) {
            setManifestLoadedToast({
              title: 'Manifest loaded',
              description: data.label?.en?.[0],
            });
          }
        });
      }
    } catch {
      try {
        const res = await fetch(
          'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const normalizedData = normalizeManifest(data);

        const enrichedData = await mergeLocalAnnotations(normalizedData);

        setManifest(enrichedData);

        if (isMounted.current) {
          requestAnimationFrame(() => {
            if (isMounted.current) {
              setManifestLoadedToast({
                title: 'Static manifest loaded',
                description: data.label?.en?.[0],
              });
            }
          });
        }
      } catch (err: any) {
        const msg = err?.message || 'Unknown error';
        if (isMounted.current) {
          setManifestError(msg);
          requestAnimationFrame(() => {
            if (isMounted.current) {
              setManifestErrorToast(msg);
            }
          });
        }
      }
    } finally {
      setIsLoadingManifest(false);
    }
  }

  useEffect(() => {
    if (manifestLoadedToast && isMounted.current && isToastReady.current) {
      const scheduleToast = () => {
        if (isMounted.current) {
          safeToast({
            title: manifestLoadedToast.title,
            description: manifestLoadedToast.description,
          });
          setManifestLoadedToast(null);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(scheduleToast);
        return () => window.cancelIdleCallback(handle);
      } else {
        const timer = setTimeout(scheduleToast, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [manifestLoadedToast, safeToast]);

  useEffect(() => {
    if (manifestErrorToast && isMounted.current && isToastReady.current) {
      const scheduleToast = () => {
        if (isMounted.current) {
          safeToast({
            title: 'Failed to load manifest',
            description: manifestErrorToast,
          });
          setManifestErrorToast(null);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(scheduleToast);
        return () => window.cancelIdleCallback(handle);
      } else {
        const timer = setTimeout(scheduleToast, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [manifestErrorToast, safeToast]);

  useEffect(() => {
    if (annotationToast && isMounted.current && isToastReady.current) {
      const scheduleToast = () => {
        if (isMounted.current) {
          safeToast({
            title: annotationToast.title,
            description: annotationToast.description,
          });
          setAnnotationToast(null);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(scheduleToast);
        return () => window.cancelIdleCallback(handle);
      } else {
        const timer = setTimeout(scheduleToast, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [annotationToast, safeToast]);

  const onFilterChange = (
    filterType: 'ai-text' | 'ai-icons' | 'human-text' | 'human-icons',
  ) => {
    switch (filterType) {
      case 'ai-text':
        setShowAITextspotting((v) => !v);
        break;
      case 'ai-icons':
        setShowAIIconography((v) => !v);
        break;
      case 'human-text':
        setShowHumanTextspotting((v) => !v);
        break;
      case 'human-icons':
        setShowHumanIconography((v) => !v);
        break;
      default:
        break;
    }
  };

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow border space-y-4">
          <h2 className="text-xl font-semibold text-center">
            Loading Manifest
          </h2>
          {manifestError && <p className="text-red-500">{manifestError}</p>}
          {isLoadingManifest ? (
            <Loader2 className="animate-spin text-primary mx-auto" />
          ) : (
            <Button onClick={loadManifest}>Retry</Button>
          )}
        </div>
      </div>
    );
  }

  const currentCanvas = getManifestCanvases(manifest)?.[currentCanvasIndex];

  const handleDelete = async (annotationId: string) => {
    const annotation = localAnnotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    const annoName = annotation.id.split('/').pop()!;
    setLocalAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    try {
      const res = await fetch(
        `/api/annotations/${encodeURIComponent(annoName)}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status}`);
      }
      setAnnotationToast({ title: 'Annotation deleted' });
    } catch (err: any) {
      setLocalAnnotations((prev) => [...prev, annotation]);
      setAnnotationToast({ title: 'Delete failed', description: err.message });
    }
  };
  const handleAnnotationSaveStart = (annotationId: string) => {
    if (viewerRef.current?.getCurrentViewportState) {
      const currentState = viewerRef.current.getCurrentViewportState();
      setSavedViewportState(currentState);
    }
    setAnnotationBeingSaved(annotationId);
    setPreserveViewport(true);
  };
  const handleAnnotationUpdate = async (updatedAnnotation: Annotation) => {
    setAnnotationBeingSaved(updatedAnnotation.id);

    try {
      const response = await fetch(
        `/api/annotations/${encodeURIComponent(updatedAnnotation.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedAnnotation),
        },
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const savedAnnotation = await response.json();

      setLocalAnnotations((prev) =>
        prev.map((a) => (a.id === updatedAnnotation.id ? savedAnnotation : a)),
      );

      setAnnotationToast({
        title: 'Annotation updated',
        description: 'Changes saved successfully',
      });

      if (
        annotationBeingSaved === updatedAnnotation.id &&
        savedViewportState &&
        viewerRef.current?.restoreViewportState
      ) {
        setTimeout(() => {
          if (viewerRef.current?.restoreViewportState && savedViewportState) {
            viewerRef.current.restoreViewportState(savedViewportState);
            setSavedViewportState(null);
            setPreserveViewport(false);
            setAnnotationBeingSaved(null);
          }
        }, 100);
      } else {
        setTimeout(() => {
          setPreserveViewport(false);
          setSavedViewportState(null);
          setAnnotationBeingSaved(null);
        }, 500);
      }
    } catch {
      setAnnotationToast({
        title: 'Error updating annotation',
        description: 'Failed to save changes',
      });

      setTimeout(() => {
        setPreserveViewport(false);
        setSavedViewportState(null);
        setAnnotationBeingSaved(null);
      }, 500);
    }
  };
  const handleNewAnnotation = (newAnnotation: Annotation) => {
    setLocalAnnotations((prev) => [...prev, newAnnotation]);

    setSelectedAnnotationId(null);

    setPreserveViewport(false);
    setSavedViewportState(null);
    setAnnotationBeingSaved(null);

    setAnnotationToast({
      title: 'Annotation created',
      description: 'New annotation added successfully',
    });

    setTimeout(() => {
      handleAnnotationSelect(newAnnotation.id);
    }, 200);
  };

  const handlePointSelect = (point: { x: number; y: number }) => {
    if (activePointSelectionHandlerRef.current) {
      activePointSelectionHandlerRef.current(point);
    } else {
    }
  };

  const handleEnablePointSelection = (
    handler: (point: { x: number; y: number }) => void,
  ) => {
    setIsPointSelectionMode(true);
    activePointSelectionHandlerRef.current = handler;
  };

  const handleDisablePointSelection = () => {
    setIsPointSelectionMode(false);
    activePointSelectionHandlerRef.current = null;
  };

  const handlePointChange = (point: { x: number; y: number } | null) => {
    setCurrentDisplayPoint(point);
  };

  const handlePointClick = (linkingAnnotationId: string) => {
    setSelectedPointLinkingId(linkingAnnotationId);
    setSelectedAnnotationId(linkingAnnotationId);
  };

  const handleEnableLinkingMode = () => {
    setIsLinkingMode(true);
    const initialSelection = selectedAnnotationId ? [selectedAnnotationId] : [];
    setSelectedAnnotationsForLinking(initialSelection);
  };

  const handleDisableLinkingMode = () => {
    setIsLinkingMode(false);
    setSelectedAnnotationsForLinking([]);
  };

  const handleAnnotationAddToLinking = (annotationId: string) => {
    setSelectedAnnotationsForLinking((prev) => {
      if (!prev.includes(annotationId)) {
        return [...prev, annotationId];
      }
      return prev;
    });
  };

  const handleAnnotationRemoveFromLinking = (annotationId: string) => {
    setSelectedAnnotationsForLinking((prev) =>
      prev.filter((id) => id !== annotationId),
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TopNavigation
        manifest={manifest}
        onToggleLeftSidebar={() => setIsLeftSidebarVisible((p) => !p)}
        onToggleRightSidebar={() => setIsRightSidebarVisible((p) => !p)}
        onOpenManifestLoader={() => setIsManifestLoaderOpen(true)}
      />

      {/* Desktop layout */}
      {!isMobile && (
        <>
          <div className="flex-1 flex overflow-hidden">
            {isLeftSidebarVisible && (
              <div className="w-64 border-r flex flex-col overflow-hidden">
                <CollectionSidebar
                  manifest={manifest}
                  currentCanvas={currentCanvasIndex}
                  onCanvasSelect={setCurrentCanvasIndex}
                />
              </div>
            )}

            <div className="flex-1 relative overflow-hidden">
              {(viewMode === 'image' || viewMode === 'annotation') &&
                currentCanvas &&
                isImageCanvas(currentCanvas) && (
                  <ImageViewer
                    manifest={manifest}
                    currentCanvas={currentCanvasIndex}
                    annotations={localAnnotations}
                    selectedAnnotationId={selectedAnnotationId}
                    onAnnotationSelect={handleAnnotationSelect}
                    onViewerReady={handleViewerReady}
                    onNewAnnotation={handleNewAnnotation}
                    onAnnotationUpdate={handleAnnotationUpdate}
                    showAITextspotting={showAITextspotting}
                    showAIIconography={showAIIconography}
                    showHumanTextspotting={showHumanTextspotting}
                    showHumanIconography={showHumanIconography}
                    viewMode={viewMode}
                    preserveViewport={preserveViewport}
                    isPointSelectionMode={isPointSelectionMode}
                    onPointSelect={
                      isPointSelectionMode ? handlePointSelect : undefined
                    }
                    selectedPoint={currentDisplayPoint}
                    linkedAnnotationsOrder={linkedAnnotationsOrder}
                    linkingAnnotations={effectiveLinkingAnnotations}
                    isLinkingMode={isLinkingMode}
                    selectedAnnotationsForLinking={
                      selectedAnnotationsForLinking
                    }
                    onAnnotationAddToLinking={handleAnnotationAddToLinking}
                    onAnnotationRemoveFromLinking={
                      handleAnnotationRemoveFromLinking
                    }
                    selectedPointLinkingId={selectedPointLinkingId}
                    onPointClick={handlePointClick}
                    onRefreshAnnotations={refreshAnnotations}
                  />
                )}

              {viewMode === 'map' &&
                React.createElement(allmapsMap, {
                  manifest,
                  currentCanvas: currentCanvasIndex,
                })}
            </div>

            {isRightSidebarVisible && (
              <div className="w-80 border-l flex flex-col overflow-hidden">
                <div className="flex border-b">
                  <Button
                    variant={viewMode === 'image' ? 'default' : 'ghost'}
                    className="flex-1 h-10"
                    onClick={() => setViewMode('image')}
                  >
                    <Info className="h-4 w-4 mr-1" /> Info
                  </Button>
                  <Button
                    variant={viewMode === 'annotation' ? 'default' : 'ghost'}
                    className="flex-1 h-10"
                    onClick={() => setViewMode('annotation')}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> Annotations
                  </Button>
                  <Button
                    variant={viewMode === 'map' ? 'default' : 'ghost'}
                    className="flex-1 h-10"
                    onClick={() => setViewMode('map')}
                  >
                    <Map className="h-4 w-4 mr-1" /> Map
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  {viewMode === 'image' && (
                    <MetadataSidebar
                      manifest={manifest}
                      currentCanvas={currentCanvasIndex}
                      activeTab="metadata"
                    />
                  )}
                  {viewMode === 'annotation' && (
                    <AnnotationList
                      annotations={localAnnotations}
                      isLoading={isLoadingAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      onAnnotationSelect={handleAnnotationSelect}
                      showAITextspotting={showAITextspotting}
                      showAIIconography={showAIIconography}
                      showHumanTextspotting={showHumanTextspotting}
                      showHumanIconography={showHumanIconography}
                      onFilterChange={onFilterChange}
                      onAnnotationPrepareDelete={
                        canEdit ? handleDelete : undefined
                      }
                      onAnnotationUpdate={
                        canEdit ? handleAnnotationUpdate : undefined
                      }
                      onAnnotationSaveStart={
                        canEdit ? handleAnnotationSaveStart : undefined
                      }
                      canEdit={canEdit}
                      canvasId={canvasId}
                      onEnablePointSelection={handleEnablePointSelection}
                      onDisablePointSelection={handleDisablePointSelection}
                      onPointChange={handlePointChange}
                      onLinkedAnnotationsOrderChange={setLinkedAnnotationsOrder}
                      linkedAnnotationsOrder={linkedAnnotationsOrder}
                      isLinkingMode={isLinkingMode}
                      selectedAnnotationsForLinking={
                        selectedAnnotationsForLinking
                      }
                      onEnableLinkingMode={handleEnableLinkingMode}
                      onDisableLinkingMode={handleDisableLinkingMode}
                      onRefreshAnnotations={() => {
                        setSelectedPointLinkingId(null);
                        setIsPointSelectionMode(false);
                        refetchGlobalLinking();
                      }}
                      isPointSelectionMode={isPointSelectionMode}
                      viewer={viewerReady ? viewerRef.current : null}
                    />
                  )}
                  {viewMode === 'map' && (
                    <MetadataSidebar
                      manifest={manifest}
                      currentCanvas={currentCanvasIndex}
                      activeTab="geo"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <StatusBar
            manifest={manifest}
            currentCanvas={currentCanvasIndex}
            totalCanvases={getManifestCanvases(manifest).length}
            onCanvasChange={setCurrentCanvasIndex}
            viewMode={viewMode === 'annotation' ? undefined : viewMode}
          />
        </>
      )}

      {/* Mobile layout */}
      {isMobile && (
        <>
          <div
            className="relative pb-14"
            style={{ height: 'calc(100vh - 3.5rem)', minHeight: 0 }}
          >
            {(mobileView === 'image' || mobileView === 'annotation') &&
              currentCanvas && (
                <ImageViewer
                  manifest={manifest}
                  currentCanvas={currentCanvasIndex}
                  annotations={localAnnotations}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationSelect={handleAnnotationSelect}
                  onViewerReady={handleViewerReady}
                  onNewAnnotation={handleNewAnnotation}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  showAITextspotting={showAITextspotting}
                  showAIIconography={showAIIconography}
                  showHumanTextspotting={showHumanTextspotting}
                  showHumanIconography={showHumanIconography}
                  viewMode={mobileView}
                  preserveViewport={preserveViewport}
                  isPointSelectionMode={isPointSelectionMode}
                  onPointSelect={
                    isPointSelectionMode ? handlePointSelect : undefined
                  }
                  selectedPoint={currentDisplayPoint}
                  linkedAnnotationsOrder={linkedAnnotationsOrder}
                  linkingAnnotations={effectiveLinkingAnnotations}
                  isLinkingMode={isLinkingMode}
                  selectedAnnotationsForLinking={selectedAnnotationsForLinking}
                  onAnnotationAddToLinking={handleAnnotationAddToLinking}
                  onAnnotationRemoveFromLinking={
                    handleAnnotationRemoveFromLinking
                  }
                  selectedPointLinkingId={selectedPointLinkingId}
                  onPointClick={handlePointClick}
                />
              )}
            {mobileView === 'map' &&
              !isGalleryOpen &&
              !isInfoOpen &&
              React.createElement(allmapsMap, {
                manifest,
                currentCanvas: currentCanvasIndex,
              })}
          </div>

          {/* Gallery Sheet */}
          <Sheet open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[80vh] mb-14 p-0 flex flex-col overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle className="ml-3 mt-2">Gallery</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <CollectionSidebar
                  manifest={manifest}
                  currentCanvas={currentCanvasIndex}
                  onCanvasSelect={(idx: number) => {
                    setCurrentCanvasIndex(idx);
                    setIsGalleryOpen(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Info Sheet */}
          <Sheet open={isInfoOpen} onOpenChange={setIsInfoOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[90vh] overflow-y-auto p-0 mb-14"
            >
              <SheetHeader>
                <SheetTitle className="ml-3 mt-2">Info</SheetTitle>
              </SheetHeader>
              <MetadataSidebar
                manifest={manifest}
                currentCanvas={currentCanvasIndex}
                activeTab={mobileView === 'map' ? 'geo' : 'metadata'}
              />
            </SheetContent>
          </Sheet>

          {/* Mobile Bottom NavBar */}
          <nav className="fixed bottom-0 left-0 right-0 z-[120] bg-white border-t flex justify-around h-14 w-full">
            <button
              className="flex flex-col items-center justify-center flex-1 text-xs"
              onClick={() => setIsGalleryOpen(true)}
            >
              <Images className="h-6 w-6 mb-0.5" />
              Gallery
            </button>
            <button
              className={`flex flex-col items-center justify-center flex-1 text-xs ${
                mobileView === 'image' ? 'text-primary' : ''
              }`}
              onClick={() => setMobileView('image')}
            >
              <Image className="h-6 w-6 mb-0.5" />
              Image
            </button>
            <button
              className={`flex flex-col items-center justify-center flex-1 text-xs ${
                mobileView === 'annotation' ? 'text-primary' : ''
              }`}
              onClick={() => setMobileView('annotation')}
            >
              <MessageSquare className="h-6 w-6 mb-0.5" />
              Anno
            </button>
            <button
              className={`flex flex-col items-center justify-center flex-1 text-xs ${
                mobileView === 'map' ? 'text-primary' : ''
              }`}
              onClick={() => setMobileView('map')}
            >
              <Map className="h-6 w-6 mb-0.5" />
              Map
            </button>
            <button
              className="flex flex-col items-center justify-center flex-1 text-xs"
              onClick={() => setIsInfoOpen(true)}
            >
              <Info className="h-6 w-6 mb-0.5" />
              Info
            </button>
          </nav>
        </>
      )}

      {/* Manifest Loader Dialog */}
      <Dialog
        open={isManifestLoaderOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleManifestLoaderClose();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary font-heading">
              Load IIIF Manifest
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Load a different IIIF image manifest to view and work with.
            </DialogDescription>
          </DialogHeader>
          <ManifestLoader
            currentManifest={manifest}
            onManifestLoad={(newManifest) => {
              const normalizedManifest = normalizeManifest(newManifest);
              setManifest(normalizedManifest);
              setCurrentCanvasIndex(0);
              setSelectedAnnotationId(null);
              handleManifestLoaderClose();
            }}
            onClose={handleManifestLoaderClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
