'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import {
  parseContentState,
  type ParsedContentState,
} from '../../lib/viewer/content-state';

interface ContentStateReceiverProps {
  /** Callback when a valid content state is received */
  onContentStateReceived: (parsed: ParsedContentState) => void;
  /** Whether the receiver is active */
  enabled?: boolean;
  /** Children to wrap (the drop target) */
  children: React.ReactNode;
}

/**
 * Invisible wrapper that accepts IIIF Content State via:
 * - Paste operation (Section 3.3): user pastes JSON or URI
 * - Drag and drop (Section 3.4): user drags content state onto the viewer
 *
 * Per spec, the content type for both operations is "text/plain",
 * and the data must NOT be content-state-encoded.
 */
export function ContentStateReceiver({
  onContentStateReceived,
  enabled = true,
  children,
}: ContentStateReceiverProps) {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);

  // Paste handler (Section 3.3)
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (!enabled) return;

      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;

      const trimmed = text.trim();
      // Quick heuristic: must look like JSON or a URL
      if (
        !trimmed.startsWith('{') &&
        !trimmed.startsWith('[') &&
        !trimmed.startsWith('http://') &&
        !trimmed.startsWith('https://')
      ) {
        return;
      }

      try {
        const parsed = parseContentState(trimmed);
        if (parsed.manifestId || parsed.canvasId) {
          event.preventDefault();
          onContentStateReceived(parsed);
          toast({
            title: 'Content State received',
            description: parsed.canvasId
              ? 'Navigating to the specified canvas.'
              : 'Loading the specified manifest.',
          });
        }
      } catch {
        // Not a valid content state — ignore silently
      }
    },
    [enabled, onContentStateReceived, toast],
  );

  // Drag and Drop handler (Section 3.4)
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!enabled) return;

      event.preventDefault();
      setIsDragOver(false);

      const text = event.dataTransfer.getData('text/plain');
      if (!text) return;

      try {
        const parsed = parseContentState(text.trim());
        if (parsed.manifestId || parsed.canvasId) {
          onContentStateReceived(parsed);
          toast({
            title: 'Content State received',
            description: 'Loaded from drag and drop.',
          });
        }
      } catch {
        // Not a valid content state
      }
    },
    [enabled, onContentStateReceived, toast],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!enabled) return;
      event.preventDefault();
      setIsDragOver(true);
    },
    [enabled],
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Register global paste listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handlePaste]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative flex-1 flex flex-col h-full overflow-hidden ${isDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 flex items-center justify-center pointer-events-none">
          <div className="bg-card border border-primary rounded-lg px-4 py-3 shadow-lg">
            <div className="text-sm font-medium text-primary">
              Drop IIIF Content State here
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export default ContentStateReceiver;
