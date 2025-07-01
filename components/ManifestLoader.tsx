'use client';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Textarea } from '@/components/Textarea';
import { useToast } from '@/hooks/use-toast';
import type { Manifest } from '@/lib/types';
import { ExternalLink, FileText, Link, Loader2, Upload } from 'lucide-react';
import React, { useCallback, useState } from 'react';

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

  const validateIIIFManifest = useCallback((data: any) => {
    const context = data['@context'];
    const isV2 =
      context &&
      (Array.isArray(context)
        ? context.some(
            (c: string) =>
              c.includes('api/presentation/2') ||
              c.includes('shared-canvas.org'),
          )
        : context.includes('api/presentation/2') ||
          context.includes('shared-canvas.org'));
    const isV3 =
      context &&
      (Array.isArray(context)
        ? context.some((c: string) => c.includes('api/presentation/3'))
        : context.includes('api/presentation/3'));

    const hasV2Structure = data['@type'] === 'sc:Manifest' && data.sequences;

    if (isV3 && data.type !== 'Manifest') {
      throw new Error('Invalid IIIF v3 manifest: type must be "Manifest"');
    }

    if ((isV2 || hasV2Structure) && data['@type'] !== 'sc:Manifest') {
      throw new Error('Invalid IIIF v2 manifest: @type must be "sc:Manifest"');
    }

    if (!isV2 && !isV3 && !hasV2Structure && data.type !== 'Manifest') {
      throw new Error('Invalid IIIF manifest: missing valid context or type');
    }

    const hasV3Content =
      isV3 && data.items && Array.isArray(data.items) && data.items.length > 0;
    const hasV2Content =
      (isV2 || hasV2Structure) &&
      data.sequences &&
      Array.isArray(data.sequences) &&
      data.sequences.length > 0 &&
      data.sequences[0].canvases &&
      Array.isArray(data.sequences[0].canvases) &&
      data.sequences[0].canvases.length > 0;

    if (!hasV3Content && !hasV2Content) {
      throw new Error(
        'Manifest contains no viewable content (no canvases found)',
      );
    }

    if (!data.id && !data['@id']) {
      throw new Error('Manifest missing required id property');
    }

    if (!data.label) {
      throw new Error('Manifest missing required label property');
    }

    return { isV2, isV3 };
  }, []);

  const loadDefaultManifest = useCallback(async () => {
    setIsLoading(true);
    try {
      let res = await fetch('/api/manifest');
      if (!res.ok) {
        res = await fetch(
          'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();

      try {
        const { isV2, isV3 } = validateIIIFManifest(data);
        toast({
          title: `Default IIIF ${
            isV3 ? 'v3' : isV2 ? 'v2' : ''
          } manifest loaded`,
          description:
            data.label?.en?.[0] ||
            data.label?.none?.[0] ||
            'Necessary Reunions Collection',
        });
      } catch (validationError) {
        console.warn('Default manifest validation warning:', validationError);
        toast({
          title: 'Default manifest loaded (with warnings)',
          description:
            data.label?.en?.[0] ||
            data.label?.none?.[0] ||
            'Necessary Reunions Collection',
        });
      }

      onManifestLoad(data);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Failed to load default manifest', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [onManifestLoad, onClose, toast, validateIIIFManifest]);

  const loadManifestFromUrl = useCallback(async () => {
    if (!manifestUrl.trim()) {
      toast({ title: 'Please enter a valid URL' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();
      const { isV2, isV3 } = validateIIIFManifest(data);

      onManifestLoad(data);
      toast({
        title: `IIIF ${
          isV3 ? 'v3' : isV2 ? 'v2' : ''
        } manifest loaded from URL`,
        description:
          data.label?.en?.[0] ||
          data.label?.none?.[0] ||
          data.label ||
          'Remote manifest',
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Failed to load manifest from URL', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [manifestUrl, onManifestLoad, onClose, toast, validateIIIFManifest]);

  const loadManifestFromJson = useCallback(async () => {
    if (!manifestJson.trim()) {
      toast({ title: 'Please enter valid JSON' });
      return;
    }

    setIsLoading(true);
    try {
      const data = JSON.parse(manifestJson);
      const { isV2, isV3 } = validateIIIFManifest(data);

      onManifestLoad(data);
      toast({
        title: `IIIF ${
          isV3 ? 'v3' : isV2 ? 'v2' : ''
        } manifest loaded from JSON`,
        description:
          data.label?.en?.[0] ||
          data.label?.none?.[0] ||
          data.label ||
          'Custom manifest',
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Invalid JSON or manifest format';
      toast({ title: 'Failed to parse manifest', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [manifestJson, onManifestLoad, onClose, toast, validateIIIFManifest]);

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
            IIIF Cookbook - Simple Image (v3)
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
            IIIF Cookbook - Image Service (v3)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            IIIF Cookbook - Multi-page Book (v3)
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
            UVA Heritage - Dutch Map (v2)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://dms-data.stanford.edu/data/manifests/Walters/qm670kv1873/manifest.json',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            Stanford Walters - Manuscript (v2)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => {
              setManifestUrl(
                'https://wellcomelibrary.org/iiif/b18035723/manifest',
              );
              setActiveTab('url');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            Wellcome Library - Book (v2)
          </Button>
        </div>
      </div>
    </div>
  );
}
