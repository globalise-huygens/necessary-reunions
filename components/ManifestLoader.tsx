'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Textarea } from '@/components/Textarea';
import { Card } from '@/components/Card';
import { Upload, Link, FileText, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Manifest } from '@/lib/types';

interface ManifestLoaderProps {
  currentManifest?: Manifest | null;
  onManifestLoad: (manifest: Manifest) => void;
  onClose: () => void;
}

export function ManifestLoader({
  currentManifest,
  onManifestLoad,
  onClose,
}: ManifestLoaderProps) {
  const [manifestUrl, setManifestUrl] = useState('');
  const [manifestJson, setManifestJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'json'>('url');
  const { toast } = useToast();

  const loadDefaultManifest = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try local API first
      let res = await fetch('/api/manifest');
      if (!res.ok) {
        // Fallback to static manifest
        res = await fetch(
          'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
        );
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      onManifestLoad(data);
      toast({
        title: 'Default manifest loaded',
        description: data.label?.en?.[0] || 'Necessary Reunions Collection',
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Failed to load default manifest', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [onManifestLoad, onClose, toast]);

  const loadManifestFromUrl = useCallback(async () => {
    if (!manifestUrl.trim()) {
      toast({ title: 'Please enter a valid URL' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();

      // Basic IIIF manifest validation for both v2 and v3
      const isV2 =
        data['@context'] && data['@context'].includes('api/presentation/2');
      const isV3 =
        data['@context'] && data['@context'].includes('api/presentation/3');

      if (!isV2 && !isV3 && !data.type) {
        throw new Error('Invalid IIIF manifest format');
      }

      // Check if manifest has content (canvases)
      const hasContent =
        (isV3 && data.items) || (isV2 && data.sequences?.[0]?.canvases);
      if (!hasContent) {
        throw new Error('Manifest contains no viewable content');
      }

      onManifestLoad(data);
      toast({
        title: 'Manifest loaded from URL',
        description: data.label?.en?.[0] || data.label || 'Remote manifest',
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Failed to load manifest from URL', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [manifestUrl, onManifestLoad, onClose, toast]);

  const loadManifestFromJson = useCallback(async () => {
    if (!manifestJson.trim()) {
      toast({ title: 'Please enter valid JSON' });
      return;
    }

    setIsLoading(true);
    try {
      const data = JSON.parse(manifestJson);

      // Basic IIIF manifest validation for both v2 and v3
      const isV2 =
        data['@context'] && data['@context'].includes('api/presentation/2');
      const isV3 =
        data['@context'] && data['@context'].includes('api/presentation/3');

      if (!isV2 && !isV3 && !data.type) {
        throw new Error('Invalid IIIF manifest format');
      }

      // Check if manifest has content (canvases)
      const hasContent =
        (isV3 && data.items) || (isV2 && data.sequences?.[0]?.canvases);
      if (!hasContent) {
        throw new Error('Manifest contains no viewable content');
      }

      onManifestLoad(data);
      toast({
        title: 'Manifest loaded from JSON',
        description: data.label?.en?.[0] || data.label || 'Custom manifest',
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Invalid JSON or manifest format';
      toast({ title: 'Failed to parse manifest', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [manifestJson, onManifestLoad, onClose, toast]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        toast({ title: 'Please select a JSON file' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setManifestJson(content);
          setActiveTab('json');
        }
      };
      reader.readAsText(file);
    },
    [toast],
  );

  return (
    <div className="space-y-6">
      {/* Current Manifest Info */}
      {currentManifest && (
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4" />
            <span className="font-medium">Current Manifest</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {typeof currentManifest.label === 'string'
              ? currentManifest.label
              : currentManifest.label?.en?.[0] || 'Untitled Manifest'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentManifest.items?.length || 0} items
          </p>
        </Card>
      )}

      {/* Default Manifest */}
      <div>
        <Button
          onClick={loadDefaultManifest}
          disabled={isLoading}
          className="w-full"
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Load Default Manifest (Necessary Reunions)
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'url'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('url')}
        >
          <Link className="h-4 w-4 mr-1 inline" />
          From URL
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'file'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('file')}
        >
          <Upload className="h-4 w-4 mr-1 inline" />
          Upload File
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'json'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('json')}
        >
          <FileText className="h-4 w-4 mr-1 inline" />
          Paste JSON
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manifest-url">Manifest URL</Label>
              <Input
                id="manifest-url"
                type="url"
                placeholder="https://example.com/manifest.json"
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the URL of a IIIF manifest.json file
              </p>
            </div>
            <Button
              onClick={loadManifestFromUrl}
              disabled={isLoading || !manifestUrl.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Load from URL
            </Button>
          </div>
        )}

        {activeTab === 'file' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manifest-file">Upload Manifest File</Label>
              <Input
                id="manifest-file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select a IIIF manifest.json file from your computer
              </p>
            </div>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manifest-json">Manifest JSON</Label>
              <Textarea
                id="manifest-json"
                placeholder="Paste your IIIF manifest JSON here..."
                value={manifestJson}
                onChange={(e) => setManifestJson(e.target.value)}
                className="mt-1 min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the contents of a IIIF manifest.json file
              </p>
            </div>
            <Button
              onClick={loadManifestFromJson}
              disabled={isLoading || !manifestJson.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Load from JSON
            </Button>
          </div>
        )}
      </div>

      {/* Sample Manifests */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sample Manifests</Label>
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            IIIF Cookbook - Simple Image
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://iiif.io/api/cookbook/recipe/0005-image-service/manifest.json',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            IIIF Cookbook - Image Service
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://uvaerfgoed.nl/viewer/api/v1/records/11245_3_2556/manifest/',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            UVA Heritage - Dutch Map (IIIF v2)
          </Button>
        </div>
      </div>
    </div>
  );
}
