# Linking Annotation Update Implementation

## Problem Statement

Users couldn't selectively delete geotag or point selection data from linking annotations. The only option was to delete the entire linking annotation, which removed all targets, geotag, and point data together.

## Solution Implemented

Added selective delete functionality for body purposes (geotag and point selection) while preserving other data.

### Changes Made

#### 1. New Function: `handleDeleteBodyPurpose`

**Location:** `components/viewer/LinkingAnnotationWidget.tsx` (line ~550)

**Purpose:** Selectively remove geotag or point selection from linking annotation body

**How it works:**

1. Confirms user intent with dialog
2. Fetches current linking annotation body
3. Filters out the specified purpose(s):
   - For `geotagging`: removes both `identifying` and `geotagging` purposes
   - For `selecting`: removes `selecting` purpose only
4. Sends PUT request with filtered body to update annotation
5. Invalidates caches and refreshes data
6. Shows success toast

**Key Code:**

```typescript
const handleDeleteBodyPurpose = async (purpose: 'geotagging' | 'selecting') => {
  if (!existingLinkingData.linking) return;

  const confirmed = window.confirm(
    `Are you sure you want to remove the ${purpose === 'geotagging' ? 'geotag' : 'point selection'}...`,
  );

  if (!confirmed) return;

  const currentBody = Array.isArray(existingLinkingData.linking.body)
    ? existingLinkingData.linking.body
    : [existingLinkingData.linking.body];

  // Remove purposes
  const purposesToRemove =
    purpose === 'geotagging' ? ['identifying', 'geotagging'] : ['selecting'];

  const filteredBody = currentBody.filter(
    (b: any) => !purposesToRemove.includes(b.purpose),
  );

  // Update annotation
  const updatedAnnotation = {
    ...existingLinkingData.linking,
    body: filteredBody,
    modified: new Date().toISOString(),
  };

  // PUT to API
  await fetch(`/api/annotations/linking/${encodedId}`, {
    method: 'PUT',
    body: JSON.stringify(updatedAnnotation),
  });
};
```

#### 2. UI Updates

**Geotag Display Section** (line ~1010)

Added:

- Display geotag information from body with `purpose: 'geotagging'`
- Shows location name, coordinates
- Delete button that calls `handleDeleteBodyPurpose('geotagging')`
- Tooltip: "Remove geotag only (keeps links and point)"

**Point Selection Display Section** (line ~1040)

Updated:

- Added delete button to existing point display
- Calls `handleDeleteBodyPurpose('selecting')`
- Tooltip: "Remove point selection only (keeps other data)"

**Visual Design:**

- Geotag section: Secondary color scheme (green)
- Point section: Accent color scheme (amber)
- Delete buttons: Destructive styling (red)
- Consistent layout with flex justify-between

## Testing Scenarios

### Scenario 1: Delete Geotag from Linking with Geotag + Point

**Initial state:**

```json
{
  "target": ["anno-1", "anno-2"],
  "body": [
    { "purpose": "identifying", "source": {...} },
    { "purpose": "geotagging", "source": {...} },
    { "purpose": "selecting", "selector": {"x": 100, "y": 200} }
  ]
}
```

**Action:** Click delete button on geotag section

**Expected result:**

```json
{
  "target": ["anno-1", "anno-2"],
  "body": [{ "purpose": "selecting", "selector": { "x": 100, "y": 200 } }]
}
```

✅ Point selection preserved
✅ Targets preserved
✅ Only geotag data removed

### Scenario 2: Delete Point from Linking with Geotag + Point

**Initial state:** Same as Scenario 1

**Action:** Click delete button on point section

**Expected result:**

```json
{
  "target": ["anno-1", "anno-2"],
  "body": [
    { "purpose": "identifying", "source": {...} },
    { "purpose": "geotagging", "source": {...} }
  ]
}
```

✅ Geotag preserved
✅ Targets preserved
✅ Only point selection removed

### Scenario 3: Delete Point from Point-Only Linking

**Initial state:**

```json
{
  "target": ["anno-1"],
  "body": [{ "purpose": "selecting", "selector": { "x": 100, "y": 200 } }]
}
```

**Action:** Click delete button on point section

**Expected result:**

```json
{
  "target": ["anno-1"],
  "body": []
}
```

✅ Empty body array (annotation exists but has no enhancement data)
⚠️ May want to consider deleting entire annotation if body becomes empty

### Scenario 4: Re-add After Delete

**Steps:**

1. Create linking with geotag
2. Add point → Both present
3. Delete geotag → Only point remains
4. Add new geotag → Both present again

