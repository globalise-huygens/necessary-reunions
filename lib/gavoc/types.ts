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
  thesaurusId?: string;
}

export interface GavocData {
  locations: GavocLocation[];
  thesaurus?: any;
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
  viewMode?: 'locations' | 'concepts';
}

export interface ViewModeConfig {
  mode: 'locations' | 'concepts';
  showAlternativeNames: boolean;
  groupByCategory: boolean;
}
