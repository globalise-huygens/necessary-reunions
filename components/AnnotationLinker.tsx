'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Link2, X, Edit3, MapPin } from 'lucide-react';
import { Button } from './Button';
import dynamic from 'next/dynamic';
import { deleteAnnotation, updateAnnotationClient } from '../lib/annoRepo';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

const GeoTaggingWidget = dynamic(
  () => import('./GeoTaggingWidget').then((mod) => mod.GeoTaggingWidget),
  { ssr: false },
);

export function AnnotationLinker({
  annotations,
  session,
  onLinkCreated,
  linkingMode,
  setLinkingMode,
  selectedIds,
  setSelectedIds,
  existingLink,
  containerName = 'my-container',
  pendingGeotag,
  expandedStyle = false,
  onSaveViewport,
  onOptimisticAnnotationAdd,
  currentAnnotationId,
}: {
  annotations: any[];
  session: any;
  onLinkCreated?: () => void;
  linkingMode?: boolean;
  setLinkingMode?: (v: boolean) => void;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  existingLink?: any;
  containerName?: string;
  pendingGeotag?: any;
  expandedStyle?: boolean;
  onSaveViewport?: (viewport: any) => void;
  onOptimisticAnnotationAdd?: (anno: any) => void;
  currentAnnotationId?: string;
}) {
  const [internalLinking, setInternalLinking] = useState(false);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [localGeotag, setLocalGeotag] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [createdAnnotation, setCreatedAnnotation] = useState<{
    id: string;
    etag: string;
  } | null>(null);
  const [linkedAnno, setLinkedAnno] = useState<{
    id: string;
    etag: string;
  } | null>(null);
  const { toast } = useToast();

  const linking = linkingMode !== undefined ? linkingMode : internalLinking;
  const selected = selectedIds !== undefined ? selectedIds : internalSelected;
  const setLinking = setLinkingMode || setInternalLinking;
  const setSelected = setSelectedIds || setInternalSelected;

  useEffect(() => {
    if (existingLink && existingLink.id && existingLink.etag) {
      setLinkedAnno({ id: existingLink.id, etag: existingLink.etag });

      if (
        linking &&
        existingLink.target &&
        Array.isArray(existingLink.target)
      ) {
        setSelected(existingLink.target);
      }

      if (existingLink.body && Array.isArray(existingLink.body)) {
        const geotagBody = existingLink.body.find(
          (b: any) =>
            b.type === 'SpecificResource' &&
            b.purpose === 'geotagging' &&
            b.source,
        );
        if (geotagBody && !localGeotag) {
          const coords = geotagBody.source.geometry?.coordinates;
          if (coords && coords.length === 2) {
            const placeIdStr = geotagBody.source.id?.split('/').pop();
            const placeId = placeIdStr ? parseInt(placeIdStr, 10) : Date.now();

            const geotagLabel =
              geotagBody.source.properties?.title ||
              geotagBody.source.properties?.description ||
              'Unknown location';

            setLocalGeotag({
              marker: [coords[1], coords[0]],
              label: geotagLabel,
              nominatimResult: {
                display_name: geotagLabel,
                lat: coords[1].toString(),
                lon: coords[0].toString(),
                place_id: isNaN(placeId) ? Date.now() : placeId,
                osm_type: 'node',
              },
            });
          }
        }
      }
    } else if (
      createdAnnotation &&
      createdAnnotation.id &&
      createdAnnotation.etag
    ) {
      setLinkedAnno({ id: createdAnnotation.id, etag: createdAnnotation.etag });
    } else {
      setLinkedAnno(null);
    }
  }, [existingLink, createdAnnotation, linking]);

  useEffect(() => {
    if (currentAnnotationId) {
      setLinking(false);
      setSelected([]);
      setLocalGeotag(null);
    }
  }, [currentAnnotationId]);

  const handleSelect = (id: string) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((x: string) => x !== id)
        : [...selected, id],
    );
  };

  const geotag = pendingGeotag ?? localGeotag;

  const handleEnterLinkingMode = () => {
    setLinking(true);

    if (
      existingLink &&
      existingLink.target &&
      Array.isArray(existingLink.target)
    ) {
      const linkedIds = existingLink.target.filter(
        (id: string) => id && id !== currentAnnotationId,
      );
      setSelected(linkedIds);
    }

    if (!localGeotag && !pendingGeotag && currentAnnotationId) {
      const relatedLinkingAnnotations = annotations.filter((a) => {
        if (a.motivation !== 'linking') return false;

        if (Array.isArray(a.target)) {
          return a.target.includes(currentAnnotationId);
        } else if (a.target === currentAnnotationId) {
          return true;
        }
        return false;
      });

      for (const link of relatedLinkingAnnotations) {
        if (link.body && Array.isArray(link.body)) {
          const geotagBody = link.body.find(
            (b: any) =>
              b.type === 'SpecificResource' &&
              (b.purpose === 'geotagging' || b.purpose === 'identifying') &&
              b.source,
          );

          if (geotagBody) {
            const coords = geotagBody.source.geometry?.coordinates;
            if (coords && coords.length === 2) {
              const placeIdStr = geotagBody.source.id?.split('/').pop();
              const placeId = placeIdStr
                ? parseInt(placeIdStr, 10)
                : Date.now();

              const geotagLabel =
                geotagBody.source.properties?.title ||
                geotagBody.source.properties?.description ||
                geotagBody.source.label ||
                'Location from existing link';

              setLocalGeotag({
                marker: [coords[1], coords[0]],
                label: geotagLabel,
                nominatimResult: {
                  display_name: geotagLabel,
                  lat: coords[1].toString(),
                  lon: coords[0].toString(),
                  place_id: isNaN(placeId) ? Date.now() : placeId,
                  osm_type: 'node',
                },
              });
              break;
            }
          }
        }
      }
    }
  };

  const createOrUpdateAnnotation = async (annotation: any) => {
    const isUpdating = existingLink && existingLink.id && existingLink.etag;

    if (isUpdating) {
      const result = await updateAnnotationClient(
        existingLink.id,
        {
          ...annotation,
          creator: {
            id: session.user.id,
            type: 'Person',
            label: session.user.label,
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        existingLink.etag,
      );

      setLinkedAnno({ id: result.annotation.id, etag: result.etag });

      onOptimisticAnnotationAdd?.({
        ...result.annotation,
        etag: result.etag,
      });

      return {
        annotation: result.annotation,
        etag: result.etag,
        isUpdate: true,
      };
    } else {
      const slug =
        annotation.target.length > 0
          ? `linking-${uuidv4()}`
          : `geotag-${uuidv4()}`;
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          'Content-Type':
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          Slug: slug,
        },
        body: JSON.stringify(annotation),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save annotation');
      }

      const data = await res.json();
      setCreatedAnnotation({ id: data.id, etag: data.etag });

      onOptimisticAnnotationAdd?.({
        ...annotation,
        id: data.id,
        etag: data.etag,
      });

      return {
        annotation: data,
        etag: data.etag,
        isUpdate: false,
      };
    }
  };

  const triggerSaveViewport = () => {
    if (
      typeof onSaveViewport === 'function' &&
      window &&
      (window as any).osdViewer
    ) {
      try {
        const viewer = (window as any).osdViewer;
        if (viewer && viewer.viewport) {
          const bounds = viewer.viewport.getBounds();
          onSaveViewport(bounds);
        }
      } catch {}
    }
  };

  const handleSaveGeotagOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session || !geotag) {
      setError('Please select a geotag.');
      return;
    }
    triggerSaveViewport();
    setSubmitting(true);
    try {
      const placeId = geotag.nominatimResult?.place_id
        ? `https://data.globalise.huygens.knaw.nl/some_unique_pid/place/${geotag.nominatimResult.place_id}`
        : undefined;
      const label = geotag.nominatimResult?.display_name || geotag.label || '';
      const coords = geotag.marker || [
        parseFloat(geotag.nominatimResult?.lat),
        parseFloat(geotag.nominatimResult?.lon),
      ];

      const identifyingBody = {
        type: 'SpecificResource',
        purpose: 'identifying',
        source: {
          id: placeId,
          type: 'Place',
          label,
          defined_by:
            coords && coords.length === 2
              ? `POINT(${coords[1]} ${coords[0]})`
              : undefined,
        },
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const geotaggingBody = {
        type: 'SpecificResource',
        purpose: 'geotagging',
        source: {
          id: placeId,
          type: 'Feature',
          properties: {
            title: label,
            description: geotag.nominatimResult?.display_name || '',
          },
          geometry: {
            type: 'Point',
            coordinates:
              coords && coords.length === 2 ? [coords[1], coords[0]] : [],
          },
        },
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: [],
        body: [identifyingBody, geotaggingBody],
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const result = await createOrUpdateAnnotation(annotation);

      setSuccess(true);
      setLocalGeotag(null);
      onLinkCreated?.();

      toast({
        title: result.isUpdate ? 'Geotag updated' : 'Geotag saved',
        description: result.isUpdate
          ? 'The geotag was updated successfully.'
          : 'The geotag was saved successfully.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save geotag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkAnnotationsOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session || selected.length === 0) {
      setError('Select annotations to link.');
      return;
    }
    triggerSaveViewport();
    setSubmitting(true);
    try {
      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selected,
        body: [],
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const result = await createOrUpdateAnnotation(annotation);

      setSuccess(true);
      setLinking(false);
      setSelected([]);
      onLinkCreated?.();

      toast({
        title: result.isUpdate ? 'Link updated' : 'Link created',
        description: result.isUpdate
          ? 'The annotation link was updated successfully.'
          : 'The annotation link was created successfully.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLink = async () => {
    setError(null);
    setSuccess(false);
    if (!session || selected.length === 0 || !geotag) {
      setError('Select annotations and a geotag.');
      return;
    }
    triggerSaveViewport();
    setSubmitting(true);
    try {
      const placeId = geotag.nominatimResult?.place_id
        ? `https://data.globalise.huygens.knaw.nl/some_unique_pid/place/${geotag.nominatimResult.place_id}`
        : undefined;
      const label = geotag.nominatimResult?.display_name || geotag.label || '';
      const coords = geotag.marker || [
        parseFloat(geotag.nominatimResult?.lat),
        parseFloat(geotag.nominatimResult?.lon),
      ];
      const identifyingBody = {
        type: 'SpecificResource',
        purpose: 'identifying',
        source: {
          id: placeId,
          type: 'Place',
          label,
          defined_by:
            coords && coords.length === 2
              ? `POINT(${coords[1]} ${coords[0]})`
              : undefined,
        },
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };
      const geotaggingBody = {
        type: 'SpecificResource',
        purpose: 'geotagging',
        source: {
          id: placeId,
          type: 'Feature',
          properties: {
            title: label,
            description: geotag.nominatimResult?.display_name || '',
          },
          geometry: {
            type: 'Point',
            coordinates:
              coords && coords.length === 2 ? [coords[1], coords[0]] : [],
          },
        },
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };
      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selected,
        body: [identifyingBody, geotaggingBody],
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const result = await createOrUpdateAnnotation(annotation);

      setCreatedAnnotation({ id: result.annotation.id, etag: result.etag });
      setSuccess(true);
      setLinking(false);
      setSelected([]);
      setLocalGeotag(null);
      onLinkCreated?.();

      toast({
        title: result.isUpdate ? 'Link updated' : 'Link created',
        description: result.isUpdate
          ? 'The annotation link and geotag were successfully updated.'
          : 'The annotation link and geotag were successfully created.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (!session) {
      setError('You must be logged in.');
      return;
    }
    if (!geotag && selected.length === 0) {
      setError('Select a geotag or annotations to link.');
      return;
    }

    if (geotag && selected.length > 0) {
      await handleCreateLink();
    } else if (geotag) {
      await handleSaveGeotagOnly();
    } else if (selected.length > 0) {
      await handleLinkAnnotationsOnly();
    }
  };

  async function handleRemove(
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ): Promise<void> {
    event.preventDefault();
    setRemoveError(null);
    setRemoveSuccess(false);
    if (!existingLink || !existingLink.id || !existingLink.etag) {
      setRemoveError('Missing link information.');
      return;
    }
    setRemoving(true);
    try {
      await deleteAnnotation(existingLink.id);
      setRemoveSuccess(true);
      setLinkedAnno(null);
      onLinkCreated?.();
      toast({
        title: 'Geotag removed',
        description: 'The geotag was removed successfully.',
      });
    } catch (e: any) {
      setRemoveError(e.message || 'Failed to remove geotag');
    } finally {
      setRemoving(false);
    }
  }

  // Debug logging removed for production

  const getAnnotationDisplayLabel = (
    annotation: any,
    fallbackId?: string,
  ): string => {
    if (!annotation) {
      if (fallbackId) {
        const foundAnno = annotations.find((a) => a.id === fallbackId);
        if (foundAnno) {
          return getAnnotationDisplayLabel(foundAnno);
        }
        return 'Text annotation';
      }
      return 'Unknown annotation';
    }

    if (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    ) {
      return 'Icon';
    }

    let bodies = Array.isArray(annotation.body) ? annotation.body : [];

    if (bodies.length > 0) {
      const loghiBody = bodies.find((b: any) =>
        b.generator?.label?.toLowerCase().includes('loghi'),
      );
      if (loghiBody && loghiBody.value) {
        return loghiBody.value;
      } else if (bodies[0]?.value) {
        return bodies[0].value;
      }
    }

    return 'Text annotation';
  };

  return (
    <div className={expandedStyle ? 'mb-4' : 'mb-4'}>
      {existingLink ? (
        <div
          className={
            expandedStyle
              ? 'rounded bg-white p-2 w-full max-w-none'
              : 'rounded bg-white p-2 w-full max-w-md'
          }
        >
          {!linking ? (
            <>
              <div className="flex flex-col gap-2">
                {' '}
                <Button
                  variant="outline"
                  onClick={() => {
                    setLinking(true);
                    if (
                      existingLink.target &&
                      Array.isArray(existingLink.target)
                    ) {
                      setSelected(existingLink.target);
                    }
                    if (existingLink.body && Array.isArray(existingLink.body)) {
                      const geotagBody = existingLink.body.find(
                        (b: any) =>
                          b.type === 'SpecificResource' &&
                          b.purpose === 'geotagging' &&
                          b.source,
                      );
                      if (geotagBody) {
                        const coords = geotagBody.source.geometry?.coordinates;
                        if (coords && coords.length === 2) {
                          const placeIdStr = geotagBody.source.id
                            ?.split('/')
                            .pop();
                          const placeId = placeIdStr
                            ? parseInt(placeIdStr, 10)
                            : Date.now();

                          const geotagLabel =
                            geotagBody.source.properties?.title ||
                            geotagBody.source.properties?.description ||
                            'Unknown location';

                          const newGeotag = {
                            marker: [coords[1], coords[0]] as [number, number],
                            label: geotagLabel,
                            nominatimResult: {
                              display_name: geotagLabel,
                              lat: coords[1].toString(),
                              lon: coords[0].toString(),
                              place_id: isNaN(placeId) ? Date.now() : placeId,
                              osm_type: 'node',
                            },
                          };
                          setLocalGeotag(newGeotag);
                        }
                      }
                    }
                  }}
                  disabled={!session}
                  className={`w-full py-2 text-sm font-medium justify-center items-center gap-2 ${
                    !session
                      ? 'opacity-50 cursor-not-allowed hover:cursor-not-allowed'
                      : ''
                  }`}
                  style={!session ? { cursor: 'not-allowed' } : {}}
                >
                  <Link2 className="w-4 h-4" />
                  Edit Link
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-full py-2 text-sm font-medium justify-center items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {removing ? 'Removing...' : 'Remove Link'}
                </Button>
              </div>
              {removeError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20 flex items-center gap-2">
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {removeError}
                </div>
              )}
              {removeSuccess && (
                <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded-md border border-emerald-200 flex items-center gap-2">
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Link removed!
                </div>
              )}
            </>
          ) : (
            <div
              className={expandedStyle ? 'space-y-2 max-w-none' : 'space-y-2'}
            >
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-primary font-medium">
                  Editing existing link
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Modify the selections below and save to update the link
                </p>
              </div>

              <div className="flex justify-between items-center mb-2">
                <strong className="text-sm font-medium">
                  Edit linked annotations and geotag
                </strong>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLinking(false);
                    if (
                      existingLink.target &&
                      Array.isArray(existingLink.target)
                    ) {
                      setSelected(existingLink.target);
                    }
                    if (existingLink.body && Array.isArray(existingLink.body)) {
                      const geotagBody = existingLink.body.find(
                        (b: any) =>
                          b.type === 'SpecificResource' &&
                          b.purpose === 'geotagging' &&
                          b.source,
                      );
                      if (geotagBody) {
                        const coords = geotagBody.source.geometry?.coordinates;
                        if (coords && coords.length === 2) {
                          const placeIdStr = geotagBody.source.id
                            ?.split('/')
                            .pop();
                          const placeId = placeIdStr
                            ? parseInt(placeIdStr, 10)
                            : Date.now();

                          const geotagLabel =
                            geotagBody.source.properties?.title ||
                            geotagBody.source.properties?.description ||
                            'Unknown location';

                          setLocalGeotag({
                            marker: [coords[1], coords[0]],
                            label: geotagLabel,
                            nominatimResult: {
                              display_name: geotagLabel,
                              lat: coords[1].toString(),
                              lon: coords[0].toString(),
                              place_id: isNaN(placeId) ? Date.now() : placeId,
                              osm_type: 'node',
                            },
                          });
                        }
                      }
                    }
                  }}
                  aria-label="Cancel"
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="mb-3">
                <strong className="text-xs block mb-2">
                  Linked annotations (click in image to add/remove):
                </strong>
                <div
                  className="mb-2"
                  style={
                    linking
                      ? {
                          cursor:
                            "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23F7F7F7' stroke='%2322524A' stroke-width='2'/%3E%3Cpath d='M16 10V22M10 16H22' stroke='%2322524A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 16 16, copy",
                        }
                      : {}
                  }
                >
                  <ol className="flex flex-col gap-1 mt-1">
                    {selected.length === 0 ? (
                      <div className="text-gray-400 text-xs bg-gray-50 p-2 rounded border-2 border-dashed">
                        No annotations selected. Click annotations in the image
                        viewer to add them.
                      </div>
                    ) : (
                      selected.map((id, idx) => {
                        const anno = annotations.find((a) => a.id === id);
                        let displayLabel = getAnnotationDisplayLabel(anno, id);
                        return (
                          <li
                            key={id}
                            className="flex items-center bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6 transition-colors hover:bg-blue-50 group shadow-sm"
                            style={{
                              fontWeight: 400,
                              fontSize: '0.85rem',
                              maxWidth: 320,
                            }}
                          >
                            <span className="text-gray-400 mr-1 w-4 text-right select-none">
                              {idx + 1}.
                            </span>
                            <span
                              className="flex-1 truncate"
                              title={displayLabel}
                            >
                              {displayLabel}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx > 0) {
                                    const newOrder = [...selected];
                                    [newOrder[idx - 1], newOrder[idx]] = [
                                      newOrder[idx],
                                      newOrder[idx - 1],
                                    ];
                                    setSelected(newOrder);
                                  }
                                }}
                                aria-label="Move up"
                                type="button"
                              >
                                ▲
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                disabled={idx === selected.length - 1}
                                onClick={() => {
                                  if (idx < selected.length - 1) {
                                    const newOrder = [...selected];
                                    [newOrder[idx], newOrder[idx + 1]] = [
                                      newOrder[idx + 1],
                                      newOrder[idx],
                                    ];
                                    setSelected(newOrder);
                                  }
                                }}
                                aria-label="Move down"
                                type="button"
                              >
                                ▼
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                              onClick={() =>
                                setSelected(selected.filter((x) => x !== id))
                              }
                              aria-label="Remove target"
                              type="button"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        );
                      })
                    )}
                  </ol>
                </div>
              </div>

              <div className="flex flex-col">
                <strong className="text-xs mb-1">
                  Geotag {localGeotag ? '(click to change)' : '(optional)'}:
                </strong>
                <div>
                  <GeoTaggingWidget
                    value={localGeotag?.marker}
                    onChange={(coords) => {
                      if (localGeotag) {
                        setLocalGeotag({
                          ...localGeotag,
                          marker: coords,
                        });
                      } else {
                        setLocalGeotag({
                          marker: coords,
                          label: '',
                          nominatimResult: {
                            display_name: '',
                            lat: coords[0].toString(),
                            lon: coords[1].toString(),
                            place_id: Date.now(),
                            osm_type: 'node',
                          },
                        });
                      }
                    }}
                    target={selected.join(',')}
                    onGeotagSelected={(info) => setLocalGeotag(info)}
                    expandedStyle={expandedStyle}
                    initialGeotag={localGeotag}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-3">
                <Button
                  onClick={handleSave}
                  disabled={
                    submitting || !session || (!geotag && selected.length === 0)
                  }
                  className="w-full justify-center items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Updating...' : 'Update Link'}
                </Button>
              </div>
              {error && (
                <div className="text-xs text-red-500 mt-2">{error}</div>
              )}
              {success && (
                <div className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Updated successfully!
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {!linking ? (
            (() => {
              const hasExistingTargets =
                existingLink &&
                existingLink.target &&
                Array.isArray(existingLink.target) &&
                existingLink.target.filter(
                  (id: string) => id !== currentAnnotationId,
                ).length > 0;

              const hasExistingGeotag =
                existingLink &&
                existingLink.body &&
                Array.isArray(existingLink.body) &&
                existingLink.body.some(
                  (b: any) =>
                    b.type === 'SpecificResource' &&
                    (b.purpose === 'geotagging' ||
                      b.purpose === 'identifying') &&
                    b.source,
                );

              const hasPendingGeotag = geotag !== null;

              let buttonText = 'Link Annotations';
              let buttonIcon = <Link2 className="w-4 h-4" />;
              let buttonVariant: 'outline' | 'default' = 'outline';

              if (hasExistingTargets && hasExistingGeotag) {
                buttonText = 'Edit Links & Geotags';
                buttonIcon = <Edit3 className="w-4 h-4" />;
                buttonVariant = 'default';
              } else if (hasExistingTargets) {
                buttonText = 'Edit Links';
                buttonIcon = <Edit3 className="w-4 h-4" />;
                buttonVariant = 'default';
              } else if (hasExistingGeotag) {
                buttonText = 'Edit Geotags';
                buttonIcon = <MapPin className="w-4 h-4" />;
                buttonVariant = 'default';
              } else if (hasPendingGeotag) {
                buttonText = 'Add Links & Geotag';
                buttonIcon = <Plus className="w-4 h-4" />;
                buttonVariant = 'default';
              }

              return (
                <div className="space-y-2">
                  <Button
                    onClick={handleEnterLinkingMode}
                    variant={buttonVariant}
                    disabled={!session}
                    className={`w-full justify-center items-center gap-2 transition-all duration-200 ${
                      !session
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:scale-[1.02]'
                    }`}
                  >
                    {buttonIcon}
                    {buttonText}
                  </Button>

                  {/* Status indicator - only show for existingLink */}
                  {(hasExistingTargets || hasExistingGeotag) && (
                    <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border">
                      {hasExistingTargets && (
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-primary/10 rounded-full">
                            <Link2 className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-foreground font-medium">
                            {
                              existingLink.target.filter(
                                (id: string) => id !== currentAnnotationId,
                              ).length
                            }{' '}
                            annotation(s) linked
                          </span>
                        </div>
                      )}
                      {hasExistingGeotag && (
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-secondary/10 rounded-full">
                            <MapPin className="w-3 h-3 text-secondary" />
                          </div>
                          <span className="text-foreground font-medium">
                            {(() => {
                              const geoBody = existingLink.body?.find(
                                (b: any) =>
                                  b.type === 'SpecificResource' &&
                                  (b.purpose === 'geotagging' ||
                                    b.purpose === 'identifying') &&
                                  b.source,
                              );
                              return (
                                geoBody?.source?.properties?.title ||
                                geoBody?.source?.properties?.description ||
                                geoBody?.source?.label ||
                                'Location tagged'
                              );
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div
              className={
                expandedStyle
                  ? 'p-4 border border-border rounded-lg bg-card shadow-sm space-y-4 max-w-none'
                  : 'p-4 border border-border rounded-lg bg-card shadow-sm space-y-4'
              }
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-foreground">
                  Select annotations to link
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinking(false)}
                  aria-label="Cancel"
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {linking && selected.length === 0 && (
                <div className="text-xs text-gray-500 mb-2">
                  Select annotations visually in the image viewer.
                </div>
              )}
              {linking && (
                <div
                  className="mb-2"
                  style={
                    linking
                      ? {
                          cursor:
                            "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23F7F7F7' stroke='%2322524A' stroke-width='2'/%3E%3Cpath d='M16 10V22M10 16H22' stroke='%2322524A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 16 16, copy",
                        }
                      : {}
                  }
                >
                  <h4 className="text-sm font-medium text-foreground">
                    Selected targets (reading order):
                  </h4>
                  {selected.length > 0 && (
                    <div className="text-xs text-primary bg-primary/10 p-2 rounded-md border border-primary/20">
                      {(() => {
                        const hasExistingLinkedIds =
                          existingLink &&
                          existingLink.target &&
                          Array.isArray(existingLink.target) &&
                          existingLink.target.length > 0;

                        if (hasExistingLinkedIds) {
                          return '✓ Existing linked annotations are pre-selected for editing';
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  <ol className="flex flex-col gap-1 mt-1">
                    {selected.length === 0 ? (
                      <span className="text-gray-400 text-xs">
                        Click annotations in the image viewer to select them for
                        linking
                      </span>
                    ) : (
                      selected.map((id, idx) => {
                        const anno = annotations.find((a) => a.id === id);
                        let displayLabel = getAnnotationDisplayLabel(anno, id);
                        return (
                          <li
                            key={id}
                            className="flex items-center bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6 transition-colors hover:bg-blue-50 group shadow-sm"
                            style={{
                              fontWeight: 400,
                              fontSize: '0.85rem',
                              maxWidth: 320,
                            }}
                          >
                            <span className="text-gray-400 mr-1 w-4 text-right select-none">
                              {idx + 1}.
                            </span>
                            <span
                              className="flex-1 truncate"
                              title={displayLabel}
                            >
                              {displayLabel}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx > 0) {
                                    const newOrder = [...selected];
                                    [newOrder[idx - 1], newOrder[idx]] = [
                                      newOrder[idx],
                                      newOrder[idx - 1],
                                    ];
                                    setSelected(newOrder);
                                  }
                                }}
                                aria-label="Move up"
                                type="button"
                              >
                                ▲
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                disabled={idx === selected.length - 1}
                                onClick={() => {
                                  if (idx < selected.length - 1) {
                                    const newOrder = [...selected];
                                    [newOrder[idx], newOrder[idx + 1]] = [
                                      newOrder[idx + 1],
                                      newOrder[idx],
                                    ];
                                    setSelected(newOrder);
                                  }
                                }}
                                aria-label="Move down"
                                type="button"
                              >
                                ▼
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                              onClick={() =>
                                setSelected(selected.filter((x) => x !== id))
                              }
                              aria-label="Remove target"
                              type="button"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        );
                      })
                    )}
                  </ol>
                </div>
              )}
              {linking && !pendingGeotag && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">
                    Add geotag:
                  </h4>
                  <div className="border border-border rounded-lg p-1 bg-card">
                    <GeoTaggingWidget
                      value={undefined}
                      onChange={setLocalGeotag}
                      target={selected.join(',')}
                      onGeotagSelected={(info) => setLocalGeotag(info)}
                      expandedStyle={expandedStyle}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={
                    submitting || !session || (!geotag && selected.length === 0)
                  }
                  className="w-full justify-center items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {submitting
                    ? existingLink && existingLink.id && existingLink.etag
                      ? 'Updating...'
                      : 'Saving...'
                    : existingLink && existingLink.id && existingLink.etag
                    ? 'Update Link'
                    : 'Save Link'}
                </Button>
              </div>
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20 flex items-center gap-2">
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded-md border border-emerald-200 flex items-center gap-2">
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Success!
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
