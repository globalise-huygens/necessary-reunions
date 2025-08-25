# GAVOC Selection Behavior Analysis

## Current Issues Identified

### 1. Inconsistent Selection Patterns

**Map Selection:** Direct selection (no toggle)

```typescript
// From GavocMap.tsx
marker.on('click', (e: any) => {
  onLocationSelect(location.id); // Direct selection
});
```

**Table Selection:** Toggle behavior

```typescript
// From GavocTable.tsx
onClick={() => {
  const newSelection = selectedLocationId === location.id ? null : location.id;
  onLocationSelect(newSelection); // Can deselect
}}
```

**Problem:** Map and table have different selection behaviors - inconsistent UX.

### 2. Thesaurus Cross-Selection Issues

**Current Behavior:**

```typescript
// From page.tsx - handleThesaurusEntrySelect
if (newSelectedId && gavocData?.thesaurus) {
  const entry = gavocData.thesaurus.entries.find((e) => e.id === newSelectedId);
  if (entry && entry.locations.length > 0) {
    setSelectedLocationId(entry.locations[0].id); // PROBLEM: Always first location
    updateUrlForLocation(entry.locations[0]);
  }
}
```

**Problems:**

- **Arbitrary selection**: Always picks `entry.locations[0]` - could be random
- **One-way sync**: Location→Thesaurus sync is missing
- **URL confusion**: URL shows location path, not concept path

### 3. Missing Bidirectional Sync

**Current:** Thesaurus → Location (✓)
**Missing:** Location → Thesaurus (✗)

When user selects a location via map/table, the corresponding thesaurus entry should be highlighted.

## Proposed Solutions

### Option A: Unified Selection Model

```typescript
interface SelectionState {
  locationId: string | null;
  conceptId: string | null;
  source: 'map' | 'table' | 'thesaurus' | 'url';
}
```

### Option B: Consistent Toggle Behavior

- Make all components use same selection pattern (either all toggle or none)
- Recommend: **No toggle** - simpler UX, click to select, click elsewhere to deselect

### Option C: Intelligent Concept Selection

- When selecting thesaurus entry with multiple locations:
  - Use coordinates proximity if available
  - Use meaningful location ordering
  - Show location picker for ambiguous cases

## Test Scenarios

1. **Click map marker** → Should highlight table row + thesaurus entry
2. **Click table row** → Should highlight map marker + thesaurus entry
3. **Click thesaurus entry** → Should highlight best-match location on map/table
4. **URL navigation** → Should highlight all related components
5. **Clear selection** → Should clear all highlights consistently

## Recommendations

1. **Fix selection consistency** - Remove toggle from table, match map behavior
2. **Add bidirectional sync** - Location selection should find and highlight concept
3. **Improve concept→location selection** - Use smarter selection than just `[0]`
4. **Unified URL handling** - Decide if URLs should show location paths or concept paths
