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

const PointSelector = dynamic(
  () => import('./PointSelector').then((mod) => mod.PointSelector),
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
  canvasId,
  manifestId,
  onPointSelectorChange,
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
  canvasId?: string;
  manifestId?: string;
  onPointSelectorChange?: (
    pointSelector: { x: number; y: number } | null,
  ) => void;
}) {
  const [internalLinking, setInternalLinking] = useState(false);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [localGeotag, setLocalGeotag] = useState<any>(null);
  const [localPointSelector, setLocalPointSelector] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
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
        Array.isArray(existingLink.target) &&
        JSON.stringify(selected) !== JSON.stringify(existingLink.target)
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

        // Extract point selector if it exists
        const pointSelectorBody = existingLink.body.find(
          (b: any) =>
            b.type === 'SpecificResource' &&
            b.purpose === 'identifying' &&
            b.selector &&
            b.selector.type === 'PointSelector',
        );

        if (pointSelectorBody) {
          const selector = pointSelectorBody.selector;
          if (selector.x !== undefined && selector.y !== undefined) {
            if (
              !localPointSelector ||
              localPointSelector.x !== selector.x ||
              localPointSelector.y !== selector.y
            ) {
              setLocalPointSelector({ x: selector.x, y: selector.y });
            }
          }
        } else {
          const allLinkingAnnotations = annotations.filter(
            (a) => a.motivation === 'linking',
          );
          const relatedLinkingAnnotations = allLinkingAnnotations.filter(
            (linkAnno) => {
              if (Array.isArray(linkAnno.target)) {
                return linkAnno.target.includes(currentAnnotationId);
              } else if (linkAnno.target === currentAnnotationId) {
                return true;
              }
              return false;
            },
          );

          let foundPointSelector = null;
          for (const linkAnno of relatedLinkingAnnotations) {
            if (linkAnno.body && Array.isArray(linkAnno.body)) {
              const pointSelectorBody = linkAnno.body.find(
                (b: any) =>
                  b.type === 'SpecificResource' &&
                  b.purpose === 'identifying' &&
                  b.selector &&
                  b.selector.type === 'PointSelector',
              );
              if (pointSelectorBody && pointSelectorBody.selector) {
                const selector = pointSelectorBody.selector;
                if (selector.x !== undefined && selector.y !== undefined) {
                  foundPointSelector = { x: selector.x, y: selector.y };
                  break;
                }
              }
            }
          }

          if (foundPointSelector && !localPointSelector) {
            setLocalPointSelector(foundPointSelector);
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
  }, [
    existingLink?.id,
    existingLink?.etag,
    existingLink?.body?.length,
    createdAnnotation?.id,
  ]);

  useEffect(() => {
    if (currentAnnotationId) {
      setLinking(false);
      setSelected([]);
      setLocalGeotag(null);
    }
  }, [currentAnnotationId]);

  useEffect(() => {
    onPointSelectorChange?.(localPointSelector);
  }, [localPointSelector]);

  const handleSelect = (id: string) => {
    const annotation = annotations.find((a) => a.id === id);
    const isIconography =
      annotation?.motivation === 'iconography' ||
      annotation?.motivation === 'iconograpy';

    const isLinkedElsewhere = isAnnotationAlreadyLinked(id);

    // Allow selecting if:
    // 1. Not linked elsewhere, OR
    // 2. Already selected (to allow deselecting), OR
    // 3. Part of the existing link being edited
    const isPartOfCurrentLink =
      existingLink &&
      existingLink.target &&
      Array.isArray(existingLink.target) &&
      existingLink.target.includes(id);

    if (isLinkedElsewhere && !selected.includes(id) && !isPartOfCurrentLink) {
      const conflictingAnnotation = annotations.find((a) => a.id === id);
      const displayLabel = getAnnotationDisplayLabel(conflictingAnnotation, id);
      const annotationType = conflictingAnnotation?.motivation || 'annotation';

      setError(
        `"${displayLabel}" (${annotationType}) is already linked in another linking annotation. Each annotation can only be part of one link.`,
      );
      return;
    }

    setError(null);

    const newSelected = selected.includes(id)
      ? selected.filter((x: string) => x !== id)
      : [...selected, id];

    setSelected(newSelected);
  };

  const geotag = pendingGeotag ?? localGeotag;

  const handleEnterLinkingMode = () => {
    setLinking(true);

    identifyOrphanedLinks();

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

            const pointSelectorBody = link.body.find(
              (b: any) =>
                b.type === 'SpecificResource' &&
                b.purpose === 'identifying' &&
                b.selector &&
                b.selector.type === 'PointSelector',
            );
            if (pointSelectorBody && !localPointSelector) {
              const selector = pointSelectorBody.selector;
              if (selector.x !== undefined && selector.y !== undefined) {
                setLocalPointSelector({ x: selector.x, y: selector.y });
              }
            }
          }
        }
      }
    }
  };
  const createOrUpdateAnnotation = async (annotation: any) => {
    const isUpdating = existingLink && existingLink.id && existingLink.etag;

    if (isUpdating) {
      let finalBody = annotation.body;

      if (annotation.body && Array.isArray(annotation.body)) {
        const existingNonGeotagBodies =
          existingLink.body?.filter((b: any) => {
            if (b.type === 'SpecificResource' && b.purpose === 'identifying') {
              const isPointSelector =
                b.selector && b.selector.type === 'PointSelector';
              return isPointSelector;
            }
            if (b.type === 'SpecificResource' && b.purpose === 'geotagging') {
              return false;
            }
            return true;
          }) || [];

        const newGeotagBodies = annotation.body.filter(
          (b: any) =>
            b.type === 'SpecificResource' &&
            (b.purpose === 'geotagging' || b.purpose === 'identifying'),
        );

        finalBody = [...existingNonGeotagBodies, ...newGeotagBodies];
      }

      const result = await updateAnnotationClient(
        existingLink.id,
        {
          ...annotation,
          body: finalBody,
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

  const handleSavePointSelectorOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session || !localPointSelector) {
      setError('Please set a point on the image.');
      return;
    }

    triggerSaveViewport();
    setSubmitting(true);
    try {
      const bodies: any[] = [];

      const pointSelectorBody = createPointSelectorBody(localPointSelector);
      if (pointSelectorBody) {
        bodies.push(pointSelectorBody);
      }

      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: [],
        body: bodies,
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };

      const result = await createOrUpdateAnnotation(annotation);

      setSuccess(true);
      onLinkCreated?.();

      toast({
        title: result.isUpdate ? 'Point Updated!' : 'Point Saved!',
        description: result.isUpdate
          ? 'The point selector was successfully updated.'
          : 'The point selector was successfully saved.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save point selector');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGeotagOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session) {
      setError('You must be logged in.');
      return;
    }
    if (!geotag && !localPointSelector) {
      setError('Please select a geotag or set a point on the image.');
      return;
    }

    triggerSaveViewport();
    setSubmitting(true);
    try {
      const bodies: any[] = [];

      if (geotag) {
        const placeId = geotag.nominatimResult?.place_id
          ? `https://data.globalise.huygens.knaw.nl/some_unique_pid/place/${geotag.nominatimResult.place_id}`
          : undefined;
        const label =
          geotag.nominatimResult?.display_name || geotag.label || '';
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

        bodies.push(identifyingBody, geotaggingBody);
      }

      if (localPointSelector) {
        const pointSelectorBody = createPointSelectorBody(localPointSelector);
        if (pointSelectorBody) {
          bodies.push(pointSelectorBody);
        }
      }

      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: [],
        body: bodies,
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
        title: result.isUpdate ? 'Geotag Updated!' : 'Geotag Saved!',
        description: result.isUpdate
          ? 'The geotag was successfully updated using PUT method.'
          : 'The geotag was successfully created using POST method.',
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

    const duplicateErrors = validateAnnotationLinks(selected);
    if (duplicateErrors.length > 0) {
      setError(
        `Cannot create link - the following annotation(s) are already linked elsewhere:\n\n• ${duplicateErrors.join(
          '\n• ',
        )}\n\nEach annotation can only be part of one link.`,
      );
      return;
    }

    triggerSaveViewport();
    setSubmitting(true);
    try {
      const bodies: any[] = [];

      if (localPointSelector) {
        const pointSelectorBody = createPointSelectorBody(localPointSelector);
        if (pointSelectorBody) {
          bodies.push(pointSelectorBody);
        }
      }

      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selected,
        body: bodies,
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
        title: result.isUpdate ? 'Link Updated!' : 'Link Created!',
        description: result.isUpdate
          ? 'The annotation link was successfully updated using PUT method.'
          : 'The annotation link was successfully created using POST method.',
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

    const duplicateErrors = validateAnnotationLinks(selected);
    if (duplicateErrors.length > 0) {
      setError(
        `Cannot create link - the following annotation(s) are already linked elsewhere:\n\n• ${duplicateErrors.join(
          '\n• ',
        )}\n\nEach annotation can only be part of one link.`,
      );
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
      const bodies: any[] = [identifyingBody, geotaggingBody];

      if (localPointSelector) {
        const pointSelectorBody = createPointSelectorBody(localPointSelector);
        if (pointSelectorBody) {
          bodies.push(pointSelectorBody);
        }
      }

      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selected,
        body: bodies,
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
    if (!geotag && selected.length === 0 && !localPointSelector) {
      setError(
        'Select a geotag, annotations to link, or set a point on the image.',
      );
      return;
    }

    if (geotag && selected.length > 0) {
      await handleCreateLink();
    } else if (geotag && localPointSelector) {
      await handleSaveGeotagOnly();
    } else if (geotag) {
      await handleSaveGeotagOnly();
    } else if (selected.length > 0) {
      await handleLinkAnnotationsOnly();
    } else if (localPointSelector) {
      await handleSavePointSelectorOnly();
    }
  };

  async function handleRemove(
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ): Promise<void> {
    event.preventDefault();
    setRemoveError(null);
    setRemoveSuccess(false);

    if (!existingLink || !existingLink.id) {
      setRemoveError(
        'Missing link information. Cannot find the annotation to remove.',
      );
      return;
    }

    if (!existingLink.etag) {
      try {
        const annotationId = existingLink.id.split('/').pop();
        if (!annotationId) {
          throw new Error('Invalid annotation ID format');
        }

        const getRes = await fetch(`/api/annotations/${annotationId}`, {
          method: 'GET',
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
        });

        if (getRes.ok) {
          const data = await getRes.json();
          const etag = data.etag || getRes.headers.get('etag');

          if (etag) {
            existingLink.etag = etag;
          } else {
            setRemoveError(
              'Could not fetch the required ETag to remove this link. The annotation may not be accessible.',
            );
            return;
          }
        } else {
          setRemoveError(
            'Failed to fetch annotation details. Please try refreshing the page.',
          );
          return;
        }
      } catch (fetchError: any) {
        setRemoveError(
          'Failed to fetch the required information to remove this link. Please try refreshing the page.',
        );
        return;
      }
    }

    setRemoving(true);

    try {
      const linkTargets = Array.isArray(existingLink.target)
        ? existingLink.target
        : [];
      const hasGeotag =
        existingLink.body &&
        Array.isArray(existingLink.body) &&
        existingLink.body.some(
          (b: any) =>
            b.type === 'SpecificResource' &&
            (b.purpose === 'geotagging' || b.purpose === 'identifying'),
        );

      const shouldDeleteEntireLink = true;

      try {
        const annotationId = existingLink.id.split('/').pop();
        if (!annotationId) {
          throw new Error('Invalid annotation ID format');
        }

        const deleteRes = await fetch(`/api/annotations/${annotationId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(existingLink.etag && { 'If-Match': existingLink.etag }),
          },
        });

        if (!deleteRes.ok) {
          const errorData = await deleteRes.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Delete failed: ${deleteRes.status} ${deleteRes.statusText}`,
          );
        }

        setRemoveSuccess(true);
        setLinkedAnno(null);
        onLinkCreated?.();

        toast({
          title: 'Link removed',
          description:
            'The entire linking annotation was deleted. All annotations are now unlinked.',
        });
      } catch (deleteError: any) {
        throw new Error(`Failed to delete annotation: ${deleteError.message}`);
      }
    } catch (e: any) {
      setRemoveError(e.message || 'Failed to remove link');
    } finally {
      setRemoving(false);
    }
  }

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
      return 'Icon annotation';
    }

    let bodies = Array.isArray(annotation.body) ? annotation.body : [];

    if (bodies.length > 0) {
      const loghiBody = bodies.find((b: any) =>
        b.generator?.label?.toLowerCase().includes('loghi'),
      );
      if (loghiBody && loghiBody.value) {
        return `"${loghiBody.value}" (textspotting)`;
      }

      if (bodies[0]?.value) {
        const textContent = bodies[0].value;
        const contentPreview =
          textContent.length > 30
            ? textContent.substring(0, 30) + '...'
            : textContent;

        const isAutomated = bodies.some(
          (b: any) => b.generator?.label || b.generator?.name,
        );

        const typeLabel = isAutomated ? 'automated text' : 'human annotation';
        return `"${contentPreview}" (${typeLabel})`;
      }
    }

    return 'Text annotation';
  };

  const isAnnotationAlreadyLinked = (annotationId: string) => {
    const annotationExists = annotations.some((a) => a.id === annotationId);
    if (!annotationExists) {
      return false;
    }

    const linkingAnnotations = annotations.filter((a) => {
      if (a.motivation !== 'linking') return false;
      if (existingLink && a.id === existingLink.id) return false;

      if (Array.isArray(a.target)) {
        return a.target.includes(annotationId);
      } else if (a.target === annotationId) {
        return true;
      }
      return false;
    });

    const validLinkingAnnotations = linkingAnnotations.filter((linkingAnno) => {
      if (!Array.isArray(linkingAnno.target)) return true;

      const allAnnotationIds = new Set(annotations.map((a) => a.id));
      const validTargets = linkingAnno.target.filter((targetId: string) =>
        allAnnotationIds.has(targetId),
      );

      return validTargets.length > 0 && validTargets.includes(annotationId);
    });

    const isLinked = validLinkingAnnotations.length > 0;

    return isLinked;
  };

  const validateAnnotationLinks = (annotationIds: string[]) => {
    const duplicateErrors: string[] = [];

    for (const annotationId of annotationIds) {
      if (isAnnotationAlreadyLinked(annotationId)) {
        const conflictingAnnotation = annotations.find(
          (a) => a.id === annotationId,
        );
        const displayLabel = getAnnotationDisplayLabel(
          conflictingAnnotation,
          annotationId,
        );
        const annotationType =
          conflictingAnnotation?.motivation || 'annotation';

        duplicateErrors.push(
          `"${displayLabel}" (${annotationType}) is already linked in another linking annotation`,
        );
      }
    }

    return duplicateErrors;
  };

  const cleanupOrphanedLinks = async (manual = false) => {
    try {
      if (!manual && cleanupRunning) {
        return;
      }

      if (manual) setCleaningUp(true);
      if (!manual) setCleanupRunning(true);

      const allAnnotationIds = new Set(annotations.map((a: any) => a.id));
      const linkingAnnotations = annotations.filter(
        (a: any) => a.motivation === 'linking',
      );
      let orphanedCount = 0;
      let deletedCount = 0;

      for (const linkingAnno of linkingAnnotations) {
        let linkedTargets: string[] = [];

        if (Array.isArray(linkingAnno.target)) {
          linkedTargets = linkingAnno.target;
        } else if (linkingAnno.body?.length) {
          const targetBodies = linkingAnno.body.filter(
            (b: any) => b.type?.includes && b.type.includes('TextualBody'),
          );
          linkedTargets = targetBodies
            .map((t: any) => t.value)
            .filter((id: string) => !!id);
        }

        if (linkedTargets.length === 0) continue;

        const existingTargets = linkedTargets.filter((targetId: string) =>
          allAnnotationIds.has(targetId),
        );

        if (existingTargets.length !== linkedTargets.length) {
          orphanedCount++;
          const orphanedTargets = linkedTargets.filter(
            (targetId: string) => !allAnnotationIds.has(targetId),
          );

          try {
            if (existingTargets.length === 0) {
              const annotationId = linkingAnno.id.split('/').pop();
              if (!annotationId) {
                throw new Error('Invalid annotation ID format');
              }

              const response = await fetch(`/api/annotations/${annotationId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                deletedCount++;
                if (manual) {
                  toast({
                    title: 'Cleaned up empty link',
                    description:
                      'Removed a link that had no valid annotations.',
                  });
                }
              } else {
              }
            } else {
              const updatedLinkingAnno = { ...linkingAnno };

              if (Array.isArray(updatedLinkingAnno.target)) {
                updatedLinkingAnno.target = existingTargets;
              } else if (updatedLinkingAnno.body?.length) {
                updatedLinkingAnno.body = updatedLinkingAnno.body.filter(
                  (b: any) => {
                    if (
                      b.type?.includes &&
                      b.type.includes('TextualBody') &&
                      b.value
                    ) {
                      return existingTargets.includes(b.value);
                    }
                    return true;
                  },
                );
              }

              const annotationId = linkingAnno.id.split('/').pop();
              if (!annotationId) {
                throw new Error('Invalid annotation ID format');
              }

              const response = await fetch(`/api/annotations/${annotationId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedLinkingAnno),
              });

              if (response.ok) {
                deletedCount++;
                if (manual) {
                  toast({
                    title: 'Cleaned up orphaned references',
                    description: `Removed ${orphanedTargets.length} invalid reference(s) from link.`,
                  });
                }
              } else {
              }
            }
          } catch (error: any) {
            if (manual) {
              toast({
                title: 'Cleanup failed',
                description:
                  'Could not clean up orphaned annotation references.',
              });
            }
          }
        }
      }

      if (manual) {
        setCleaningUp(false);
        if (orphanedCount === 0) {
          toast({
            title: 'No cleanup needed',
            description: 'All links are properly maintained.',
          });
        } else {
          toast({
            title: 'Cleanup complete',
            description: `Successfully cleaned up ${deletedCount} link(s) with orphaned references.`,
          });
        }
      } else {
        setCleanupRunning(false);
      }
    } catch (error: any) {
      if (manual) {
        setCleaningUp(false);
        toast({
          title: 'Cleanup error',
          description: 'An unexpected error occurred during cleanup.',
        });
      } else {
        setCleanupRunning(false);
      }
    }
  };

  const identifyOrphanedLinks = () => {
    const allAnnotationIds = new Set(annotations.map((a: any) => a.id));
    const linkingAnnotations = annotations.filter(
      (a: any) => a.motivation === 'linking',
    );
    const orphanedLinks = [];

    for (const linkingAnno of linkingAnnotations) {
      let linkedTargets: string[] = [];

      if (Array.isArray(linkingAnno.target)) {
        linkedTargets = linkingAnno.target;
      } else if (linkingAnno.body?.length) {
        const targetBodies = linkingAnno.body.filter(
          (b: any) => b.type?.includes && b.type.includes('TextualBody'),
        );
        linkedTargets = targetBodies
          .map((t: any) => t.value)
          .filter((id: string) => !!id);
      }

      if (linkedTargets.length === 0) continue;

      const existingTargets = linkedTargets.filter((targetId: string) =>
        allAnnotationIds.has(targetId),
      );

      if (existingTargets.length !== linkedTargets.length) {
        const orphanedTargets = linkedTargets.filter(
          (targetId: string) => !allAnnotationIds.has(targetId),
        );

        orphanedLinks.push({
          linkId: linkingAnno.id,
          totalTargets: linkedTargets.length,
          existingTargets: existingTargets.length,
          orphanedTargets,
        });
      }
    }

    return orphanedLinks;
  };

  const createPointSelectorBody = (point: { x: number; y: number }) => {
    if (!canvasId || !session) {
      return null;
    }

    const body = {
      type: 'SpecificResource',
      purpose: 'identifying',
      source: canvasId,
      selector: {
        type: 'PointSelector',
        x: point.x,
        y: point.y,
      },
      creator: {
        id: session.user.id,
        type: 'Person',
        label: session.user.label,
      },
      created: new Date().toISOString(),
    };

    return body;
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
          {!linking && linkingMode === undefined ? (
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
                  title="Delete the entire link (all linked annotations will become unlinked)"
                >
                  <X className="w-4 h-4" />
                  {removing ? 'Removing...' : 'Delete Link'}
                </Button>
                {/* Helper text to explain remove behavior */}
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed mt-1">
                  ⚠️ This will delete the entire link. All linked annotations
                  will become unlinked.
                </div>
                <Button
                  variant="secondary"
                  onClick={() => cleanupOrphanedLinks(true)}
                  disabled={cleaningUp}
                  className="w-full py-2 text-sm font-medium justify-center items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {cleaningUp ? 'Cleaning...' : 'Clean Up Links'}
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
                  Edit linked annotations
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

                      const pointSelectorBody = existingLink.body.find(
                        (b: any) =>
                          b.type === 'SpecificResource' &&
                          b.purpose === 'identifying' &&
                          b.selector &&
                          b.selector.type === 'PointSelector',
                      );
                      if (pointSelectorBody) {
                        const selector = pointSelectorBody.selector;
                        if (
                          selector.x !== undefined &&
                          selector.y !== undefined
                        ) {
                          setLocalPointSelector({
                            x: selector.x,
                            y: selector.y,
                          });
                        }
                      } else {
                        setLocalPointSelector(null);
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
                          cursor: 'crosshair',
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

                        if (!anno) {
                          return (
                            <li
                              key={id}
                              className="flex items-center bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-xs gap-1 min-h-6"
                            >
                              <span className="text-red-600">
                                Missing annotation: {id}
                              </span>
                            </li>
                          );
                        }

                        if (
                          anno.motivation === 'iconography' ||
                          anno.motivation === 'iconograpy'
                        ) {
                        }

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

              <div className="flex flex-col gap-3 mt-3">
                <Button
                  onClick={handleSave}
                  disabled={submitting || !session || selected.length === 0}
                  className="w-full justify-center items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Updating...' : 'Update Link'}
                </Button>
              </div>
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 mt-2">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="whitespace-pre-line leading-relaxed">
                      {error}
                    </div>
                  </div>
                </div>
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

                  {/* Manual cleanup button - always visible for troubleshooting */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cleanupOrphanedLinks(true)}
                    disabled={cleaningUp || !session}
                    className={`w-full justify-center items-center gap-2 text-xs ${
                      identifyOrphanedLinks().length > 0
                        ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : ''
                    }`}
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    {cleaningUp
                      ? 'Cleaning...'
                      : identifyOrphanedLinks().length > 0
                      ? `Fix ${identifyOrphanedLinks().length} Broken Links`
                      : 'Check Links'}
                  </Button>

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
                  onClick={() => {
                    setLinking(false);
                    setLocalPointSelector(null);
                  }}
                  aria-label="Cancel"
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-3 h-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Linking constraints:</div>
                    <div>• Each annotation can only be part of one link</div>
                    <div>• Each link can have only one geotag</div>
                  </div>
                </div>
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
                          cursor: 'crosshair',
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
                      <div className="text-muted-foreground text-sm p-4 bg-muted/30 rounded-md border border-dashed text-center">
                        Click annotations in the image viewer to select them for
                        linking.
                        <br />
                        <span className="text-xs">
                          Note: Already linked annotations cannot be selected.
                        </span>
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
              {linking && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">
                    Point on image:
                  </h4>
                  <div className="border border-border rounded-lg p-1 bg-card">
                    <PointSelector
                      value={localPointSelector}
                      onChange={setLocalPointSelector}
                      canvasId={canvasId}
                      manifestId={manifestId}
                      disabled={!session}
                      expandedStyle={expandedStyle}
                      existingAnnotations={annotations}
                      currentAnnotationId={currentAnnotationId}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={
                    submitting ||
                    !session ||
                    (!geotag && selected.length === 0 && !localPointSelector)
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
                <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="whitespace-pre-line leading-relaxed">
                      {error}
                    </div>
                  </div>
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
