'use client';

import {
  ChevronDown,
  Filter,
  List,
  Map,
  MapPin,
  Search,
  Target,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  formatCoordinatesForDisplay,
  shouldDisplayCoordinates,
} from '../../lib/gazetteer/coordinate-utils';
import { createSlugFromName } from '../../lib/gazetteer/data';
import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from '../../lib/gazetteer/types';
import { useGazetteerData } from '../../hooks/use-gazetteer-data';

// Dynamic import for map component to avoid SSR issues with Leaflet
// eslint-disable-next-line @typescript-eslint/naming-convention
const GazetteerMap = dynamic(() => import('./GazetteerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted/20 flex items-center justify-center">
      <div className="text-muted-foreground">Loading map...</div>
    </div>
  ),
});

export function GazetteerBrowser() {
  // NEW APPROACH: Progressive Loading from AnnoRepo using linking-bulk endpoint
  // Follows the same proven pattern as viewer annotations
  // 1. Fetches first page immediately (~100 places in <8s)
  // 2. Auto-loads remaining pages progressively in background
  // 3. All data comes from AnnoRepo, no static fallback

  // Use the progressive loading hook
  const { allPlaces, isGlobalLoading, isLoadingMore, loadingProgress } =
    useGazetteerData();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [filters, setFilters] = useState<GazetteerFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapInitialized, setMapInitialized] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Client-side filtering - React Compiler friendly version
  const filteredPlaces = allPlaces.filter((place) => {
    // Apply search term filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      if (!place.name.toLowerCase().includes(lowerSearch)) {
        return false;
      }
    }

    // Apply letter filter
    if (selectedLetter) {
      const lowerLetter = selectedLetter.toLowerCase();
      if (!place.name.toLowerCase().startsWith(lowerLetter)) {
        return false;
      }
    }

    // Apply category filter
    if (filters.category) {
      if (place.category !== filters.category) {
        return false;
      }
    }

    // Apply coordinates filter
    if (filters.hasCoordinates) {
      if (!place.coordinates) {
        return false;
      }
    }

    // Apply modern name filter
    if (filters.hasModernName) {
      if (!place.modernName) {
        return false;
      }
    }

    return true;
  });

  // Create search result structure for compatibility with existing UI
  const searchResult: GazetteerSearchResult = {
    places: filteredPlaces,
    totalCount: filteredPlaces.length,
    hasMore: isLoadingMore,
  };

  const handleFilterChange = (key: keyof GazetteerFilter, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Load categories once on mount
  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const response = await fetch('/api/gazetteer/categories', {
          signal: controller.signal,
        });
        if (response.ok) {
          const categoriesData = (await response.json()) as PlaceCategory[];
          setCategories(categoriesData);
        } else if (response.status === 504) {
          setCategories([]);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setCategories([]);
        }
      }
    }

    loadCategories().catch(() => {
      // Ignore errors - categories will remain empty
    });
    return () => controller.abort();
  }, []);

  // Initialize map container when entering map view
  useEffect(() => {
    if (viewMode !== 'map') return;

    // Wait for container to be ready
    const timer = setTimeout(() => {
      if (mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setMapInitialized(true);
        } else {
          setTimeout(() => setMapInitialized(true), 100);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [viewMode]);

  const clearFilters = () => {
    setFilters({});
    setSelectedLetter(null);
  };

  const hasActiveFilters =
    Object.values(filters).some(
      (value) => value !== undefined && value !== '',
    ) || selectedLetter !== null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card/30 backdrop-blur-sm">
        {/* Search & Filter Header */}
        <div className="border-b border-border flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-semibold text-card-foreground flex items-center tracking-wide">
                <Search className="h-5 w-5 mr-2 text-primary" />
                Search & Browse
              </h2>

              {/* View Mode Toggle - Prominent Position */}
              <div className="flex items-center space-x-1 bg-muted/30 backdrop-blur-sm rounded-lg p-1 border">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="flex items-center space-x-2 h-8 px-3"
                  size="sm"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('map')}
                  className="flex items-center space-x-2 h-8 px-3"
                  size="sm"
                >
                  <Map className="w-4 h-4" />
                  <span className="hidden sm:inline">Map</span>
                </Button>
              </div>
            </div>

            {/* Alphabetical Navigation */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Browse by first letter:
              </h3>
              <div className="flex flex-wrap gap-1">
                {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                  <button
                    key={`letter-${letter}`}
                    onClick={() => {
                      setSelectedLetter(letter);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedLetter === letter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedLetter(null);
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedLetter === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  placeholder="Search place names..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-lg bg-background/50 backdrop-blur-sm focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>

              {/* Filters Toggle */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showFilters ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Collapsible Filters */}
              {showFilters && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Category Filter */}
                    <div>
                      <label
                        htmlFor="category-select"
                        className="block text-xs font-medium text-muted-foreground mb-1"
                      >
                        Category
                      </label>
                      <select
                        id="category-select"
                        value={filters.category || ''}
                        onChange={(e) =>
                          handleFilterChange(
                            'category',
                            e.target.value || undefined,
                          )
                        }
                        className="w-full text-sm border border-input rounded bg-background/50 backdrop-blur-sm px-2 py-1 focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="">All categories</option>
                        {categories.map((cat) => (
                          <option key={`category-${cat.key}`} value={cat.key}>
                            {cat.label} ({cat.count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Coordinates Filter */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hasCoordinates"
                        checked={filters.hasCoordinates || false}
                        onChange={(e) =>
                          handleFilterChange(
                            'hasCoordinates',
                            e.target.checked || undefined,
                          )
                        }
                        className="w-4 h-4 text-primary bg-background border-input rounded focus:ring-ring"
                      />
                      <label
                        htmlFor="hasCoordinates"
                        className="text-xs text-muted-foreground"
                      >
                        Has coordinates
                      </label>
                    </div>

                    {/* Modern Name Filter */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hasModernName"
                        checked={filters.hasModernName || false}
                        onChange={(e) =>
                          handleFilterChange(
                            'hasModernName',
                            e.target.checked || undefined,
                          )
                        }
                        className="w-4 h-4 text-primary bg-background border-input rounded focus:ring-ring"
                      />
                      <label
                        htmlFor="hasModernName"
                        className="text-xs text-muted-foreground"
                      >
                        Has modern name
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Data Truncation Warning */}
          {searchResult.warning && (
            <div className="mx-4 mt-4 mb-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 text-amber-600 mt-0.5">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-amber-800">
                    {searchResult.warning}
                  </p>
                  {searchResult.processedAnnotations != null &&
                    searchResult.availableAnnotations != null && (
                      <p className="text-xs text-amber-700 mt-1">
                        Processed: {searchResult.processedAnnotations} /{' '}
                        {searchResult.availableAnnotations} annotations
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Results Header */}
          <div className="px-4 py-2 border-b border-border bg-muted/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {viewMode === 'list' ? (
                  <>
                    Showing {searchResult.places.length} of{' '}
                    {searchResult.totalCount} places
                    {searchResult.hasMore && ' (load more below)'}
                  </>
                ) : (
                  <>
                    {
                      searchResult.places.filter(
                        (p) =>
                          p.coordinates &&
                          shouldDisplayCoordinates(p.coordinates),
                      ).length
                    }{' '}
                    of {searchResult.places.length} places mappable
                  </>
                )}
              </p>
              {isLoadingMore && viewMode === 'list' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoadingSpinner />
                  <span>
                    Loading more places... {loadingProgress.processed} /{' '}
                    {loadingProgress.total}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            {/* List View */}
            {viewMode === 'list' && (
              <div className="h-full overflow-auto p-4">
                {isGlobalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <LoadingSpinner />
                      <p className="mt-4 text-sm text-muted-foreground">
                        Loading places from AnnoRepo...
                      </p>
                      {loadingProgress.total > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {loadingProgress.processed} / {loadingProgress.total}{' '}
                          loaded
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {searchResult.places.length === 0 ? (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          No places found
                        </h3>
                        <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                          Try adjusting your search criteria or filters.
                        </p>
                        {hasActiveFilters && (
                          <Button onClick={clearFilters} variant="outline">
                            Clear filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {searchResult.places.map((place) => (
                            <PlaceCard
                              key={`place-${place.id}`}
                              place={place}
                            />
                          ))}
                        </div>

                        {isLoadingMore && (
                          <div className="text-center py-8">
                            <div className="flex items-center justify-center space-x-3">
                              <LoadingSpinner />
                              <span className="text-muted-foreground">
                                Loading more places ({loadingProgress.processed}{' '}
                                / {loadingProgress.total})...
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Map View */}
            {viewMode === 'map' && (
              <div
                ref={mapContainerRef}
                className="h-full w-full relative"
                style={{ minHeight: '400px' }}
                key={`map-view-${viewMode}`}
              >
                {mapInitialized ? (
                  <div className="absolute inset-0">
                    <GazetteerMap
                      key={`map-${searchResult.places.length}-${mapInitialized}`}
                      places={searchResult.places}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                    <div className="text-center">
                      <LoadingSpinner />
                      <p className="text-muted-foreground mt-2">
                        Initializing map...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceCard({ place }: { place: GazetteerPlace }) {
  const slug = createSlugFromName(place.name);
  const mapCount = place.mapReferences?.length || (place.mapInfo ? 1 : 0);
  const hasMultipleMaps = mapCount > 1;

  const getDatesFromPlace = () => {
    const dates: string[] = [];

    if (place.mapReferences) {
      // TODO: mapReferences does not have date info in the type, needs to be added additionally based on the map metadata spreadsheet
    }

    if (place.mapInfo?.date) {
      dates.push(place.mapInfo.date);
    }

    return dates.filter(Boolean).sort();
  };

  const getPlaceTypeStyle = (category: string) => {
    const lowerCategory = category.toLowerCase();

    // Water-related places - blue tones
    if (
      lowerCategory.includes('rivier') ||
      lowerCategory.includes('river') ||
      lowerCategory.includes('rio') ||
      lowerCategory.includes('zee') ||
      lowerCategory.includes('sea') ||
      lowerCategory.includes('baai') ||
      lowerCategory.includes('bay') ||
      lowerCategory.includes('meer') ||
      lowerCategory.includes('lake') ||
      lowerCategory.includes('water')
    ) {
      return 'bg-blue-50/30 border-blue-100/50';
    }

    // Islands - teal/aqua tones
    if (
      lowerCategory.includes('eiland') ||
      lowerCategory.includes('island') ||
      lowerCategory.includes('ilha') ||
      lowerCategory.includes('eilanden')
    ) {
      return 'bg-teal-50/30 border-teal-100/50';
    }

    // Mountains/hills - green/earth tones
    if (
      lowerCategory.includes('berg') ||
      lowerCategory.includes('mountain') ||
      lowerCategory.includes('hill') ||
      lowerCategory.includes('heuvel')
    ) {
      return 'bg-green-50/30 border-green-100/50';
    }

    // Capes/points - purple tones
    if (
      lowerCategory.includes('kaap') ||
      lowerCategory.includes('cape') ||
      lowerCategory.includes('caap') ||
      lowerCategory.includes('punt') ||
      lowerCategory.includes('point')
    ) {
      return 'bg-purple-50/30 border-purple-100/50';
    }

    // Settlements/places - amber/yellow tones (using your secondary color)
    if (
      lowerCategory.includes('plaats') ||
      lowerCategory.includes('settlement') ||
      lowerCategory.includes('stad') ||
      lowerCategory.includes('city') ||
      lowerCategory.includes('dorp') ||
      lowerCategory.includes('village') ||
      lowerCategory.includes('fort') ||
      lowerCategory.includes('castle') ||
      lowerCategory.includes('kasteel') ||
      lowerCategory.includes('place')
    ) {
      return 'bg-secondary/10 border-secondary/20';
    }

    // Kingdoms/territories - royal purple
    if (
      lowerCategory.includes('koninkryk') ||
      lowerCategory.includes('ryk') ||
      lowerCategory.includes('kingdom') ||
      lowerCategory.includes('gebiet') ||
      lowerCategory.includes('landstreek') ||
      lowerCategory.includes('region')
    ) {
      return 'bg-indigo-50/30 border-indigo-100/50';
    }

    // Forests/wilderness - forest green
    if (
      lowerCategory.includes('wilderness') ||
      lowerCategory.includes('forest') ||
      lowerCategory.includes('bos') ||
      lowerCategory.includes('woud')
    ) {
      return 'bg-emerald-50/30 border-emerald-100/50';
    }

    // Religious sites - warm yellow/gold
    if (
      lowerCategory.includes('tempel') ||
      lowerCategory.includes('temple') ||
      lowerCategory.includes('pagood') ||
      lowerCategory.includes('pagoda')
    ) {
      return 'bg-yellow-50/30 border-yellow-100/50';
    }

    // Default - neutral
    return 'bg-gray-50/30 border-gray-100/50';
  };

  const formatCategory = (category: string) => {
    if (!category || category === 'place') return null;

    const gavocCategoryMap: Record<string, string> = {
      rivier: 'river',
      zee: 'sea',
      meer: 'lake',
      baai: 'bay',
      eiland: 'island',
      eilanden: 'islands',
      berg: 'mountain',
      kaap: 'cape',
      plaats: 'settlement',
      stad: 'city',
      dorp: 'village',
      fort: 'fort',
      landstreek: 'region',
      gebied: 'territory',
      koninkryk: 'kingdom',
      bos: 'forest',
      tempel: 'temple',
    };

    return gavocCategoryMap[category.toLowerCase()] || category;
  };

  const inferPlaceType = (name: string) => {
    const lowerName = name.toLowerCase();

    // Rivers - Dutch, English, Portuguese
    if (
      lowerName.includes('rivier') ||
      lowerName.includes('river') ||
      lowerName.includes('rio')
    ) {
      return 'river';
    }

    // Islands - Dutch, English, Portuguese
    if (
      lowerName.includes('eiland') ||
      lowerName.includes('island') ||
      lowerName.includes('ilha')
    ) {
      return 'island';
    }

    // Mountains/Hills
    if (
      lowerName.includes('berg') ||
      lowerName.includes('mountain') ||
      lowerName.includes('hill')
    ) {
      return 'mountain';
    }

    // Capes
    if (
      lowerName.includes('kaap') ||
      lowerName.includes('cape') ||
      lowerName.includes('caap')
    ) {
      return 'cape';
    }

    // Bays
    if (lowerName.includes('baai') || lowerName.includes('bay')) {
      return 'bay';
    }

    // Lakes
    if (lowerName.includes('meer') || lowerName.includes('lake')) {
      return 'lake';
    }

    // Forts/Castles
    if (
      lowerName.includes('fort') ||
      lowerName.includes('castle') ||
      lowerName.includes('kasteel')
    ) {
      return 'fort';
    }

    // Cities
    if (lowerName.includes('stad') || lowerName.includes('city')) {
      return 'city';
    }

    // Villages
    if (lowerName.includes('dorp') || lowerName.includes('village')) {
      return 'village';
    }

    // Coasts
    if (lowerName.includes('kust') || lowerName.includes('coast')) {
      return 'coast';
    }

    // Kingdoms/Territories
    if (
      lowerName.includes('koninkryk') ||
      lowerName.includes('ryk') ||
      lowerName.includes('kingdom') ||
      lowerName.includes('gebiet')
    ) {
      return 'kingdom';
    }

    // Forests/Wilderness
    if (
      lowerName.includes('wilderness') ||
      lowerName.includes('forest') ||
      lowerName.includes('bos') ||
      lowerName.includes('woud')
    ) {
      return 'forest';
    }

    // Religious sites - Temples
    if (
      lowerName.includes('tempel') ||
      lowerName.includes('temple') ||
      lowerName.includes('pagood') ||
      lowerName.includes('pagoda')
    ) {
      return 'temple';
    }

    return null;
  };

  const documentationDates = getDatesFromPlace();
  const verifiedCategory = formatCategory(place.category);
  const inferredType = !verifiedCategory ? inferPlaceType(place.name) : null;

  const typeForStyling = verifiedCategory || inferredType || place.category;
  const placeTypeStyle = getPlaceTypeStyle(typeForStyling);

  return (
    <Link href={`/gazetteer/${slug}`} className="block">
      <div
        className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 h-full border ${placeTypeStyle}`}
      >
        <div className="space-y-3">
          {/* Name and Type */}
          <div>
            <h3 className="font-heading text-lg text-primary mb-1">
              {place.name}
            </h3>
            {verifiedCategory && (
              <p className="text-sm text-gray-500 italic mb-2">
                identified as {verifiedCategory}
              </p>
            )}
            {!verifiedCategory && inferredType && (
              <p className="text-sm text-gray-400 italic mb-2">
                might be {inferredType}
              </p>
            )}

            <div className="flex flex-wrap gap-1 mb-3">
              {hasMultipleMaps && (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                  {mapCount} Maps
                </Badge>
              )}

              {place.hasPointSelection && (
                <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 rounded text-xs text-primary">
                  <Target className="w-3 h-3" />
                  <span>Positioned on Map</span>
                </div>
              )}
            </div>
          </div>

          {/* Chronological Documentation */}
          {hasMultipleMaps ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Documented across{' '}
                <span className="font-medium">{mapCount}</span> historical maps
                {documentationDates.length > 0 && (
                  <span>
                    {documentationDates.length > 1
                      ? ` from ${documentationDates[0]} to ${
                          documentationDates[documentationDates.length - 1]
                        }`
                      : ` in ${documentationDates[0]}`}
                  </span>
                )}
              </p>
            </div>
          ) : place.mapInfo?.date ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Documented in{' '}
                <span className="font-medium">{place.mapInfo.date}</span>
              </p>
            </div>
          ) : null}

          {/* Modern Name */}
          {place.modernName && (
            <p className="text-sm text-gray-600">
              <strong>Modern:</strong> {place.modernName}
            </p>
          )}

          {/* Alternative Names */}
          {place.alternativeNames && place.alternativeNames.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-700">
                Historical variants:
              </h4>
              <div className="flex flex-wrap gap-1">
                {place.alternativeNames.slice(0, 2).map((name) => (
                  <Badge
                    key={`alt-name-${place.id}-${name}`}
                    variant="outline"
                    className="text-xs bg-gray-50"
                  >
                    {name}
                  </Badge>
                ))}
                {place.alternativeNames.length > 2 && (
                  <Badge variant="outline" className="text-xs bg-gray-50">
                    +{place.alternativeNames.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Coordinates */}
          {place.coordinates && shouldDisplayCoordinates(place.coordinates) && (
            <p className="text-xs text-gray-500 flex items-center space-x-1">
              <MapPin className="w-3 h-3" />
              <span>
                {place.coordinateType === 'geographic'
                  ? 'Location: '
                  : 'Map position: '}
                {formatCoordinatesForDisplay(place.coordinates).formatted}
              </span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
