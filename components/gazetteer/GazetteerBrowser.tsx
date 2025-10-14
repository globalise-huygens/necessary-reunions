'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  formatCoordinatesForDisplay,
  shouldDisplayCoordinates,
} from '@/lib/gazetteer/coordinate-utils';
import { createSlugFromName } from '@/lib/gazetteer/data';
import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from '@/lib/gazetteer/types';
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
import { useEffect, useRef, useState } from 'react';

const GazetteerMap = dynamic(() => import('./GazetteerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted/20 flex items-center justify-center">
      <div className="text-muted-foreground">Loading map...</div>
    </div>
  ),
});

export function GazetteerBrowser() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] =
    useState<GazetteerSearchResult | null>(null);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [filters, setFilters] = useState<GazetteerFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (viewMode === 'map') {
      setMapReady(false);
      const timer = setTimeout(() => {
        if (mapContainerRef.current) {
          const rect = mapContainerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setMapReady(true);
          } else {
            setTimeout(() => setMapReady(true), 100);
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedLetter, filters, currentPage]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/gazetteer/categories');
      if (response.ok) {
        const categoriesData = await response.json();
        setCategories(categoriesData);
      } else if (response.status === 504) {
        setCategories([]);
      }
    } catch (error) {
      setCategories([]);
    }
  };

  const performSearch = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: '200',
        ...(selectedLetter && { startsWith: selectedLetter.toLowerCase() }),
        ...(filters.category && { category: filters.category }),
        ...(filters.hasCoordinates && { hasCoordinates: 'true' }),
        ...(filters.hasModernName && { hasModernName: 'true' }),
        ...(filters.source && { source: filters.source }),
      });

      const response = await fetch(`/api/gazetteer/places?${params}`);
      if (response.ok) {
        const result = await response.json();
        if (currentPage === 0) {
          setSearchResult(result);
        } else {
          setSearchResult((prev) => {
            const existingIds = new Set(
              (prev?.places || []).map((p: GazetteerPlace) => p.id),
            );
            const newPlaces = result.places.filter(
              (p: GazetteerPlace) => !existingIds.has(p.id),
            );

            return {
              ...result,
              places: [...(prev?.places || []), ...newPlaces],
            };
          });
        }
      } else if (response.status === 504) {
        const errorResult = {
          places: [],
          totalCount: 0,
          hasMore: false,
          error:
            'Request timed out. The server is taking too long to process this request. Please try again later or use more specific search terms.',
        };
        setSearchResult(errorResult);
      } else {
        const errorResult = {
          places: [],
          totalCount: 0,
          hasMore: false,
          error: 'Failed to search places. Please try again later.',
        };
        setSearchResult(errorResult);
      }
    } catch (error) {
      const errorResult = {
        places: [],
        totalCount: 0,
        hasMore: false,
        error: 'Network error. Please check your connection and try again.',
      };
      setSearchResult(errorResult);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof GazetteerFilter, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  const loadMore = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const autoLoadAllData = async () => {
    if (isAutoLoading || !searchResult) return;

    setIsAutoLoading(true);
    let page = 1;
    let hasMore = searchResult.hasMore;
    let currentPlaces = [...searchResult.places];

    while (hasMore) {
      try {
        const params = new URLSearchParams({
          search: '',
          page: page.toString(),
          limit: '50',
        });

        const response = await fetch(`/api/gazetteer/places?${params}`);
        if (response.ok) {
          const result = await response.json();

          if (result.places.length > 0) {
            // Filter out duplicates based on place ID
            const existingIds = new Set(
              currentPlaces.map((p: GazetteerPlace) => p.id),
            );
            const newPlaces = result.places.filter(
              (p: GazetteerPlace) => !existingIds.has(p.id),
            );
            currentPlaces = [...currentPlaces, ...newPlaces];
            currentPlaces = [...currentPlaces, ...newPlaces];

            setSearchResult((prev) =>
              prev
                ? {
                    ...result,
                    places: currentPlaces,
                    totalCount: result.totalCount,
                    hasMore: result.hasMore,
                  }
                : result,
            );

            hasMore = result.hasMore;
            page++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        hasMore = false;
      }
    }

    setIsAutoLoading(false);
  };

  useEffect(() => {
    const isUnfilteredBrowse =
      !searchTerm &&
      !selectedLetter &&
      !filters.category &&
      !filters.hasCoordinates &&
      !filters.hasModernName &&
      !filters.source;

    if (
      searchResult &&
      searchResult.hasMore &&
      !isAutoLoading &&
      isUnfilteredBrowse
    ) {
      const timer = setTimeout(() => {
        autoLoadAllData();
      }, 500);

      return () => clearTimeout(timer);
    } else {
    }
  }, [searchResult, searchTerm, selectedLetter, filters, isAutoLoading]);

  const clearFilters = () => {
    setFilters({});
    setSelectedLetter(null);
    setCurrentPage(0);
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
                    key={letter}
                    onClick={() => {
                      setSelectedLetter(letter);
                      setCurrentPage(0);
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
                    setCurrentPage(0);
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
            {/* Search and Filters */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
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
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Category
                      </label>
                      <select
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
                          <option key={cat.key} value={cat.key}>
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
          {/* Results Header */}
          {searchResult && (
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
                {searchResult.hasMore &&
                  !isAutoLoading &&
                  viewMode === 'list' && (
                    <Button
                      onClick={autoLoadAllData}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      Load all{' '}
                      {searchResult.totalCount - searchResult.places.length}{' '}
                      remaining
                    </Button>
                  )}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            {/* List View */}
            {viewMode === 'list' && (
              <div className="h-full overflow-auto p-4">
                {isLoading && !searchResult ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : searchResult ? (
                  <>
                    {searchResult.places.length === 0 ? (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          No places found
                        </h3>
                        <p className="text-muted-foreground mb-4">
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
                          {searchResult.places.map((place, index) => (
                            <PlaceCard
                              key={`${place.id}-${index}`}
                              place={place}
                            />
                          ))}
                        </div>

                        {searchResult.hasMore && !isAutoLoading && (
                          <div className="text-center pt-6">
                            <div className="space-y-3">
                              <Button
                                onClick={loadMore}
                                variant="outline"
                                className="w-40"
                              >
                                Load More
                              </Button>
                            </div>
                          </div>
                        )}

                        {isAutoLoading && (
                          <div className="text-center py-8">
                            <div className="flex items-center justify-center space-x-3">
                              <LoadingSpinner />
                              <span className="text-muted-foreground">
                                Loading all remaining places...
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Start browsing places
                    </h3>
                    <p className="text-muted-foreground">
                      Search for place names or browse by letter to get started.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Map View */}
            {viewMode === 'map' && (
              <div
                ref={mapContainerRef}
                className="h-full w-full relative"
                style={{ minHeight: '400px' }}
              >
                {searchResult && mapReady ? (
                  <div className="absolute inset-0">
                    <GazetteerMap
                      key={`map-${searchResult.places.length}-${mapReady}`}
                      places={searchResult.places}
                      onPlaceSelect={(placeId) => {
                        if (placeId) {
                          const place = searchResult.places.find(
                            (p) => p.id === placeId,
                          );
                          if (place) {
                            const slug = createSlugFromName(place.name);
                            window.open(`/gazetteer/${slug}`, '_blank');
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                    <div className="text-center">
                      {!mapReady ? (
                        <>
                          <LoadingSpinner />
                          <p className="text-muted-foreground mt-2">
                            Initializing map...
                          </p>
                        </>
                      ) : !searchResult ? (
                        <>
                          <Map className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Search to view places on map
                          </h3>
                          <p className="text-muted-foreground">
                            Enter search criteria to display places on the map.
                          </p>
                        </>
                      ) : null}
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
      // Note: mapReferences doesn't seem to have date info in the type
      // We might need to get this from the actual map data
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

    // GAVOC categories (Dutch) with English translations
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
                {place.alternativeNames.slice(0, 2).map((name, index) => (
                  <Badge
                    key={`alt-name-card-${place.id}-${name.replace(
                      /[^a-zA-Z0-9]/g,
                      '',
                    )}-${index}`}
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
