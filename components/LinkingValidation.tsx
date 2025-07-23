import {
  deleteLinkingRelationship,
  getLinkingAnnotationsForAnnotation,
  validateLinkingAnnotations,
} from '@/lib/linking-validation';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

interface ExistingLinkingDisplayProps {
  annotationId: string;
  onLinkingDeleted?: () => void;
}

export function ExistingLinkingDisplay({
  annotationId,
  onLinkingDeleted,
}: ExistingLinkingDisplayProps) {
  const [existingLinks, setExistingLinks] = useState<{
    linking?: any;
    geotagging?: any;
    pointSelection?: any;
  }>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingLinks();
  }, [annotationId]);

  const loadExistingLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const links = await getLinkingAnnotationsForAnnotation(annotationId);
      setExistingLinks(links);
    } catch (err: any) {
      console.error('Error loading existing links:', err);
      setError('Failed to load existing linking information');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (
    linkingId: string,
    motivation: 'linking' | 'geotagging' | 'point_selection',
  ) => {
    try {
      setDeleting(linkingId);
      setError(null);
      await deleteLinkingRelationship(linkingId, motivation);
      await loadExistingLinks();
      onLinkingDeleted?.();
    } catch (err: any) {
      console.error(`Error deleting ${motivation} link:`, err);
      setError(`Failed to delete ${motivation} relationship: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteEntireLinkingAnnotation = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete the entire linking annotation? This will remove all linked annotations, geotag data, and point selection. The original text/icon annotations will remain intact.',
    );

    if (!confirmed) return;

    try {
      setDeleting('entire');
      setError(null);

      const linkingId =
        existingLinks.linking?.id ||
        existingLinks.geotagging?.id ||
        existingLinks.pointSelection?.id;

      if (linkingId) {
        await deleteLinkingRelationship(linkingId, 'linking');
        await loadExistingLinks(); // Reload to update the display
        onLinkingDeleted?.();
      }
    } catch (err: any) {
      console.error('Error deleting entire linking annotation:', err);
      setError(`Failed to delete linking annotation: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
        Checking existing links...
      </div>
    );
  }

  const hasLinks = Object.values(existingLinks).some((link) => link);

  if (!hasLinks) {
    return null;
  }

  return (
    <div className="space-y-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs font-medium text-primary">
          <Info className="h-3 w-3" />
          Existing Links for this Annotation
        </div>

        {/* Delete entire linking annotation button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDeleteEntireLinkingAnnotation}
          disabled={deleting === 'entire'}
          className="h-5 px-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          title="Delete the entire linking annotation (all targets, geotag, and point selection)"
        >
          <Trash2 className="h-2.5 w-2.5" />
          {deleting === 'entire' ? 'Deleting...' : 'Delete All'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="text-xs p-2">
          <AlertTriangle className="h-3 w-3" />
          <span>{error}</span>
        </Alert>
      )}

      <div className="space-y-1">
        {existingLinks.linking && (
          <div className="flex items-center justify-between text-xs bg-white p-2 rounded border">
            <div>
              <span className="font-medium">Linking:</span> Connected to{' '}
              {Array.isArray(existingLinks.linking.target)
                ? existingLinks.linking.target.length - 1
                : 0}{' '}
              other annotation(s)
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleDeleteLink(existingLinks.linking.id, 'linking')
              }
              disabled={deleting === existingLinks.linking.id}
              className="h-5 px-1.5 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Trash2 className="h-2.5 w-2.5" />
              {deleting === existingLinks.linking.id ? 'Deleting...' : 'Remove'}
            </Button>
          </div>
        )}

        {existingLinks.geotagging && (
          <div className="flex items-center justify-between text-xs bg-white p-2 rounded border">
            <div>
              <span className="font-medium">Geotagging:</span> Location attached
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleDeleteLink(existingLinks.geotagging.id, 'geotagging')
              }
              disabled={deleting === existingLinks.geotagging.id}
              className="h-5 px-1.5 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Trash2 className="h-2.5 w-2.5" />
              {deleting === existingLinks.geotagging.id
                ? 'Deleting...'
                : 'Remove'}
            </Button>
          </div>
        )}

        {existingLinks.pointSelection && (
          <div className="flex items-center justify-between text-xs bg-white p-2 rounded border">
            <div>
              <span className="font-medium">Point Selection:</span> Point
              coordinates attached
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleDeleteLink(
                  existingLinks.pointSelection.id,
                  'point_selection',
                )
              }
              disabled={deleting === existingLinks.pointSelection.id}
              className="h-5 px-1.5 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Trash2 className="h-2.5 w-2.5" />
              {deleting === existingLinks.pointSelection.id
                ? 'Deleting...'
                : 'Remove'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ValidationDisplayProps {
  annotationIds: string[];
  excludeLinkingId?: string;
  motivation: 'linking' | 'geotagging' | 'point_selection';
}

export function ValidationDisplay({
  annotationIds,
  excludeLinkingId,
  motivation,
}: ValidationDisplayProps) {
  const [validation, setValidation] = useState<{
    isValid: boolean;
    conflicts: any[];
    warnings: string[];
    mergeable?: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (annotationIds.length > 1) {
        validateAnnotations();
      } else {
        setValidation(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [annotationIds, excludeLinkingId, motivation]);

  const validateAnnotations = async () => {
    try {
      setLoading(true);
      const result = await validateLinkingAnnotations(
        annotationIds,
        excludeLinkingId,
      );
      setValidation(result);
    } catch (error) {
      console.error('Error validating annotations:', error);
      setValidation({
        isValid: false,
        conflicts: [],
        warnings: ['Failed to validate annotations'],
        mergeable: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
        Validating annotations...
      </div>
    );
  }

  if (!validation || annotationIds.length <= 1) {
    return null;
  }

  // Don't show anything if there are no conflicts, warnings, or mergeable items
  if (
    validation.isValid &&
    validation.warnings.length === 0 &&
    (!validation.mergeable || validation.mergeable.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-2">
      {validation.conflicts.length > 0 && (
        <Alert variant="destructive" className="text-xs p-2">
          <AlertTriangle className="h-3 w-3" />
          <div>
            <div className="font-medium">Conflicts Found:</div>
            <ul className="mt-1 space-y-1">
              {validation.conflicts.map((conflict, idx) => (
                <li key={idx}>
                  Annotation {conflict.annotationId.slice(-8)} is already part
                  of a {conflict.conflictType} relationship
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {validation.mergeable && validation.mergeable.length > 0 && (
        <Alert
          variant="default"
          className="text-xs p-2 bg-primary/5 border-primary/20"
        >
          <Info className="h-3 w-3" />
          <div>
            <div className="font-medium text-primary">
              Mergeable Annotations Found:
            </div>
            <ul className="mt-1 space-y-1">
              {validation.mergeable.map((merge, idx) => (
                <li key={idx} className="text-primary/80">
                  <strong>Annotation {merge.annotationId.slice(-8)}</strong>:{' '}
                  {merge.reason}
                  <br />
                  <span className="text-xs text-primary/60">
                    Existing content: {merge.existingContent.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-primary font-medium">
              ✓ These annotations can be safely merged. Saving will combine the
              content.
            </div>
          </div>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert variant="default" className="text-xs p-2">
          <Info className="h-3 w-3" />
          <div>
            <div className="font-medium">Warnings:</div>
            <ul className="mt-1 space-y-1">
              {validation.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}
    </div>
  );
}
