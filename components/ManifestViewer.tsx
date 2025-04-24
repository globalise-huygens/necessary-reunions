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

const STATIC_MANIFEST_URL = '/data/manifest.json';
const API_MANIFEST_URL = '/api/manifest';

export function ManifestViewer() {
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentCanvas, setCurrentCanvas] = useState(0);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [rightTab, setRightTab] = useState<'metadata' | 'annotations' | 'geo'>(
    'metadata',
  );
  const [viewMode, setViewMode] = useState<'image' | 'map'>('image');
  const [viewerInst, setViewerInst] = useState<any>(null);
  const { toast } = useToast();

  const loadManifest = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch(API_MANIFEST_URL);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setManifest(data);
      toast({
        title: 'Manifest loaded',
        description: data.label?.en?.[0] || 'Untitled manifest',
      });
    } catch (apiErr: any) {
      console.warn('API failed, loading static manifest', apiErr);
      try {
        const stat = await fetch(STATIC_MANIFEST_URL);
        if (!stat.ok) throw new Error(`Static ${stat.status}`);
        const data = await stat.json();
        setManifest(data);
        toast({
          title: 'Static manifest loaded',
          description: data.label?.en?.[0] || 'Untitled manifest',
        });
      } catch (staticErr: any) {
        const msg = staticErr.message || 'Unknown error';
        setLoadError(msg);
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
      setLoading(false);
    }
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
            <Button onClick={loadManifest} className="w-full">
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
        onToggleLeftSidebar={() => setShowLeft((p) => !p)}
        onToggleRightSidebar={() => setShowRight((p) => !p)}
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
