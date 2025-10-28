# Place Biography Requirements - PlaceDetail Component

## Overview

Transform PlaceDetail into a comprehensive "Place Biography" showcasing the complete historical narrative of each place through multiple data sources.

## Current Data Available (from API)

### ✅ Already Available

- `name` - Current canonical name
- `category` - Place type (needs taxonomy enhancement)
- `textParts[]` - Text recognition variants (creator/loghi sources)
- `comments[]` - Commenting annotations with remarks
- `coordinates` - Pixel or geographic coordinates
- `coordinateType` - Type of coordinates
- `hasHumanVerification` - Verification status
- `linkingAnnotationId` - Source annotation

### ⚠️ Partially Available

- `alternativeNames[]` - Currently null, needs enrichment from:
  - External thesaurus (GAVOC)
  - GLOBALISE dataset
  - Text spotting combinations
  - Iconography labels

### ❌ Missing/Needs Enhancement

- Map timeline data (map dates + recognized names per map)
- Iconography classifications
- External thesaurus preferred labels
- Full map references with archive links
- Modern coordinates from Nominatim

---

## Required Biography Sections

### 1. **Preferred Label** (Header)

**Data Source**: External thesaurus (GAVOC `preferredTerm`)

**Current Status**:

- ✅ Display: `place.name`
- ❌ Missing: Link to external thesaurus URI
- ❌ Missing: GAVOC preferred term distinction

**Implementation Needed**:

```typescript
{
  name: string;                    // Current canonical name
  preferredLabel?: string;         // GAVOC preferredTerm
  preferredLabelSource?: {
    uri: string;                   // GAVOC URI
    type: 'gavoc' | 'globalise';
  };
}
```

**UI Enhancement**:

- Large heading with preferred label
- Small badge: "GAVOC Preferred" with link icon
- Fallback to `name` if no preferred term exists

---

### 2. **Alternative Labels** (Name Variants Section)

**Data Sources**:

1. External thesaurus `alternativeTerms` (GAVOC)
2. GLOBALISE dataset `identified_by` array (ALT classifications)
3. Text spotting combinations (`textParts[]` deduplicated)
4. Iconography labels (when applicable)

**Current Status**:

- ✅ Display: `alternativeNames[]` badges
- ⚠️ Partial: Only showing GAVOC + GLOBALISE
- ❌ Missing: Text spotting combinations
- ❌ Missing: Iconography labels
- ❌ Missing: Source attribution per name

**Implementation Needed**:

```typescript
{
  alternativeNames: Array<{
    value: string;
    source: 'gavoc' | 'globalise' | 'text-spotting' | 'iconography';
    sourceUri?: string;
    confidence?: number; // For AI-generated names
  }>;
}
```

**UI Enhancement**:

- Group by source with collapsible sections:
  - "Historical Sources (GAVOC)"
  - "Modern Equivalents (GLOBALISE)"
  - "Text Recognition Variants (HTR/Loghi)"
  - "Iconographic Labels"
- Different badge colors per source type
- Show confidence scores for AI-generated variants

---

### 3. **Place Type** (Classification Section)

**Data Sources**:

1. PoolParty taxonomy (primary)
2. GAVOC category
3. Iconography classification from linked annotations

**Current Status**:

- ✅ Display: `getCategoryLabel(place.category)`
- ✅ Display: PoolParty URI link
- ❌ Missing: Iconography classification
- ❌ Missing: Multiple type classifications

**Implementation Needed**:

```typescript
{
  category: string;                // Primary taxonomy key
  categoryUri?: string;            // PoolParty URI
  additionalTypes?: Array<{
    type: string;
    source: 'gavoc' | 'iconography' | 'poolparty';
    label: string;
    uri?: string;
    iconographyId?: string;       // Reference to iconography annotation
  }>;
}
```

**UI Enhancement**:

- Primary type as large badge with PoolParty link
- Secondary types (iconography) as smaller badges
- Visual icon symbols for iconography types
- Explanation text about cartographic symbols

---

### 4. **Comments, Remarks & Notes** (Annotations Section)

**Data Source**: `comments[]` array from `purpose: "commenting"` annotations

**Current Status**:

- ✅ Available: `comments[]` with `value` and `targetId`
- ❌ Missing: Display in UI
- ❌ Missing: Creator/date information
- ❌ Missing: Link to target annotation

**Implementation Needed**:

