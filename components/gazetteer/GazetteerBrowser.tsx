'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Select } from '@/components/shared/Select';
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
import { ExternalLink, Filter, MapPin, Search, Target } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    fetchCategories();
  }, []);

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
        console.warn(
          'Categories request timed out, continuing without categories',
        );
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
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
          setSearchResult((prev) => ({
            ...result,
            places: [...(prev?.places || []), ...result.places],
          }));
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
        console.error('Search failed with status:', response.status);
        const errorResult = {
          places: [],
          totalCount: 0,
          hasMore: false,
          error: 'Failed to search places. Please try again later.',
        };
        setSearchResult(errorResult);
      }
    } catch (error) {
      console.error('Error searching places:', error);
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
            currentPlaces = [...currentPlaces, ...result.places];

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
          console.error(`Failed to load page ${page}:`, response.status);
          hasMore = false;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error auto-loading data:', error);
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
    <div className="h-full overflow-auto bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <MapPin className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-heading">Gazetteer</h1>
                <p className="text-gray-600">
                  Historical place names from early modern Kerala maps
                </p>
              </div>
            </div>
          </div>

          {/* Alphabetical Navigation */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Browse by first letter:
              </h3>
              <div className="flex flex-wrap gap-2">
                {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                  <button
                    key={letter}
                    onClick={() => {
                      setSelectedLetter(letter);
                      setCurrentPage(0);
                    }}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedLetter === letter
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    selectedLetter === null
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search for places..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {hasActiveFilters && <Badge variant="secondary">Active</Badge>}
              </Button>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} size="sm">
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <Select
                    value={filters.category || ''}
                    onValueChange={(value) =>
                      handleFilterChange('category', value || undefined)
                    }
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label} ({category.count})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source
                  </label>
                  <Select
                    value={filters.source || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange(
                        'source',
                        value === 'all' ? undefined : value,
                      )
                    }
                  >
                    <option value="all">All Sources</option>
                    <option value="manual">Manual Annotations</option>
                    <option value="ai-generated">AI Generated</option>
                  </Select>
                </div>

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
                    className="rounded"
                  />
                  <label
                    htmlFor="hasCoordinates"
                    className="text-sm font-medium text-gray-700"
                  >
                    Has Coordinates
                  </label>
                </div>

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
                    className="rounded"
                  />
                  <label
                    htmlFor="hasModernName"
                    className="text-sm font-medium text-gray-700"
                  >
                    Has Modern Name
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Results Summary */}
          {searchResult && (
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                {searchResult.totalCount} places found
                {searchTerm && ` for "${searchTerm}"`}
                {selectedLetter && ` starting with "${selectedLetter}"`}
                {isAutoLoading && (
                  <span className="ml-2 text-sm text-blue-600">
                    (auto-loading all data...)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !searchResult && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* Places Grid */}
          {searchResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResult.places.map((place, index) => (
                <PlaceCard key={`${place.id}_${index}`} place={place} />
              ))}
            </div>
          )}

          {/* Load More */}
          {searchResult && searchResult.hasMore && !isAutoLoading && (
            <div className="flex justify-center">
              <Button
                onClick={loadMore}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                {isLoading ? <LoadingSpinner /> : null}
                <span>Load More</span>
              </Button>
            </div>
          )}

          {/* Auto-loading indicator */}
          {isAutoLoading && (
            <div className="flex justify-center items-center space-x-2 py-4">
              <LoadingSpinner />
              <span className="text-sm text-gray-600">
                Loading all places...
              </span>
            </div>
          )}

          {/* Error State */}
          {searchResult && searchResult.error && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.684-.833-2.464 0L5.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-red-900 mb-2">
                  {searchResult.error.includes('timed out')
                    ? 'Request Timed Out'
                    : 'Error Loading Data'}
                </h3>
                <p className="text-red-700 text-sm mb-4">
                  {searchResult.error}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentPage(0);
                    performSearch();
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {searchResult &&
            searchResult.places.length === 0 &&
            !isLoading &&
            !searchResult.error && (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No places found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function PlaceCard({ place }: { place: GazetteerPlace }) {
  const slug = createSlugFromName(place.name);
  const mapCount = place.mapReferences?.length || (place.mapInfo ? 1 : 0);
  const hasMultipleMaps = mapCount > 1;

  // Extract and sort dates from map references and mapInfo
  const getDatesFromPlace = () => {
    const dates: string[] = [];

    if (place.mapReferences) {
      // Note: mapReferences doesn't seem to have date info in the type
      // We might need to get this from the actual map data
    }

    if (place.mapInfo?.date) {
      dates.push(place.mapInfo.date);
    }

    // For now, let's work with what we have
    return dates.filter(Boolean).sort();
  };

  // Get place type styling based on category
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

  // Format category for display
  const formatCategory = (category: string) => {
    if (!category || category === 'place') return null;

    // GAVOC categories (Dutch) with English translations
    const gavocCategoryMap: Record<string, string> = {
      // Water features
      rivier: 'river',
      zee: 'sea',
      meer: 'lake',
      baai: 'bay',

      // Land features
      eiland: 'island',
      eilanden: 'islands',
      berg: 'mountain',
      kaap: 'cape',

      // Settlements
      plaats: 'settlement',
      stad: 'city',
      dorp: 'village',
      fort: 'fort',

      // Regions
      landstreek: 'region',
      gebied: 'territory',
      koninkryk: 'kingdom',

      // Other features
      bos: 'forest',
      tempel: 'temple',
    };

    return gavocCategoryMap[category.toLowerCase()] || category;
  };

  // Infer place type from name when no specific category is available
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

  // Use verified category if available, otherwise use inferred type for styling
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
                    key={index}
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
