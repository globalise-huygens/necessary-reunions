# Critical Fix: Target Preservation in Linking Annotation Updates

## Problem

When updating an existing linking annotation to add/change just the geotag or point (without modifying the linked annotations), the system was **losing all linked targets** except the current annotation.

### Example Bug:

**Before (existing annotation):**

```json
{
  "target": ["anno-1", "anno-2", "anno-3", "anno-4"],
  "body": []
}
```

**User action:** Add geotag to this linking

**After (buggy result):**

```json
{
  "target": ["anno-1"],  // ❌ Lost anno-2, anno-3, anno-4!
  "body": [
    { "purpose": "identifying", ... },
    { "purpose": "geotagging", ... }
  ]
}
```

## Root Cause

In `AnnotationList.tsx` line ~555, the target calculation was:

```typescript
const allTargetIds = Array.from(
  new Set([currentAnnotation.id, ...data.linkedIds]),
);
```

When saving just geotag/point updates (not in linking mode), `data.linkedIds` was `[]`, so:

- `allTargetIds = [currentAnnotation.id]`
- All other targets lost ❌

## Solution

Added logic to **preserve existing targets** when updating body data only:

```typescript
let allTargetIds: string[];
if (existingLinkingAnnotation && data.linkedIds.length === 0) {
  // Preserve existing targets when only updating body data
  const existingTargets = Array.isArray(existingLinkingAnnotation.target)
    ? existingLinkingAnnotation.target
    : [existingLinkingAnnotation.target];
  allTargetIds = existingTargets.filter(
    (t): t is string => typeof t === 'string',
  );
} else {
  // Use provided linkedIds (normal linking flow)
  allTargetIds = Array.from(new Set([currentAnnotation.id, ...data.linkedIds]));
}
```

## Changes Made

### 1. `AnnotationList.tsx` (handleSaveLinkingAnnotation)

**Before:**

```typescript
const allTargetIds = Array.from(
  new Set([currentAnnotation.id, ...data.linkedIds]),
);

let existingLinkingAnnotation = /* fetch logic */;
```

**After:**

```typescript
let existingLinkingAnnotation = /* fetch logic */;

// Determine targets based on whether we're updating or creating
let allTargetIds: string[];
if (existingLinkingAnnotation && data.linkedIds.length === 0) {
  // Preserve existing targets
  allTargetIds = existingLinkingAnnotation.target;
} else {
  // Use new targets
  allTargetIds = [currentAnnotation.id, ...data.linkedIds];
}
```

### 2. `LinkingAnnotationWidget.tsx` (handleSave)

**Fixed validation:** Allow saving with empty `currentlySelectedForLinking` when updating existing annotation:

```typescript
// Before: Would reject updates with 0 selections
if (
  currentlySelectedForLinking.length === 0 &&
  !selectedGeotag &&
  !selectedPoint
) {
  throw new Error('Nothing to save...');
}

// After: Allow if updating existing
if (
  currentlySelectedForLinking.length === 0 &&
  !selectedGeotag &&
  !selectedPoint &&
  !existingAnnotationId // ← Added this check
) {
  throw new Error('Nothing to save...');
}
```

**Fixed success message:** Show correct annotation count when preserving targets:

```typescript
// Before: Always showed currentlySelectedForLinking.length (could be 0)
const description = `Successfully saved link between ${currentlySelectedForLinking.length} annotations...`;

// After: Count existing targets when updating with no new selections
let annotationCount = currentlySelectedForLinking.length;
if (
  isUpdating &&
  annotationCount === 0 &&
  existingLinkingData.linking?.target
) {
  const existingTargets = Array.isArray(existingLinkingData.linking.target)
    ? existingLinkingData.linking.target
    : [existingLinkingData.linking.target];
  annotationCount = existingTargets.length;
}
const description = `Successfully saved link between ${annotationCount} annotations...`;
```

## Testing Scenarios

### Scenario 1: Add Geotag to Existing Multi-Target Linking ✅

**Initial state:**

