# Linking Annotation Feature Implementation

This document describes the implementation of the linking annotation feature for the Necessary Reunions project. The feature allows users to:

1. **Link annotations together** in reading order
2. **Add geolocation information** using external APIs
3. **Select points** on images for highlighting

## Architecture Overview

### Core Components

1. **LinkingAnnotationWidget** (`components/LinkingAnnotationWidget.tsx`)
   - Main UI component for creating and editing linking annotations
   - Provides tabbed interface for the three linking features
   - Integrates with the AnnotationList component

2. **GeoTagMap** (`components/GeoTagMap.tsx`)
   - Leaflet-based map component for visualizing selected locations
   - Shows markers for geotagged locations
   - Dynamically loaded to avoid SSR issues

3. **LinkingModeContext** (`components/LinkingModeContext.tsx`)
   - React context for managing linking state across components
   - Handles point selection mode and annotation linking state

4. **useLinkingAnnotations** (`hooks/use-linking-annotations.ts`)
   - Custom hook for managing linking annotations
   - Provides CRUD operations for linking annotations
   - Fetches and caches linking annotation data

### API Routes

1. **`/api/annotations/linking`** - GET/POST linking annotations
2. **`/api/annotations/linking/[id]`** - PUT/DELETE specific linking annotations

### Enhanced Components

1. **AnnotationList** - Extended to show linking widgets and status indicators
2. **ImageViewer** - Added point selection functionality and reading order visualization
3. **ManifestViewer** - Passes canvas ID to enable linking functionality

## Features

### 1. Annotation Linking

**Purpose**: Connect annotations together in reading order.

**Implementation**:
- Click annotations in the ImageViewer to add them to the link
- Drag and drop to reorder linked annotations
- Visual reading order numbers (1, 2, 3, etc.) displayed on image overlays
- Orange highlighting for linked annotations in the image viewer
- Link icon indicator in the annotation list

**Data Structure**:
```json
{
  "target": [
    "annotation-id-1",
    "annotation-id-2", 
    "annotation-id-3"
  ]
}
```

### 2. Geotagging

**Purpose**: Add geographical location information from external sources.

**Implementation**:
- Search using Nominatim API (OpenStreetMap)
- Interactive map showing selected location
- Support for multiple geocoding services (extensible)
- Stores both identifying and geotagging bodies

**Data Structure**:
```json
{
  "body": [
    {
      "type": "SpecificResource",
      "purpose": "identifying",
      "source": {
        "id": "https://data.globalise.huygens.knaw.nl/place/123",
        "type": "Place",
        "label": "Amsterdam",
        "defined_by": "POINT(4.9036 52.3676)"
      }
    },
    {
      "type": "SpecificResource", 
      "purpose": "geotagging",
      "source": {
        "id": "https://data.globalise.huygens.knaw.nl/place/123",
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [4.9036, 52.3676]
        }
      }
    }
  ]
}
```

### 3. Point Selection

**Purpose**: Mark specific points on the image.

**Implementation**:
- Click mode for selecting points on the image
- Converts screen coordinates to image coordinates
- Visual feedback with crosshair cursor
- Point coordinates displayed in the interface

**Data Structure**:
```json
{
  "body": [
    {
      "type": "SpecificResource",
      "purpose": "highlighting", 
      "selector": {
        "type": "PointSelector",
        "x": 123,
        "y": 456
      }
    }
  ]
}
```

## User Interface

### Annotation List Integration

Each annotation in the AnnotationList now includes:

1. **Status Icons**:
   - Link icon: Annotation is part of a linking annotation
   - Map pin icon: Has geolocation data
   - Plus icon: Has selected point

2. **Expandable Linking Widget**:
   - Chevron button to expand/collapse
   - Save button (enabled when changes are made)
   - Three-tab interface for different linking features

### Visual Indicators

1. **In Image Viewer**:
   - Orange highlighting for linked annotations
   - Reading order numbers (1, 2, 3, etc.) in orange badges
   - Special cursor for point selection mode

2. **In Annotation List**:
   - Status icons showing linking features
   - Expandable sections for editing
   - Color-coded indicators

## Technical Implementation

### Type Definitions

New TypeScript interfaces in `lib/types.ts`:

```typescript
interface LinkingAnnotation {
  id: string;
  type: string;
  motivation: 'linking';
  target: string[]; // Array of annotation IDs
  body: LinkingBody[];
  creator?: Creator;
  created?: string;
  modified?: string;
}

interface LinkingBody {
  type: 'SpecificResource';
  purpose: 'identifying' | 'geotagging' | 'highlighting';
  source?: GeoLocation | CanvasLocation;
  selector?: PointSelector;
  creator?: Creator;
  created?: string;
}
```

### API Integration

The system integrates with:

1. **AnnoRepo** - For storing and retrieving linking annotations
2. **Nominatim API** - For geocoding location searches
3. **IIIF Image API** - For coordinate transformation

### State Management

1. **Local State** - Component-level state for UI interactions
2. **React Context** - Cross-component state for linking mode
3. **Custom Hooks** - Data fetching and caching

## Usage Workflow

### Creating a Linking Annotation

1. **Select an annotation** in the annotation list
2. **Expand the annotation** to show details
3. **Click the chevron** on the "Linking Annotation" section
4. **Use the tabbed interface**:
   - **Link tab**: Click annotations in the image to add them
   - **Geotag tab**: Search for locations and view on map
   - **Point tab**: Click on the image to select a point
5. **Save the linking annotation**

### Editing a Linking Annotation

1. **Expand an annotation** with existing linking data
2. **Modify the links, geotag, or point** as needed
3. **Save changes** (automatically updates the existing linking annotation)

### Viewing Linked Annotations

1. **Look for status icons** in the annotation list
2. **Check the image viewer** for reading order numbers
3. **Expand annotations** to see detailed linking information

## Future Enhancements

1. **Additional Geocoding APIs**:
   - GLOBALISE Django API
   - Grote Atlas API

2. **Enhanced Visual Feedback**:
   - Line connections between linked annotations
   - Hover effects for reading order

3. **Batch Operations**:
   - Select multiple annotations at once
   - Bulk geotagging operations

4. **Export Features**:
   - Export linked annotation sets
   - Generate reading order reports

## Development Notes

### Dependencies Added

- No new dependencies were required
- Uses existing Leaflet integration for maps
- Leverages existing UI component library

### Performance Considerations

- Dynamic loading of map component to avoid SSR issues
- Efficient state management to prevent unnecessary re-renders
- Caching of linking annotation data

### Browser Compatibility

- Modern browsers with ES6+ support
- Responsive design for mobile and desktop
- Accessible keyboard navigation

## Error Handling

1. **API Failures**: Graceful degradation with user feedback
2. **Network Issues**: Retry mechanisms for critical operations
3. **Validation**: Client-side validation before API calls
4. **User Feedback**: Toast notifications for success/error states

This implementation provides a comprehensive linking annotation system that enhances the annotation workflow while maintaining simplicity and performance.
