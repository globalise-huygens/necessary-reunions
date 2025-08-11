'use client';

import '@/styles/gavoc.css';
import { GavocTable } from '@/components/gavoc/GavocTable';
import { GavocThesaurusTable } from '@/components/gavoc/GavocThesaurusTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { UnifiedHeader } from '@/components/UnifiedHeader';
import {
  exportToCSV,
  filterGavocLocations,
  processGavocData,
} from '@/lib/gavoc/data-processing';
import { GavocThesaurusEntry, searchThesaurus } from '@/lib/gavoc/thesaurus';
import { FilterConfig, GavocData, GavocLocation } from '@/lib/gavoc/types';
import {
  findLocationByPath,
  getCurrentLocationFromUrl,
  getShareableUrl,
  updateUrlForLocation,
} from '@/lib/gavoc/url-utils';
import {
  BarChart3,
  Check,
  Copy,
  Download,
  Filter,
  Globe,
  Info,
  Layers,
  List as ListIcon,
  Search,
  Share2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

const GavocMap = dynamic(() => import('@/components/gavoc/GavocMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted/20 flex items-center justify-center">
      <div className="text-muted-foreground">Loading map...</div>
    </div>
  ),
});

export default function GavocPage() {
  const [gavocData, setGavocData] = useState<GavocData | null>(null);
  const [filteredLocations, setFilteredLocations] = useState<GavocLocation[]>(
    [],
  );
  const [filteredThesaurusEntries, setFilteredThesaurusEntries] = useState<
    GavocThesaurusEntry[]
  >([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hasCoordinatesOnly, setHasCoordinatesOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [viewMode, setViewMode] = useState<'locations' | 'concepts'>(
    'locations',
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/gavoc-atlas-index.csv');
        if (!response.ok) {
          throw new Error('Failed to load GAVOC atlas data');
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter((line) => line.trim());

        const headerLine = lines[0];
        const headers: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < headerLine.length; i++) {
          const char = headerLine[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            headers.push(current.trim().replace(/"/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        headers.push(current.trim().replace(/"/g, ''));

        const rawData = lines.slice(1).map((line) => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = (values[index] || '').replace(/"/g, '');
          });
          return row;
        });

        const processedData = processGavocData(rawData);
        setGavocData(processedData);
        setFilteredLocations(processedData.locations);

        const currentLocationId = getCurrentLocationFromUrl();
        if (currentLocationId) {
          const location = findLocationByPath(
            processedData.locations,
            window.location.pathname,
          );
          if (location) {
            setSelectedLocationId(location.id);
            setIsSidebarVisible(true);
          }
        }
      } catch (err) {
        console.error('Error loading GAVOC data:', err);
        setError('Failed to load atlas data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!gavocData) return;

    const filterConfig: FilterConfig = {
      searchQuery,
      categoryFilter,
      hasCoordinatesOnly,
      sortConfig,
      viewMode,
    };

    const filtered = filterGavocLocations(gavocData.locations, filterConfig);
    setFilteredLocations(filtered);

    if (gavocData.thesaurus) {
      let thesaurusEntries = gavocData.thesaurus.entries;

      if (searchQuery.trim()) {
        thesaurusEntries = searchThesaurus(gavocData.thesaurus, searchQuery);
      }

      if (categoryFilter && categoryFilter !== 'all') {
        thesaurusEntries = thesaurusEntries.filter(
          (entry: GavocThesaurusEntry) => entry.category === categoryFilter,
        );
      }

      if (hasCoordinatesOnly) {
        thesaurusEntries = thesaurusEntries.filter(
          (entry: GavocThesaurusEntry) => entry.coordinates,
        );
      }

      setFilteredThesaurusEntries(thesaurusEntries);
    }
  }, [
    gavocData,
    searchQuery,
    categoryFilter,
    hasCoordinatesOnly,
    sortConfig,
    viewMode,
  ]);

  const handleLocationSelect = useCallback(
    (locationId: string | null) => {
      // Always set the new selection (don't toggle)
      setSelectedLocationId(locationId);

      if (locationId && gavocData) {
        const location = gavocData.locations.find((l) => l.id === locationId);
        if (location) {
          updateUrlForLocation(location);
        }
      } else {
        updateUrlForLocation(null);
      }
    },
    [gavocData],
  );

  const handleSort = useCallback((key: string) => {
    setSortConfig((prevSort) => ({
      key,
      direction:
        prevSort?.key === key && prevSort.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleThesaurusEntrySelect = useCallback(
    (entryId: string | null) => {
      const newSelectedId = selectedEntryId === entryId ? null : entryId;
      setSelectedEntryId(newSelectedId);

      if (newSelectedId && gavocData?.thesaurus) {
        const entry = gavocData.thesaurus.entries.find(
          (e: GavocThesaurusEntry) => e.id === newSelectedId,
        );
        if (entry && entry.locations.length > 0) {
          setSelectedLocationId(entry.locations[0].id);
          updateUrlForLocation(entry.locations[0]);
        }
      } else {
        setSelectedLocationId(null);
        updateUrlForLocation(null);
      }
    },
    [selectedEntryId, gavocData],
  );

  const handleViewModeToggle = useCallback(() => {
    setViewMode((prev) => (prev === 'locations' ? 'concepts' : 'locations'));
    setSelectedLocationId(null);
    setSelectedEntryId(null);
    updateUrlForLocation(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('all');
    setHasCoordinatesOnly(false);
    setSortConfig(null);
  }, []);

  const handleExport = useCallback(() => {
    if (filteredLocations.length === 0) return;

    const csvContent = exportToCSV(filteredLocations);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `gavoc-atlas-${new Date().toISOString().split('T')[0]}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredLocations]);

  const handleShare = useCallback(() => {
    if (!selectedLocationId || !gavocData) return;

    const location = gavocData.locations.find(
      (l) => l.id === selectedLocationId,
    );
    if (!location) return;

    const shareableUrl = getShareableUrl(location);
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  }, [selectedLocationId, gavocData]);

  useEffect(() => {
    const handlePopState = () => {
      if (!gavocData) return;

      const location = findLocationByPath(
        gavocData.locations,
        window.location.pathname,
      );
      setSelectedLocationId(location?.id || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [gavocData]);

  const tableHeaders = useMemo(
    () => [
      'id',
      'originalNameOnMap',
      'presentName',
      'category',
      'coordinates',
      'latitude',
      'longitude',
      'mapGridSquare',
      'map',
      'page',
      'uri',
      'urlPath',
      'alternativeNames',
    ],
    [],
  );

  const thesaurusHeaders = useMemo(
    () => [
      'preferredTerm',
      'alternativeTerms',
      'category',
      'coordinates',
      'locationCount',
      'uri',
      'urlPath',
    ],
    [],
  );

  const getColumnDisplayName = useCallback((header: string) => {
    const displayNames: Record<string, string> = {
      id: 'ID',
      originalNameOnMap: 'Original Name',
      presentName: 'Present Name',
      category: 'Category',
      coordinates: 'Coordinates',
      latitude: 'Latitude',
      longitude: 'Longitude',
      mapGridSquare: 'Grid Square',
      map: 'Map',
      page: 'Page',
      uri: 'URI',
      urlPath: 'URL Path',
      alternativeNames: 'Alternative Names',
      preferredTerm: 'Preferred Term',
      alternativeTerms: 'Alternative Terms',
      locationCount: 'Locations',
    };
    return displayNames[header] || header;
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      'plaats/settlement':
        'bg-primary/10 text-primary border border-primary/20',
      'eiland/island':
        'bg-secondary/10 text-secondary-foreground border border-secondary/20',
      'rivier/river':
        'bg-accent/10 text-accent-foreground border border-accent/20',
      'kaap/cape': 'bg-chart-1/10 text-chart-1 border border-chart-1/20',
      'landstreek/region':
        'bg-muted/10 text-muted-foreground border border-muted/20',
      'baai/bay': 'bg-chart-2/10 text-chart-2 border border-chart-2/20',
      'berg/mountain':
        'bg-destructive/10 text-destructive border border-destructive/20',
      'fort/fortress': 'bg-chart-4/10 text-chart-4 border border-chart-4/20',
      'eilanden/islands': 'bg-chart-5/10 text-chart-5 border border-chart-5/20',
      'ondiepte/shoals': 'bg-chart-3/10 text-chart-3 border border-chart-3/20',
      'zeestraat/strait': 'bg-primary/10 text-primary border border-primary/20',
      'provincie/province':
        'bg-muted/10 text-muted-foreground border border-muted/20',
      'schiereiland/peninsula':
        'bg-accent/10 text-accent-foreground border border-accent/20',
      'gebouw/building': 'bg-chart-1/10 text-chart-1 border border-chart-1/20',
      unknown: 'bg-muted/10 text-muted-foreground border border-muted/20',
    };
    return (
      colors[category] ||
      'bg-muted/10 text-muted-foreground border border-muted/20'
    );
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
    setTimeout(() => {
      setMapResizeTrigger((prev) => prev + 1);
    }, 100);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      const clampedWidth = Math.max(280, Math.min(600, newWidth));
      setSidebarWidth(clampedWidth);

      setMapResizeTrigger((prev) => prev + 1);
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setMapResizeTrigger((prev) => prev + 1);
    };

    window.addEventListener('resize', handleResize);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg text-muted-foreground">
            Loading GAVOC Atlas data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <div className="w-6 h-6 rounded-full bg-destructive"></div>
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Error Loading Data
          </h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!gavocData) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.8))] flex flex-col overflow-hidden">
      <UnifiedHeader
        gavocSidebarToggle={{
          isVisible: isSidebarVisible,
          onToggle: toggleSidebar,
        }}
      />
      <div className="flex-1 flex min-h-0 overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Sidebar - only visible when toggled */}
        {isSidebarVisible && (
          <div
            className="bg-card/80 backdrop-blur-sm border-r border-border shadow-sm overflow-hidden flex flex-col transition-all duration-300 relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Search & Filter Section */}
            <div className="p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-semibold text-card-foreground flex items-center tracking-wide">
                  <Search className="h-5 w-5 mr-2 text-primary" />
                  Search & Filter
                </h2>
                <div className="flex items-center space-x-2">
                  {(searchQuery ||
                    categoryFilter !== 'all' ||
                    hasCoordinatesOnly) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mt-4">
                {/* View Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex rounded-lg border border-border bg-background p-1 w-full">
                    <Button
                      variant={viewMode === 'locations' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('locations')}
                      className="flex items-center space-x-2 px-3 py-1.5"
                    >
                      <ListIcon className="h-3 w-3" />
                      <span>Locations</span>
                    </Button>
                    <Button
                      variant={viewMode === 'concepts' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('concepts')}
                      className="flex items-center space-x-2 px-3 py-1.5"
                    >
                      <Layers className="h-3 w-3" />
                      <span>Concepts</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* <label className="text-sm font-serif font-semibold text-foreground tracking-wide">
                    Search locations
                  </label> */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={
                        viewMode === 'locations'
                          ? 'Search names, categories, coordinates...'
                          : 'Search concepts, alternative terms...'
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background border-input focus:border-ring focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {/* <label className="text-sm font-serif font-semibold text-foreground tracking-wide">
                    Filter by category
                  </label> */}
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {gavocData.categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="coordinates-only"
                    checked={hasCoordinatesOnly}
                    onChange={(e) => setHasCoordinatesOnly(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-ring"
                  />
                  <label
                    htmlFor="coordinates-only"
                    className="text-sm text-foreground"
                  >
                    Show only locations with coordinates
                  </label>
                </div>
              </div>

              {(viewMode === 'locations'
                ? filteredLocations
                : filteredThesaurusEntries
              ).length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing{' '}
                    <span className="font-medium text-foreground">
                      {viewMode === 'locations'
                        ? filteredLocations.length
                        : filteredThesaurusEntries.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium text-foreground">
                      {viewMode === 'locations'
                        ? gavocData.totalCount
                        : gavocData.thesaurus?.totalConcepts || 0}
                    </span>{' '}
                    {viewMode === 'locations' ? 'locations' : 'concepts'}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={
                        (viewMode === 'locations'
                          ? filteredLocations
                          : filteredThesaurusEntries
                        ).length === 0
                      }
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    {(selectedLocationId || selectedEntryId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                        disabled={!selectedLocationId && !selectedEntryId}
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Share2 className="h-4 w-4 mr-1" />
                            Share
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Data Table Section */}
            <div className="flex-grow overflow-hidden flex flex-col">
              {(viewMode === 'locations'
                ? filteredLocations
                : filteredThesaurusEntries
              ).length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-md mx-auto p-6">
                    <Info className="h-8 w-8 text-primary mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium text-foreground">
                        No results found
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {viewMode === 'locations'
                          ? 'No locations available.'
                          : 'No concepts available.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-grow overflow-hidden gavoc-table-container">
                    {viewMode === 'locations' ? (
                      <GavocTable
                        locations={filteredLocations}
                        headers={tableHeaders}
                        selectedLocationId={selectedLocationId}
                        hoveredRowId={hoveredRowId}
                        onLocationSelect={handleLocationSelect}
                        onRowHover={setHoveredRowId}
                        getColumnDisplayName={getColumnDisplayName}
                        getCategoryColor={getCategoryColor}
                        copyToClipboard={copyToClipboard}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    ) : (
                      <GavocThesaurusTable
                        entries={filteredThesaurusEntries}
                        headers={thesaurusHeaders}
                        selectedEntryId={selectedEntryId}
                        hoveredRowId={hoveredRowId}
                        onEntrySelect={handleThesaurusEntrySelect}
                        onRowHover={setHoveredRowId}
                        getColumnDisplayName={getColumnDisplayName}
                        getCategoryColor={getCategoryColor}
                        copyToClipboard={copyToClipboard}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute top-0 right-0 w-1 h-full cursor-ew-resize bg-border hover:bg-primary/50 transition-colors ${
                isResizing ? 'bg-primary' : ''
              }`}
              style={{ zIndex: 10 }}
            />
          </div>
        )}

        {/* Map Section - takes full width when sidebar hidden */}
        <div className="flex-1 h-full relative">
          {filteredLocations.length > 0 &&
            filteredLocations.filter((l) => l.hasCoordinates).length === 0 && (
              <div className="absolute inset-0 bg-muted/20 bg-opacity-75 z-10 flex items-center justify-center">
                <div className="bg-card p-6 rounded-lg shadow-lg text-center space-y-3">
                  <Info className="h-8 w-8 text-primary mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-card-foreground">
                      No mappable locations
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      No locations in the current filter have coordinates.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHasCoordinatesOnly(false)}
                  >
                    Show all locations
                  </Button>
                </div>
              </div>
            )}
          <GavocMap
            locations={gavocData.locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={handleLocationSelect}
            triggerResize={mapResizeTrigger}
          />
        </div>
      </div>
    </div>
  );
}