```typescript
{
  comments: Array<{
    value: string;
    targetId: string;
    creator?: {
      id: string;
      type: string;
      label: string;
    };
    created?: string;
    purpose: 'commenting';
  }>;
}
```

**UI Enhancement**:

- New section: "Historical Notes & Remarks"
- Card-based layout with:
  - Comment text (markdown support?)
  - Creator badge (human/AI)
  - Timestamp
  - Link to source annotation/target
- Group by target if multiple comments

---

### 5. **Timeline** (Historical Name Evolution)

**Data Source**: Map dates + text recognition per map

**Current Status**:

- ⚠️ Partial: Shows `mapReferences[]` with basic info
- ❌ Missing: Structured timeline by date
- ❌ Missing: Map dates in timeline
- ❌ Missing: Text variants per map/date

**Implementation Needed**:

```typescript
{
  timeline: Array<{
    date: string; // Map creation date
    mapTitle: string;
    mapId: string;
    canvasId: string;
    recognizedNames: Array<{
      value: string;
      source: 'human' | 'loghi-htr' | 'ai-pipeline';
      confidence?: number;
      targetId: string;
    }>;
    permalink?: string; // Link to archive
    isDateUncertain?: boolean; // "?" dates
  }>;
}
```

**UI Enhancement**:

- Visual timeline component (vertical line with date markers)
- Each timeline entry shows:
  - **Date** (large, with "uncertain" indicator if "?")
  - **Map title** (clickable to archive)
  - **Recognized names** on that map (badges with source icons)
  - **Confidence scores** for AI recognition
- Sort chronologically (uncertain dates first)
- Highlight evolution of spelling over time

---

### 6. **Modern Location Map** (Geography Section)

**Data Source**: Modern coordinates via Nominatim geocoding

**Current Status**:

- ✅ Component exists: `ModernLocationMap`
- ✅ Geocoding with caching
- ⚠️ Basic display only
- ❌ Missing: Coordinate display
- ❌ Missing: Uncertainty indicator

**Implementation Needed**:

```typescript
{
  modernLocation?: {
    lat: number;
    lon: number;
    displayName: string;
    source: 'nominatim' | 'gavoc' | 'manual';
    confidence: 'high' | 'medium' | 'low';
    searchTerm: string;         // What was searched
  };
}
```

**UI Enhancement**:

- Show coordinates in DMS (degrees/minutes/seconds) format
- Confidence indicator:
  - 🟢 High: Direct match on modern name
  - 🟡 Medium: Fallback to historical name
  - 🔴 Low: Generic Kerala region
- Link to OpenStreetMap
- Link to Wikipedia (if available)
- Download coordinates button (.gpx/.kml)

---

### 7. **Archive Map Links** (Sources Section)

**Data Source**: Map references with archive permalinks

**Current Status**:

- ✅ Display: `mapReferences[]` with titles
- ⚠️ Partial: Shows titles and dimensions
- ❌ Missing: Archive thumbnails
- ❌ Missing: Grid square/page numbers prominently
- ❌ Missing: IIIF viewer links

**Implementation Needed**:

```typescript
{
  mapReferences: Array<{
    mapId: string;
    mapTitle: string;
    canvasId: string;
    date?: string;
    permalink?: string; // National Archive link
    iiifManifest?: string; // IIIF manifest URL
    thumbnail?: string; // IIIF thumbnail
    gridSquare?: string; // Map grid reference
    pageNumber?: string; // Archive page number
    dimensions?: {
      width: number;
      height: number;
    };
  }>;
}
```

**UI Enhancement**:

- Card grid layout with thumbnails
- Each card shows:
  - **Thumbnail image** (from IIIF)
  - **Map title** + date
  - **Grid square** (e.g., "F-4") if available
  - **Page number** (e.g., "p. 23") if available
  - **Buttons**:
    - 🔗 View in Archive (permalink)
    - 🖼️ Open in IIIF Viewer
    - 📍 View Annotation
- Highlight primary map (where place was first identified)

---

## Data Flow Architecture

### API Enhancement Needed

**Current**: `/api/gazetteer/linking-bulk`

- Returns: Basic place data with limited enrichment

**Required Enhancement**:

