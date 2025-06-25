'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { Loader2, Info, MessageSquare, Map, Images, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CollectionSidebar } from '@/components/CollectionSidebar';
import { TopNavigation } from '@/components/Navbar';
import { StatusBar } from '@/components/StatusBar';
import { normalizeManifest, getManifestCanvases } from '@/lib/iiif-helpers';
import dynamic from 'next/dynamic';
import type { Manifest } from '@/lib/types';
import { ImageViewer } from '@/components/ImageViewer';
import { useAllAnnotations } from '@/hooks/use-all-annotations';
import { AnnotationList } from '@/components/AnnotationList';
import type { Annotation } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/Sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/Dialog';
import { ManifestLoader } from '@/components/ManifestLoader';
import { Footer } from '@/components/Footer';

const AllmapsMap = dynamic(() => import('./AllmapsMap'), { ssr: false });
const MetadataSidebar = dynamic(
  () => import('@/components/MetadataSidebar').then((m) => m.MetadataSidebar),
  { ssr: true },
);

interface ManifestViewerProps {
  showManifestLoader?: boolean;
  onManifestLoaderClose?: () => void;
}

export function ManifestViewer({
  showManifestLoader = false,
  onManifestLoaderClose,
}: ManifestViewerProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const { toast } = useToast();
  const { status } = useSession();
  const canEdit = status === 'authenticated';

  const [currentCanvasIndex, setCurrentCanvasIndex] = useState(0);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'image' | 'annotation' | 'map'>(
    'image',
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

  const [showTextspotting, setShowTextspotting] = useState(true);
  const [showIconography, setShowIconography] = useState(true);

  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const [currentPointSelector, setCurrentPointSelector] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {}, [currentPointSelector]);

  const canvasId = manifest?.items?.[currentCanvasIndex]?.id ?? '';
  const {
    annotations,
    isLoading: isLoadingAnnotations,
    refresh,
    addAnnotation,
    removeAnnotation,
    getEtag,
  } = useAllAnnotations(canvasId);

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<
    'image' | 'annotation' | 'map' | 'gallery' | 'info'
  >('image');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isManifestLoaderOpen, setIsManifestLoaderOpen] =
    useState(showManifestLoader);

  const handleManifestLoaderClose = () => {
    setIsManifestLoaderOpen(false);
    if (onManifestLoaderClose) {
      onManifestLoaderClose();
    }
  };

  const [linkingMode, setLinkingMode] = useState(false);
  const [selectedLinkingIds, setSelectedLinkingIds] = useState<string[]>([]);

  const isAnnotationAlreadyLinked = (annotationId: string) => {
    const annotationExists = localAnnotations.some(
      (a) => a.id === annotationId,
    );
    if (!annotationExists) {
      return false;
    }

    const linkingAnnotations = localAnnotations.filter((a) => {
      if (a.motivation !== 'linking') return false;

      if (Array.isArray(a.target)) {
        return a.target.includes(annotationId);
      } else if (a.target === annotationId) {
        return true;
      }
      return false;
    });

    const validLinkingAnnotations = linkingAnnotations.filter((linkingAnno) => {
      if (!Array.isArray(linkingAnno.target)) return true;

      const allAnnotationIds = new Set(localAnnotations.map((a) => a.id));
      const validTargets = linkingAnno.target.filter((targetId: string) =>
        allAnnotationIds.has(targetId),
      );

      return validTargets.length > 0 && validTargets.includes(annotationId);
    });

    return validLinkingAnnotations.length > 0;
  };

  const getAnnotationDisplayLabel = (
    annotation: any,
    fallbackId?: string,
  ): string => {
    if (!annotation) {
      if (fallbackId) {
        const foundAnno = localAnnotations.find((a) => a.id === fallbackId);
        if (foundAnno) {
          return getAnnotationDisplayLabel(foundAnno);
        }
        return 'Text annotation';
      }
      return 'Unknown annotation';
    }

    if (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    ) {
      return 'Icon annotation';
    }

    let bodies = Array.isArray(annotation.body) ? annotation.body : [];

    if (bodies.length > 0) {
      const loghiBody = bodies.find((b: any) =>
        b.generator?.label?.toLowerCase().includes('loghi'),
      );
      if (loghiBody && loghiBody.value) {
        return `"${loghiBody.value}" (textspotting)`;
      }

      if (bodies[0]?.value) {
        const textContent = bodies[0].value;
        const contentPreview =
          textContent.length > 30
            ? textContent.substring(0, 30) + '...'
            : textContent;

        const isAutomated = bodies.some(
          (b: any) => b.generator?.label || b.generator?.name,
        );

        const typeLabel = isAutomated ? 'automated text' : 'human annotation';
        return `"${contentPreview}" (${typeLabel})`;
      }
    }

    return 'Text annotation';
  };
  const handleSelectedIdsChange = (newIds: string[]) => {
    const addedIds = newIds.filter((id) => !selectedLinkingIds.includes(id));

    for (const id of addedIds) {
      if (isAnnotationAlreadyLinked(id)) {
        const conflictingAnnotation = localAnnotations.find((a) => a.id === id);
        const displayLabel = getAnnotationDisplayLabel(
          conflictingAnnotation,
          id,
        );
        const annotationType =
          conflictingAnnotation?.motivation || 'annotation';

        toast({
          title: 'Cannot select annotation',
          description: `"${displayLabel}" (${annotationType}) is already linked in another linking annotation. Each annotation can only be part of one link.`,
        });

        return;
      }
    }

    setSelectedLinkingIds(newIds);
  };

  const [savedViewport, setSavedViewport] = useState<any>(null);
  const imageViewerRef = useRef<any>(null);

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    if (!linkingMode) {
      setSelectedAnnotationId(null);
    }
  }, [currentCanvasIndex, viewMode, linkingMode]);

  const logAnnotationSummary = () => {
    const iconographyAnnotations = localAnnotations.filter(
      (a) => a.motivation === 'iconography' || a.motivation === 'iconograpy',
    );
    const textspottingAnnotations = localAnnotations.filter(
      (a) => a.motivation === 'textspotting',
    );
    const linkingAnnotations = localAnnotations.filter(
      (a) => a.motivation === 'linking',
    );
    const otherAnnotations = localAnnotations.filter(
      (a) =>
        a.motivation !== 'iconography' &&
        a.motivation !== 'iconograpy' &&
        a.motivation !== 'textspotting' &&
        a.motivation !== 'linking',
    );
  };

  const handleSetLinkingMode = (enable: boolean) => {
    setLinkingMode(enable);

    if (enable) {
      logAnnotationSummary();

      if (selectedAnnotationId) {
        setSelectedLinkingIds((prev) =>
          prev.includes(selectedAnnotationId)
            ? prev
            : [...prev, selectedAnnotationId],
        );
      }
    } else {
      setSelectedLinkingIds([]);
    }
  };

  async function loadManifest() {
    setIsLoadingManifest(true);
    setManifestError(null);

    try {
      const res = await fetch('/api/manifest');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const normalizedData = normalizeManifest(data);
      setManifest(normalizedData);
      toast({ title: 'Manifest loaded', description: data.label?.en?.[0] });
    } catch {
      try {
        const res = await fetch(
          'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const normalizedData = normalizeManifest(data);
        setManifest(normalizedData);
        toast({
          title: 'Static manifest loaded',
          description: data.label?.en?.[0],
        });
      } catch (err: any) {
        const msg = err?.message || 'Unknown error';
        setManifestError(msg);
        toast({
          title: 'Failed to load manifest',
          description: msg,
        });
      }
    } finally {
      setIsLoadingManifest(false);
    }
  }

  useEffect(() => {
    loadManifest();
  }, []);

  const onFilterChange = (mot: 'textspotting' | 'iconography') => {
    if (mot === 'textspotting') setShowTextspotting((v) => !v);
    else setShowIconography((v) => !v);
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

  const handleDelete = async (annotation: Annotation) => {
    const annoName = annotation.id.split('/').pop()!;
    removeAnnotation(annotation.id);
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
      toast({ title: 'Annotation deleted' });
    } catch (err: any) {
      addAnnotation(annotation);
      setLocalAnnotations((prev) => [...prev, annotation]);
      toast({ title: 'Delete failed', description: err.message });
    }
  };

  const handleOptimisticAnnotationAdd = (anno: Annotation) => {
    addAnnotation(anno);

    setLocalAnnotations((prev) => {
      if (prev.some((a) => a.id === anno.id)) {
        return prev;
      }
      return [...prev, anno];
    });

    setTimeout(() => {
      refresh();
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TopNavigation
        manifest={manifest}
        onToggleLeftSidebar={() => setIsLeftSidebarVisible((p) => !p)}
        onToggleRightSidebar={() => setIsRightSidebarVisible((p) => !p)}
        onOpenManifestLoader={() => setIsManifestLoaderOpen(true)}
      />

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
                currentCanvas && (
                  <ImageViewer
                    manifest={manifest}
                    currentCanvas={currentCanvasIndex}
                    annotations={localAnnotations}
                    selectedAnnotationId={selectedAnnotationId}
                    onAnnotationSelect={
                      linkingMode ? undefined : setSelectedAnnotationId
                    }
                    onViewerReady={(viewer) => {
                      if (typeof window !== 'undefined') {
                        (window as any).osdViewer = viewer;
                      }
                    }}
                    showTextspotting={showTextspotting}
                    showIconography={showIconography}
                    linkingMode={linkingMode}
                    selectedIds={selectedLinkingIds}
                    onSelectedIdsChange={handleSelectedIdsChange}
                    showAnnotations={viewMode === 'annotation'}
                    currentPointSelector={currentPointSelector}
                  />
                )}
              {viewMode === 'map' && (
                <AllmapsMap
                  manifest={manifest}
                  currentCanvas={currentCanvasIndex}
                />
              )}
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
                      onChange={setManifest}
                      annotations={localAnnotations}
                      isLoadingAnnotations={isLoadingAnnotations}
                      onRefreshAnnotations={refresh}
                    />
                  )}
                  {viewMode === 'annotation' && (
                    <AnnotationList
                      annotations={localAnnotations}
                      canvasId={canvasId}
                      manifestId={manifest?.id}
                      isLoading={isLoadingAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      onAnnotationSelect={setSelectedAnnotationId}
                      showTextspotting={showTextspotting}
                      showIconography={showIconography}
                      onFilterChange={onFilterChange}
                      onAnnotationPrepareDelete={
                        canEdit ? handleDelete : undefined
                      }
                      canEdit={canEdit}
                      linkingMode={linkingMode}
                      setLinkingMode={handleSetLinkingMode}
                      selectedIds={selectedLinkingIds}
                      setSelectedIds={setSelectedLinkingIds}
                      onLinkCreated={() => {
                        setLinkingMode(false);
                        setSelectedLinkingIds([]);
                      }}
                      onRefreshAnnotations={refresh}
                      onSaveViewport={setSavedViewport}
                      onOptimisticAnnotationAdd={handleOptimisticAnnotationAdd}
                      onCurrentPointSelectorChange={setCurrentPointSelector}
                      onAnnotationInLinkingMode={(annotationId) => {
                        if (annotationId) {
                          setLinkingMode(true);
                        } else {
                          setLinkingMode(false);
                        }
                      }}
                      getEtag={getEtag}
                    />
                  )}
                  {viewMode === 'map' && (
                    <MetadataSidebar
                      manifest={manifest}
                      currentCanvas={currentCanvasIndex}
                      activeTab="geo"
                      onChange={setManifest}
                      annotations={localAnnotations}
                      isLoadingAnnotations={isLoadingAnnotations}
                      onRefreshAnnotations={refresh}
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
                  onAnnotationSelect={
                    linkingMode ? undefined : setSelectedAnnotationId
                  }
                  onViewerReady={() => {}}
                  showTextspotting={showTextspotting}
                  showIconography={showIconography}
                  linkingMode={linkingMode}
                  selectedIds={selectedLinkingIds}
                  onSelectedIdsChange={handleSelectedIdsChange}
                  showAnnotations={mobileView === 'annotation'}
                />
              )}
            {mobileView === 'map' && !isGalleryOpen && !isInfoOpen && (
              <AllmapsMap
                manifest={manifest}
                currentCanvas={currentCanvasIndex}
              />
            )}
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
                  onCanvasSelect={(idx) => {
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
                onChange={setManifest}
                annotations={localAnnotations}
                isLoadingAnnotations={isLoadingAnnotations}
                onRefreshAnnotations={refresh}
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load IIIF Manifest</DialogTitle>
            <DialogDescription>
              Load a different IIIF manifest to view and work with.
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
