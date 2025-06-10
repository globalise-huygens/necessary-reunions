'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Link2, X } from 'lucide-react';
import { Button } from './Button';
import dynamic from 'next/dynamic';
import { deleteAnnotation } from '../lib/annoRepo';
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
  onSaveViewport, // <-- existing prop
  onOptimisticAnnotationAdd, // <-- NEW PROP
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
  onOptimisticAnnotationAdd?: (anno: any) => void; // <-- NEW PROP
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
    console.log('existingLink:', existingLink);
    if (existingLink && existingLink.id && existingLink.etag) {
      setLinkedAnno({ id: existingLink.id, etag: existingLink.etag });

      // When entering linking mode with an existing link, populate the current targets
      if (
        linking &&
        existingLink.target &&
        Array.isArray(existingLink.target)
      ) {
        setSelected(existingLink.target);
      }

      // If there's a geotag in the existing link, set it
      if (existingLink.body && Array.isArray(existingLink.body)) {
        const geotagBody = existingLink.body.find(
          (b: any) =>
            b.type === 'SpecificResource' &&
            b.purpose === 'geotagging' &&
            b.source,
        );
        if (geotagBody && !localGeotag) {
          // Convert back to the geotag format expected by GeoTaggingWidget
          const coords = geotagBody.source.geometry?.coordinates;
          if (coords && coords.length === 2) {
            setLocalGeotag({
              marker: [coords[1], coords[0]], // Convert back to [lat, lng]
              label: geotagBody.source.properties?.title || '',
              nominatimResult: {
                display_name:
                  geotagBody.source.properties?.description ||
                  geotagBody.source.properties?.title ||
                  '',
                lat: coords[1],
                lon: coords[0],
                place_id: geotagBody.source.id?.split('/').pop(), // Extract place_id if available
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

  const handleSelect = (id: string) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((x: string) => x !== id)
        : [...selected, id],
    );
  };

  const geotag = pendingGeotag ?? localGeotag;

  // Helper to call onSaveViewport if provided
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

  // New: Save geotag only
  const handleSaveGeotagOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session || !geotag) {
      setError('Please select a geotag.');
      return;
    }
    triggerSaveViewport(); // <-- Save viewport before saving
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
        target: [], // No linked annotations
        body: [identifyingBody, geotaggingBody],
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };
      const slug = `geotag-${uuidv4()}`;
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
        throw new Error(err.error || 'Failed to save geotag');
      }
      const data = await res.json();
      setSuccess(true);
      setLocalGeotag(null);
      onOptimisticAnnotationAdd?.({
        ...annotation,
        id: data.id,
        etag: data.etag,
      }); // <-- optimistic update
      onLinkCreated?.();
      toast({
        title: 'Geotag saved',
        description: 'The geotag was saved successfully.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save geotag');
    } finally {
      setSubmitting(false);
    }
  };

  // New: Link annotations only
  const handleLinkAnnotationsOnly = async () => {
    setError(null);
    setSuccess(false);
    if (!session || selected.length === 0) {
      setError('Select annotations to link.');
      return;
    }
    triggerSaveViewport(); // <-- Save viewport before saving
    setSubmitting(true);
    try {
      const annotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        motivation: 'linking',
        target: selected,
        body: [], // No geotag
        creator: {
          id: session.user.id,
          type: 'Person',
          label: session.user.label,
        },
        created: new Date().toISOString(),
      };
      const slug = `linking-${uuidv4()}`;
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
        throw new Error(err.error || 'Failed to create link');
      }
      const data = await res.json();
      setSuccess(true);
      setLinking(false);
      setSelected([]);
      onOptimisticAnnotationAdd?.({
        ...annotation,
        id: data.id,
        etag: data.etag,
      }); // <-- optimistic update
      onLinkCreated?.();
      toast({
        title: 'Link created',
        description: 'The annotation link was created successfully.',
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
    triggerSaveViewport(); // <-- Save viewport before saving
    setSubmitting(true);
    try {
      // Build the annotation object as per the spec
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
      // Generate a slug for the annotation (could be based on a uuid or a hash of targets)
      const slug = `linking-${uuidv4()}`;
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
        throw new Error(err.error || 'Failed to create link');
      }
      // Get the canonical annotation URL from the Location header
      const location =
        res.headers.get('Location') || res.headers.get('location');
      const data = await res.json();
      setCreatedAnnotation({ id: data.id, etag: data.etag });
      setSuccess(true);
      setLinking(false);
      setSelected([]);
      setLocalGeotag(null);
      onOptimisticAnnotationAdd?.({
        ...annotation,
        id: data.id,
        etag: data.etag,
      }); // <-- optimistic update
      onLinkCreated?.();
      toast({
        title: 'Link created',
        description: location
          ? `Annotation created at ${location}`
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
    triggerSaveViewport();
    setSubmitting(true);
    try {
      let annotation;
      let slug;
      if (geotag && selected.length > 0) {
        // Save both
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
        annotation = {
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
        slug = `linking-${uuidv4()}`;
      } else if (geotag) {
        // Save geotag only
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
        annotation = {
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
        slug = `geotag-${uuidv4()}`;
      } else if (selected.length > 0) {
        // Link only
        annotation = {
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
        slug = `linking-${uuidv4()}`;
      }
      const headers: Record<string, string> = {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      };
      if (slug) headers['Slug'] = slug;
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers,
        body: JSON.stringify(annotation),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      const data = await res.json();
      setCreatedAnnotation({ id: data.id, etag: data.etag });
      setSuccess(true);
      setLinking(false);
      setSelected([]);
      setLocalGeotag(null);
      onOptimisticAnnotationAdd?.({
        ...annotation,
        id: data.id,
        etag: data.etag,
      });
      onLinkCreated?.();
      toast({
        title: 'Saved',
        description: 'Your changes were saved successfully.',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
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
  return (
    <div className={expandedStyle ? 'mb-4' : 'mb-4'}>
      {existingLink && (!existingLink.id || !existingLink.etag) && (
        <div className="text-xs text-red-500 mb-2">
          Warning: existingLink is missing id or etag. Deletion will not work.
        </div>
      )}
      {existingLink ? (
        <div
          className={
            expandedStyle
              ? 'rounded bg-white p-2 w-full max-w-none'
              : 'rounded bg-white p-2 w-full max-w-md'
          }
        >
          <div className="mb-3 text-sm text-blue-900">
            This annotation is part of a linking annotation.
          </div>

          {/* Show current linked annotations */}
          {existingLink.target && Array.isArray(existingLink.target) && (
            <div className="mb-3">
              <strong className="text-xs block mb-2">
                Currently linked annotations:
              </strong>
              <div className="flex flex-wrap gap-1">
                {existingLink.target.map((targetId: string) => {
                  const targetAnno = annotations.find((a) => a.id === targetId);
                  let label = targetId;
                  if (targetAnno) {
                    if (
                      targetAnno.motivation === 'iconography' ||
                      targetAnno.motivation === 'iconograpy'
                    ) {
                      label = 'Icon';
                    } else if (Array.isArray(targetAnno.body)) {
                      const loghiBody = targetAnno.body.find((b: any) =>
                        b.generator?.label?.toLowerCase().includes('loghi'),
                      );
                      if (loghiBody && loghiBody.value) {
                        label = loghiBody.value;
                      } else if (targetAnno.body[0]?.value) {
                        label = targetAnno.body[0].value;
                      }
                    }
                  }
                  return (
                    <span
                      key={targetId}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 border border-blue-300"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show current geotag if exists */}
          {existingLink.body &&
            Array.isArray(existingLink.body) &&
            (() => {
              const geotagBody = existingLink.body.find(
                (b: any) =>
                  b.type === 'SpecificResource' &&
                  b.purpose === 'geotagging' &&
                  b.source &&
                  b.source.properties?.title,
              );
              return geotagBody ? (
                <div className="mb-3">
                  <strong className="text-xs block mb-1">
                    Current geotag:
                  </strong>
                  <span className="text-xs text-gray-600">
                    {geotagBody.source.properties.title}
                  </span>
                </div>
              ) : null;
            })()}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => setLinking(true)}
              className="w-full py-2 text-sm font-medium justify-center items-center gap-2"
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
            <div className="text-xs text-red-500 mt-2">{removeError}</div>
          )}
          {removeSuccess && (
            <div className="text-xs text-green-600 mt-2">Link removed!</div>
          )}
        </div>
      ) : (
        <>
          {!linking ? (
            <Button
              onClick={() => setLinking(true)}
              variant="outline"
              className="w-full justify-center items-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              Link Annotations
            </Button>
          ) : (
            <div
              className={
                expandedStyle
                  ? 'p-2 border rounded bg-white space-y-2 max-w-none'
                  : 'p-2 border rounded bg-white space-y-2'
              }
            >
              <div className="flex justify-between items-center mb-2">
                <strong className="text-sm font-medium">
                  Select annotations to link
                </strong>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinking(false)}
                  aria-label="Cancel"
                  className="h-8 w-8 p-0"
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
                  <strong className="text-xs">
                    Selected targets (reading order):
                  </strong>
                  <ol className="flex flex-col gap-1 mt-1">
                    {selected.length === 0 ? (
                      <span className="text-gray-400 text-xs">
                        No targets selected
                      </span>
                    ) : (
                      selected.map((id, idx) => {
                        const anno = annotations.find((a) => a.id === id);
                        let displayLabel = id;
                        if (anno) {
                          if (
                            anno.motivation === 'iconography' ||
                            anno.motivation === 'iconograpy'
                          ) {
                            displayLabel = 'Icon';
                          } else if (Array.isArray(anno.body)) {
                            const loghiBody = anno.body.find((b: any) =>
                              b.generator?.label
                                ?.toLowerCase()
                                .includes('loghi'),
                            );
                            if (loghiBody && loghiBody.value) {
                              displayLabel = loghiBody.value;
                            } else if (anno.body[0]?.value) {
                              displayLabel = anno.body[0].value;
                            }
                          }
                        }
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
                <div className="flex flex-col">
                  <strong className="text-xs mb-1">Add geotag:</strong>
                  <div>
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
              <div className="flex flex-col gap-3 mt-3">
                <Button
                  onClick={handleSave}
                  disabled={
                    submitting || !session || (!geotag && selected.length === 0)
                  }
                  className="w-full justify-center items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Saving...' : 'Save Link'}
                </Button>
              </div>
              {error && (
                <div className="text-xs text-red-500 mt-2">{error}</div>
              )}
              {success && (
                <div className="text-xs text-green-600 mt-2">Success!</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
