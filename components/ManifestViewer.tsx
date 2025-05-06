'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { Loader2, Info, MessageSquare, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/Toast';
import { CollectionSidebar } from '@/components/CollectionSidebar';
import { TopNavigation } from '@/components/Navbar';
import { StatusBar } from '@/components/StatusBar';
import { Alert, AlertTitle, AlertDescription } from '@/components/Alert';
import dynamic from 'next/dynamic';
import type { Manifest } from '@/lib/types';
import { ImageViewer } from '@/components/ImageViewer';
import { useAllAnnotations } from '@/hooks/use-all-annotations';
import { AnnotationList } from '@/components/AnnotationList';

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

  const [currentCanvasIndex, setCurrentCanvasIndex] = useState(0);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'image' | 'annotation' | 'map'>(
    'image',
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

  const viewerHostRef = useRef<HTMLDivElement>(null);

  // ── Moved hook here, before any returns ────────────────────────────────────────
  const canvasId = manifest?.items?.[currentCanvasIndex]?.id ?? '';
  const { annotations, isLoading: isLoadingAnnotations } =
    useAllAnnotations(canvasId);
  // ───────────────────────────────────────────────────────────────────────────────

  // clear selection when canvas or mode changes
  useEffect(() => {
    setSelectedAnnotationId(null);
  }, [currentCanvasIndex, viewMode]);

  // manifest load logic
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
      // fallback
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
          action: (
            <ToastAction altText="Retry" onClick={loadManifest}>
              Retry
            </ToastAction>
          ),
        });
      }
    } finally {
      setIsLoadingManifest(false);
    }
  }

  useEffect(() => {
    loadManifest();
  }, []);

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow border space-y-4">
          <h2 className="text-xl font-semibold text-center">
            Loading Manifest
          </h2>
          {manifestError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{manifestError}</AlertDescription>
            </Alert>
          )}
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TopNavigation
        manifest={manifest}
        onToggleLeftSidebar={() => setIsLeftSidebarVisible((p) => !p)}
        onToggleRightSidebar={() => setIsRightSidebarVisible((p) => !p)}
      />

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

        <div ref={viewerHostRef} className="flex-1 relative overflow-hidden">
          {(viewMode === 'image' || viewMode === 'annotation') &&
            currentCanvas && (
              <ImageViewer
                key={`${canvasId}-${viewMode}`}
                containerRef={viewerHostRef}
                manifest={manifest}
                currentCanvas={currentCanvasIndex}
                annotations={
                  viewMode === 'annotation' ? annotations : undefined
                }
                selectedAnnotationId={selectedAnnotationId}
                onAnnotationSelect={setSelectedAnnotationId}
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
                  annotations={annotations}
                  isLoading={isLoadingAnnotations}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationSelect={setSelectedAnnotationId}
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
        totalCanvases={manifest.items.length}
        onCanvasChange={setCurrentCanvasIndex}
        viewMode={viewMode === 'annotation' ? undefined : viewMode}
      />
    </div>
  );
}
