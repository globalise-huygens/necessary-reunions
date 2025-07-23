'use client';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EditableAnnotationText } from '@/components/EditableAnnotationText';
import { GeoTaggingWidget } from '@/components/GeoTaggingWidget';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Annotation } from '@/lib/types';
import {
  ChevronDown,
  ChevronUp,
  GlobeLock,
  Link,
  Link2,
  MapPin,
  Target,
  Type,
  X,
} from 'lucide-react';
import React, {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PointSelector } from './PointSelector';

const getBodies = (annotation: Annotation) => {
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : ([annotation.body] as any[]);
  return bodies.filter((b) => b.type === 'TextualBody');
};

const getLoghiBody = (annotation: Annotation) => {
  if (!annotation.body) return null;
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];
  return bodies.find(
    (body: any) =>
      body.generator?.id === 'https://loghi.nl' ||
      body.generator?.label === 'Loghi' ||
      body.purpose === 'classifying',
  );
};

const getAnnotationText = (annotation: Annotation): string => {
  if (!annotation.body) return '';
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  if (
    annotation.motivation === 'iconography' ||
    annotation.motivation === 'iconograpy'
  ) {
    return 'Icon';
  }

  const textBodies = bodies.filter((body: any) => body.type === 'TextualBody');
  const loghiBody = getLoghiBody(annotation);

  if (loghiBody && loghiBody.value) {
    return loghiBody.value;
  }

  const firstTextBody = textBodies[0];
  return firstTextBody?.value || '';
};

