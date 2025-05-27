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

  useEffect(() => {
    console.log('existingLink:', existingLink);
    if (existingLink && existingLink.id && existingLink.etag) {
      setLinkedAnno({ id: existingLink.id, etag: existingLink.etag });
    } else if (
      createdAnnotation &&
      createdAnnotation.id &&
      createdAnnotation.etag
    ) {
      setLinkedAnno({ id: createdAnnotation.id, etag: createdAnnotation.etag });
    } else {
      setLinkedAnno(null);
    }
  }, [existingLink, createdAnnotation]);

  const linking = linkingMode !== undefined ? linkingMode : internalLinking;
  const selected = selectedIds !== undefined ? selectedIds : internalSelected;
  const setLinking = setLinkingMode || setInternalLinking;
  const setSelected = setSelectedIds || setInternalSelected;

  const handleSelect = (id: string) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((x: string) => x !== id)
        : [...selected, id],
    );
  };

  const geotag = pendingGeotag ?? localGeotag;

  const handleCreateLink = async () => {
    setError(null);
    setSuccess(false);
    if (!session || selected.length === 0 || !geotag) {
      setError('Select annotations and a geotag.');
      return;
    }
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

  const handleRemove = async () => {
    if (!linkedAnno) {
      setRemoveError('No annotation id or ETag found for removal.');
      return;
    }

    setRemoving(true);
    setRemoveError(null);

    try {
      const res = await fetch(linkedAnno.id, {
        method: 'DELETE',
        headers: {
          'If-Match': linkedAnno.etag,
          ...(session?.accessToken
            ? { Authorization: `Bearer ${session.accessToken}` }
            : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Deletion failed: ${res.status} ${res.statusText}`);
      }
      setRemoveSuccess(true);
      setLinkedAnno(null);
    } catch (err: any) {
      setRemoveError(err.message);
    } finally {
      setRemoving(false);
    }
  };

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
          <div className="mb-2 text-sm text-blue-900">
            A geotag is already linked to this annotation.
          </div>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removing}
            className="w-full py-2 text-base font-semibold"
          >
            {removing ? 'Removing…' : 'Remove geotag'}
          </Button>
          {removeError && (
            <div className="text-xs text-red-500 mt-2">{removeError}</div>
          )}
          {removeSuccess && (
            <div className="text-xs text-green-600 mt-2">Geotag removed!</div>
          )}
        </div>
      ) : (
        <>
          {!linking ? (
            <Button onClick={() => setLinking(true)} variant="outline">
              <Plus className="mr-2" /> Link Annotations
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
                <strong>Select annotations to link</strong>
                <button onClick={() => setLinking(false)} aria-label="Cancel">
                  <X className="w-4 h-4" />
                </button>
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
                              <button
                                className="text-gray-300 hover:text-blue-700 transition-colors"
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
                                style={{ fontSize: '0.9em', lineHeight: 1 }}
                              >
                                ▲
                              </button>
                              <button
                                className="text-gray-300 hover:text-blue-700 transition-colors"
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
                                style={{ fontSize: '0.9em', lineHeight: 1 }}
                              >
                                ▼
                              </button>
                            </div>
                            <button
                              className="ml-1 text-gray-300 hover:text-red-500 transition-colors opacity-80 group-hover:opacity-100"
                              onClick={() =>
                                setSelected(selected.filter((x) => x !== id))
                              }
                              aria-label="Remove target"
                              type="button"
                              style={{ fontSize: '0.9em', lineHeight: 1 }}
                            >
                              <X className="w-3 h-3" />
                            </button>
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
              <Button
                onClick={handleCreateLink}
                disabled={submitting || selected.length === 0 || !geotag}
                className="mt-2"
              >
                <Link2 className="mr-2" /> Create Link
              </Button>
              {error && (
                <div className="text-xs text-red-500 mt-2">{error}</div>
              )}
              {success && (
                <div className="text-xs text-green-600 mt-2">Link created!</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
