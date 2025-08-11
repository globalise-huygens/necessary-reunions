export interface GavocLocation {
  id: string;
  indexPage: string;
  originalNameOnMap: string;
  presentName: string;
  category: string;
  coordinates: string;
  mapGridSquare: string;
  map: string;
  page: string;
  latitude?: number;
  longitude?: number;
  uri?: string;
  urlPath?: string;
  alternativeNames: string[];
  hasCoordinates: boolean;
  thesaurusId?: string; // Links to the thesaurus entry
}

export interface GavocData {
  locations: GavocLocation[];
  thesaurus?: any; // Will be properly typed when we import the thesaurus types
  totalCount: number;
  coordinatesCount: number;
  categories: string[];
}

export interface FilterConfig {
  searchQuery: string;
  categoryFilter: string;
  hasCoordinatesOnly: boolean;
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
  viewMode?: 'locations' | 'concepts'; // New: toggle between individual locations and concepts
}

export interface ViewModeConfig {
  mode: 'locations' | 'concepts';
  showAlternativeNames: boolean;
  groupByCategory: boolean;
}