const MemoizedTabButton = memo(
  ({
    active,
    onClick,
    icon,
    label,
    description,
    disabled = false,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    description: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 p-2 sm:p-3 rounded-md text-left transition-all min-w-0 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : disabled
          ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-2 mb-1 min-w-0">
        {icon}
        <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
      </div>
      <p className="text-xs opacity-80 hidden sm:block truncate">
        {description}
      </p>
    </button>
  ),
);

MemoizedTabButton.displayName = 'MemoizedTabButton';

const MemoizedBadge = memo(Badge);
MemoizedBadge.displayName = 'MemoizedBadge';

const MemoizedButton = memo(Button);
MemoizedButton.displayName = 'MemoizedButton';

export const AnnotationEditor = memo(
  ({
    annotation,
    session,
    geotag,
    linkedIds = [], // default to empty array
    annotations = [], // default to empty array
    onRefreshAnnotations,
    onLinkCreated,
    onCurrentPointSelectorChange,
    linkingMode,
    setLinkingMode,
    selectedIds = [], // default to empty array
    setSelectedIds,
    getEtag,
    canvasId,
    manifestId,
    onSaveViewport,
    onOptimisticAnnotationAdd,
    onAnnotationInLinkingMode,
    onAnnotationSelect,
    onEnsureExpanded,
    pendingGeotags,
    setPendingGeotags,
    toast,
  }: {
    annotation: any;
    session: any;
    geotag: any;
    linkedIds?: string[]; // make optional
    annotations?: any[]; // make optional
    onRefreshAnnotations?: () => void;
    onLinkCreated?: () => void;
    onCurrentPointSelectorChange?: (
      point: { x: number; y: number } | null,
    ) => void;
    linkingMode?: boolean;
    setLinkingMode?: (v: boolean) => void;
    selectedIds?: string[]; // make optional
    setSelectedIds?: (ids: string[]) => void;
    getEtag: (id: string) => string | undefined;
    canvasId: string;
    manifestId?: string;
    onSaveViewport?: (viewport: any) => void;
    onOptimisticAnnotationAdd?: (anno: any) => void;
    onAnnotationInLinkingMode?: (annotationId: string | null) => void;
    onAnnotationSelect?: (id: string) => void;
    onEnsureExpanded?: (id: string) => void;
    pendingGeotags: Record<string, any>;
    setPendingGeotags: React.Dispatch<
      React.SetStateAction<Record<string, any>>
    >;
    toast: any;
  }) => {
    const [activeTab, setActiveTab] = useState<'link' | 'geotag' | 'point'>(
      'link',
    );

    const [pendingGeotag, setPendingGeotag] = useState<any>(null);
    const [pendingPoint, setPendingPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (onAnnotationInLinkingMode) {
        if (activeTab === 'link') {
          onAnnotationInLinkingMode(annotation.id);

          if (
            setSelectedIds &&
            (!selectedIds ||
              selectedIds.length === 0 ||
              !selectedIds.includes(annotation.id))
          ) {
            const linkingAnnos = getLinkingAnnotations(annotation.id);
            if (
              linkingAnnos.length > 0 &&
              Array.isArray(linkingAnnos[0].target)
            ) {
              setSelectedIds(linkingAnnos[0].target);
            } else {
              setSelectedIds([annotation.id]);
            }
          }
        } else {
          onAnnotationInLinkingMode(null);
          if (setSelectedIds && !isSaving) {
            setSelectedIds([]);
          }
        }
      }
    }, [activeTab, annotation.id, onAnnotationInLinkingMode, isSaving]);

    useEffect(() => {
      if (activeTab === 'link') {
      }
    }, [selectedIds, activeTab]);

    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }, []);

    const getLinkingAnnotations = (annotationId: string) => {
      return annotations.filter((a) => {
        if (a.motivation !== 'linking') return false;
        if (Array.isArray(a.target)) {
          return a.target.includes(annotationId);
        }
        return a.target === annotationId;
      });
    };

    const hasPendingChanges = (() => {
      if (activeTab === 'geotag') return !!pendingGeotag;
      if (activeTab === 'point') return !!pendingPoint;
      if (activeTab === 'link') return selectedIds && selectedIds.length > 1;
      return false;
    })();

    const hasExistingData = (() => {
      if (activeTab === 'geotag') return !!geotag;
      if (activeTab === 'point') {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        for (const linkAnno of linkingAnnos) {
          if (linkAnno.body && Array.isArray(linkAnno.body)) {
            const pointSelectorBody = linkAnno.body.find(
              (b: any) =>
                b.type === 'SpecificResource' &&
                b.purpose === 'identifying' &&
                b.selector &&
                b.selector.type === 'PointSelector',
            );
            if (pointSelectorBody) return true;
          }
        }
        return false;
      }
      if (activeTab === 'link') return linkedIds.length > 0;
      return false;
    })();

    const TabButton = MemoizedTabButton;

    const getSmartSuggestions = (annotation: any) => {
      const bodies = annotation.body || [];
      const textContent = bodies
        .filter((b: any) => b.type === 'TextualBody')
        .map((b: any) => b.value || '')
        .join(' ')
        .toLowerCase();

      const hasPlaceIndicators =
        /\b(in|at|near|from|to|town|city|village|street|amsterdam|london|paris|church|market|house|building)\b/.test(
          textContent,
        );
      const hasLocationWords =
        /\b(amsterdam|london|paris|church|market|house|street|road|square|bridge)\b/.test(
          textContent,
        );
      const hasConnectiveWords =
        /\b(and|with|next to|beside|above|below|between)\b/.test(textContent);

      return {
        suggestLinking: hasConnectiveWords || textContent.length > 50,
        suggestGeotagging: hasLocationWords || hasPlaceIndicators,
        suggestPoint: hasLocationWords,
        explanation: hasLocationWords
          ? 'This annotation mentions specific places that could be mapped geographically.'
          : hasConnectiveWords
          ? 'This annotation contains words that suggest it might relate to other annotations.'
          : null,
      };
    };

    const memoizedInitialGeotag = useMemo(() => {
      return geotag
        ? {
            marker: [
              parseFloat(geotag.source.lat || '0'),
              parseFloat(geotag.source.lon || '0'),
            ] as [number, number],
            label: geotag.source.properties?.title || geotag.source.label || '',
            nominatimResult: geotag.source,
          }
        : undefined;
    }, [geotag]);

    const handleGeotagSelected = useCallback(
      (selectedGeotag: any) => {
        setPendingGeotag(selectedGeotag);
        setSaveError(null);

        toast({
          title: 'Location Selected',
          description:
            'Geographic location ready to save. Click "Save Changes" below.',
        });
      },
      [toast],
    );

    const performSave = useCallback(
      async (
        annotationData: any,
        existingLink: any,
        onSuccess: () => void,
        successMessage: string,
      ) => {
        let response;
        if (existingLink) {
          response = await fetch(`/api/annotations/${existingLink.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
              'If-Match': getEtag(existingLink.id) || '',
            },
            body: JSON.stringify(annotationData),
          });
        } else {
          response = await fetch('/api/annotations', {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
              Slug: `linking-${annotation.id.split('/').pop()}`,
            },
            body: JSON.stringify(annotationData),
          });
        }

        if (!response.ok) {
          throw new Error(
            `Failed to save: ${response.status} ${response.statusText}`,
          );
        }

        const savedAnnotation = await response.json();

        if (onOptimisticAnnotationAdd && savedAnnotation) {
          onOptimisticAnnotationAdd({
            ...annotationData,
            id:
              savedAnnotation.id ||
              (existingLink ? existingLink.id : `temp-${Date.now()}`),
            etag: savedAnnotation.etag || response.headers.get('etag'),
          });
        }

        onSuccess();

        toast({
          title: successMessage,
          description: 'Changes saved successfully.',
        });

        onLinkCreated?.();
      },
      [
        session,
        annotation.id,
        getEtag,
        onOptimisticAnnotationAdd,
        onLinkCreated,
        toast,
      ],
    );

    const handleSaveLinkingData = useCallback(async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!selectedIds || selectedIds.length <= 1) {
        setSaveError(
          'You need to select at least 2 annotations to create a link.',
        );
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      const currentAnnotationId = annotation.id;

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (
              body.purpose === 'geotagging' ||
              (body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector')
            ) {
              bodies.push(body);
            }
          });
        }

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: selectedIds,
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {},
          'Link Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save link');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save link. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, [
      session,
      selectedIds,
      annotation.id,
      getLinkingAnnotations,
      getEtag,
      onLinkCreated,
      onOptimisticAnnotationAdd,
      toast,
      performSave,
    ]);

    const handleSaveGeotagData = async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!pendingGeotag) {
        setSaveError('No geotag changes to save.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (body.purpose !== 'geotagging') {
              bodies.push(body);
            }
          });
        }

        const geotagBody = {
          type: 'SpecificResource',
          purpose: 'geotagging',
          source: {
            id: pendingGeotag.nominatimResult.place_id.toString(),
            type: pendingGeotag.osmType,
            label: pendingGeotag.displayName,
            lat: pendingGeotag.marker[0].toString(),
            lon: pendingGeotag.marker[1].toString(),
            properties: {
              title: pendingGeotag.label,
            },
          },
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: new Date().toISOString(),
        };
        bodies.push(geotagBody);

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: existingLink?.target || [annotation.id],
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {
            setPendingGeotag(null);
          },
          'Location Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save geotag');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save location. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const handleSavePointData = async () => {
      if (!session) {
        setSaveError('You must be logged in to save changes.');
        return;
      }

      if (!pendingPoint) {
        setSaveError('No point changes to save.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        const bodies: any[] = [];

        if (
          existingLink &&
          existingLink.body &&
          Array.isArray(existingLink.body)
        ) {
          existingLink.body.forEach((body: any) => {
            if (
              !(
                body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector'
              )
            ) {
              bodies.push(body);
            }
          });
        }

        const pointSelectorBody = {
          type: 'SpecificResource',
          purpose: 'identifying',
          source: canvasId,
          selector: {
            type: 'PointSelector',
            x: pendingPoint.x,
            y: pendingPoint.y,
          },
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: new Date().toISOString(),
        };
        bodies.push(pointSelectorBody);

        const annotationData = {
          '@context': 'http://www.w3.org/ns/anno.jsonld',
          type: 'Annotation',
          motivation: 'linking',
          target: existingLink?.target || [annotation.id],
          body: bodies,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: existingLink?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        await performSave(
          annotationData,
          existingLink,
          () => {
            setPendingPoint(null);
          },
          'Point Saved!',
        );
      } catch (error: any) {
        setSaveError(error.message || 'Failed to save point');
        toast({
          title: 'Save Failed',
          description:
            error.message || 'Failed to save point. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const handleRemoveData = async (type: 'link' | 'geotag' | 'point') => {
      if (!session) {
        setSaveError('You must be logged in to remove data.');
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const linkingAnnos = getLinkingAnnotations(annotation.id);
        const existingLink = linkingAnnos.length > 0 ? linkingAnnos[0] : null;

        if (!existingLink) {
          setSaveError('No existing data to remove.');
          return;
        }

        if (type === 'link') {
          const hasOtherData =
            existingLink.body &&
            Array.isArray(existingLink.body) &&
            existingLink.body.some(
              (body: any) =>
                body.purpose === 'geotagging' ||
                (body.purpose === 'identifying' &&
                  body.selector?.type === 'PointSelector'),
            );

          if (!hasOtherData) {
            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'DELETE',
                headers: {
                  'If-Match': getEtag(existingLink.id) || '',
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to delete: ${response.status} ${response.statusText}`,
              );
            }
          } else {
            const bodies = existingLink.body.filter(
              (body: any) =>
                body.purpose === 'geotagging' ||
                (body.purpose === 'identifying' &&
                  body.selector?.type === 'PointSelector'),
            );

            const annotationData = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              type: 'Annotation',
              motivation: 'linking',
              target: [annotation.id],
              body: bodies,
              creator: {
                id: session.user.id,
                type: 'Person',
                label: session.user.label,
              },
              created: existingLink.created || new Date().toISOString(),
              modified: new Date().toISOString(),
            };

            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type':
                    'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                  'If-Match': getEtag(existingLink.id) || '',
                },
                body: JSON.stringify(annotationData),
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to update: ${response.status} ${response.statusText}`,
              );
            }
          }
        } else {
          const bodies: any[] = [];

          if (existingLink.body && Array.isArray(existingLink.body)) {
            existingLink.body.forEach((body: any) => {
              if (type === 'geotag' && body.purpose === 'geotagging') {
                return;
              }
              if (
                type === 'point' &&
                body.purpose === 'identifying' &&
                body.selector?.type === 'PointSelector'
              ) {
                return;
              }
              bodies.push(body);
            });
          }

          const hasLinkedTargets =
            Array.isArray(existingLink.target) &&
            existingLink.target.length > 1;

          if (bodies.length === 0 && !hasLinkedTargets) {
            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'DELETE',
                headers: {
                  'If-Match': getEtag(existingLink.id) || '',
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to delete: ${response.status} ${response.statusText}`,
              );
            }
          } else {
            const annotationData = {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              type: 'Annotation',
              motivation: 'linking',
              target: existingLink.target,
              body: bodies,
              creator: {
                id: session.user.id,
                type: 'Person',
                label: session.user.label,
              },
              created: existingLink.created || new Date().toISOString(),
              modified: new Date().toISOString(),
            };

            const response = await fetch(
              `/api/annotations/${existingLink.id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type':
                    'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                  'If-Match': getEtag(existingLink.id) || '',
                },
                body: JSON.stringify(annotationData),
              },
            );

            if (!response.ok) {
              throw new Error(
                `Failed to update: ${response.status} ${response.statusText}`,
              );
            }
          }
        }

        if (type === 'geotag') setPendingGeotag(null);
        if (type === 'point') setPendingPoint(null);
        if (type === 'link' && setSelectedIds) setSelectedIds([]);

        const typeLabel =
          type === 'link' ? 'links' : type === 'geotag' ? 'location' : 'point';
        toast({
          title: 'Data Removed!',
          description: `Successfully removed ${typeLabel} from this annotation.`,
        });

        onLinkCreated?.();
      } catch (error: any) {
        setSaveError(error.message || 'Failed to remove data');
        toast({
          title: 'Remove Failed',
          description:
            error.message || 'Failed to remove data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const smartSuggestions = getSmartSuggestions(annotation);

    // Text editing functionality
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const loghiBody = getLoghiBody(annotation);
    const annotationText = getAnnotationText(annotation);
    const isTextEditable = !!loghiBody; // Only allow editing of Loghi text

    const handleUpdateAnnotationText = useCallback(
      async (annotation: Annotation, newValue: string) => {
        if (!session?.user) {
          throw new Error('You must be logged in to edit annotations');
        }

        // Update the Loghi body only
        const bodies = getBodies(annotation);
        const updatedBodies = bodies.map((body: any) => {
          if (
            body.generator?.id === 'https://loghi.nl' ||
            body.generator?.label === 'Loghi' ||
            body.purpose === 'classifying'
          ) {
            return {
              ...body,
              value: newValue,
              modified: new Date().toISOString(),
            };
          }
          return body;
        });

        const updatedAnnotation = {
          ...annotation,
          body: updatedBodies,
          modified: new Date().toISOString(),
        };

        // Save to API
        const response = await fetch(`/api/annotations/${annotation.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          body: JSON.stringify(updatedAnnotation),
        });

        if (!response.ok) {
          throw new Error(`Failed to update annotation: ${response.status}`);
        }

        // Call the update callback if provided
        if (onRefreshAnnotations) {
          onRefreshAnnotations();
        }

        toast({
          title: 'Text Updated',
          description: 'Annotation text has been saved successfully.',
        });
      },
      [session, onRefreshAnnotations, toast],
    );

    return (
      <div className="space-y-2">
        {/* Text editing section - only show for annotations with Loghi text */}
        {(isTextEditable || annotation.motivation === 'textspotting') && (
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">
                {annotation.motivation === 'iconography' ||
                annotation.motivation === 'iconograpy'
                  ? 'Icon Label'
                  : 'Text Content'}
              </h3>
              {isTextEditable && (
                <Badge variant="secondary" className="text-xs">
                  Loghi
                </Badge>
              )}
            </div>

            {isTextEditable ? (
              <EditableAnnotationText
                annotation={annotation}
                value={annotationText}
                placeholder={
                  annotation.motivation === 'iconography' ||
                  annotation.motivation === 'iconograpy'
                    ? 'Describe this icon...'
                    : 'Enter text content...'
                }
                multiline={annotationText.length > 50}
                canEdit={isTextEditable && !!session?.user}
                onUpdate={handleUpdateAnnotationText}
                isEditing={editingTextId === annotation.id}
                onStartEdit={() => setEditingTextId(annotation.id)}
                onCancelEdit={() => setEditingTextId(null)}
                onFinishEdit={() => setEditingTextId(null)}
                className="w-full"
              />
            ) : (
              <div className="text-sm text-muted-foreground p-2 bg-muted/20 rounded border-dashed border">
                {annotationText ||
                  (annotation.motivation === 'iconography' ||
                  annotation.motivation === 'iconograpy'
                    ? 'Icon annotation - no editable text'
                    : 'No editable text available')}
                {!isTextEditable && annotationText && (
                  <div className="text-xs text-muted-foreground mt-1">
                    • Text generated by{' '}
                    {getBodies(annotation).find(
                      (b: any) => b.type === 'TextualBody',
                    )?.generator?.label || 'AI'}{' '}
                    - not editable
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-2 bg-muted/20 border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <GlobeLock className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Annotation Details</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID:</span>
              <span className="font-mono">
                {annotation.id.split('/').pop()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{annotation.motivation || 'annotation'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GeoTag:</span>
              <span
                className={geotag ? 'text-green-600' : 'text-muted-foreground'}
              >
                {geotag
                  ? geotag.source.properties?.title || geotag.source.label
                  : 'none'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Links:</span>
              <span
                className={(() => {
                  const currentCount =
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                      ? selectedIds.length
                      : linkedIds.length;
                  return currentCount > 0
                    ? 'text-blue-600'
                    : 'text-muted-foreground';
                })()}
              >
                {(() => {
                  const currentCount =
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                      ? selectedIds.length
                      : linkedIds.length;
                  return currentCount > 0
                    ? `${currentCount} connected`
                    : 'none';
                })()}
              </span>
            </div>
          </div>

          {(linkedIds.length > 0 ||
            (activeTab === 'link' &&
              selectedIds &&
              selectedIds.length > 0)) && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">
                {activeTab === 'link' && selectedIds && selectedIds.length > 0
                  ? 'Linked annotations (click in image to add/remove):'
                  : 'Linked annotations (reading order):'}
              </div>
              <div className="flex flex-wrap gap-1 max-w-full">
                {(() => {
                  let orderedIds: string[] = [];
                  if (
                    activeTab === 'link' &&
                    selectedIds &&
                    selectedIds.length > 0
                  ) {
                    orderedIds = selectedIds;
                  } else {
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    if (
                      linkingAnnos.length > 0 &&
                      Array.isArray(linkingAnnos[0].target)
                    ) {
                      orderedIds = linkingAnnos[0].target;
                    } else {
                      orderedIds = [annotation.id];
                    }
                  }

                  return orderedIds.map((lid, index) => {
                    const linkedAnno = annotations.find((a) => a.id === lid);
                    let label = lid;
                    if (linkedAnno) {
                      if (
                        linkedAnno.motivation === 'iconography' ||
                        linkedAnno.motivation === 'iconograpy'
                      ) {
                        label = 'Icon';
                      } else if (Array.isArray(linkedAnno.body)) {
                        // Use the first available text body value
                        if (linkedAnno.body[0]?.value) {
                          label = linkedAnno.body[0].value;
                        }
                      }
                    }
                    const isCurrent = lid === annotation.id;
                    const sequenceNumber = index + 1;

                    return (
                      <span
                        key={lid}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium max-w-[120px] ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <span className="bg-background text-foreground rounded-full w-3 h-3 text-xs flex items-center justify-center font-bold leading-none flex-shrink-0">
                          {sequenceNumber}
                        </span>
                        <span className="truncate">
                          {label.length > 12
                            ? label.substring(0, 12) + '...'
                            : label}
                        </span>
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Smart suggestions */}
        {smartSuggestions.explanation && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">💡</span>
              </div>
              <div>
                <div className="font-medium text-blue-900 text-sm">
                  Smart Suggestion
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {smartSuggestions.explanation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-muted/20 rounded-lg overflow-x-auto">
          <TabButton
            active={activeTab === 'link'}
            onClick={() => setActiveTab('link')}
            icon={
              <div className="flex items-center gap-1">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestLinking && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Link"
            description="Connect related annotations"
          />
          <TabButton
            active={activeTab === 'geotag'}
            onClick={() => setActiveTab('geotag')}
            icon={
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestGeotagging && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Location"
            description="Associate with real place"
          />
          <TabButton
            active={activeTab === 'point'}
            onClick={() => setActiveTab('point')}
            icon={
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {smartSuggestions.suggestPoint && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            }
            label="Point"
            description="Point to location on image"
          />
        </div>

        {/* Save/Update/Remove Controls - Always visible for all tabs */}
        <div className="flex items-center justify-between p-2 bg-muted/10 border border-border rounded-lg">
          <div className="flex-1">
            {hasPendingChanges ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                {/* <span className="text-sm font-medium text-amber-700">
                  You have unsaved changes
                </span> */}
              </div>
            ) : hasExistingData ? (
              <span className="text-sm text-muted-foreground">
                {activeTab === 'geotag' &&
                  'Location set - modify below or remove'}
                {activeTab === 'point' && 'Point set - modify below or remove'}
                {activeTab === 'link' && 'Links exist - modify below or remove'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {activeTab === 'geotag' && 'No location - add below'}
                {activeTab === 'point' && 'No point - add below'}
                {activeTab === 'link' && 'No links - create below'}
              </span>
            )}
            {saveError && (
              <div className="text-xs text-destructive mt-1">{saveError}</div>
            )}
          </div>
          <div className="flex gap-2">
            {/* {hasPendingChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeTab === 'geotag') setPendingGeotag(null);
                  if (activeTab === 'point') setPendingPoint(null);
                  if (activeTab === 'link' && setSelectedIds) {
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    if (
                      linkingAnnos.length > 0 &&
                      Array.isArray(linkingAnnos[0].target)
                    ) {
                      setSelectedIds(linkingAnnos[0].target);
                    } else {
                      setSelectedIds([annotation.id]);
                    }
                  }
                  setSaveError(null);
                }}
                disabled={isSaving}
                className="text-xs"
              >
                Discard
              </Button>
            )} */}
            {hasExistingData && !hasPendingChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeTab === 'geotag') handleRemoveData('geotag');
                  else if (activeTab === 'point') handleRemoveData('point');
                  else if (activeTab === 'link') handleRemoveData('link');
                }}
                disabled={isSaving}
                className="text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            )}
            <Button
              onClick={async () => {
                setIsSaving(true);

                try {
                  if (activeTab === 'link') await handleSaveLinkingData();
                  else if (activeTab === 'geotag') await handleSaveGeotagData();
                  else if (activeTab === 'point') await handleSavePointData();
                } catch (error) {
                  console.error('Save error:', error);
                }
              }}
              disabled={!hasPendingChanges || isSaving || !session}
              size="sm"
              className="text-xs font-medium"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                (() => {
                  if (activeTab === 'link') return 'Save Link';
                  if (activeTab === 'geotag')
                    return hasExistingData
                      ? 'Update Location'
                      : 'Save Location';
                  if (activeTab === 'point')
                    return hasExistingData ? 'Update Point' : 'Save Point';
                  return 'Save';
                })()
              )}
            </Button>
          </div>
        </div>

        {/* Tab content */}
        <div
          className="p-2 bg-card border border-border rounded-lg"
          style={{ minHeight: '200px' }}
        >
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-5 h-5 text-primary flex-shrink-0" />
                <h3 className="font-medium">Link Annotations</h3>
              </div>

              {/* Link Building Section - Always visible in Link tab */}
              <div className="space-y-3 p-3 bg-secondary/10 border border-secondary/30 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-primary">
                    Link Builder
                  </h4>
                </div>

                {/* Current selection */}
                {selectedIds && selectedIds.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-foreground">
                      Selected Annotations ({selectedIds.length})
                    </h5>
                    <div className="space-y-2">
                      {selectedIds.map((id, index) => {
                        const anno = annotations.find((a) => a.id === id);
                        if (!anno) return null;

                        const isCurrent = id === annotation.id;
                        const title =
                          anno.motivation === 'iconography' ||
                          anno.motivation === 'iconograpy'
                            ? 'Icon'
                            : (Array.isArray(anno.body) &&
                                anno.body[0]?.value) ||
                              'Untitled';

                        const canMoveUp = index > 0;
                        const canMoveDown = index < selectedIds.length - 1;

                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 p-2 rounded border ${
                              isCurrent
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/20 border-border'
                            }`}
                          >
                            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="text-sm font-medium truncate">
                                {title}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded whitespace-nowrap">
                                Current
                              </span>
                            )}

                            {/* Reordering controls */}
                            {selectedIds.length > 1 && (
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (canMoveUp && setSelectedIds) {
                                      const newIds = [...selectedIds];
                                      [newIds[index], newIds[index - 1]] = [
                                        newIds[index - 1],
                                        newIds[index],
                                      ];
                                      setSelectedIds(newIds);
                                    }
                                  }}
                                  disabled={!canMoveUp}
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (canMoveDown && setSelectedIds) {
                                      const newIds = [...selectedIds];
                                      [newIds[index], newIds[index + 1]] = [
                                        newIds[index + 1],
                                        newIds[index],
                                      ];
                                      setSelectedIds(newIds);
                                    }
                                  }}
                                  disabled={!canMoveDown}
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {/* Remove from selection */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (setSelectedIds) {
                                  const newIds = selectedIds.filter(
                                    (selectedId) => selectedId !== id,
                                  );
                                  setSelectedIds(newIds);
                                }
                              }}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-red-600 flex-shrink-0"
                              title="Remove from link"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {selectedIds.length < 2 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                        Select at least 2 annotations to create a link
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center text-muted-foreground bg-card/50 rounded border border-dashed border-muted-foreground/30">
                    <p className="text-sm">
                      No annotations selected for linking
                    </p>
                    <p className="text-xs mt-1">
                      Click annotations in the image viewer to start building a
                      link
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      The current annotation will automatically be included
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'geotag' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-medium">Geographic Location</h3>
              </div>

              {/* Show existing geotag if present */}
              {geotag && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">
                      Current Location
                    </span>
                  </div>
                  <p className="text-sm text-green-700">
                    {geotag.source.properties?.title || geotag.source.label}
                    {geotag.source?.type && (
                      <span className="text-green-600 ml-1">
                        ({geotag.source.type})
                      </span>
                    )}
                  </p>
                  {geotag.created && (
                    <p className="text-xs text-green-600 mt-1">
                      Created: {new Date(geotag.created).toLocaleString()}
                      {geotag.creator?.label && ` by ${geotag.creator.label}`}
                    </p>
                  )}
                </div>
              )}

              {/* Show pending geotag if present */}
              {pendingGeotag && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      Pending Location Change
                    </span>
                  </div>
                  <p className="text-sm text-amber-700">
                    {pendingGeotag.label}
                    <span className="text-amber-600 ml-1">
                      ({pendingGeotag.osmType})
                    </span>
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Coordinates: {pendingGeotag.marker[0].toFixed(5)},{' '}
                    {pendingGeotag.marker[1].toFixed(5)}
                  </p>
                </div>
              )}

              {/* GeoTagging Widget */}
              <React.Fragment>
                <Suspense
                  fallback={
                    <div className="p-4 text-center border border-border rounded-lg">
                      <LoadingSpinner />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading map widget...
                      </p>
                    </div>
                  }
                >
                  <GeoTaggingWidget
                    target={annotation.id}
                    expandedStyle={true}
                    initialGeotag={memoizedInitialGeotag}
                    onGeotagSelected={handleGeotagSelected}
                  />
                </Suspense>
              </React.Fragment>
            </div>
          )}

          {activeTab === 'point' && (
            <div className="space-y-4">
              {' '}
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="font-medium">Image Point Mapping</h3>
              </div>
              {/* Show pending point if present */}
              {pendingPoint && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      Pending Point Change
                    </span>
                  </div>
                  <p className="text-sm text-amber-700">
                    New coordinates: ({pendingPoint.x}, {pendingPoint.y})
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This point will be saved when you click "Save Changes"
                  </p>
                </div>
              )}
              {/* PointSelector Widget */}
              <Suspense fallback={<LoadingSpinner />}>
                <PointSelector
                  value={(() => {
                    // Get existing point selector from linking annotations
                    const linkingAnnos = getLinkingAnnotations(annotation.id);
                    for (const linkAnno of linkingAnnos) {
                      if (linkAnno.body && Array.isArray(linkAnno.body)) {
                        const pointSelectorBody = linkAnno.body.find(
                          (b: any) =>
                            b.type === 'SpecificResource' &&
                            b.purpose === 'identifying' &&
                            b.selector &&
                            b.selector.type === 'PointSelector',
                        );
                        if (pointSelectorBody && pointSelectorBody.selector) {
                          return {
                            x: pointSelectorBody.selector.x,
                            y: pointSelectorBody.selector.y,
                          };
                        }
                      }
                    }
                    return null;
                  })()}
                  onChange={(point: { x: number; y: number } | null) => {
                    // Store as pending change instead of immediately saving
                    setPendingPoint(point);
                    setSaveError(null);
                    onCurrentPointSelectorChange?.(point);
                  }}
                  canvasId={canvasId}
                  manifestId={manifestId}
                  expandedStyle={true}
                  existingAnnotations={annotations}
                  currentAnnotationId={annotation.id}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    );
  },
);

AnnotationEditor.displayName = 'AnnotationEditor';
