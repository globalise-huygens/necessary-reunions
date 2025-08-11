# GAVOC Atlas Thesaurus System

## Overview

The GAVOC Atlas now includes a comprehensive thesaurus system that groups individual location entries into conceptual entities, creating a more sophisticated way to navigate and understand the historical geographic data.

## Key Concepts

### Preferred Terms vs Alternative Terms

- **Preferred Term**: The "present name" from the CSV (modern/standardized name)
- **Alternative Terms**: All "original names" from historical maps that refer to the same place
- **Concept Grouping**: Multiple historical entries that refer to the same geographic entity

## Examples from the Data

### Example 1: Aden/Adan

**Concept**: `Aden/Adan`

- **Preferred Term**: `Aden/Adan`
- **Alternative Terms**:
  - `Ade Vechie` (Old Aden)
  - `Aden` (multiple historical spellings)
  - `Adon` (variant spelling)
- **Locations**: 4 separate map entries
- **URI**: `https://necessaryreunions.org/gavoc/concept/plaats-aden-adan/aden-adan`

### Example 2: Arnhem Land

**Concept**: `Arnhem Land`

- **Preferred Term**: `Arnhem Land`
- **Alternative Terms**:
  - `Aarnhems Land`
  - `Aarnhems Landt`
- **Locations**: 2 separate map entries
- **URI**: `https://necessaryreunions.org/gavoc/concept/landstreek-arnhem-land/arnhem-land`

### Example 3: Tg. Mangkalihat

**Concept**: `Tg. Mangkalihat`

- **Preferred Term**: `Tg. Mangkalihat`
- **Alternative Terms**:
  - `Aart Gysens H.`
  - `art Gysens Hoek`
- **Locations**: 2 separate map entries
- **URI**: `https://necessaryreunions.org/gavoc/concept/kaap-tg-mangkalihat/tg-mangkalihat`

## Technical Implementation

### Data Structure

```typescript
interface GavocThesaurusEntry {
  id: string; // Unique concept identifier
  preferredTerm: string; // Modern/standardized name
  alternativeTerms: string[]; // Historical variations
  category: string; // Geographic category
  coordinates?: { latitude: number; longitude: number };
  locations: GavocLocation[]; // All individual map entries
  uri: string; // Canonical concept URI
  urlPath: string; // URL path for concept
}
```

### URI System

- **Concept URIs**: `https://necessaryreunions.org/gavoc/concept/{category}-{normalized-term}/{slug}`
- **Location URIs**: `https://necessaryreunions.org/gavoc/{id}/{slug}` (existing system)

## User Interface Features

### View Mode Toggle

- **Locations View**: Shows individual map entries (11,086+ entries)
- **Concepts View**: Shows grouped concepts (~8,000-9,000 unique concepts)

### Dual Table System

1. **Location Table**: Individual historical map entries
2. **Thesaurus Table**: Conceptual groupings with:
   - Preferred term
   - Alternative terms (comma-separated)
   - Category
   - Coordinates (if available)
   - Location count (number of map entries for this concept)
   - URIs and URLs

### Navigation Flow

1. **Concept Selection**: Click on a concept in thesaurus view
2. **Location Selection**: Automatically selects first location from that concept
3. **Map Display**: Centers on the concept's coordinates
4. **URL Updates**: Browser URL reflects the selected location

### Search & Filtering

- **Concept Search**: Searches both preferred terms and alternative terms
- **Location Search**: Searches all individual location data
- **Category Filtering**: Works in both views
- **Coordinate Filtering**: Shows only concepts/locations with coordinates

## Benefits

### 1. **Cleaner Navigation**

- Reduces visual clutter by grouping related entries
- Easier to find unique places rather than duplicate entries

### 2. **Historical Context**

- Shows how place names evolved over time
- Preserves all historical spelling variations
- Links different maps showing the same place

### 3. **Better Data Analysis**

- True count of unique geographic concepts
- Understanding of naming patterns and changes
- Ability to track places across different historical periods

### 4. **Enhanced URIs**

- Concepts get canonical URIs for citing and linking
- Individual locations maintain their specific URIs
- Proper semantic web structure

## Data Quality Insights

### Duplicate Patterns Discovered

1. **Spelling Variations**: Same place, different historical spellings
2. **Language Variations**: Dutch vs local vs modern names
3. **Map Redundancy**: Same place appears on multiple historical maps
4. **Temporal Changes**: Names that changed over time periods

### Statistics (Estimated)

- **Total Location Entries**: 11,086
- **Unique Concepts**: ~8,000-9,000
- **Reduction Factor**: ~20-25% consolidation
- **Multi-entry Concepts**: ~2,000-3,000 concepts with multiple location entries

## Future Enhancements

### 1. **Advanced Linking**

- Cross-reference with external gazetteers
- Link to modern GIS coordinates
- Connect to historical timeline data

### 2. **Semantic Enhancement**

- Add hierarchical relationships (part-of, near, etc.)
- Temporal relationships (renamed-to, succeeded-by)
- Linguistic relationships (translation-of, variant-of)

### 3. **API Endpoints**

- REST API for concept lookup
- SPARQL endpoint for semantic queries
- Linked data exports (RDF, JSON-LD)

## Usage Examples

### For Researchers

```
1. Search for "Ceylon" in concepts view
2. See all historical name variations
3. View all maps that show this place
4. Get canonical URI for citations
```

### For Digital Humanities

```
1. Export concept data with alternative terms
2. Analyze naming patterns over time
3. Cross-reference with other historical datasets
4. Track colonial naming practices
```

### For Web Integration

```
1. Link to specific concepts via URI
2. Embed maps showing concept locations
3. Reference in academic papers
4. Build upon for related projects
```

This thesaurus system transforms the GAVOC Atlas from a simple location index into a sophisticated historical geographic knowledge base that preserves both the granular detail of individual map entries and the conceptual understanding of geographic entities across time.
