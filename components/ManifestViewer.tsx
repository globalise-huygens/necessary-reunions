'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/Button';
import { Loader2, Info, MessageSquare, Map } from 'lucide-react';
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

  const onFilterChange = (mot: 'textspotting' | 'iconography') => {
    if (mot === 'textspotting') setShowTextspotting((v) => !v);
    else setShowIconography((v) => !v);
  };

  const canvasId = manifest?.items?.[currentCanvasIndex]?.id ?? '';
  const {
    annotations,
    isLoading: isLoadingAnnotations,
    reload,
  } = useAllAnnotations(canvasId);

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
      reload();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message });
    }
  };

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

        <div className="flex-1 relative overflow-hidden">
          {(viewMode === 'image' || viewMode === 'annotation') &&
            currentCanvas && (
              <ImageViewer
                manifest={manifest}
                currentCanvas={currentCanvasIndex}
                annotations={viewMode === 'annotation' ? annotations : []}
                selectedAnnotationId={selectedAnnotationId}
                onAnnotationSelect={setSelectedAnnotationId}
                onViewerReady={() => {}}
                showTextspotting={showTextspotting}
                showIconography={showIconography}
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
                  showTextspotting={showTextspotting}
                  showIconography={showIconography}
                  onFilterChange={onFilterChange}
                  onAnnotationPrepareDelete={canEdit ? handleDelete : undefined}
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
        totalCanvases={manifest.items.length}
        onCanvasChange={setCurrentCanvasIndex}
        viewMode={viewMode === 'annotation' ? undefined : viewMode}
      />
    </div>
  );
}
