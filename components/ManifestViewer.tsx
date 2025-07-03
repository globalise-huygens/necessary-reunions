'use client';

import { AnnotationList } from '@/components/AnnotationList';
import { Button } from '@/components/Button';
import { CollectionSidebar } from '@/components/CollectionSidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/Dialog';
import { Footer } from '@/components/Footer';
import { ImageViewer } from '@/components/ImageViewer';
import { ManifestLoader } from '@/components/ManifestLoader';
import { TopNavigation } from '@/components/Navbar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/Sheet';
import { StatusBar } from '@/components/StatusBar';
import { useAllAnnotations } from '@/hooks/use-all-annotations';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  getManifestCanvases,
  isImageCanvas,
  mergeLocalAnnotations,
  normalizeManifest,
} from '@/lib/iiif-helpers';
import type { Annotation, Manifest } from '@/lib/types';
import { Image, Images, Info, Loader2, Map, MessageSquare } from 'lucide-react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

  const isMounted = useRef(false);
  const isToastReady = useRef(false);

  useLayoutEffect(() => {
    isMounted.current = true;
    setTimeout(() => {
      isToastReady.current = true;
    }, 100);
    return () => {
      isMounted.current = false;
      isToastReady.current = false;
    };
  }, []);

  const [currentCanvasIndex, setCurrentCanvasIndex] = useState(0);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'image' | 'annotation' | 'map'>(
    'image',
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

  const [showAITextspotting, setShowAITextspotting] = useState(true);
  const [showAIIconography, setShowAIIconography] = useState(true);
  const [showHumanTextspotting, setShowHumanTextspotting] = useState(true);
  const [showHumanIconography, setShowHumanIconography] = useState(true);

  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const canvasId =
    getManifestCanvases(manifest)?.[currentCanvasIndex]?.id ?? '';
  const { annotations, isLoading: isLoadingAnnotations } =
    useAllAnnotations(canvasId);

  const isMobile = useIsMobile();
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

  const handleManifestLoaderClose = () => {
    setIsManifestLoaderOpen(false);
    if (onManifestLoaderClose) {
      onManifestLoaderClose();
    }
  };

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    setSelectedAnnotationId(null);
  }, [currentCanvasIndex, viewMode]);

  async function loadManifest() {
    setIsLoadingManifest(true);
    setManifestError(null);

    try {
      const res = await fetch('/api/manifest');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const normalizedData = normalizeManifest(data);

      const enrichedData = await mergeLocalAnnotations(normalizedData);

      if (isMounted.current) {
        setManifest(enrichedData);
        setTimeout(() => {
          if (isMounted.current) {
            setManifestLoadedToast({
              title: 'Manifest loaded',
              description: data.label?.en?.[0],
            });
          }
        }, 0);
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

        if (isMounted.current) {
          setManifest(enrichedData);
          setTimeout(() => {
            if (isMounted.current) {
              setManifestLoadedToast({
                title: 'Static manifest loaded',
                description: data.label?.en?.[0],
              });
            }
          }, 0);
        }
      } catch (err: any) {
        const msg = err?.message || 'Unknown error';
        // Only update state if component is still mounted
        if (isMounted.current) {
          setManifestError(msg);
          setTimeout(() => {
            if (isMounted.current) {
              setManifestErrorToast(msg);
            }
          }, 0);
        }
      }
    } finally {
      setIsLoadingManifest(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadManifest();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (manifestLoadedToast && isMounted.current && isToastReady.current) {
      toast({
        title: manifestLoadedToast.title,
        description: manifestLoadedToast.description,
      });
      setManifestLoadedToast(null);
    }
  }, [manifestLoadedToast, toast]);

  useEffect(() => {
    if (manifestErrorToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Failed to load manifest',
        description: manifestErrorToast,
      });
      setManifestErrorToast(null);
    }
  }, [manifestErrorToast, toast]);

  useEffect(() => {
    if (annotationToast && isMounted.current && isToastReady.current) {
      toast({
        title: annotationToast.title,
        description: annotationToast.description,
      });
      setAnnotationToast(null);
    }
  }, [annotationToast, toast]);

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

  const handleDelete = async (annotation: Annotation) => {
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

  const handleAnnotationUpdate = (updatedAnnotation: Annotation) => {
    setLocalAnnotations((prev) =>
      prev.map((a) => (a.id === updatedAnnotation.id ? updatedAnnotation : a)),
    );
    setAnnotationToast({
      title: 'Annotation updated',
      description: 'Changes saved successfully',
    });
  };

  const handleNewAnnotation = (newAnnotation: Annotation) => {
    setLocalAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    setAnnotationToast({
      title: 'Annotation created',
      description: 'New annotation added successfully',
    });
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
                    onAnnotationSelect={setSelectedAnnotationId}
                    onViewerReady={() => {}}
                    onNewAnnotation={handleNewAnnotation}
                    showAITextspotting={showAITextspotting}
                    showAIIconography={showAIIconography}
                    showHumanTextspotting={showHumanTextspotting}
                    showHumanIconography={showHumanIconography}
                    viewMode={viewMode}
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
                    />
                  )}
                  {viewMode === 'annotation' && (
                    <AnnotationList
                      annotations={localAnnotations}
                      isLoading={isLoadingAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      onAnnotationSelect={setSelectedAnnotationId}
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
                      canEdit={canEdit}
                    />
                  )}
                  {viewMode === 'map' && (
                    <MetadataSidebar
                      manifest={manifest}
                      currentCanvas={currentCanvasIndex}
                      activeTab="geo"
                      onChange={setManifest}
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
                  onAnnotationSelect={setSelectedAnnotationId}
                  onViewerReady={() => {}}
                  onNewAnnotation={handleNewAnnotation}
                  showAITextspotting={showAITextspotting}
                  showAIIconography={showAIIconography}
                  showHumanTextspotting={showHumanTextspotting}
                  showHumanIconography={showHumanIconography}
                  viewMode={mobileView}
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
                onChange={setManifest}
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
