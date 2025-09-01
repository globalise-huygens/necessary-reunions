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
import { ExternalLink, Filter, MapPin, Search } from 'lucide-react';
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
        limit: '200', // Increased to ensure all places are loaded
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
          {searchResult && searchResult.hasMore && (
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

  return (
    <Link href={`/gazetteer/${slug}`} className="block">
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 h-full">
        <div className="space-y-3">
          {/* Name and Tags */}
          <div>
            <h3 className="font-heading text-lg text-primary line-clamp-2 mb-2">
              {place.name}
            </h3>

            <div className="flex flex-wrap gap-1 mb-2">
              {place.hasHumanVerification && (
                <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                  Verified
                </Badge>
              )}

              {place.isGeotagged && (
                <Badge
                  variant="default"
                  className="text-xs bg-blue-100 text-blue-800"
                >
                  Geotagged
                </Badge>
              )}

              {place.hasPointSelection && (
                <Badge variant="secondary" className="text-xs">
                  Point Selected
                </Badge>
              )}

              {place.targetAnnotationCount &&
                place.targetAnnotationCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {place.targetAnnotationCount} annotation
                    {place.targetAnnotationCount > 1 ? 's' : ''}
                  </Badge>
                )}

              {place.mapReferences && place.mapReferences.length > 1 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-50 text-amber-700"
                >
                  {place.mapReferences.length} maps
                </Badge>
              )}
            </div>
          </div>

          {/* Modern Name */}
          {place.modernName && (
            <p className="text-sm text-gray-600">
              <strong>Modern:</strong> {place.modernName}
            </p>
          )}

          {/* Map Information */}
          {place.mapInfo && (
            <div className="text-sm text-gray-600">
              <p className="font-medium">{place.mapInfo.title}</p>
              {place.mapInfo.date && (
                <p className="text-xs text-gray-500">
                  Date: {place.mapInfo.date}
                </p>
              )}
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

          {/* Source Information */}
          {place.creator && (
            <p className="text-xs text-gray-500">
              <strong>Linked by:</strong>{' '}
              {typeof place.creator === 'string'
                ? place.creator
                : place.creator.label}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
