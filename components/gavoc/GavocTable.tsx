import { Copy, Eye, Globe } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import { Button } from '../../components/shared/Button';
import type { GavocLocation } from '../../lib/gavoc/types';

interface GavocTableProps {
  locations: GavocLocation[];
  headers: string[];
  selectedLocationId: string | null;
  hoveredRowId: string | null;
  onLocationSelect: (locationId: string | null) => void;
  onRowHover: (locationId: string | null) => void;
  getColumnDisplayName: (header: string) => string;
  getCategoryColor: (category: string) => string;
  copyToClipboard: (text: string) => void;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
  isMobile?: boolean;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    locations: GavocLocation[];
    headers: string[];
    selectedLocationId: string | null;
    hoveredRowId: string | null;
    onLocationSelect: (locationId: string | null) => void;
    onRowHover: (locationId: string | null) => void;
    getColumnDisplayName: (header: string) => string;
    getCategoryColor: (category: string) => string;
    copyToClipboard: (text: string) => void;
    isMobile: boolean;
  };
}

const COLUMN_WIDTH = 200;
const MOBILE_COLUMN_WIDTH = 150;

const TableRow = React.memo(({ index, style, data }: RowProps) => {
  const {
    locations,
    headers,
    selectedLocationId,
    hoveredRowId,
    onLocationSelect,
    onRowHover,
    getCategoryColor,
    copyToClipboard,
    isMobile,
  } = data;

  const location = locations[index];
  const columnWidth = isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH;

  const rowStyle = useMemo(
    () => ({
      ...style,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      minWidth: data.headers.length * columnWidth + 48,
      ...(location &&
        selectedLocationId !== location.id && {
          backgroundColor:
            hoveredRowId === location.id
              ? 'rgba(120, 113, 108, 0.05)'
              : index % 2 === 0
                ? 'rgba(255, 255, 255, 0.6)'
                : 'rgba(245, 245, 244, 0.4)',
        }),
      borderBottom: '1px solid rgba(231, 229, 228, 0.6)',
      borderLeft: 'none',
    }),
    [
      style,
      selectedLocationId,
      hoveredRowId,
      location,
      index,
      data.headers.length,
      columnWidth,
    ],
  );

  if (!location) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          minWidth:
            data.headers.length *
              (isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH) +
            48,
        }}
      />
    );
  }

  const isSelected = selectedLocationId === location.id;
  const rowClassName = `gavoc-table-row ${
    isSelected ? 'gavoc-table-row-selected gavoc-selection-animation' : ''
  }`;

  return (
    <div
      style={rowStyle}
      className={rowClassName}
      role="button"
      tabIndex={0}
      onClick={() => {
        onLocationSelect(location.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onLocationSelect(location.id);
        }
      }}
      onMouseEnter={() => onRowHover(location.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      {headers.map((header) => {
        let cellValue: string | number = '';

        switch (header) {
          case 'id':
            cellValue = location.id.replace('gavoc-', '');
            break;
          case 'originalNameOnMap':
            cellValue = location.originalNameOnMap;
            break;
          case 'presentName':
            cellValue = location.presentName;
            break;
          case 'category':
            cellValue = location.category;
            break;
          case 'coordinates':
            cellValue = location.coordinates;
            break;
          case 'latitude':
            cellValue = location.latitude ? location.latitude.toFixed(4) : '';
            break;
          case 'longitude':
            cellValue = location.longitude ? location.longitude.toFixed(4) : '';
            break;
          case 'mapGridSquare':
            cellValue = location.mapGridSquare;
            break;
          case 'map':
            cellValue = location.map;
            break;
          case 'page':
            cellValue = location.page;
            break;
          case 'uri':
            cellValue = location.uri || '';
            break;
          case 'urlPath':
            cellValue = location.urlPath || '';
            break;
          case 'alternativeNames':
            cellValue = location.alternativeNames.join(', ');
            break;
          default:
            cellValue = '';
        }

        return (
          <div
            key={`cell-${location.id}-${header}`}
            style={{
              width: columnWidth,
              minWidth: columnWidth,
              maxWidth: columnWidth,
            }}
            className="px-4 py-2 text-sm overflow-hidden whitespace-nowrap text-ellipsis border-r border-stone-200/60 flex-shrink-0"
          >
            <div className="flex items-center space-x-2">
              {header === 'category' ? (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                    String(cellValue),
                  )}`}
                >
                  {String(cellValue)}
                </span>
              ) : header === 'latitude' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span className="text-foreground font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : header === 'longitude' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span className="text-foreground font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : header === 'coordinates' && cellValue && cellValue !== '-' ? (
                <div className="flex items-center space-x-2">
                  <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span
                    className="text-foreground truncate"
                    title={String(cellValue)}
                  >
                    {String(cellValue)}
                  </span>
                </div>
              ) : header === 'uri' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span
                    className="text-foreground font-mono text-xs truncate"
                    title={String(cellValue)}
                  >
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                    title="Copy URI to clipboard"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : header === 'urlPath' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span
                    className="text-foreground font-mono text-xs truncate"
                    title={String(cellValue)}
                  >
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const fullUrl = `${window.location.origin}${cellValue}`;
                      copyToClipboard(fullUrl);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                    title="Copy URL to clipboard"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <span
                  className="text-foreground truncate block"
                  title={String(cellValue)}
                >
                  {String(cellValue) || (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="w-12 px-2 py-2 flex items-center justify-center flex-shrink-0">
        {selectedLocationId === location.id && (
          <div className="flex items-center space-x-1 gavoc-selected-indicator">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
            <span className="text-xs text-secondary-foreground font-medium">
              Selected
            </span>
          </div>
        )}
        {hoveredRowId === location.id && selectedLocationId !== location.id && (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export const GavocTable = React.memo<GavocTableProps>(
  ({
    locations,
    headers,
    selectedLocationId,
    hoveredRowId,
    onLocationSelect,
    onRowHover,
    getColumnDisplayName,
    getCategoryColor,
    copyToClipboard,
    sortConfig,
    onSort,
    isMobile = false,
  }) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);

    const sortedData = useMemo(() => locations, [locations]);

    const selectedIndex = useMemo(() => {
      if (!selectedLocationId) return -1;
      return locations.findIndex((l) => l.id === selectedLocationId);
    }, [locations, selectedLocationId]);

    useEffect(() => {
      if (selectedIndex >= 0 && listRef.current) {
        const timeoutId = setTimeout(() => {
          try {
            listRef.current?.scrollToItem(selectedIndex, 'center');
          } catch {}
        }, 150);

        return () => clearTimeout(timeoutId);
      }
    }, [selectedIndex]);

    const itemData = useMemo(
      () => ({
        locations: sortedData,
        headers,
        selectedLocationId,
        hoveredRowId,
        onLocationSelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
        isMobile,
      }),
      [
        sortedData,
        headers,
        selectedLocationId,
        hoveredRowId,
        onLocationSelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
        isMobile,
      ],
    );

    const totalWidth =
      headers.length * (isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH) + 48;

    const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      if (headerRef.current) {
        headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }, []);

    return (
      <div className="flex-grow flex flex-col h-full">
        {/* Fixed Header - no scrollbar, follows body scroll */}
        <div
          ref={headerRef}
          className="gavoc-table-header sticky top-0 z-10 bg-gradient-to-r from-stone-100/90 to-stone-200/70 border-b border-stone-300/80 overflow-hidden"
        >
          <div
            className="flex"
            style={{ width: totalWidth, minWidth: totalWidth }}
          >
            {headers.map((header) => {
              const isSorted = sortConfig && sortConfig.key === header;
              const arrow = isSorted
                ? sortConfig.direction === 'asc'
                  ? '▲'
                  : '▼'
                : '';
              if (onSort) {
                return (
                  <button
                    key={`header-${header}`}
                    type="button"
                    style={{
                      width: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                      minWidth: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                      maxWidth: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                    }}
                    className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border-r border-stone-300/60 group flex-shrink-0 bg-gradient-to-b from-stone-50 to-stone-100 text-left"
                    onClick={() => onSort(header)}
                    title={`Sort by ${getColumnDisplayName(header)}`}
                    aria-label={`Sort by ${getColumnDisplayName(header)}`}
                  >
                    <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                      {getColumnDisplayName(header)}
                      <span
                        className={`transition-opacity duration-150 ${
                          isSorted
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-60'
                        }`}
                      >
                        {arrow}
                      </span>
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={`header-${header}`}
                  style={{
                    width: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                    minWidth: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                    maxWidth: isMobile ? MOBILE_COLUMN_WIDTH : COLUMN_WIDTH,
                    cursor: 'default',
                  }}
                  className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border-r border-stone-300/60 select-none group flex-shrink-0 bg-gradient-to-b from-stone-50 to-stone-100"
                  title={undefined}
                >
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                    {getColumnDisplayName(header)}
                    <span
                      className={`transition-opacity duration-150 ${
                        isSorted
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-60'
                      }`}
                    >
                      {arrow}
                    </span>
                  </span>
                </div>
              );
            })}
            <div className="w-12 px-2 py-3 flex-shrink-0 bg-gradient-to-b from-stone-50 to-stone-100" />
          </div>
        </div>

        {/* Scrollable Body - only this scrolls horizontally */}
        <div
          ref={bodyRef}
          className="gavoc-table-body flex-1 overflow-auto"
          onScroll={handleBodyScroll}
        >
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                width={Math.max(width, totalWidth)}
                itemCount={sortedData.length}
                itemSize={60}
                itemData={itemData}
                overscanCount={5}
              >
                {TableRow}
              </List>
            )}
          </AutoSizer>
        </div>
      </div>
    );
  },
);

GavocTable.displayName = 'GavocTable';
