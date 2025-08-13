# Linking Annotations Fix - Testing Guide

This document describes the issues identified and fixed in the linking annotations functionality.

## Issues Identified

1. **Inconsistent Body Structure**: Some linking annotations had empty bodies `[]` while others had improperly structured bodies.

2. **Missing Purpose Fields**: Body elements were missing the crucial `purpose` field that identifies content type.

3. **Improper Geotag Structure**: Geotag data structure varied between Globalise and Nominatim sources.

4. **Point Selection Issues**: Point selectors had incorrect purpose field (`highlighting` instead of `selecting`).

5. **Creator Information**: Inconsistent creator information across body parts.

## Fixes Applied

### 1. Enhanced Geotag Data Handling (`AnnotationList.tsx`)

```typescript
// Now properly handles both Globalise and Nominatim formats
if (data.geotag.geometry && data.geotag.properties) {
  // Globalise format
  geotagSource = {
    id: data.geotag.id || `https://data.globalise.huygens.knaw.nl/place/${Date.now()}`,
    type: 'Feature',
    properties: {
      title: data.geotag.properties.title || data.geotag.label || 'Unknown Location',
      description: data.geotag.properties.description || data.geotag.properties.title || '',
    },
    geometry: data.geotag.geometry,
  };
} else if (data.geotag.lat && data.geotag.lon) {
  // Nominatim format
  geotagSource = {
    id: `https://nominatim.openstreetmap.org/details.php?place_id=${data.geotag.place_id || Date.now()}`,
    type: 'Feature',
    properties: {
      title: data.geotag.display_name || 'Unknown Location',
      description: data.geotag.display_name || '',
    },
    geometry: {
      type: 'Point',
      coordinates: [parseFloat(data.geotag.lon), parseFloat(data.geotag.lat)],
    },
  };
}
```

### 2. Fixed Point Selector Structure

```typescript
// Corrected purpose field and structure order
{
  type: 'SpecificResource',
  purpose: 'selecting', // Was 'highlighting' or missing
  source: canvasId,
  selector: {
    type: 'PointSelector',
    x: Math.round(data.point.x),
    y: Math.round(data.point.y),
  },
  creator: { /* ... */ },
  created: new Date().toISOString(),
}
```

### 3. Server-Side Validation Enhancement (`linking/route.ts`)

```typescript
function validateAndFixBodies(bodies: any[], user: any): any[] {
  return bodies.map((body) => {
    // Ensure proper structure
    if (!body.type) {
      body.type = 'SpecificResource';
    }

    // Fix point selector purpose
    if (body.selector?.type === 'PointSelector' && 
        (body.purpose === 'highlighting' || !body.purpose)) {
      body.purpose = 'selecting';
    }

    // Fix geotagging sources
    if (body.purpose === 'geotagging' && body.source) {
      if (!body.source.type) {
        body.source.type = 'Feature';
      }
      // ... additional fixes
    }

    // Add missing creator and timestamps
    // ...
  });
}
```

### 4. Linking Repair Utility (`lib/viewer/linking-repair.ts`)

Added comprehensive repair functions:
- `analyzeLinkingAnnotation()`: Analyzes annotation structure and identifies issues
- `repairLinkingAnnotationStructure()`: Repairs common structural problems
- `validateLinkingAnnotationBeforeSave()`: Validates annotations before saving

### 5. Enhanced Validation (`LinkingPreValidation.tsx`)

```typescript
// Better validation of linking components
const hasLinkedAnnotations = linkedIds && linkedIds.length > 1;
const hasGeotag = selectedGeotag && 
  (selectedGeotag.lat || selectedGeotag.geometry || selectedGeotag.coordinates);
const hasPoint = selectedPoint && 
  typeof selectedPoint.x === 'number' && 
  typeof selectedPoint.y === 'number';
```

### 6. Debug Endpoint (`api/annotations/debug/route.ts`)

Added endpoint to analyze annotation structure:
- `GET /api/annotations/debug?id={annotationId}`: Analyze annotation structure
- `POST /api/annotations/debug`: Preview repairs without saving

## Testing the Fixes

### 1. Test Linking Annotations

1. Go to `/viewer`
2. Select 2+ annotations
3. Use the linking widget to create a link
4. Verify the annotation is saved with proper structure

### 2. Test Geotag Addition

1. Select an annotation
2. Add a geotag using the map interface
3. Save and verify the geotag data structure is correct

### 3. Test Point Selection

1. Select an annotation
2. Enable point selection mode
3. Click on the image to set a point
4. Save and verify the point selector has `purpose: 'selecting'`

### 4. Test with Debug Endpoint

```bash
# Analyze an existing annotation
curl "http://localhost:3002/api/annotations/debug?id=ANNOTATION_URL"

# Preview repair
curl -X POST "http://localhost:3002/api/annotations/debug" \
  -H "Content-Type: application/json" \
  -d '{"annotationId": "ANNOTATION_URL", "repair": true}'
```

## Expected Behavior After Fixes

1. **Consistent Structure**: All linking annotations should have properly structured bodies with correct `type` and `purpose` fields.

2. **Geotag Compatibility**: Both Globalise and Nominatim geotag sources should work correctly.

3. **Point Selectors**: Point selections should save with `purpose: 'selecting'` and proper structure.

4. **Validation**: The system should properly validate before saving and provide meaningful error messages.

5. **Display**: Existing linking data should display correctly in the UI.

## Troubleshooting

If you encounter issues:

1. Check browser console for detailed error messages
2. Use the debug endpoint to analyze specific annotations
3. Verify that the linking widget shows proper validation messages
4. Check server logs for API errors

## Example of Fixed Annotation Structure

```json
{
  "@context": ["http://www.w3.org/ns/anno.jsonld"],
  "id": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/...",
  "type": "Annotation",
  "motivation": "linking",
  "target": [
    "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/...",
    "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/..."
  ],
  "body": [
    {
      "type": "SpecificResource",
      "purpose": "geotagging",
      "source": {
        "id": "https://data.globalise.huygens.knaw.nl/place/...",
        "type": "Feature",
        "properties": {
          "title": "Location Name",
          "description": "Location Description"
        },
        "geometry": {
          "type": "Point",
          "coordinates": [lon, lat]
        }
      },
      "creator": {...},
      "created": "2025-01-15T..."
    },
    {
      "type": "SpecificResource",
      "purpose": "selecting",
      "source": "https://data.globalise.huygens.knaw.nl/manifests/.../canvas/...",
      "selector": {
        "type": "PointSelector",
        "x": 1234,
        "y": 5678
      },
      "creator": {...},
      "created": "2025-01-15T..."
    }
  ],
  "creator": {...},
  "created": "2025-01-15T..."
}
```
