'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/Button';
import { Loader2, Search, Info, MessageSquare, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/Toast';
import { ImageViewer } from '@/components/ImageViewer';
import { CollectionSidebar } from '@/components/CollectionSidebar';
import { TopNavigation } from '@/components/Navbar';
import { StatusBar } from '@/components/StatusBar';
import { Alert, AlertTitle, AlertDescription } from '@/components/Alert';
import { cn } from '@/lib/utils';

const AllmapsMap = dynamic(() => import('./AllmapsMap'), { ssr: false });
const MetadataSidebar = dynamic(
  () =>
    import('@/components/MetadataSidebar').then((mod) => mod.MetadataSidebar),
  { ssr: true },
);

export function ManifestViewer() {
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentCanvas, setCurrentCanvas] = useState(0);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [rightTab, setRightTab] = useState<'metadata' | 'annotations' | 'geo'>(
    'metadata',
  );
  const [viewMode, setViewMode] = useState<'image' | 'map'>('image');
  const [viewerInst, setViewerInst] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadManifest = async (url = '/api/manifest') => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setManifest(data);
      toast({
        title: 'Manifest loaded',
        description: data.label?.en?.[0] || 'Untitled manifest',
      });
    } catch (err: any) {
      const msg = err.message || 'Unknown error';
      setLoadError(msg);
      toast({
        title: 'Failed to load manifest',
        description: msg,
        action: (
          <ToastAction
            altText="Load sample"
            onClick={() => loadManifestSample()}
          >
            Use sample
          </ToastAction>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadManifestSample = () => {
    const sample = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/sample-manifest',
      type: 'Manifest',
      label: { en: ['Sample Manifest'] },
      summary: { en: ['A sample manifest for testing'] },
      items: [
        {
          id: 'canvas/1',
          type: 'Canvas',
          label: { en: ['First Image'] },
          width: 800,
          height: 600,
          items: [
            {
              id: 'page/1',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'annotation/1',
                  type: 'Annotation',
                  motivation: 'painting',
                  body: {
                    id: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
                    type: 'Image',
                    format: 'image/jpeg',
                    width: 800,
                    height: 600,
                  },
                  target: 'canvas/1',
                },
              ],
            },
          ],
        },
      ],
    };
    setManifest(sample);
    toast({
      title: 'Sample manifest loaded',
      description: 'Successfully loaded sample manifest',
    });
  };

  useEffect(() => {
    loadManifest();
  }, []);

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
            <Button onClick={() => loadManifest()} className="w-full">
              <Search className="h-4 w-4 mr-2" /> Retry
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
        onToggleLeftSidebar={() => setShowLeft((prev) => !prev)}
        onToggleRightSidebar={() => setShowRight((prev) => !prev)}
      />
      <div className="flex-1 flex overflow-hidden">
        {showLeft && (
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
              onViewerReady={setViewerInst}
            />
          ) : (
            <AllmapsMap manifest={manifest} currentCanvas={currentCanvas} />
          )}
        </div>
        {showRight && (
          <div className="w-80 border-l flex flex-col overflow-hidden">
            <div className="border-b flex">
              <Button
                variant={rightTab === 'metadata' ? 'default' : 'ghost'}
                className="flex-1 rounded-none h-10"
                onClick={() => {
                  setRightTab('metadata');
                  setViewMode('image');
                }}
              >
                <Info
                  className={cn('h-4 w-4', rightTab === 'metadata' && 'mr-2')}
                />
                {rightTab === 'metadata' && 'Info'}
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded-none h-10 opacity-50 cursor-not-allowed"
                disabled
                title="Annotation features coming soon"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant={rightTab === 'geo' ? 'default' : 'ghost'}
                className="flex-1 rounded-none h-10"
                onClick={() => {
                  setRightTab('geo');
                  setViewMode('map');
                }}
              >
                <Map className={cn('h-4 w-4', rightTab === 'geo' && 'mr-2')} />
                {rightTab === 'geo' && 'Map'}
              </Button>
            </div>
            <MetadataSidebar
              manifest={manifest}
              currentCanvas={currentCanvas}
              activeTab={rightTab}
              onChange={setManifest}
            />
          </div>
        )}
      </div>
      <StatusBar
        manifest={manifest}
        currentCanvas={currentCanvas}
        totalCanvases={manifest.items?.length || 0}
        onCanvasChange={setCurrentCanvas}
        viewer={viewerInst}
        viewMode={viewMode}
      />
    </div>
  );
}