```json
{
  "target": ["anno-1", "anno-2", "anno-3", "anno-4"],
  "body": []
}
```

**Action:** Select anno-1, click Geotag tab, add location "Thimiri"

**Expected result:**

```json
{
  "target": ["anno-1", "anno-2", "anno-3", "anno-4"],  // ✅ All preserved
  "body": [
    { "purpose": "identifying", "source": {...} },
    { "purpose": "geotagging", "source": {...} }
  ]
}
```

**Toast message:** "Successfully updated link between 4 annotations with location: Thimiri"

### Scenario 2: Add Point to Existing Linking with Geotag ✅

**Initial state:**

```json
{
  "target": ["anno-1", "anno-2"],
  "body": [
    { "purpose": "identifying", ... },
    { "purpose": "geotagging", ... }
  ]
}
```

**Action:** Add point selection

**Expected result:**

```json
{
  "target": ["anno-1", "anno-2"],  // ✅ Preserved
  "body": [
    { "purpose": "identifying", ... },
    { "purpose": "geotagging", ... },
    { "purpose": "selecting", "selector": {...} }  // ✅ Added
  ]
}
```

### Scenario 3: Update Targets via Linking Mode ✅

**Initial state:**

```json
{
  "target": ["anno-1", "anno-2"],
  "body": [...]
}
```

**Action:** Enable linking mode, select anno-3, save

**Expected result:**

```json
{
  "target": ["anno-1", "anno-2", "anno-3"],  // ✅ anno-3 added
  "body": [...]  // ✅ Body preserved
}
```

**This still works because `data.linkedIds.length > 0`**

## Debug Events

Added debug event for transparency:

```typescript
emitDebugEvent('info', 'Preserving Existing Targets', {
  existingTargets: allTargetIds,
  reason: 'No new linkedIds provided, updating body data only',
});
```

## Validation Logic

| Scenario                      | currentlySelectedForLinking | existingAnnotationId | selectedGeotag/Point | Result                       |
| ----------------------------- | --------------------------- | -------------------- | -------------------- | ---------------------------- |
| New linking, no data          | 0                           | null                 | false                | ❌ Error: "Nothing to save"  |
| New linking, 1 anno, no data  | 1                           | null                 | false                | ❌ Error: "Need at least 2"  |
| New linking, 2+ annos         | 2+                          | null                 | false                | ✅ Create                    |
| Update existing, add geotag   | 0                           | exists               | true                 | ✅ Update (preserve targets) |
| Update existing, add point    | 0                           | exists               | true                 | ✅ Update (preserve targets) |
| Update existing, change links | 2+                          | exists               | false                | ✅ Update (use new targets)  |

## Commit Message

```
Fix: Preserve targets when updating linking body data

Critical bug fix: When updating an existing linking annotation to add
or change geotag/point selection without modifying the linked annotations,
the system was losing all targets except the current annotation.

Changes:
- Move existingLinkingAnnotation fetch before target calculation
- Preserve existing targets when data.linkedIds is empty
- Update validation to allow empty selections when updating
- Fix success message to show correct annotation count
- Add debug event for target preservation transparency

Fixes issue where adding geotag to 4-annotation linking resulted
in only 1 target remaining.
```

## Impact

**Before this fix:**

- ❌ Users couldn't safely add geotag/point to existing multi-annotation links
- ❌ Success message showed "0 annotations"
- ❌ Data loss on every body-only update

**After this fix:**

- ✅ Targets preserved when updating body data only
- ✅ Correct success message with proper count
- ✅ Safe to add/update/delete geotag and point on existing links
- ✅ Normal linking mode still works as before

## Related Files

- `components/viewer/AnnotationList.tsx` - Target preservation logic
- `components/viewer/LinkingAnnotationWidget.tsx` - Validation and messaging
- `hooks/use-linking-annotations.ts` - Update/create operations
- `app/api/annotations/linking/[id]/route.ts` - PUT endpoint

## Build Status

✅ Build succeeds with no errors
✅ No TypeScript issues
✅ No ESLint issues