✅ Should work - uses existing save logic

## API Flow

### Update Request

```
PUT /api/annotations/linking/[id]
Authorization: Bearer {token}
Content-Type: application/json

{
  "id": "https://annorepo.globalise.huygens.knaw.nl/...",
  "type": "Annotation",
  "motivation": "linking",
  "target": ["anno-1", "anno-2"],
  "body": [ /* filtered array */ ],
  "modified": "2025-11-03T..."
}
```

### API Route Behavior

1. Validates session
2. Checks for conflicts (other annotations using same targets)
3. Calls `updateAnnotation()` from `lib/viewer/annoRepo.ts`
4. AnnoRepo replaces entire annotation with new version
5. Returns updated annotation

## Edge Cases Handled

1. **Empty body after deletion:** Annotation persists with empty body array
2. **Confirmation dialog:** Prevents accidental deletion
3. **Loading state:** Disable button during save
4. **Error handling:** Shows error toast if update fails
5. **Cache invalidation:** Clears both canvas and global caches
6. **UI refresh:** Fetches fresh data after successful delete

## Future Improvements

### 1. Delete Entire Annotation if Body Becomes Empty

```typescript
const filteredBody = currentBody.filter(...);

if (filteredBody.length === 0 && Array.isArray(existingLinkingData.linking.target) && existingLinkingData.linking.target.length === 1) {
  // Only 1 target and no body data left - delete entire annotation
  await deleteLinkingRelationship(existingLinkingData.linking.id, 'linking');
  return;
}
```

**Reasoning:** A linking annotation with 1 target and no body data has no meaningful content

### 2. Optimistic UI Updates

Currently waits for API response before updating UI. Could:

- Immediately hide deleted section
- Rollback if API call fails
- Show loading spinner on deleted section

### 3. Undo Functionality

Add "Undo" button in success toast:

```typescript
toast({
  title: 'Geotag Removed',
  action: (
    <Button onClick={() => restoreGeotag(savedGeotag)}>
      Undo
    </Button>
  )
});
```

### 4. Batch Operations

Allow selecting multiple purposes to delete at once:

```typescript
handleDeleteBodyPurposes(['geotagging', 'selecting']);
```

## Known Limitations

1. **No undo:** Deletion is immediate and permanent (requires fetching from AnnoRepo history)
2. **No validation:** Doesn't check if deleting body data makes annotation meaningless
3. **No audit trail:** No record of who deleted what data (AnnoRepo keeps modified date)
4. **Confirmation dialog:** Basic browser confirm (could use custom modal)

## Integration Points

### Components that need updates:

- ✅ `LinkingAnnotationWidget.tsx` - Updated with delete buttons
- ⚠️ `AnnotationList.tsx` - May need to handle empty body case
- ⚠️ `ImageViewer.tsx` - Point indicators may need refresh after delete
- ⚠️ `GeoTagMap.tsx` - May need to clear selection after delete

### Hooks that may need attention:

- ✅ `use-linking-annotations.ts` - Cache invalidation works
- ✅ `use-global-linking-annotations.ts` - Cache invalidation works
- ⚠️ Point indicator refresh logic in PointSelector.tsx

## Documentation Updates Needed

1. User guide: How to selectively remove data
2. Developer docs: Body purpose management patterns
3. API docs: PUT endpoint body filtering behavior
4. Architecture docs: Update consolidation logic explanation

## Commit Message

```
Fix: Add selective delete for geotag and point

Users can now remove geotag or point selection from linking
annotations without deleting the entire annotation or other data.

Changes:
- Add handleDeleteBodyPurpose() function
- Add delete buttons to geotag and point sections
- Filter body array by purpose before update
- Preserve targets and other body items
- Show confirmation dialog before deletion
- Invalidate caches and refresh after successful delete

Resolves issue where only option was to delete entire linking
annotation, losing all targets, geotag, and point data together.
```

## Testing Checklist

- [ ] Delete geotag from linking with geotag + point
- [ ] Delete point from linking with geotag + point
- [ ] Delete geotag from geotag-only linking
- [ ] Delete point from point-only linking
- [ ] Re-add geotag after deleting it
- [ ] Re-add point after deleting it
- [ ] Cancel confirmation dialog
- [ ] Test with single target linking
- [ ] Test with multiple target linking
- [ ] Verify point indicators update after deletion
- [ ] Verify cache invalidation works
- [ ] Test error handling (network failure)
- [ ] Verify toast messages appear
- [ ] Test rapid clicks on delete button
- [ ] Verify disabled state during save
- [ ] Check browser console for errors