```typescript
// Add to processLinkingAnnotations()
async function enrichPlaceData(place: ProcessedPlace): Promise<EnrichedPlace> {
  // 1. Fetch target annotations for timeline
  const targetAnnotations = await fetchTargetAnnotations(place.targetIds);

  // 2. Extract map info and dates
  const timeline = buildTimeline(targetAnnotations);

  // 3. Fetch iconography annotations
  const iconography = await fetchIconographyAnnotations(
    place.linkingAnnotationId,
  );

  // 4. Enrich alternative names
  const enrichedNames = await enrichAlternativeNames(
    place.name,
    place.textParts,
    iconography,
  );

  // 5. Geocode for modern location
  const modernLocation = await geocodePlace(place.name, place.modernName);

  return {
    ...place,
    timeline,
    iconography,
    alternativeNames: enrichedNames,
    modernLocation,
  };
}
```

---

## Implementation Priority

### Phase 1: Data Collection (High Priority)

1. ✅ Comments display - Already in data
2. ⚠️ Timeline construction - Needs map date extraction
3. ⚠️ Alternative names enrichment - Partial (needs text spotting)
4. ❌ Iconography integration - Needs target fetching

### Phase 2: UI Enhancement (Medium Priority)

1. Comments & Remarks section (new)
2. Timeline visualization component (enhance existing)
3. Alternative names grouping by source
4. Place type with iconography badges

### Phase 3: Data Enrichment (Lower Priority)

1. Modern location confidence scores
2. Archive map thumbnails (IIIF)
3. Preferred label from GAVOC
4. Geocoding with uncertainty

---

## Example: Complete Place Biography for "Ro: Mirsou"

```
╔══════════════════════════════════════════════════════════╗
║  Ro: Mirsou                                              ║
║  🏷️ GAVOC Preferred Label                                ║
╚══════════════════════════════════════════════════════════╝

┌─ Alternative Names ─────────────────────────────────────┐
│ Historical Sources (GAVOC): [Ro Mirsou] [Rio Mirsou]   │
│ Text Recognition (HTR):     [R.] [Ro.] [Ro:] [Mirsou]  │
└─────────────────────────────────────────────────────────┘

┌─ Place Type ────────────────────────────────────────────┐
│ 🗺️ Settlement (PoolParty URI 🔗)                        │
│ Cartographic symbols: [River icon] from iconography     │
└─────────────────────────────────────────────────────────┘

┌─ Historical Notes ──────────────────────────────────────┐
│ 💬 "'Ro' might come from the portuguese word 'rio',    │
│     meaning 'river'."                                    │
│    — Human annotator, 2024                              │
└─────────────────────────────────────────────────────────┘

┌─ Timeline: Name Evolution ──────────────────────────────┐
│                                                          │
│  📅 1663 - Malabar Coast Map                            │
│  ├─ Recognized: "Ro: Mirsou" (human ✓)                 │
│  ├─ Recognized: "R." (Loghi HTR, 92%)                   │
│  └─ 🔗 View in Archive                                  │
│                                                          │
│  📅 1670 - Cochin Region Detail                         │
│  └─ Recognized: "Rio Mirsou" (human ✓)                 │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─ Modern Location ───────────────────────────────────────┐
│  🗺️ Map showing approximate location                    │
│  📍 10.8505° N, 76.2711° E (uncertainty: medium 🟡)     │
│  🔗 OpenStreetMap | Wikipedia | Download KML            │
└─────────────────────────────────────────────────────────┘

┌─ Archive Sources ───────────────────────────────────────┐
│  [Thumbnail] Malabar Coast Map (1663)                   │
│  Grid: F-4 | Page: 23                                   │
│  🔗 View in Archive | 🖼️ IIIF Viewer                    │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### Performance Requirements

- Initial place load: < 3 seconds
- Timeline data: Progressive loading
- Map thumbnails: Lazy loading with placeholders
- Geocoding: Cached (7 days)

### Accessibility

- All sections keyboard navigable
- Screen reader friendly timeline
- High contrast mode support
- ARIA labels for all interactive elements

### Responsive Design

- Desktop: 2-column layout (details | map)
- Tablet: Stacked sections with sticky header
- Mobile: Single column, collapsible sections

---

## Next Steps

1. **API Enhancement**: Update `/api/gazetteer/linking-bulk` to include timeline and iconography
2. **Type Definitions**: Extend `GazetteerPlace` interface with new fields
3. **UI Components**: Build timeline and comments components
4. **Data Pipeline**: Implement target annotation fetching for complete data
5. **Testing**: Verify with multiple place examples
