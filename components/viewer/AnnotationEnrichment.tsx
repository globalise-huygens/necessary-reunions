/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-use-before-define */

import {
  Check,
  ChevronDown,
  ChevronUp,
  Image,
  Link,
  MapPin,
  Crosshair,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useRef, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Button } from '../../components/shared/Button';
import { useLinkingMode } from '../../components/viewer/LinkingModeContext';
import { PointSelector } from '../../components/viewer/PointSelector';
import { invalidateGlobalLinkingCache } from '../../hooks/use-global-linking-annotations';
import { invalidateLinkingCache } from '../../hooks/use-linking-annotations';
import { useIsMobile } from '../../hooks/use-mobile';
import { useToast } from '../../hooks/use-toast';
import { useOptionalProjectConfig } from '../../lib/viewer/project-context';
import { deleteLinkingRelationship } from '../../lib/viewer/linking-validation';

const geoTagMapDynamic = dynamic(
  () => import('./GeoTagMap').then((mod) => ({ default: mod.GeoTagMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-48 sm:h-64">
        <div className="text-sm text-muted-foreground">Loading map...</div>
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnnotationEnrichmentProps {
  annotations: any[];
  isLinkingMode: boolean;
  onRefreshAnnotations?: () => void;
  canEdit: boolean;
  onSave?: (data: {
    linkedIds: string[];
    geotag?: any;
    point?: any;
    existingLinkingId?: string | null;
  }) => Promise<void>;
  availableAnnotations?: any[];
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  session?: any;
  initialGeotag?: any;
  initialPoint?: { x: number; y: number } | null;
  selectedAnnotationsForLinking?: string[];
  onEnableLinkingMode?: () => void;
  onDisableLinkingMode?: () => void;
  selectedAnnotationId?: string;
  canvasId?: string;
  onLinkedAnnotationsOrderChange?: (orderedIds: string[]) => void;
  onEnablePointSelection?: () => void;
  onDisablePointSelection?: () => void;
  onPointChange?: (point: { x: number; y: number } | null) => void;
  viewer?: any;
  defaultTab?: 'link' | 'geotag' | 'point';
  onGlobalRefresh?: () => void;
  /** Geotag sources available for the active project */
  geotagSources?: Array<'nominatim' | 'globalise' | 'neru' | 'gavoc'>;
}

// ---------------------------------------------------------------------------
// Section header component (collapsible trigger)
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  label,
  badge,
  isOpen,
  onToggle,
  isMobile,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isMobile: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center w-full gap-2 text-left rounded-md transition-colors
        ${isMobile ? 'min-h-[44px] px-2 py-2.5' : 'min-h-[36px] px-2 py-1.5'}
        hover:bg-muted/50 active:bg-muted/70`}
      aria-expanded={isOpen}
    >
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium flex-1">{label}</span>
      {badge ? <span className="flex-shrink-0">{badge}</span> : null}
      <ChevronDown
        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status badges (shown when a section has data)
// ---------------------------------------------------------------------------

function StatusBadge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'success';
}) {
  const styles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    active: 'bg-chart-4/15 text-chart-4 border-chart-4/25',
    success: 'bg-chart-2/15 text-chart-2 border-chart-2/25',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AnnotationEnrichment = React.memo(function AnnotationEnrichment(
  props: AnnotationEnrichmentProps,
): React.ReactElement | null {
  const {
    canEdit = true,
    onSave = async () => {},
    annotations = [],
    availableAnnotations = [],
    selectedIds,
    setSelectedIds,
    session,
    initialGeotag,
    initialPoint,
    selectedAnnotationsForLinking = [],
    onEnableLinkingMode,
    onDisableLinkingMode,
    isLinkingMode = false,
    selectedAnnotationId,
    onRefreshAnnotations,
    canvasId,
    onLinkedAnnotationsOrderChange,
    onEnablePointSelection,
    onDisablePointSelection,
    onPointChange,
    defaultTab = 'link',
    onGlobalRefresh,
    geotagSources,
  } = props;

  const linkingModeContext = useLinkingMode();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const projectConfig = useOptionalProjectConfig();

  // Derive geotag sources from project config if not explicitly provided
  const resolvedGeotagSources = geotagSources ??
    projectConfig?.geotagSources ?? ['nominatim'];
  const [linkOpen, setLinkOpen] = useState(defaultTab === 'link');
  const [geotagOpen, setGeotagOpen] = useState(defaultTab === 'geotag');
  const [pointOpen, setPointOpen] = useState(defaultTab === 'point');

  // -- Core state --
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedGeotag, setSelectedGeotag] = useState<any>(
    initialGeotag || null,
  );
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
  } | null>(initialPoint || null);
  const [isPointSelectionActive, setIsPointSelectionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);

  const [existingLinkingData, setExistingLinkingData] = useState<{
    linking?: any;
    geotagging?: any;
  }>({});
  const [loadingExistingData, setLoadingExistingData] = useState(false);
  const [hasManuallyReordered, setHasManuallyReordered] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Two-step confirm for destructive delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmDeleteTimeout = useRef<NodeJS.Timeout | null>(null);

  const componentId = useRef(
    `widget-${Math.random().toString(36).slice(2, 11)}`,
  );

  const lastFetchRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const justSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pointSelectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAvailableAnnotationsLengthRef = useRef<number>(0);

  const selected = selectedIds !== undefined ? selectedIds : internalSelected;
  const setSelected = setSelectedIds || setInternalSelected;
  const userSession = session || { user: { name: 'Demo User' } };

  // -- Helpers --

  const getBodies = (annotation: any) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : ([annotation.body] as any[]);
    return bodies.filter((b: any) => b.type === 'TextualBody');
  };

  const getAnnotationText = React.useCallback((annotation: any) => {
    const bodies = getBodies(annotation);

    const humanBody = bodies.find(
      (body: any) =>
        !body.generator && body.value && body.value.trim().length > 0,
    );
    if (humanBody) return humanBody.value;

    const loghiBody = bodies.find(
      (body: any) =>
        body.generator &&
        (body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')) &&
        body.value &&
        body.value.trim().length > 0,
    );
    if (loghiBody) return loghiBody.value;

    const otherAiBody = bodies.find(
      (body: any) =>
        body.generator &&
        !(
          body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')
        ) &&
        body.value &&
        body.value.trim().length > 0,
    );
    return otherAiBody?.value || '';
  }, []);

  const currentlySelectedForLinking = React.useMemo(() => {
    if (hasManuallyReordered) return selected;
    if (
      isLinkingMode &&
      selectedAnnotationsForLinking.length > 0 &&
      selected.length === 0
    ) {
      return selectedAnnotationsForLinking;
    }
    return selected;
  }, [
    hasManuallyReordered,
    selected,
    isLinkingMode,
    selectedAnnotationsForLinking,
    forceUpdate,
  ]);

  // -- Effects --

  React.useEffect(() => {
    if (selectedAnnotationsForLinking.length > 0 && !selectedIds) {
      setInternalSelected(selectedAnnotationsForLinking);
    }
  }, [selectedAnnotationsForLinking, selectedIds]);

  React.useEffect(() => {
    setSelectedPoint(initialPoint || null);
  }, [initialPoint]);

  React.useEffect(() => {
    if (selectedAnnotationId) {
      setHasManuallyReordered(false);
      const isFirstLoad = lastFetchRef.current !== selectedAnnotationId;
      fetchExistingLinkingData(selectedAnnotationId, isFirstLoad);
    } else {
      setExistingLinkingData({});
      setInternalSelected([]);
      if (setSelectedIds) setSelectedIds([]);
      setSelectedGeotag(null);
      setSelectedPoint(null);
    }
  }, [selectedAnnotationId]);

  React.useEffect(() => {
    const currentLength = availableAnnotations?.length || 0;
    if (
      selectedAnnotationId &&
      availableAnnotations &&
      currentLength !== lastAvailableAnnotationsLengthRef.current
    ) {
      lastAvailableAnnotationsLengthRef.current = currentLength;
      if (hasManuallyReordered && internalSelected.length > 0) return;
      fetchExistingLinkingData(selectedAnnotationId, true);
    }
  }, [availableAnnotations?.length, selectedAnnotationId]);

  React.useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (justSavedTimeoutRef.current) {
        clearTimeout(justSavedTimeoutRef.current);
      }
      if (pointSelectionTimeoutRef.current) {
        clearTimeout(pointSelectionTimeoutRef.current);
      }
      if (confirmDeleteTimeout.current) {
        clearTimeout(confirmDeleteTimeout.current);
      }
    };
  }, []);

  // -- Data operations --

  const extractLinkingDataFromGlobal = (annotationId: string) => {
    if (!availableAnnotations || availableAnnotations.length === 0) {
      return { linking: null, geotagging: null };
    }

    const linkingAnnotations = availableAnnotations.filter(
      (ann: any) =>
        ann.motivation === 'linking' &&
        ann.target &&
        (Array.isArray(ann.target)
          ? ann.target.includes(annotationId)
          : ann.target === annotationId),
    );

    if (linkingAnnotations.length === 0) {
      return { linking: null, geotagging: null };
    }

    const primaryLinking = linkingAnnotations[0];
    const linking = { ...primaryLinking };
    let geotagging = null;

    if (primaryLinking.body) {
      const bodies = Array.isArray(primaryLinking.body)
        ? primaryLinking.body
        : [primaryLinking.body];
      const geotagBody = bodies.find((b: any) => b.purpose === 'geotagging');
      if (geotagBody) {
        geotagging = { ...primaryLinking, body: geotagBody };
      }
    }

    return { linking, geotagging };
  };

  const fetchExistingLinkingData = (
    annotationId: string,
    forceRefresh = false,
  ) => {
    if (!forceRefresh && lastFetchRef.current === annotationId) return;
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    lastFetchRef.current = annotationId;

    try {
      setLoadingExistingData(true);
      setError(null);

      const links = extractLinkingDataFromGlobal(annotationId);
      setExistingLinkingData(links);

      if (links.linking && links.linking.target) {
        const linkedIds = Array.isArray(links.linking.target)
          ? links.linking.target
          : [links.linking.target];

        setInternalSelected(linkedIds);
        if (setSelectedIds) setSelectedIds(linkedIds);

        if (isLinkingMode) {
          linkingModeContext.clearLinkingSelection();
          linkedIds.forEach((id: string) =>
            linkingModeContext.addAnnotationToLinking(id),
          );
        }
      } else {
        if (!hasManuallyReordered) {
          setInternalSelected([]);
          if (setSelectedIds) setSelectedIds([]);
        }
        if (isLinkingMode) linkingModeContext.clearLinkingSelection();
      }

      if (links.geotagging && links.geotagging.body) {
        const geotagBody = Array.isArray(links.geotagging.body)
          ? links.geotagging.body.find((b: any) => b.purpose === 'geotagging')
          : links.geotagging.body;
        if (geotagBody) {
          const source = geotagBody.source;
          if (source) {
            setSelectedGeotag({
              ...source,
              displayName:
                source._label || source.label || source.properties?.title,
              originalResult: source,
            });
          } else {
            setSelectedGeotag(geotagBody);
          }
        }
      } else {
        setSelectedGeotag(null);
      }

      if (links.linking && links.linking.body) {
        const bodies = Array.isArray(links.linking.body)
          ? links.linking.body
          : [links.linking.body];
        const pointSelectorBody = bodies.find(
          (b: any) =>
            b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
        );
        if (pointSelectorBody && pointSelectorBody.selector) {
          setSelectedPoint({
            x: pointSelectorBody.selector.x,
            y: pointSelectorBody.selector.y,
          });
        } else {
          setSelectedPoint(null);
        }
      } else {
        setSelectedPoint(null);
      }
    } catch {
      setError('Failed to load enrichment data');
    } finally {
      setLoadingExistingData(false);
    }
  };

  // -- Delete operations --

  const handleDeleteExistingLink = async (
    linkingId: string,
    motivation: 'linking' | 'geotagging',
  ) => {
    // Two-step confirm
    if (confirmDeleteId !== linkingId) {
      setConfirmDeleteId(linkingId);
      if (confirmDeleteTimeout.current) {
        clearTimeout(confirmDeleteTimeout.current);
      }
      confirmDeleteTimeout.current = setTimeout(
        () => setConfirmDeleteId(null),
        3000,
      );
      return;
    }
    setConfirmDeleteId(null);

    try {
      setError(null);
      await deleteLinkingRelationship(linkingId, motivation);

      if (canvasId) invalidateLinkingCache(canvasId);
      invalidateGlobalLinkingCache();
      if (onGlobalRefresh) onGlobalRefresh();
      if (onRefreshAnnotations) onRefreshAnnotations();

      if (selectedAnnotationId) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
        fetchExistingLinkingData(selectedAnnotationId, true);
      }

      if (motivation === 'linking') {
        setInternalSelected([]);
        if (setSelectedIds) setSelectedIds([]);
        setSelectedPoint(null);
      } else if (motivation === 'geotagging') {
        setSelectedGeotag(null);
      }

      onRefreshAnnotations?.();

      toast({
        title: 'Deleted',
        description: `Removed ${motivation === 'linking' ? 'annotation links' : 'geotag'}.`,
      });
    } catch {
      const errorMessage = `Failed to delete ${motivation} data`;
      setError(errorMessage);
      toast({ title: 'Delete failed', description: errorMessage });
    }
  };

  const handleDeleteBodyPurpose = async (
    purpose: 'geotagging' | 'selecting',
  ) => {
    if (!existingLinkingData.linking) return;

    const confirmed = window.confirm(
      `Remove the ${purpose === 'geotagging' ? 'location tag' : 'point marker'} from this annotation? Linked annotations will remain intact.`,
    );
    if (!confirmed) return;

    try {
      setError(null);
      setIsSaving(true);

      const currentBody = Array.isArray(existingLinkingData.linking.body)
        ? existingLinkingData.linking.body
        : existingLinkingData.linking.body
          ? [existingLinkingData.linking.body]
          : [];

      const purposesToRemove =
        purpose === 'geotagging'
          ? ['identifying', 'geotagging']
          : ['selecting'];

      const filteredBody = currentBody.filter(
        (b: any) => !purposesToRemove.includes(b.purpose),
      );

      const updatedAnnotation = {
        ...existingLinkingData.linking,
        body: filteredBody,
        modified: new Date().toISOString(),
      };

      const annotationId = existingLinkingData.linking.id;
      const encodedId = encodeURIComponent(encodeURIComponent(annotationId));
      const response = await fetch(`/api/annotations/linking/${encodedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAnnotation),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Update failed: ${response.status}`);
      }

      if (canvasId) invalidateLinkingCache(canvasId);
      invalidateGlobalLinkingCache();
      if (onGlobalRefresh) onGlobalRefresh();
      if (purpose === 'geotagging') setSelectedGeotag(null);
      else setSelectedPoint(null);
      if (onRefreshAnnotations) onRefreshAnnotations();

      if (selectedAnnotationId) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
        fetchExistingLinkingData(selectedAnnotationId, true);
      }

      toast({
        title: 'Removed',
        description: `Removed ${purpose === 'geotagging' ? 'location tag' : 'point marker'}.`,
      });
    } catch (deleteError: unknown) {
      const errorMessage =
        deleteError instanceof Error
          ? deleteError.message
          : `Failed to remove ${purpose} data`;
      setError(errorMessage);
      toast({ title: 'Update failed', description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  // -- NeRu sync --

  const handleSyncNeRuGeotag = async (globId: string) => {
    if (!existingLinkingData.linking || !globId) return;

    try {
      setIsSyncing(true);
      setError(null);

      const response = await fetch(
        `/api/neru/places?glob_id=${encodeURIComponent(globId)}`,
      );

      if (!response.ok) throw new Error('Failed to fetch place data');

      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        throw new Error(`Place "${globId}" not found in dataset`);
      }

      const neruPlace = data.features[0].originalData;
      const title = neruPlace._label;

      let coords: [number, number] = [0, 0];
      if (neruPlace.defined_by) {
        const match = neruPlace.defined_by.match(/POINT \(([^ ]+) ([^ ]+)\)/);
        if (match && match[1] && match[2]) {
          coords = [parseFloat(match[1]), parseFloat(match[2])];
        }
      }

      const currentBody = Array.isArray(existingLinkingData.linking.body)
        ? existingLinkingData.linking.body
        : existingLinkingData.linking.body
          ? [existingLinkingData.linking.body]
          : [];

      const filteredBody = currentBody.filter(
        (b: any) => b.purpose !== 'geotagging' && b.purpose !== 'identifying',
      );

      filteredBody.push({
        purpose: 'identifying',
        type: 'SpecificResource',
        source: {
          id:
            neruPlace.id || `https://id.necessaryreunions.org/place/${globId}`,
          type: 'Place',
          label: title,
          _label: title,
          glob_id: globId,
          defined_by:
            neruPlace.defined_by || `POINT(${coords[0]} ${coords[1]})`,
          classified_as: neruPlace.classified_as,
          identified_by: neruPlace.identified_by,
          coord_certainty: neruPlace.coord_certainty,
        },
      });

      filteredBody.push({
        purpose: 'geotagging',
        type: 'SpecificResource',
        source: {
          id:
            neruPlace.id || `https://id.necessaryreunions.org/place/${globId}`,
          type: 'Feature',
          properties: {
            title: title,
            description: title,
            glob_id: globId,
            classified_as: neruPlace.classified_as,
            coord_certainty: neruPlace.coord_certainty,
          },
          geometry: { type: 'Point', coordinates: coords },
          _label: title,
          glob_id: globId,
          classified_as: neruPlace.classified_as,
          identified_by: neruPlace.identified_by,
          defined_by: neruPlace.defined_by,
          coord_certainty: neruPlace.coord_certainty,
        },
      });

      const updatedAnnotation = {
        ...existingLinkingData.linking,
        body: filteredBody,
        modified: new Date().toISOString(),
      };

      const annotationId = existingLinkingData.linking.id;
      const encodedId = encodeURIComponent(encodeURIComponent(annotationId));
      const updateResponse = await fetch(
        `/api/annotations/linking/${encodedId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAnnotation),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Update failed: ${updateResponse.status}`,
        );
      }

      if (canvasId) invalidateLinkingCache(canvasId);
      invalidateGlobalLinkingCache();
      if (onGlobalRefresh) onGlobalRefresh();
      if (onRefreshAnnotations) onRefreshAnnotations();

      if (selectedAnnotationId) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
        fetchExistingLinkingData(selectedAnnotationId, true);
      }

      const hasNewCoords = coords[0] !== 0 || coords[1] !== 0;
      toast({
        title: 'Synced',
        description: hasNewCoords
          ? `Updated coordinates: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`
          : 'Updated (no coordinates in dataset)',
      });
    } catch (syncError: unknown) {
      const errorMessage =
        syncError instanceof Error
          ? syncError.message
          : 'Failed to sync with dataset';
      setError(errorMessage);
      toast({ title: 'Sync failed', description: errorMessage });
    } finally {
      setIsSyncing(false);
    }
  };

  // -- Reorder --

  function moveSelected(idx: number, dir: -1 | 1) {
    const newOrder = [...currentlySelectedForLinking];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    const temp = newOrder[idx]!;
    newOrder[idx] = newOrder[swapIdx]!;
    newOrder[swapIdx] = temp;
    setSelected(newOrder);
    setHasManuallyReordered(true);
    setForceUpdate((prev) => prev + 1);

    if (onLinkedAnnotationsOrderChange) {
      onLinkedAnnotationsOrderChange(newOrder);
    }
    if (isLinkingMode && selectedAnnotationsForLinking.length > 0) {
      linkingModeContext.clearLinkingSelection();
      newOrder.forEach((id: string) =>
        linkingModeContext.addAnnotationToLinking(id),
      );
    }
  }

  // -- Point selection --

  const handleStartPointSelection = () => {
    setIsPointSelectionActive(true);
    if (onEnablePointSelection) onEnablePointSelection();
  };

  const handlePointChange = (point: { x: number; y: number } | null) => {
    setSelectedPoint(point);
    setIsPointSelectionActive(false);
    if (onPointChange) onPointChange(point);
    if (onDisablePointSelection) onDisablePointSelection();
  };

  // -- Save --

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    const existingAnnotationId = existingLinkingData.linking?.id || null;

    try {
      if (
        currentlySelectedForLinking.length === 0 &&
        !selectedGeotag &&
        !selectedPoint &&
        !existingAnnotationId
      ) {
        throw new Error('No changes to save yet');
      }

      if (
        !existingAnnotationId &&
        currentlySelectedForLinking.length === 1 &&
        !selectedGeotag &&
        !selectedPoint
      ) {
        throw new Error(
          'Select at least 2 annotations to create a link, or add a location or point marker',
        );
      }

      if (existingAnnotationId && currentlySelectedForLinking.length > 0) {
        if (
          currentlySelectedForLinking.length === 1 &&
          !selectedGeotag &&
          !selectedPoint
        ) {
          throw new Error(
            'A link needs at least 2 annotations, or add a location or point marker',
          );
        }
      }

      const geotagToSave = selectedGeotag?.originalResult || selectedGeotag;

      await onSave({
        linkedIds: currentlySelectedForLinking,
        geotag: geotagToSave,
        point: selectedPoint,
        existingLinkingId: existingAnnotationId,
      });

      const isUpdating = !!existingAnnotationId;
      if (!isUpdating) setForceUpdate((prev) => prev + 1);

      if (canvasId) invalidateLinkingCache(canvasId);
      invalidateGlobalLinkingCache();
      if (onGlobalRefresh) {
        onGlobalRefresh();
      }
      if (onRefreshAnnotations) {
        onRefreshAnnotations();
      }

      if (selectedAnnotationId) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 500);
        });
        fetchExistingLinkingData(selectedAnnotationId, true);
      }

      // Build descriptive toast
      const locationName = selectedGeotag?.displayName || selectedGeotag?.label;
      const parts: string[] = [];
      if (selectedGeotag && locationName) {
        parts.push(`location: ${locationName}`);
      } else if (selectedGeotag) {
        parts.push('geographic data');
      }
      if (selectedPoint) {
        parts.push('point marker');
      }

      let annotationCount = currentlySelectedForLinking.length;
      if (
        isUpdating &&
        annotationCount === 0 &&
        existingLinkingData.linking?.target
      ) {
        const existingTargets = Array.isArray(
          existingLinkingData.linking.target,
        )
          ? existingLinkingData.linking.target
          : [existingLinkingData.linking.target];
        annotationCount = existingTargets.length;
      }
      if (annotationCount > 1) {
        parts.unshift(`${annotationCount} annotations`);
      }

      const contextInfo =
        parts.length > 0 ? ` with ${parts.join(' and ')}` : '';

      toast({
        title: isUpdating ? 'Updated' : 'Saved',
        description: `${isUpdating ? 'Updated' : 'Saved'} enrichment${contextInfo}`,
      });

      setJustSaved(true);
      if (justSavedTimeoutRef.current) {
        clearTimeout(justSavedTimeoutRef.current);
      }
      justSavedTimeoutRef.current = setTimeout(() => setJustSaved(false), 2500);

      // Exit linking mode after save
      if (isLinkingMode && onDisableLinkingMode) {
        linkingModeContext.exitLinkingMode();
        onDisableLinkingMode();
      }

      if (isPointSelectionActive && onDisablePointSelection) {
        if (pointSelectionTimeoutRef.current) {
          clearTimeout(pointSelectionTimeoutRef.current);
        }
        pointSelectionTimeoutRef.current = setTimeout(() => {
          setIsPointSelectionActive(false);
          onDisablePointSelection();
        }, 1000);
      }

      // Suggest next step
      if (!existingLinkingData.linking?.body) {
        if (
          !selectedGeotag &&
          resolvedGeotagSources &&
          resolvedGeotagSources.length > 0
        ) {
          setTimeout(() => {
            setGeotagOpen(true);
          }, 600);
        }
      }
    } catch (e: any) {
      const errorMessage = e.message || 'An error occurred during save';
      setError(errorMessage);
      toast({
        title: 'Save failed',
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayedLinks =
    currentlySelectedForLinking.length > 0
      ? currentlySelectedForLinking
      : existingLinkingData.linking?.target
        ? Array.isArray(existingLinkingData.linking.target)
          ? existingLinkingData.linking.target
          : [existingLinkingData.linking.target]
        : [];

  const existingGeotagBody = existingLinkingData.linking?.body
    ? (Array.isArray(existingLinkingData.linking.body)
        ? existingLinkingData.linking.body
        : [existingLinkingData.linking.body]
      ).find((b: any) => b.purpose === 'geotagging')
    : null;

  const existingGeotagName =
    existingGeotagBody?.source?.properties?.title ||
    existingGeotagBody?.source?.label ||
    null;

  const existingPointBody = existingLinkingData.linking?.body
    ? (Array.isArray(existingLinkingData.linking.body)
        ? existingLinkingData.linking.body
        : [existingLinkingData.linking.body]
      ).find(
        (b: any) =>
          b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
      )
    : null;

  const hasExistingPoint = !!existingPointBody || !!selectedPoint;
  const hasExistingGeotag = !!existingGeotagBody || !!selectedGeotag;
  const hasLinks = displayedLinks.length > 0;

  // -- Validation status --

  const canSave =
    !!userSession?.user &&
    !isSaving &&
    !justSaved &&
    (currentlySelectedForLinking.length > 0 ||
      !!selectedGeotag ||
      !!selectedPoint);

  const validationMessage = React.useMemo(() => {
    if (
      currentlySelectedForLinking.length === 0 &&
      !selectedGeotag &&
      !selectedPoint
    ) {
      return null;
    }
    if (
      currentlySelectedForLinking.length === 1 &&
      !selectedGeotag &&
      !selectedPoint &&
      !existingLinkingData.linking?.id
    ) {
      return 'Select at least one more annotation, or add a location or point';
    }
    return null;
  }, [
    currentlySelectedForLinking.length,
    selectedGeotag,
    selectedPoint,
    existingLinkingData.linking?.id,
  ]);

  // RENDER
  // -----------------------------------------------------------------------

  if (!canEdit) return null;

  return (
    <div className={`space-y-1 ${isMobile ? '' : 'mt-2'}`}>
      {/* Header with save button */}
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Enrichment
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
          className={`ml-auto ${isMobile ? 'h-8 px-3' : 'h-7 px-2'} text-xs ${
            justSaved ? 'bg-chart-2 hover:bg-chart-2' : ''
          }`}
        >
          {justSaved ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Saved
            </>
          ) : isSaving ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground mr-1" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3 w-3 mr-1" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          {error}
        </div>
      )}

      {/* Validation hint */}
      {validationMessage && (
        <div className="mx-2 text-xs text-chart-4 bg-chart-4/10 p-2 rounded border border-chart-4/20">
          {validationMessage}
        </div>
      )}

      {/* Loading indicator */}
      {selectedAnnotationId && loadingExistingData && (
        <div className="mx-2">
          <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            Loading...
          </div>
        </div>
      )}

      {/* Linking mode status strip */}
      {isLinkingMode && !existingLinkingData.linking?.target && (
        <div
          className={`mx-2 flex items-center gap-2 rounded-md border-l-4 border-l-primary bg-primary/5 ${
            isMobile ? 'p-3' : 'p-2'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Link className="h-3 w-3 flex-shrink-0" />
              {currentlySelectedForLinking.length === 0 && (
                <span>Tap annotations on the map to link them</span>
              )}
              {currentlySelectedForLinking.length === 1 && (
                <span>Select at least one more annotation</span>
              )}
              {currentlySelectedForLinking.length >= 2 && (
                <span>
                  {currentlySelectedForLinking.length} selected — ready to save
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {currentlySelectedForLinking.length > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0 text-[10px] font-bold">
                {currentlySelectedForLinking.length}
              </span>
            )}
            {onDisableLinkingMode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  linkingModeContext.exitLinkingMode();
                  onDisableLinkingMode();
                  setInternalSelected([]);
                  if (setSelectedIds) setSelectedIds([]);
                  setHasManuallyReordered(false);
                  toast({
                    title: 'Cancelled',
                    description: 'Selection discarded.',
                  });
                }}
                className={`${isMobile ? 'h-8 px-2' : 'h-6 px-2'} text-xs`}
                disabled={isSaving}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={async () => {
                const currentSelection = currentlySelectedForLinking;
                setInternalSelected(currentSelection);
                if (setSelectedIds) setSelectedIds(currentSelection);
                setHasManuallyReordered(true);
                setForceUpdate((prev) => prev + 1);

                if (
                  onLinkedAnnotationsOrderChange &&
                  currentSelection.length > 1
                ) {
                  onLinkedAnnotationsOrderChange(currentSelection);
                }

                linkingModeContext.exitLinkingMode();
                if (onDisableLinkingMode) onDisableLinkingMode();

                await handleSave();
              }}
              className={`${isMobile ? 'h-8 px-3' : 'h-6 px-2'} text-xs`}
              disabled={
                isSaving ||
                (currentlySelectedForLinking.length < 2 &&
                  !selectedGeotag &&
                  !selectedPoint)
              }
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 1: Link Annotations                                    */}
      {/* ============================================================= */}

      <Collapsible.Root open={linkOpen} onOpenChange={setLinkOpen}>
        <Collapsible.Trigger asChild>
          <div>
            <SectionHeader
              icon={<Link className="h-3.5 w-3.5" />}
              label="Link annotations"
              badge={
                hasLinks ? (
                  <StatusBadge variant={isLinkingMode ? 'active' : 'default'}>
                    {displayedLinks.length} linked
                  </StatusBadge>
                ) : null
              }
              isOpen={linkOpen}
              onToggle={() => setLinkOpen(!linkOpen)}
              isMobile={isMobile}
            />
          </div>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div
            className={`px-2 pb-2 space-y-2 ${isMobile ? 'pt-1' : 'pt-0.5'}`}
          >
            {/* Empty state */}
            {!isLinkingMode &&
              currentlySelectedForLinking.length === 0 &&
              !existingLinkingData.linking?.target && (
                <div className="p-3 bg-muted/30 rounded-lg text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Connect annotations that belong together to establish
                    reading order
                  </p>
                  {onEnableLinkingMode && (
                    <Button
                      size="sm"
                      onClick={() => {
                        linkingModeContext.clearLinkingSelection();
                        onEnableLinkingMode();
                        setLinkOpen(true);
                      }}
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-2 ${isMobile ? 'h-9' : ''}`}
                    >
                      <Plus className="h-3 w-3" />
                      Start selecting
                    </Button>
                  )}
                </div>
              )}

            {/* Linked annotations list */}
            {displayedLinks.length > 0 && (
              <div className="border rounded bg-primary/5 border-primary/20">
                {/* List header */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary">
                      {displayedLinks.length} linked
                    </span>
                    {isLinkingMode && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider font-medium">
                        Editing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onEnableLinkingMode && !isLinkingMode && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          linkingModeContext.clearLinkingSelection();
                          currentlySelectedForLinking.forEach((id: string) =>
                            linkingModeContext.addAnnotationToLinking(id),
                          );
                          onEnableLinkingMode();
                        }}
                        disabled={!canEdit}
                        className={`${isMobile ? 'h-8 px-2' : 'h-6 px-2'} text-xs`}
                        title="Add more annotations"
                        aria-label="Add more annotations"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                    {existingLinkingData.linking && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleDeleteExistingLink(
                            existingLinkingData.linking.id,
                            'linking',
                          )
                        }
                        disabled={!canEdit}
                        className={`${isMobile ? 'h-8 px-2' : 'h-6 px-2'} text-xs ${
                          confirmDeleteId === existingLinkingData.linking.id
                            ? 'bg-destructive text-destructive-foreground'
                            : 'text-destructive hover:bg-destructive/10'
                        }`}
                        title={
                          confirmDeleteId === existingLinkingData.linking.id
                            ? 'Click again to confirm'
                            : 'Delete all links'
                        }
                        aria-label={
                          confirmDeleteId === existingLinkingData.linking.id
                            ? 'Confirm delete all links'
                            : 'Delete all links'
                        }
                      >
                        {confirmDeleteId === existingLinkingData.linking.id ? (
                          <span className="text-[10px]">Confirm?</span>
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* List items */}
                <div
                  className={`space-y-0.5 overflow-y-auto p-1 ${
                    isMobile ? 'max-h-40' : 'max-h-60'
                  }`}
                >
                  {displayedLinks.map((targetId: string, index: number) => {
                    const annotation = annotations.find(
                      (a) => a.id === targetId,
                    );
                    const isCurrentAnnotation =
                      targetId === selectedAnnotationId;

                    if (!annotation) return null;

                    const annotationText = getAnnotationText(annotation);
                    const isIcon =
                      annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy';

                    return (
                      <div
                        key={targetId}
                        className={`group rounded text-xs flex items-center gap-1.5 transition-colors ${
                          isMobile ? 'p-2' : 'p-1.5'
                        } ${
                          isCurrentAnnotation
                            ? 'bg-primary/15 border border-primary/30'
                            : 'border border-transparent hover:bg-primary/5'
                        }`}
                      >
                        <span className="text-primary/60 w-4 font-medium text-center flex-shrink-0">
                          {index + 1}
                        </span>
                        {isIcon ? (
                          <Image className="h-3 w-3 text-primary/80 flex-shrink-0" />
                        ) : (
                          <Type className="h-3 w-3 text-primary/80 flex-shrink-0" />
                        )}
                        <span
                          className="flex-1 truncate text-primary/90"
                          title={isIcon ? 'Icon' : annotationText || '(Empty)'}
                        >
                          {isIcon ? 'Icon' : annotationText || '(Empty)'}
                        </span>

                        {/* Action buttons: show on hover (desktop), always show (mobile) */}
                        <div
                          className={`flex items-center gap-0.5 ml-auto ${
                            isMobile
                              ? ''
                              : 'opacity-0 group-hover:opacity-100 transition-opacity'
                          }`}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSelected(index, -1);
                            }}
                            disabled={!canEdit || index === 0}
                            className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} p-0 hover:bg-primary/10`}
                            title="Move up"
                            aria-label={`Move annotation ${index + 1} up`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSelected(index, 1);
                            }}
                            disabled={
                              !canEdit || index === displayedLinks.length - 1
                            }
                            className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} p-0 hover:bg-primary/10`}
                            title="Move down"
                            aria-label={`Move annotation ${index + 1} down`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newOrder = displayedLinks.filter(
                                (id: string) => id !== targetId,
                              );
                              setSelected(newOrder);
                              setHasManuallyReordered(true);
                              setForceUpdate((prev) => prev + 1);
                              if (onLinkedAnnotationsOrderChange) {
                                onLinkedAnnotationsOrderChange(newOrder);
                              }
                            }}
                            disabled={!canEdit}
                            className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} p-0 hover:bg-destructive/10 text-destructive`}
                            title="Remove from link"
                            aria-label={`Remove annotation ${index + 1} from link`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* ============================================================= */}
      {/* SECTION 2: Geotag (Location)                                   */}
      {/* ============================================================= */}

      <Collapsible.Root open={geotagOpen} onOpenChange={setGeotagOpen}>
        <Collapsible.Trigger asChild>
          <div>
            <SectionHeader
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Add location"
              badge={
                hasExistingGeotag ? (
                  <StatusBadge variant="success">
                    {existingGeotagName || 'Tagged'}
                  </StatusBadge>
                ) : null
              }
              isOpen={geotagOpen}
              onToggle={() => setGeotagOpen(!geotagOpen)}
              isMobile={isMobile}
            />
          </div>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div
            className={`px-2 pb-2 space-y-2 ${isMobile ? 'pt-1' : 'pt-0.5'}`}
          >
            {/* Empty state */}
            {!hasExistingGeotag && !selectedGeotag && (
              <p className="text-xs text-muted-foreground px-1">
                Tag this annotation with a geographic location
              </p>
            )}

            {/* Existing geotag display */}
            {!selectedGeotag &&
              existingGeotagBody &&
              (() => {
                const geotagBody = existingGeotagBody;
                const globId =
                  geotagBody?.source?.glob_id ||
                  geotagBody?.source?.properties?.glob_id;
                const hasCoordinates =
                  geotagBody?.source?.geometry?.coordinates &&
                  (geotagBody.source.geometry.coordinates[0] !== 0 ||
                    geotagBody.source.geometry.coordinates[1] !== 0);

                return (
                  <div className="p-2 bg-secondary/10 border border-secondary/30 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {geotagBody.source?.properties?.title ||
                              geotagBody.source?.label ||
                              'Location'}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                          {globId && (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-mono">{globId}</span>
                            </div>
                          )}
                          {hasCoordinates ? (
                            <div className="text-[11px] text-muted-foreground">
                              {geotagBody.source.geometry.coordinates.join(
                                ', ',
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-chart-4">
                              No coordinates available
                            </div>
                          )}
                        </div>
                        {globId && (
                          <div className="mt-2 pt-1.5 border-t border-secondary/30">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncNeRuGeotag(globId)}
                              disabled={!canEdit || isSaving || isSyncing}
                              className={`${isMobile ? 'h-8' : 'h-6'} px-2 text-xs`}
                              title="Refresh from latest dataset"
                              aria-label="Refresh geotag from dataset"
                            >
                              <RefreshCw
                                className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`}
                              />
                              {isSyncing ? 'Syncing...' : 'Refresh'}
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBodyPurpose('geotagging')}
                        disabled={!canEdit || isSaving}
                        className={`${isMobile ? 'h-8 w-8' : 'h-6 w-6'} p-0 text-destructive hover:bg-destructive/10`}
                        title="Remove location"
                        aria-label="Remove location tag"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })()}

            {/* GeoTagMap */}
            {React.createElement(geoTagMapDynamic, {
              key: componentId.current,
              onGeotagSelected: (geotag: any) => {
                setSelectedGeotag(geotag);
              },
              onGeotagCleared: () => setSelectedGeotag(null),
              initialGeotag: initialGeotag,
              showClearButton: !!selectedGeotag,
              allowedSources: resolvedGeotagSources,
            })}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* ============================================================= */}
      {/* SECTION 3: Point Marker                                        */}
      {/* ============================================================= */}

      <Collapsible.Root open={pointOpen} onOpenChange={setPointOpen}>
        <Collapsible.Trigger asChild>
          <div>
            <SectionHeader
              icon={<Crosshair className="h-3.5 w-3.5" />}
              label="Add point marker"
              badge={
                hasExistingPoint ? (
                  <StatusBadge variant="success">
                    {selectedPoint
                      ? `${selectedPoint.x}, ${selectedPoint.y}`
                      : existingPointBody
                        ? `${existingPointBody.selector.x}, ${existingPointBody.selector.y}`
                        : 'Set'}
                  </StatusBadge>
                ) : null
              }
              isOpen={pointOpen}
              onToggle={() => setPointOpen(!pointOpen)}
              isMobile={isMobile}
            />
          </div>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div
            className={`px-2 pb-2 space-y-2 ${isMobile ? 'pt-1' : 'pt-0.5'}`}
          >
            {/* Empty state */}
            {!hasExistingPoint && !selectedPoint && (
              <p className="text-xs text-muted-foreground px-1">
                Mark a specific point on the map for this annotation
              </p>
            )}

            {/* Existing point display */}
            {!selectedPoint && existingPointBody && (
              <div className="p-2 bg-accent/10 border border-accent/30 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Crosshair className="h-3.5 w-3.5" />
                      Point
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      X: {existingPointBody.selector.x}, Y:{' '}
                      {existingPointBody.selector.y}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBodyPurpose('selecting')}
                    disabled={!canEdit || isSaving}
                    className={`${isMobile ? 'h-8 w-8' : 'h-6 w-6'} p-0 text-destructive hover:bg-destructive/10`}
                    title="Remove point"
                    aria-label="Remove point marker"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <PointSelector
              value={selectedPoint}
              onChange={handlePointChange}
              canvasId={canvasId}
              disabled={!canEdit}
              expandedStyle={true}
              existingAnnotations={availableAnnotations}
              currentAnnotationId={selectedAnnotationId}
              onStartSelecting={handleStartPointSelection}
              viewer={props.viewer}
              hideDisplay={false}
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
});

export default AnnotationEnrichment;
