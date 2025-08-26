# SVG Annotation Human Editing Enhancement

## Overview

This enhancement ensures that when users edit the outline (SVG shape) of annotations, these edits are properly marked as human-created modifications. Previously, editing the polygon outline of an annotation wouldn't change its classification from AI-generated to human-edited.

## Changes Made

### 1. DrawingTools.tsx - Enhanced `finishEditing` Function

- **Before**: Only iconography annotations were marked with a `creator` field when their outline was edited
- **After**: All annotations (both text and iconography) are marked with a `creator` field when their SVG outline is edited
- **Impact**: Any time a user modifies the polygon outline of an annotation, it becomes classified as human-edited

### 2. Updated `isHumanCreated` Logic Across Components

Updated the `isHumanCreated` function in three components to be consistent:
- `components/viewer/ImageViewer.tsx`
- `components/viewer/AnnotationList.tsx` 
- `components/viewer/FastAnnotationItem.tsx`

**Enhanced Logic**:
```typescript
const isHumanCreated = (annotation: Annotation) => {
  // Check if annotation has a creator at the top level (human-edited outline or human-created)
  if (annotation.creator) {
    return true;
  }

  // Check if any textual bodies were created/edited by humans
  const bodies = getBodies(annotation);
  return bodies.some((body) => body.creator && !body.generator);
};
```

### 3. Added Debug Logging

Added console logging in the `finishEditing` function to help track when annotations are being marked as human-edited:

```typescript
console.log('SVG Annotation Edit:', {
  annotationId: editingAnnotation.id,
  motivation: editingAnnotation.motivation,
  hadCreatorBefore: !!editingAnnotation.creator,
  hasCreatorAfter: !!updatedAnnotation.creator,
  creatorAdded: !editingAnnotation.creator && !!updatedAnnotation.creator,
  userSession: !!session?.user,
});
```

## User Experience Impact

### Before
- AI-generated text annotations remained classified as "AI" even after users edited their outlines
- Only text content changes would mark an annotation as human-edited
- Inconsistent behavior between text and iconography annotations

### After
- Any outline/shape editing immediately marks the annotation as human-created
- Consistent behavior across all annotation types
- Visual indicators (human/AI badges) properly reflect user modifications
- Better tracking of human vs. AI contributions

## Technical Details

### When Annotations Are Marked as Human-Created

1. **Text Content Editing**: When users modify the text content of annotations
2. **SVG Outline Editing**: When users modify the polygon shape/outline (NEW)
3. **Manual Creation**: When users create new annotations from scratch

### Creator Field Structure

When marking an annotation as human-edited, the following creator object is added:

```typescript
{
  id: `https://orcid.org/${userId}`,
  type: 'Person',
  label: userDisplayName
}
```

### Backward Compatibility

- Existing annotations are not affected
- The change only applies to future edits
- No database migration required
- All existing logic for detecting human vs. AI annotations remains functional

## Testing

To test this feature:

1. Navigate to the annotation viewer
2. Select an AI-generated annotation (should show as "AI" in filters/badges)
3. Click the edit button (square with dashed lines + pen icon)
4. Modify the polygon outline by dragging points, adding points, or removing points
5. Save the changes (green checkmark)
6. Verify the annotation now shows as "Human" in the interface
7. Check the browser console for the debug log entry

## Files Modified

- `components/viewer/DrawingTools.tsx` - Enhanced SVG editing logic
- `components/viewer/ImageViewer.tsx` - Updated isHumanCreated function
- `components/viewer/AnnotationList.tsx` - Updated isHumanCreated function  
- `components/viewer/FastAnnotationItem.tsx` - Updated isHumanCreated function

## Future Considerations

- Could extend this pattern to other types of annotation modifications
- May want to track different types of human edits (outline vs. content vs. metadata)
- Could add more granular logging for analytics
