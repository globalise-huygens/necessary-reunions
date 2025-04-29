'use client';

import React, { useState, useEffect } from 'react';
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

const API_MANIFEST_URL = '/api/manifest';
const STATIC_MANIFEST_URL =
  'https://globalise-huygens.github.io/necessary-reunions/manifest.json';

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

  useEffect(() => {
    setSelectedAnnotationId(null);
  }, [currentCanvasIndex, viewMode]);

  async function loadManifest() {
    setIsLoadingManifest(true);
    setManifestError(null);

    try {
      const response = await fetch(API_MANIFEST_URL);
      if (!response.ok)
        throw new Error(`API responded with status ${response.status}`);
      const data = await response.json();
      setManifest(data);
      toast({ title: 'Manifest loaded', description: data.label?.en?.[0] });
    } catch {
      try {
        const response = await fetch(STATIC_MANIFEST_URL);
        if (!response.ok)
          throw new Error(
            `Static manifest responded with status ${response.status}`,
          );
        const data = await response.json();
        setManifest(data);
        toast({
          title: 'Static manifest loaded',
          description: data.label?.en?.[0],
        });
      } catch (error: any) {
        setManifestError(error.message || 'Unknown error loading manifest');
        toast({
          title: 'Failed to load manifest',
          description: error.message,
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

  const currentCanvas = manifest?.items?.[currentCanvasIndex] ?? null;

  const canvasId = currentCanvas?.id ?? '';
  const { annotations, isLoading: isLoadingAnnotations } =
    useAllAnnotations(canvasId);

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 space-y-4 bg-white rounded-lg shadow border">
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

        <div className="flex-1 overflow-hidden relative">
          {(viewMode === 'image' || viewMode === 'annotation') &&
            currentCanvas && (
              <ImageViewer
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
            <div className="border-b flex">
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

              {viewMode === 'annotation' && currentCanvas && (
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
        viewer={undefined}
        viewMode={viewMode === 'annotation' ? undefined : viewMode}
      />
    </div>
  );
}
