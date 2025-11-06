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
  geotagSource?: {
    id: string;
    label: string;
    thesaurus: 'gavoc' | 'openstreetmap' | 'globalise' | 'unknown';
  };
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
  comments?: CommentAnnotation[];
  linkingAnnotationCount?: number;
  partOf?: PlaceHierarchy[];
  parsedRemarks?: ParsedRemarks;
}

export interface PlaceHierarchy {
  id: string;
  label: string;
  type?: string;
  classified_as?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
}

export interface ParsedRemarks {
  context: string[];
  coord: string[];
  disambiguation: string[];
  association: string[];
  inference: string[];
  automatic: string[];
  source: string[];
  altLabel: string[];
  other: string[];
}

export interface CommentAnnotation {
  value: string;
  targetId: string;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
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
  motivation?: 'textspotting' | 'iconography';
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
  classification?: {
    label: string;
    id: string;
    creator?: {
      id: string;
      type: string;
      label: string;
    };
    created?: string;
  };
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
  linkingAnnotationId?: string;
}

export interface GazetteerSearchResult {
  places: GazetteerPlace[];
  totalCount: number;
  hasMore: boolean;
  error?: string;
  warning?: string;
  truncated?: boolean;
  processedAnnotations?: number;
  availableAnnotations?: number;
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
