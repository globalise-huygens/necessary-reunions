'use client';

import { Button } from '@/components/shared/Button';
import { GavocThesaurusEntry } from '@/lib/gavoc/thesaurus';
import { Copy, Eye, Globe } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

interface GavocThesaurusTableProps {
  entries: GavocThesaurusEntry[];
  headers: string[];
  selectedEntryId: string | null;
  hoveredRowId: string | null;
  onEntrySelect: (entryId: string | null) => void;
  onRowHover: (entryId: string | null) => void;
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
    entries: GavocThesaurusEntry[];
    headers: string[];
    selectedEntryId: string | null;
    hoveredRowId: string | null;
    onEntrySelect: (entryId: string | null) => void;
    onRowHover: (entryId: string | null) => void;
    getColumnDisplayName: (header: string) => string;
    getCategoryColor: (category: string) => string;
    copyToClipboard: (text: string) => void;
  };
}

const COLUMN_WIDTH = 200;

const ThesaurusTableRow = React.memo(({ index, style, data }: RowProps) => {
  const {
    entries,
    headers,
    selectedEntryId,
    hoveredRowId,
    onEntrySelect,
    onRowHover,
    getCategoryColor,
    copyToClipboard,
  } = data;

  const entry = entries[index];

  const rowStyle = useMemo(
    () => ({
      ...style,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      minWidth: data.headers.length * COLUMN_WIDTH + 48,
      backgroundColor:
        selectedEntryId === entry.id
          ? 'transparent'
          : hoveredRowId === entry.id
          ? 'rgba(120, 113, 108, 0.05)'
          : index % 2 === 0
          ? 'rgba(255, 255, 255, 0.6)'
          : 'rgba(245, 245, 244, 0.4)',
      borderBottom: '1px solid rgba(231, 229, 228, 0.6)',
      borderLeft: 'none',
    }),
    [
      style,
      selectedEntryId,
      hoveredRowId,
      entry.id,
      index,
      data.headers.length,
    ],
  );

  const isSelected = selectedEntryId === entry.id;
  const rowClassName = `gavoc-table-row ${
    isSelected ? 'gavoc-table-row-selected gavoc-selection-animation' : ''
  }`;

  return (
    <div
      style={rowStyle}
      className={rowClassName}
      onClick={() => onEntrySelect(entry.id)}
      onMouseEnter={() => onRowHover(entry.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      {headers.map((header) => {
        let cellValue: string | number = '';
        let isSpecialCell = false;

        switch (header) {
          case 'preferredTerm':
            cellValue = entry.preferredTerm;
            break;
          case 'alternativeTerms':
            cellValue = entry.alternativeTerms.join(', ');
            break;
          case 'category':
            cellValue = entry.category;
            isSpecialCell = true;
            break;
          case 'coordinates':
            cellValue = entry.coordinates
              ? `${entry.coordinates.latitude.toFixed(
                  4,
                )}, ${entry.coordinates.longitude.toFixed(4)}`
              : '';
            isSpecialCell = true;
            break;
          case 'locationCount':
            cellValue = entry.locations.length;
            break;
          case 'uri':
            cellValue = entry.uri || '';
            isSpecialCell = true;
            break;
          case 'urlPath':
            cellValue = entry.urlPath || '';
            isSpecialCell = true;
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
              ) : header === 'coordinates' && cellValue && cellValue !== '' ? (
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
              ) : header === 'urlPath' && cellValue ? (
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
                      const fullUrl = `${window.location.origin}${cellValue}`;
                      copyToClipboard(fullUrl);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy URL to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : header === 'locationCount' ? (
                <span
                  className="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded text-xs"
                  title={`${cellValue} location${cellValue !== 1 ? 's' : ''}`}
                >
                  {String(cellValue)}
                </span>
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
        {selectedEntryId === entry.id && (
          <div className="flex items-center space-x-1 gavoc-selected-indicator">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
            <span className="text-xs text-amber-700 font-medium">Selected</span>
          </div>
        )}
        {hoveredRowId === entry.id && selectedEntryId !== entry.id && (
          <Eye className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </div>
  );
});

ThesaurusTableRow.displayName = 'ThesaurusTableRow';

export const GavocThesaurusTable = React.memo<GavocThesaurusTableProps>(
  ({
    entries,
    headers,
    selectedEntryId,
    hoveredRowId,
    onEntrySelect,
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

    const sortedData = useMemo(() => entries, [entries]);

    const selectedIndex = useMemo(() => {
      if (!selectedEntryId) return -1;
      return entries.findIndex((e) => e.id === selectedEntryId);
    }, [entries, selectedEntryId]);

    useEffect(() => {
      if (selectedIndex >= 0 && listRef.current) {
        setTimeout(() => {
          listRef.current?.scrollToItem(selectedIndex, 'center');
        }, 150);
      }
    }, [selectedIndex]);

    const itemData = useMemo(
      () => ({
        entries: sortedData,
        headers,
        selectedEntryId,
        hoveredRowId,
        onEntrySelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
      }),
      [
        sortedData,
        headers,
        selectedEntryId,
        hoveredRowId,
        onEntrySelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
      ],
    );

    const totalWidth = headers.length * COLUMN_WIDTH + 48;

    const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      if (headerRef.current) {
        headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }, []);

    return (
      <div className="flex-grow flex flex-col h-full">
        {/* Fixed Header */}
        <div
          ref={headerRef}
          className="gavoc-table-header sticky top-0 z-10 bg-gradient-to-r from-emerald-100/90 to-emerald-200/70 border-b border-emerald-300/80 overflow-hidden"
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
                  className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border-r border-emerald-300/60 select-none group flex-shrink-0 bg-gradient-to-b from-emerald-50 to-emerald-100"
                  onClick={onSort ? () => onSort(header) : undefined}
                  title={
                    onSort
                      ? `Sort by ${getColumnDisplayName(header)}`
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-900 text-sm">
                      {getColumnDisplayName(header)}
                    </span>
                    {onSort && (
                      <span className="text-emerald-700 text-xs font-mono">
                        {arrow}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="w-12 px-2 py-3 flex-shrink-0 bg-gradient-to-b from-emerald-50 to-emerald-100"></div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          ref={bodyRef}
          className="gavoc-table-body flex-1 overflow-auto"
          onScroll={handleBodyScroll}
        >
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <List
                ref={listRef}
                height={height}
                width={Math.max(width, totalWidth)}
                itemCount={sortedData.length}
                itemSize={60}
                itemData={itemData}
                overscanCount={5}
              >
                {ThesaurusTableRow}
              </List>
            )}
          </AutoSizer>
        </div>
      </div>
    );
  },
);

GavocThesaurusTable.displayName = 'GavocThesaurusTable';
