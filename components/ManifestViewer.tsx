'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { Loader2, Info, MessageSquare, Map, Images, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CollectionSidebar } from '@/components/CollectionSidebar';
import { TopNavigation } from '@/components/Navbar';
import { StatusBar } from '@/components/StatusBar';
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
import { Footer } from '@/components/Footer';

const AllmapsMap = dynamic(() => import('./AllmapsMap'), { ssr: false });
const MetadataSidebar = dynamic(
  () => import('@/components/MetadataSidebar').then((m) => m.MetadataSidebar),
  { ssr: true },
);

export function ManifestViewer() {
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

  const [linkingMode, setLinkingMode] = useState(false);
  const [selectedLinkingIds, setSelectedLinkingIds] = useState<string[]>([]);

  const [savedViewport, setSavedViewport] = useState<any>(null);
  const imageViewerRef = useRef<any>(null);

  useEffect(() => {
    console.log('[ManifestViewer] Annotations updated:', annotations.length);
    setLocalAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    if (!linkingMode) {
      setSelectedAnnotationId(null);
    }
  }, [currentCanvasIndex, viewMode, linkingMode]);

  const handleSetLinkingMode = (enable: boolean) => {
    setLinkingMode(enable);
    if (enable && selectedAnnotationId) {
      setSelectedLinkingIds((prev) =>
        prev.includes(selectedAnnotationId)
          ? prev
          : [...prev, selectedAnnotationId],
      );
    }
  };

  useEffect(() => {
    if (linkingMode && selectedAnnotationId) {
      setSelectedLinkingIds((prev) =>
        prev.includes(selectedAnnotationId)
          ? prev
          : [...prev, selectedAnnotationId],
      );
    }
  }, [linkingMode, selectedAnnotationId]);

  async function loadManifest() {
    setIsLoadingManifest(true);
    setManifestError(null);

    try {
      const res = await fetch('/api/manifest');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setManifest(data);
      toast({ title: 'Manifest loaded', description: data.label?.en?.[0] });
    } catch {
      try {
        const res = await fetch(
          'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setManifest(data);
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

  const currentCanvas = manifest.items[currentCanvasIndex];

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
    console.log('[ManifestViewer] Adding annotation optimistically:', anno.id);
    // Add to the hook's internal state
    addAnnotation(anno);

    // Update local state for UI reactivity
    setLocalAnnotations((prev) => {
      if (prev.some((a) => a.id === anno.id)) {
        console.log(
          '[ManifestViewer] Annotation already exists in local state',
        );
        return prev;
      }
      console.log('[ManifestViewer] Adding annotation to local state');
      return [...prev, anno];
    });

    // Ensure changes propagate by triggering a refresh after a short delay
    // This helps with cases where components might not re-render due to reference equality
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
                    onSelectedIdsChange={setSelectedLinkingIds}
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
            totalCanvases={manifest.items.length}
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
                  onSelectedIdsChange={setSelectedLinkingIds}
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
    </div>
  );
}
