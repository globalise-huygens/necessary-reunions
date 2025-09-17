'use client';

import { useBulkLinkingAnnotations } from '@/hooks/use-bulk-linking-annotations';
import { useEffect } from 'react';

interface DebugLinkingAnnotationsProps {
  canvasId: string;
}

export function DebugLinkingAnnotations({
  canvasId,
}: DebugLinkingAnnotationsProps) {
  const { linkingAnnotations, isLoading } = useBulkLinkingAnnotations(canvasId);

  useEffect(() => {
    console.log('🔍 DebugLinkingAnnotations: Current state:', {
      canvasId,
      annotationsCount: linkingAnnotations.length,
      isLoading,
      sampleAnnotation: linkingAnnotations[0],
    });
  }, [canvasId, linkingAnnotations.length, isLoading]);

  // REMOVED: Direct API call to avoid confusion - only use the hook

  return (
    <div
      style={{
        position: 'fixed',
        top: '50px',
        right: '10px',
        background: 'white',
        border: '1px solid #ccc',
        padding: '10px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px',
      }}
    >
      <h4>Debug Linking Annotations</h4>
      <p>Canvas ID: {canvasId.slice(-20)}...</p>
      <p>Hook count: {linkingAnnotations.length}</p>
      <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
    </div>
  );
}
