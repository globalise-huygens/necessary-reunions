import { Button } from '@/components/shared/Button';
import { GavocLocation } from '@/lib/gavoc/types';
import { Copy, ExternalLink, Eye, Globe } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';

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
  };
}

const COLUMN_WIDTH = 200;

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
  } = data;

  const location = locations[index];

  const rowStyle = useMemo(
    () => ({
      ...style,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      minWidth: data.headers.length * COLUMN_WIDTH + 48, // Ensure row is wide enough
      backgroundColor:
        selectedLocationId === location.id
          ? 'transparent' // Use CSS class for selected styling
          : hoveredRowId === location.id
          ? 'rgba(120, 113, 108, 0.05)'
          : index % 2 === 0
          ? 'rgba(255, 255, 255, 0.6)'
          : 'rgba(245, 245, 244, 0.4)',
      borderBottom: '1px solid rgba(231, 229, 228, 0.6)',
      borderLeft: 'none', // Use CSS class for selected border
    }),
    [
      style,
      selectedLocationId,
      hoveredRowId,
      location.id,
      index,
      data.headers.length,
    ],
  );

  const isSelected = selectedLocationId === location.id;
  const rowClassName = `gavoc-table-row ${
    isSelected ? 'gavoc-table-row-selected gavoc-selection-animation' : ''
  }`;

  return (
    <div
      style={rowStyle}
      className={rowClassName}
      onClick={() => onLocationSelect(location.id)}
      onMouseEnter={() => onRowHover(location.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      {headers.map((header) => {
        let cellValue: string | number = '';
        let isSpecialCell = false;

        switch (header) {
          case 'id':
            cellValue = location.id.replace('gavoc-', ''); // Remove the prefix
            break;
          case 'originalNameOnMap':
            cellValue = location.originalNameOnMap;
            break;
          case 'presentName':
            cellValue = location.presentName;
            break;
          case 'category':
            cellValue = location.category;
            isSpecialCell = true;
            break;
          case 'coordinates':
            cellValue = location.coordinates;
            isSpecialCell = true;
            break;
          case 'latitude':
            cellValue = location.latitude ? location.latitude.toFixed(4) : '';
            isSpecialCell = true;
            break;
          case 'longitude':
            cellValue = location.longitude ? location.longitude.toFixed(4) : '';
            isSpecialCell = true;
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
            isSpecialCell = true;
            break;
          case 'alternativeNames':
            cellValue = location.alternativeNames.join(', ');
            break;
          default:
            cellValue = '';
        }

        return (
          <div
            key={header}
            style={{
              width: COLUMN_WIDTH,
              minWidth: COLUMN_WIDTH,
              maxWidth: COLUMN_WIDTH,
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
                  <span className="text-slate-700 font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : header === 'longitude' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span className="text-slate-700 font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : header === 'coordinates' && cellValue && cellValue !== '-' ? (
                <div className="flex items-center space-x-2">
                  <Globe className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span
                    className="text-slate-700 truncate"
                    title={String(cellValue)}
                  >
                    {String(cellValue)}
                  </span>
                </div>
              ) : header === 'uri' && cellValue ? (
                <div className="flex items-center space-x-2 group">
                  <span
                    className="text-slate-700 font-mono text-xs truncate"
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
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy URI to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : (
                <span
                  className="text-slate-700 truncate block"
                  title={String(cellValue)}
                >
                  {String(cellValue) || (
                    <span className="text-slate-400 italic">—</span>
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
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
            <span className="text-xs text-amber-700 font-medium">Selected</span>
          </div>
        )}
        {hoveredRowId === location.id && selectedLocationId !== location.id && (
          <Eye className="h-4 w-4 text-slate-400" />
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
  }) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);

    // Don't reorder the data - keep original order for better UX
    const sortedData = useMemo(() => locations, [locations]);

    // Find the index of the selected item for scrolling
    const selectedIndex = useMemo(() => {
      if (!selectedLocationId) return -1;
      return locations.findIndex((l) => l.id === selectedLocationId);
    }, [locations, selectedLocationId]);

    // Scroll to selected item when selection changes
    useEffect(() => {
      if (selectedIndex >= 0 && listRef.current) {
        // Small delay to ensure the list is rendered
        setTimeout(() => {
          listRef.current?.scrollToItem(selectedIndex, 'center');
        }, 150);
      }
      // Note: We don't scroll when selectedIndex is -1 (no selection) to maintain current view
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
      ],
    );

    const totalWidth = headers.length * COLUMN_WIDTH + 48;

    const handleHeaderScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        if (bodyRef.current) {
          bodyRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
      },
      [],
    );

    const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      if (headerRef.current) {
        headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }, []);

    return (
      <div className="flex-grow flex flex-col h-full">
        {/* Fixed Header with synchronized scrolling */}
        <div
          ref={headerRef}
          className="gavoc-table-header sticky top-0 z-10 bg-gradient-to-r from-stone-100/90 to-stone-200/70 border-b border-stone-300/80 overflow-x-auto overflow-y-hidden"
          onScroll={handleHeaderScroll}
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
              return (
                <div
                  key={header}
                  style={{
                    width: COLUMN_WIDTH,
                    minWidth: COLUMN_WIDTH,
                    maxWidth: COLUMN_WIDTH,
                    cursor: onSort ? 'pointer' : 'default',
                  }}
                  className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border-r border-stone-300/60 select-none group flex-shrink-0 bg-gradient-to-b from-stone-50 to-stone-100"
                  onClick={onSort ? () => onSort(header) : undefined}
                  title={
                    onSort
                      ? `Sort by ${getColumnDisplayName(header)}`
                      : undefined
                  }
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
            <div className="w-12 px-2 py-3 flex-shrink-0 bg-gradient-to-b from-stone-50 to-stone-100"></div>
          </div>
        </div>

        {/* Scrollable Body with synchronized scrolling */}
        <div
          ref={bodyRef}
          className="gavoc-table-body flex-1 overflow-auto"
          onScroll={handleBodyScroll}
        >
          <List
            ref={listRef}
            height={400}
            width={totalWidth}
            itemCount={sortedData.length}
            itemSize={60}
            itemData={itemData}
            overscanCount={5}
          >
            {TableRow}
          </List>
        </div>
      </div>
    );
  },
);

GavocTable.displayName = 'GavocTable';
