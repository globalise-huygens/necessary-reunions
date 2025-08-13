export interface GazetteerPlace {
  id: string;
  name: string;
  alternativeNames?: string[];
  category: string;
  coordinates?: {
    x: number;
    y: number;
  };
  modernName?: string;
  description?: string;
  manifestUrl?: string;
  canvasUrl?: string;
  targetIds?: string[];
  linkingAnnotationId?: string;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  modified?: string;
  textParts?: Array<{
    value: string;
    source: 'creator' | 'loghi';
    targetId: string;
  }>;
  // Legacy fields for backward compatibility
  canvasId?: string;
  manifestId?: string;
  annotations?: GazetteerAnnotation[];
  mapReferences?: MapReference[];
  linkedUri?: string;
}

export interface GazetteerAnnotation {
  id: string;
  value: string;
  confidence?: number;
  source: 'manual' | 'ai-generated' | 'linking';
  coordinates: {
    x: number;
    y: number;
  };
  boundingBox: {
    points: string;
  };
  canvasId: string;
  created: string;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  linkedUri?: string;
}

export interface MapReference {
  mapId: string;
  mapTitle: string;
  canvasId: string;
  gridSquare?: string;
  pageNumber?: string;
}

export interface GazetteerSearchResult {
  places: GazetteerPlace[];
  totalCount: number;
  hasMore: boolean;
}

export interface GazetteerFilter {
  category?: string;
  hasCoordinates?: boolean;
  hasModernName?: boolean;
  source?: 'manual' | 'ai-generated' | 'linking' | 'all';
}

export interface PlaceCategory {
  key: string;
  label: string;
  count: number;
}
