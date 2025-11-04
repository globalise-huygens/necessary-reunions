# Linking Annotation Update System Analysis

## Current Update Flow

### Scenario 1: Linking with empty body → Add geotag

**Example Input:**

```json
{
  "id": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/8cfdd388-...",
  "motivation": "linking",
  "target": ["anno-1", "anno-2", "anno-3", "anno-4"],
  "body": []
}
```

**When you add a geotag:**

1. **Frontend (`handleSaveLinkingAnnotation`)** builds payload:
   - Fetches existing linking annotation by ID or target
   - Copies existing body array: `body = [...existingLinkingAnnotation.body]`
   - Filters out old geotag data: `body.filter(b => b.purpose !== 'geotagging' && b.purpose !== 'identifying')`
   - Adds new geotag bodies (identifying + geotagging purposes)
   - Calls `updateLinkingAnnotation()` with full payload

2. **API Route (`PUT /api/annotations/linking/[id]`):**
   - Receives full annotation with updated body
   - Calls `updateAnnotation()` which does a PUT to AnnoRepo
   - **Replaces entire annotation** with new version

**Result:** Works correctly - geotag is added to body array

---

### Scenario 2: Geotag exists → Add point selection

**Example Input:**

```json
{
  "id": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/c987d22f-...",
  "target": ["anno-1"],
  "body": [
    { "purpose": "identifying", "source": {...} },
    { "purpose": "geotagging", "source": {...} }
  ]
}
```

**When you add a point:**

1. **Frontend** builds payload:
   - Copies existing body: `body = [...existingLinkingAnnotation.body]`
   - Filters out old point: `body.filter(b => b.purpose !== 'selecting')`
   - Adds new point body with PointSelector
   - Calls `updateLinkingAnnotation()` with full payload

2. **API Route:**
   - Receives full annotation with 3 body items (identifying, geotagging, selecting)
   - Calls `updateAnnotation()` which replaces entire annotation

**Result:** Works correctly - point is added while preserving geotag

---

### Scenario 3: Geotag + Point exist → Delete geotag only

**Current Problem:** When you try to delete just the geotag:

1. **Frontend Options:**
   - **Option A:** Call delete on linking annotation ID
     - **Problem:** Deletes entire annotation including point selection
   - **Option B:** Update annotation with filtered body
     - Requires explicit "delete geotag" action
     - Frontend must rebuild body without geotag purposes

2. **No dedicated "delete body item" endpoint**
   - Cannot selectively remove just identifying + geotagging bodies
   - Must reconstruct entire annotation

---

## Critical Issues

### 1. **No Granular Body Management**

Current system treats body as atomic - you must always provide the complete body array.

**Missing capabilities:**

- Delete specific body item by purpose
- Patch/merge body items
- Partial updates to body array

### 2. **Frontend Logic Couples All Operations**

`handleSaveLinkingAnnotation()` handles:

- Adding geotag (filters + adds)
- Adding point (filters + adds)
- Updating targets
- No explicit "delete geotag" path

**Current "delete" pattern:**

```typescript
// In LinkingValidation.tsx - deletes ENTIRE annotation
await deleteLinkingRelationship(linkingId, 'linking');
```

### 3. **Consolidation Logic Unclear**

The POST route has complex consolidation logic:

```typescript
// In route.ts POST
async function consolidateWithExisting() {
  // Filters bodies by purpose before adding new ones
  for (const newBodyItem of newBodies) {
    if (newBodyItem.purpose) {
      consolidatedBodies = consolidatedBodies.filter(
        (existing) => existing.purpose !== newBodyItem.purpose,
      );
    }
    consolidatedBodies.push(newBodyItem);
  }
}
```

**Problem:** This logic is in POST (create), but update operations go through PUT route which doesn't have this logic.

---

## Recommended Solutions

### Solution 1: Implement Selective Body Delete (Quick Fix)

Add method to widget to delete specific body purposes:

```typescript
// In LinkingAnnotationWidget.tsx
const handleDeleteBodyPurpose = async (purpose: 'geotagging' | 'selecting') => {
  if (!existingLinkingData.linking) return;

  const currentBody = Array.isArray(existingLinkingData.linking.body)
    ? existingLinkingData.linking.body
    : [existingLinkingData.linking.body];

  // Filter out the purposes to delete
  const purposesToRemove =
    purpose === 'geotagging' ? ['identifying', 'geotagging'] : ['selecting'];

  const filteredBody = currentBody.filter(
    (b) => !purposesToRemove.includes(b.purpose),
  );

  // Update annotation with filtered body
  const updatedAnnotation = {
    ...existingLinkingData.linking,
    body: filteredBody,
    modified: new Date().toISOString(),
  };

  await updateLinkingAnnotation(updatedAnnotation);
  await fetchExistingLinkingData(selectedAnnotationId, true);
};
```

**Usage in UI:**

