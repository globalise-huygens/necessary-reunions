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
  }, [searchTerm, filters, currentPage]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/gazetteer/categories');
      if (response.ok) {
        const categoriesData = await response.json();
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const performSearch = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: '24',
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
      }
    } catch (error) {
      console.error('Error searching places:', error);
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
    setCurrentPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== '',
  );

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
                  Place Names Database of Early Modern Kerala
                </p>
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
              {searchResult.places.map((place) => (
                <PlaceCard key={place.id} place={place} />
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

          {/* Empty State */}
          {searchResult && searchResult.places.length === 0 && !isLoading && (
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
          {/* Name */}
          <div>
            <h3 className="font-heading text-lg text-primary line-clamp-2">
              {place.name}
            </h3>
          </div>

          {/* Modern Name */}
          {place.modernName && (
            <p className="text-sm text-gray-600">
              <strong>Modern:</strong> {place.modernName}
            </p>
          )}

          {/* Coordinates */}
          {place.coordinates && shouldDisplayCoordinates(place.coordinates) && (
            <p className="text-xs text-gray-500 flex items-center space-x-1">
              <MapPin className="w-3 h-3" />
              <span>
                {formatCoordinatesForDisplay(place.coordinates).formatted}
              </span>
            </p>
          )}

          {/* Source Information - more useful for historians */}
          {place.creator && (
            <p className="text-xs text-gray-500">
              <strong>Source:</strong>{' '}
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
