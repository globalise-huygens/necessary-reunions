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
  coordinateType?: 'pixel' | 'geographic';
  isGeotagged?: boolean;
  canvasId?: string;
  manifestId?: string;
  annotations?: GazetteerAnnotation[];
  mapReferences?: MapReference[];
  linkedUri?: string;

  hasPointSelection?: boolean;
  hasGeotagging?: boolean;
  hasHumanVerification?: boolean;
  targetAnnotationCount?: number;
  mapInfo?: MapInfo;
  textRecognitionSources?: TextRecognitionSource[];
}

export interface MapInfo {
  id: string;
  title: string;
  date?: string;
  permalink?: string;
  canvasId: string;
  canvasLabel?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface TextRecognitionSource {
  text: string;
  source: 'human' | 'ai-pipeline' | 'loghi-htr';
  confidence?: number;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  generator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  targetId: string;
  isHumanVerified?: boolean;
  verifiedBy?: {
    id: string;
    type: string;
    label: string;
  };
  verifiedDate?: string;
  svgSelector?: string;
  canvasUrl?: string;
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
  error?: string;
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
