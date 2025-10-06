'use client';

import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import { Label } from '@/components/shared/Label';
import { Textarea } from '@/components/shared/Textarea';
import { useToast } from '@/hooks/use-toast';
import type { Manifest } from '@/lib/types';
import {
  getAllLocalizedValues,
  getLocalizedValue,
} from '@/lib/viewer/iiif-helpers';
import {
  getValidationSummary,
  validateManifest,
} from '@/lib/viewer/manifest-validator';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  Link,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
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
  const [validationResult, setValidationResult] = useState<any>(null);
  const { toast } = useToast();

  const validateIIIFManifest = useCallback((data: any) => {
    const validation = validateManifest(data);
    setValidationResult(validation);

    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    return validation;
  }, []);

  const loadDefaultManifest = useCallback(async () => {
    setIsLoading(true);
    try {
      // EMERGENCY FIX: Use GitHub Pages directly first to bypass 404 API issues
      console.log('[MANIFEST LOADER] Loading directly from GitHub Pages');
      let res = await fetch('https://globalise-huygens.github.io/necessary-reunions/manifest.json');
      
      if (!res.ok) {
        console.log('[MANIFEST LOADER] GitHub Pages failed, trying API fallback');
        res = await fetch('/api/manifest');
      }
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();

      try {
        const validation = validateIIIFManifest(data);
        toast({
          title: `Default manifest loaded`,
          description: getValidationSummary(validation),
        });
      } catch (validationError) {
        toast({
          title: 'Default manifest loaded (with warnings)',
          description:
            getLocalizedValue(data.label) || 'Necessary Reunions Collection',
        });
      }

      onManifestLoad(data);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Could not load default manifest', description: msg });
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
      const validation = validateIIIFManifest(data);

      onManifestLoad(data);
      toast({
        title: `Manifest loaded successfully`,
        description: getValidationSummary(validation),
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: 'Could not load manifest', description: msg });
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
      const validation = validateIIIFManifest(data);

      onManifestLoad(data);
      toast({
        title: `Manifest loaded successfully`,
        description: getValidationSummary(validation),
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Invalid data format';
      toast({ title: 'Could not parse manifest data', description: msg });
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
        <Card className="p-4 bg-card border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">Current Manifest</span>
          </div>
          <div className="space-y-2">
            {(() => {
              if (typeof currentManifest.label === 'string') {
                return (
                  <p className="text-sm text-card-foreground">
                    {currentManifest.label}
                  </p>
                );
              }

              const allLabels = getAllLocalizedValues(currentManifest.label);
              if (allLabels && allLabels.length > 0) {
                return (
                  <div className="space-y-1">
                    {allLabels.map(({ language, value }, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          {language}:
                        </span>
                        <p className="text-card-foreground mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <p className="text-sm text-card-foreground">
                  Untitled Manifest
                </p>
              );
            })()}
          </div>
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
          From Web
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
          Custom Data
        </button>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <Card className="p-4 bg-card border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {validationResult.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="font-medium text-card-foreground">
              {validationResult.isValid ? 'Valid Manifest' : 'Invalid Manifest'}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            {getValidationSummary(validationResult)}
          </p>

          {validationResult.warnings.length > 0 && (
            <div className="space-y-1 mb-2">
              {validationResult.warnings.map(
                (warning: string, index: number) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-amber-700">{warning}</span>
                  </div>
                ),
              )}
            </div>
          )}

          {validationResult.errors.length > 0 && (
            <div className="space-y-1">
              {validationResult.errors.map((error: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">{error}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manifest-url">Manifest Web Address</Label>
              <Input
                id="manifest-url"
                type="url"
                placeholder="https://example.com/manifest.json"
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the web address of a digital manifest
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
              Load Manifest
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
                Select a manifest file (.json) from your computer
              </p>
            </div>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manifest-json">Manifest Data</Label>
              <Textarea
                id="manifest-json"
                placeholder="Paste your manifest data here..."
                value={manifestJson}
                onChange={(e) => {
                  setManifestJson(e.target.value);
                  if (e.target.value.trim()) {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      const validation = validateManifest(parsed);
                      setValidationResult(validation);
                    } catch (parseError) {
                      setValidationResult({
                        isValid: false,
                        errors: ['Invalid JSON format'],
                        warnings: [],
                        metadata: {
                          version: 'unknown',
                          hasImages: false,
                          hasAnnotations: false,
                          hasGeoreferencing: false,
                          canvasCount: 0,
                          annotationCount: 0,
                        },
                      });
                    }
                  } else {
                    setValidationResult(null);
                  }
                }}
                className="mt-1 min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the contents of a manifest file
              </p>
            </div>
            <Button
              onClick={loadManifestFromJson}
              disabled={
                isLoading ||
                !manifestJson.trim() ||
                (validationResult && !validationResult.isValid)
              }
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Load Manifest
            </Button>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="space-y-2 p-4 bg-card border border-border rounded-lg shadow-sm">
        <Label className="text-sm font-medium text-primary">
          IIIF Image & Presentation Loader
        </Label>
        <div className="text-xs text-card-foreground space-y-1">
          <p>
            <strong>Supports:</strong> IIIF Presentation API v2 & v3 with image
            content only
          </p>
          <p>
            <strong>Compatible:</strong> Image manifests, single canvases,
            digital books, manuscripts
          </p>
          <p>
            <strong>Not supported:</strong> Audio, video, or time-based media
            manifests
          </p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 mt-3 pt-3 border-t border-border">
          <p>• Use "From Web" if you have a link to an online manifest</p>
          <p>
            • Use "Upload File" if you have a manifest file on your computer
          </p>
          <p>
            • Use "Custom Data" if you want to paste manifest information
            directly
          </p>
        </div>

        <details className="mt-3">
          <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
            Show example image manifests
          </summary>
          <div className="space-y-2 mt-2">
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
              IIIF Cookbook - Sample Book
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
              UVA Heritage - Historical Map
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
              Wellcome Library - Historical Book
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}
