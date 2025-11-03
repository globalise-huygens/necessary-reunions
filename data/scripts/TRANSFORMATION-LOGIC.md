# NeRu CSV to JSON Transformation Logic

## Data Structure Overview

### Core Principle

- **GLOB_ID** is the unique identifier that connects all 4 CSV files
- Each GLOB_ID represents ONE place with:
  - ONE PREF_LABEL (preferred/primary name)
  - ZERO or MORE ALT_LABELs (alternative names)
  - ZERO or MORE TYPE classifications
  - ZERO or MORE RELATION entries (hierarchical relationships)
  - Multiple REMARKS fields from different tables

## Input Sources

### 1. places.csv (689 rows)

**Primary data source for each place**

- `GLOB_ID` - Unique identifier (e.g., "NR_0", "GLOB_176")
- `PREF_LABEL` - Primary name to use as `_label` in JSON
- `LATITUDE`, `LONGITUDE` - Coordinates
- `COORD_CERTAINTY` - "certain" or "uncertain"
- `GEONAMES_ID`, `WIKIDATA_ID`, `AMH_ID`, `TGN_ID`, `WHG_ID` - External identifiers
- `CCODES` - Country codes (e.g., "India")
- **REMARKS FIELDS**:
  - `PREF_LABEL_REMARKS` - Comments about the preferred label
  - `COORD_REMARKS` - Comments about coordinates/location
  - `OVERALL_REMARKS` - General remarks about the place

### 2. altLabels.csv (267 rows)

**Alternative names linked to places**

- `GLOB_ID` - Links to places.csv
- `ALT_LABEL` - Alternative name for the place
- `ALT_LABEL_SOURCE` - Source document for this name
- `ALT_LABEL_SOURCE_PAGE` - Page number in source
- **REMARKS FIELD**:
  - `ALT_LABEL_REMARK` - Context/notes about this alternative name

### 3. placeTypes.csv (88 rows)

**Type classifications for places**

- `GLOB_ID` - Links to places.csv
- `PLACE` - Place name (for reference)
- `TYPE` - Classification (e.g., "kingdom", "temple", "church", "island", "fort")
- `SOURCE` - Source for this classification
- **REMARKS FIELD**:
  - `TYPE_REMARKS` - Comments about this type classification

### 4. placeRelation.csv (24 rows)

**Hierarchical relationships between places**

- `GLOB_ID` - The place being described
- `PLACE` - Place name
- `RELATION` - Type of relationship ("Part Of", "Overlaps")
- `RELATED_GLOB_ID` - The related place's GLOB_ID
- `RELATED_PLACE` - Related place name
- **REMARKS FIELD**:
  - `RELATION_REMARKS` - Context about this relationship

## Output Structure (Linked Art JSON-LD)

### Template for Each Place

```json
{
  "@context": "https://linked.art/ns/v1/linked-art.json",
  "id": "https://id.necessaryreunions.org/place/{UUID}",
  "type": "Place",
  "_label": "{PREF_LABEL}",
  "classified_as": [
    /* TYPE entries */
  ],
  "identified_by": [
    /* PREF_LABEL + ALT_LABELs + External IDs */
  ],
  "referred_to_by": [
    /* ALL REMARKS */
  ],
  "part_of": [
    /* RELATION entries */
  ],
  "defined_by": "POINT ({longitude} {latitude})"
}
```

## Transformation Steps

### Step 1: Read and Parse All CSV Files

```typescript
const places = parseCSV('places.csv');
const altLabels = parseCSV('altLabels.csv');
const placeTypes = parseCSV('placeTypes.csv');
const placeRelations = parseCSV('placeRelation.csv');
```

### Step 2: Group Data by GLOB_ID

