'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Info, MessageSquare, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { ImageViewer } from '@/components/image-viewer';
import { CollectionSidebar } from '@/components/collection-sidebar';
import { MetadataSidebar } from '@/components/metadata-sidebar';
import { TopNavigation } from '@/components/Navbar';
import { StatusBar } from '@/components/StatusBar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import dynamic from 'next/dynamic';
const AllmapsMap = dynamic(() => import('../components/AllmapsMap'), {
  ssr: false,
});

export function ManifestViewer() {
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentCanvas, setCurrentCanvas] = useState(0);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [rightSidebarTab, setRightSidebarTab] = useState<
    'metadata' | 'annotations' | 'geo'
  >('metadata');
  const [viewMode, setViewMode] = useState<'image' | 'map'>('image');
  const { toast } = useToast();
  const [viewerInstance, setViewerInstance] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadLocalManifest();
  }, []);

  const loadLocalManifest = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch('/api/manifest');
      if (!response.ok)
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}`,
        );
      const data = await response.json();
      setManifest(data);
      toast({
        title: 'Manifest loaded',
        description: `${data.label?.en?.[0] || 'Untitled manifest'}`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setLoadError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Failed to load manifest',
        description: errorMessage,
        action: (
          <ToastAction altText="Load sample" onClick={loadSampleManifest}>
            Use sample
          </ToastAction>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSampleManifest = () => {
    const sampleManifest = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/sample-manifest',
      type: 'Manifest',
      label: { en: ['Sample Manifest'] },
      summary: { en: ['A sample manifest for testing'] },
      items: [
        {
          id: 'https://example.org/canvas/1',
          type: 'Canvas',
          label: { en: ['First Image'] },
          width: 800,
          height: 600,
          items: [
            {
              id: 'https://example.org/page/1',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/1',
                  type: 'Annotation',
                  motivation: 'painting',
                  body: {
                    id: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
                    type: 'Image',
                    format: 'image/jpeg',
                    width: 800,
                    height: 600,
                  },
                  target: 'https://example.org/canvas/1',
                },
              ],
            },
          ],
        },
      ],
    };

    setManifest(sampleManifest);
    toast({
      title: 'Sample manifest loaded',
      description: 'Successfully loaded sample manifest',
    });
  };

  const handleManifestChange = (updatedManifest: any) => {
    setManifest({ ...updatedManifest });
  };

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 space-y-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-center">
            Loading IIIF Manifest
          </h2>
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Error loading manifest</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Button onClick={loadLocalManifest} className="w-full">
              <Search className="h-4 w-4 mr-2" /> Retry Loading Manifest
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TopNavigation
        manifest={manifest}
        onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
        onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
      />

      <div className="flex-1 flex overflow-hidden">
        {showLeftSidebar && (
          <div className="w-64 border-r flex flex-col overflow-hidden">
            <CollectionSidebar
              manifest={manifest}
              currentCanvas={currentCanvas}
              onCanvasSelect={setCurrentCanvas}
            />
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {viewMode === 'image' ? (
            <ImageViewer
              manifest={manifest}
              currentCanvas={currentCanvas}
              onCanvasChange={setCurrentCanvas}
              onViewerReady={setViewerInstance}
            />
          ) : (
            <AllmapsMap />
          )}
        </div>

        {showRightSidebar && (
          <div className="w-80 border-l flex flex-col overflow-hidden">
            <div className="border-b flex">
              <Button
                variant={rightSidebarTab === 'metadata' ? 'default' : 'ghost'}
                className="flex-1 rounded-none h-10"
                onClick={() => {
                  setRightSidebarTab('metadata');
                  setViewMode('image');
                }}
              >
                <Info
                  className={`h-4 w-4 ${
                    rightSidebarTab === 'metadata' ? 'mr-2' : ''
                  }`}
                />
                {rightSidebarTab === 'metadata' && 'Info'}
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded-none h-10 opacity-50 cursor-not-allowed"
                disabled
                title="Annotation features coming soon"
              >
                <MessageSquare className="h-4 w-4" />
                {rightSidebarTab === 'annotations' && 'Draw'}
              </Button>
              <Button
                variant={rightSidebarTab === 'geo' ? 'default' : 'ghost'}
                className="flex-1 rounded-none h-10"
                onClick={() => {
                  setRightSidebarTab('geo');
                  setViewMode('map');
                }}
              >
                <Map
                  className={`h-4 w-4 ${
                    rightSidebarTab === 'geo' ? 'mr-2' : ''
                  }`}
                />
                {rightSidebarTab === 'geo' && 'Map'}
              </Button>
            </div>
            <MetadataSidebar
              manifest={manifest}
              currentCanvas={currentCanvas}
              activeTab={rightSidebarTab}
              onChange={handleManifestChange}
            />
          </div>
        )}
      </div>

      <StatusBar
        manifest={manifest}
        currentCanvas={currentCanvas}
        totalCanvases={manifest.items?.length || 0}
        onCanvasChange={setCurrentCanvas}
        viewer={viewerInstance}
        viewMode={viewMode}
      />
    </div>
  );
}