```tsx
<Button onClick={() => handleDeleteBodyPurpose('geotagging')}>
  Remove Geotag Only
</Button>
```

### Solution 2: Add PATCH Endpoint (Better Architecture)

Create new route `/api/annotations/linking/[id]/body` with operations:

```typescript
// PATCH /api/annotations/linking/[id]/body
{
  "operation": "remove",
  "purposes": ["geotagging", "identifying"]
}

// Or add
{
  "operation": "add",
  "bodies": [
    { "purpose": "geotagging", "source": {...} }
  ]
}
```

**Benefits:**

- Clear intent
- Atomic operations
- Preserves other body items
- Better error handling

### Solution 3: Consolidate Update Logic (Stable Long-term)

Move consolidation logic from POST to shared utility used by both POST and PUT:

```typescript
// In lib/viewer/linking-utils.ts
export function mergeAnnotationBodies(
  existing: AnnotationBody[],
  updates: AnnotationBody[],
  operation: 'replace' | 'merge' | 'remove',
): AnnotationBody[] {
  switch (operation) {
    case 'replace':
      // Remove bodies with same purpose, add new ones
      let result = [...existing];
      for (const update of updates) {
        if (update.purpose) {
          result = result.filter((b) => b.purpose !== update.purpose);
        }
        result.push(update);
      }
      return result;

    case 'remove':
      // Remove bodies matching purposes in updates
      const purposesToRemove = updates.map((u) => u.purpose).filter(Boolean);
      return existing.filter((b) => !purposesToRemove.includes(b.purpose));

    case 'merge':
      // Add if not exists
      const existingPurposes = existing.map((b) => b.purpose);
      const newBodies = updates.filter(
        (u) => !existingPurposes.includes(u.purpose),
      );
      return [...existing, ...newBodies];
  }
}
```

---

## Implementation Priority

### Immediate (Today):

1. Add "Remove Geotag" button with Solution 1
2. Add "Remove Point" button with same pattern
3. Add confirmation dialogs

### Short-term (This Week):

1. Extract consolidation logic to shared utility
2. Use in both POST and PUT routes
3. Add comprehensive tests

### Long-term (Next Sprint):

1. Implement PATCH endpoint for body operations
2. Refactor frontend to use operation-based updates
3. Add optimistic UI updates with rollback

---

## Testing Scenarios

### Test Case 1: Sequential Additions

1. Create linking with 2 annotations (empty body)
2. Add geotag → Verify body has 2 items (identifying, geotagging)
3. Add point → Verify body has 3 items (all preserved)
4. Verify target array unchanged

### Test Case 2: Selective Deletion

1. Create linking with geotag + point (3 body items)
2. Delete geotag only → Verify body has 1 item (selecting)
3. Re-add geotag → Verify body has 3 items again

### Test Case 3: Replacement

1. Create linking with geotag A
2. Update to geotag B → Verify old geotag removed, new added
3. Update to point → Verify geotag + point both present

### Test Case 4: Target Updates

1. Create linking with 2 annotations + geotag
2. Add 3rd annotation to targets → Verify geotag preserved
3. Remove 1 annotation from targets → Verify geotag preserved

---

## Current Behaviour Summary

| Operation                     | Current Method           | Works? | Issue                           |
| ----------------------------- | ------------------------ | ------ | ------------------------------- |
| Add geotag to empty linking   | PUT with full body       | ✅ Yes | None                            |
| Add point to existing linking | PUT with full body       | ✅ Yes | None                            |
| Delete geotag only            | DELETE entire annotation | ❌ No  | Deletes point too               |
| Delete point only             | DELETE entire annotation | ❌ No  | Deletes geotag too              |
| Update geotag value           | PUT with new geotag      | ✅ Yes | Purpose-based replacement works |
| Add annotation to targets     | PUT with new targets     | ✅ Yes | Body preserved by PUT logic     |

---

## Code Locations

### Frontend Update Logic:

- `components/viewer/AnnotationList.tsx` (line 528) - `handleSaveLinkingAnnotation()`
- `components/viewer/LinkingAnnotationWidget.tsx` (line 600) - `handleSave()`
- `hooks/use-linking-annotations.ts` (line 319) - `updateLinkingAnnotation()`

### API Routes:

- `app/api/annotations/linking/route.ts` - POST with consolidation logic
- `app/api/annotations/linking/[id]/route.ts` - PUT and DELETE

### Utilities:

- `lib/viewer/linking-validation.ts` - Validation and delete helpers
- `lib/viewer/annoRepo.ts` - Low-level AnnoRepo operations

---

## Recommendation

**Implement Solution 1 immediately** to unblock users, then refactor with Solution 3 for stability.

The core issue is that the system was designed for "replace entire body" operations, not granular body management. The consolidation logic exists but only in the POST route for handling duplicate prevention, not for intentional partial updates.

Adding explicit "delete geotag" and "delete point" actions with proper body filtering will solve the immediate UX problem while maintaining data integrity.
