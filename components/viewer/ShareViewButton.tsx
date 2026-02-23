'use client';

import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../hooks/use-toast';
import { buildShareableUrl } from '../../lib/viewer/content-state';

interface ShareViewButtonProps {
  /** Manifest URI */
  manifestId: string;
  /** Current canvas URI */
  canvasId?: string;
  /** Selected annotation ID */
  annotationId?: string;
  /** Current viewport region (from OpenSeadragon) */
  region?: { x: number; y: number; w: number; h: number };
  /** Point on canvas */
  point?: { x: number; y: number };
  /** Compact mode for toolbar */
  compact?: boolean;
}

/**
 * Share button that generates an IIIF Content State URL for the current viewer state.
 * Supports:
 * - Copy to clipboard (Section 3.7)
 * - Display for manual copying
 * - Open in external viewer
 */
export function ShareViewButton({
  manifestId,
  canvasId,
  annotationId,
  region,
  point,
  compact = false,
}: ShareViewButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const { toast } = useToast();

  const getViewerBaseUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/viewer`;
  }, []);

  const generateUrl = useCallback(() => {
    const baseUrl = getViewerBaseUrl();
    return buildShareableUrl({
      viewerBaseUrl: baseUrl,
      manifestId,
      canvasId,
      region,
      annotationId,
      point,
    });
  }, [manifestId, canvasId, annotationId, region, point, getViewerBaseUrl]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      const url = generateUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied',
        description: 'Shareable IIIF Content State URL copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: show URL for manual copying
      setShowUrl(true);
    }
  }, [generateUrl, toast]);

  const handleShowUrl = useCallback(() => {
    setShowUrl((prev) => !prev);
  }, []);

  if (compact) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCopyToClipboard}
        className="h-7 px-2"
        title="Share current view (IIIF Content State)"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopyToClipboard}
          className="h-7 px-2 text-xs"
          title="Copy shareable link"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Share
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleShowUrl}
          className="h-7 px-1.5"
          title="Show shareable URL"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {showUrl && (
        <div className="absolute right-0 top-8 z-50 w-80 p-3 bg-card border border-border rounded-lg shadow-lg">
          <div className="text-xs font-medium mb-1.5">
            IIIF Content State URL
          </div>
          <div className="bg-muted rounded p-2 text-[10px] font-mono break-all max-h-24 overflow-auto select-all">
            {generateUrl()}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">
              Compatible with any IIIF viewer
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUrl(false)}
              className="h-5 px-1.5 text-[10px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShareViewButton;
