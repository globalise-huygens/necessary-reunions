import type { GazetteerPlace, MapReference } from './types';

type MapReferenceLike = Partial<
  Pick<
    MapReference,
    'canvasId' | 'mapId' | 'mapTitle' | 'gridSquare' | 'pageNumber'
  >
> & {
  linkingAnnotationId?: string;
};

export function getMapReferenceKey(reference: MapReferenceLike): string {
  const canvasId = reference.canvasId?.trim();
  if (canvasId) return `canvas:${canvasId}`;

  const mapId = reference.mapId?.trim();
  if (mapId) return `map:${mapId}`;

  const mapTitle = reference.mapTitle?.trim();
  return mapTitle ? `title:${mapTitle}` : '';
}

export function deduplicateMapReferences<T extends MapReferenceLike>(
  mapReferences: T[] | undefined,
): T[] | undefined {
  if (!mapReferences || mapReferences.length === 0) return undefined;

  const referencesByMap = new Map<string, T>();
  mapReferences.forEach((reference) => {
    const key = getMapReferenceKey(reference);
    if (!key) return;

    const existing = referencesByMap.get(key);
    if (!existing) {
      referencesByMap.set(key, reference);
      return;
    }

    referencesByMap.set(key, {
      ...existing,
      mapTitle: existing.mapTitle || reference.mapTitle,
      gridSquare: existing.gridSquare || reference.gridSquare,
      pageNumber: existing.pageNumber || reference.pageNumber,
      linkingAnnotationId:
        existing.linkingAnnotationId || reference.linkingAnnotationId,
    });
  });

  return Array.from(referencesByMap.values());
}

export function getUniqueMapReferences(
  place: Pick<GazetteerPlace, 'mapReferences'>,
): MapReference[] {
  return deduplicateMapReferences(place.mapReferences) || [];
}

export function getUniqueMapCount(
  place: Pick<
    GazetteerPlace,
    'canvasId' | 'mapInfo' | 'mapReferences' | 'textRecognitionSources'
  >,
): number {
  const mapKeys = new Set<string>();

  if (place.canvasId) {
    mapKeys.add(`canvas:${place.canvasId}`);
  }

  if (place.mapInfo?.canvasId) {
    mapKeys.add(`canvas:${place.mapInfo.canvasId}`);
  } else if (place.mapInfo?.id) {
    mapKeys.add(`map:${place.mapInfo.id}`);
  }

  place.mapReferences?.forEach((reference) => {
    const key = getMapReferenceKey(reference);
    if (key) mapKeys.add(key);
  });

  place.textRecognitionSources?.forEach((source) => {
    if (source.canvasUrl) {
      mapKeys.add(`canvas:${source.canvasUrl}`);
    }
  });

  return mapKeys.size;
}