```typescript
const placeMap = new Map<string, PlaceData>();

// Start with places.csv as base
for (const row of places) {
  if (!row.GLOB_ID) continue;

  placeMap.set(row.GLOB_ID, {
    globId: row.GLOB_ID,
    prefLabel: row.PREF_LABEL,
    latitude: row.LATITUDE,
    longitude: row.LONGITUDE,
    coordCertainty: row.COORD_CERTAINTY,
    externalIds: {
      geonames: row.GEONAMES_ID,
      wikidata: row.WIKIDATA_ID,
      amh: row.AMH_ID,
      tgn: row.TGN_ID,
      whg: row.WHG_ID,
    },
    ccodes: row.CCODES,
    remarks: {
      prefLabel: row.PREF_LABEL_REMARKS,
      coord: row.COORD_REMARKS,
      overall: row.OVERALL_REMARKS,
    },
    altLabels: [],
    types: [],
    relations: [],
  });
}

// Add alternative labels
for (const row of altLabels) {
  const place = placeMap.get(row.GLOB_ID);
  if (place) {
    place.altLabels.push({
      label: row.ALT_LABEL,
      source: row.ALT_LABEL_SOURCE,
      sourcePage: row.ALT_LABEL_SOURCE_PAGE,
      remark: row.ALT_LABEL_REMARK,
    });
  }
}

// Add types
for (const row of placeTypes) {
  const place = placeMap.get(row.GLOB_ID);
  if (place) {
    place.types.push({
      type: row.TYPE,
      source: row.SOURCE,
      remark: row.TYPE_REMARKS,
    });
  }
}

// Add relations
for (const row of placeRelations) {
  const place = placeMap.get(row.GLOB_ID);
  if (place) {
    place.relations.push({
      relation: row.RELATION,
      relatedGlobId: row.RELATED_GLOB_ID,
      relatedPlace: row.RELATED_PLACE,
      remark: row.RELATION_REMARKS,
    });
  }
}
```

### Step 3: Transform to Linked Art JSON

#### 3.1 Generate UUID for Each Place

```typescript
function generatePlaceId(globId: string): string {
  // If GLOB_ID already contains UUID format, extract it
  // Otherwise generate new UUID based on GLOB_ID
  const uuid = globId.includes('GLOB_')
    ? generateUuidFromString(globId)
    : generateUuidFromString(`NR_${globId}`);

  return `https://id.necessaryreunions.org/place/${uuid}`;
}
```

#### 3.2 Build \_label Field

```typescript
"_label": place.prefLabel
```

#### 3.3 Build classified_as Array (from placeTypes.csv)

```typescript
"classified_as": place.types.map(typeEntry => ({
  "id": mapTypeToUri(typeEntry.type), // Map to PoolParty URIs
  "type": "Type",
  "_label": typeEntry.type
}))
```

**Type Mapping Strategy:**

- Use existing GLOBALISE PoolParty URIs where applicable
- For new types not in GLOBALISE, create placeholder URIs
- Document unmapped types for manual URI assignment

#### 3.4 Build identified_by Array

```typescript
"identified_by": [
  // PREFERRED NAME (PREF_LABEL)
  {
    "type": "Name",
    "content": place.prefLabel,
    "classified_as": [
      {
        "id": "PREF",
        "type": "Type",
        "_label": "PREF"
      }
    ]
  },

  // ALTERNATIVE NAMES (ALT_LABELs)
  ...place.altLabels.map(alt => ({
    "type": "Name",
    "content": alt.label,
    "classified_as": [
      {
        "id": "ALT",
        "type": "Type",
        "_label": "ALT"
      }
    ]
  })),

  // EXTERNAL IDENTIFIERS
  ...Object.entries(place.externalIds)
    .filter(([key, value]) => value) // Only include non-empty IDs
    .map(([key, value]) => ({
      "type": "Identifier",
      "content": formatExternalId(key, value)
    }))
]
```

**External ID Formatting:**

- `GEONAMES_ID`: Format as full URL `https://geonames.org/{id}`
- `WIKIDATA_ID`: Already full URL, use as-is
- `AMH_ID`: Keep as-is (e.g., "amh_791p")
- `TGN_ID`: Format as Getty TGN URL
- `WHG_ID`: Keep as-is

#### 3.5 Build referred_to_by Array (ALL REMARKS)

```typescript
"referred_to_by": [
  // PREF_LABEL_REMARKS
  ...(place.remarks.prefLabel ? [{
    "type": "LinguisticObject",
    "classified_as": [{
      "id": "http://vocab.getty.edu/aat/300435416",
      "type": "Type",
      "_label": "Description"
    }],
    "content": `[PREF_LABEL] ${place.remarks.prefLabel}`
  }] : []),

  // COORD_REMARKS
  ...(place.remarks.coord ? [{
    "type": "LinguisticObject",
    "classified_as": [{
      "id": "http://vocab.getty.edu/aat/300435416",
      "type": "Type",
      "_label": "Description"
    }],
    "content": `[COORDINATES] ${place.remarks.coord}`
  }] : []),

  // OVERALL_REMARKS
  ...(place.remarks.overall ? [{
    "type": "LinguisticObject",
    "classified_as": [{
      "id": "http://vocab.getty.edu/aat/300435416",
      "type": "Type",
      "_label": "Description"
    }],
    "content": `[CONTEXT] ${place.remarks.overall}`
  }] : []),

  // ALT_LABEL_REMARKs (one per alternative label with remarks)
  ...place.altLabels
    .filter(alt => alt.remark)
    .map(alt => ({
      "type": "LinguisticObject",
      "classified_as": [{
        "id": "http://vocab.getty.edu/aat/300435416",
        "type": "Type",
        "_label": "Description"
      }],
      "content": `[ALT_LABEL: ${alt.label}] ${alt.remark}. Source: ${alt.source}${alt.sourcePage ? `, p. ${alt.sourcePage}` : ''}`
    })),

  // TYPE_REMARKS (one per type classification with remarks)
  ...place.types
    .filter(typeEntry => typeEntry.remark)
    .map(typeEntry => ({
      "type": "LinguisticObject",
      "classified_as": [{
        "id": "http://vocab.getty.edu/aat/300435416",
        "type": "Type",
        "_label": "Description"
      }],
      "content": `[TYPE: ${typeEntry.type}] ${typeEntry.remark}. Source: ${typeEntry.source}`
    })),

  // RELATION_REMARKS (one per relationship with remarks)
  ...place.relations
    .filter(rel => rel.remark)
    .map(rel => ({
      "type": "LinguisticObject",
      "classified_as": [{
        "id": "http://vocab.getty.edu/aat/300435416",
        "type": "Type",
        "_label": "Description"
      }],
      "content": `[RELATION: ${rel.relation} ${rel.relatedPlace}] ${rel.remark}`
    }))
]
```

**REMARKS Tagging Strategy:**

- Prefix each remark with context tag in brackets (e.g., `[PREF_LABEL]`, `[COORDINATES]`, `[ALT_LABEL: {name}]`)
- Include source information where available
- Preserve all scholarly notes and context

#### 3.6 Build part_of Array (from placeRelation.csv)

```typescript
"part_of": place.relations
  .filter(rel => rel.relation === "Part Of")
  .map(rel => ({
    "id": generatePlaceId(rel.relatedGlobId),
    "type": "Place",
    "_label": rel.relatedPlace,
    "classified_as": []
  }))
```

**Note:** "Overlaps" relationships need different handling - consider separate field or different classification

#### 3.7 Build defined_by Field (WKT POINT)

```typescript
"defined_by": place.latitude && place.longitude
  ? `POINT (${place.longitude} ${place.latitude})`
  : undefined
```

**Coordinate Handling:**

- Only include if both latitude and longitude exist
- Format: `POINT (longitude latitude)` - note longitude comes first in WKT
- If coordinates missing, omit `defined_by` field entirely

### Step 4: Handle Edge Cases

#### Empty/Missing Data

- **No PREF_LABEL**: Skip place (cannot create valid entry)
- **No coordinates**: Omit `defined_by` field
- **No ALT_LABELs**: Just include PREF in `identified_by`
- **No types**: Empty `classified_as` array
- **No relations**: Empty `part_of` array
- **No remarks**: Empty `referred_to_by` array

#### Data Quality

- **COORD_CERTAINTY**: Include in COORD_REMARKS if "uncertain"
- **Empty GLOB_ID**: Generate new UUID-based ID
- **Duplicate ALT_LABELs**: Keep all (may come from different sources)
- **Invalid coordinates**: Log warning and omit `defined_by`

### Step 5: Generate Output File

```typescript
const outputData = Array.from(placeMap.values())
  .map((place) => transformToLinkedArt(place))
  .filter((place) => place !== null); // Remove invalid entries

fs.writeFileSync(
  'public/neru-place-dataset.json',
  JSON.stringify(outputData, null, 2),
);
```

## Data Validation Checklist

Before finalizing output, verify:

- [ ] All GLOB_IDs from places.csv are represented
- [ ] All ALT_LABELs are linked to correct PREF_LABELs
- [ ] All REMARKS fields are preserved with context tags
- [ ] Coordinate format matches WKT standard (longitude first)
- [ ] External IDs are properly formatted as URLs where applicable
- [ ] UUID generation is consistent and repeatable
- [ ] Relationships reference valid place IDs
- [ ] No data loss from any CSV file

## Output Statistics to Generate

```typescript
console.log(`
Transformation Complete:
- Total places: ${placeMap.size}
- Places with coordinates: ${placesWithCoords}
- Places with alt labels: ${placesWithAltLabels}
- Places with types: ${placesWithTypes}
- Places with relations: ${placesWithRelations}
- Total alt labels: ${totalAltLabels}
- Total remarks preserved: ${totalRemarks}
`);
```

## Integration with GeoTagMap

The output `neru-place-dataset.json` will be:

1. Placed in `/public/` directory
2. Loaded by GeoTagMap component as new data source
3. Searchable alongside GLOBALISE and GAVOC datasets
4. Compatible with existing search result interfaces

**Next Step:** Implement this logic in TypeScript script
