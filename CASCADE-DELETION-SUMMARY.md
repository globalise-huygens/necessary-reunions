# Cascade Deletion Implementation Summary

## Issue Identified

**User Question:** "What about if I delete one of the linked textspotting or iconography annotations? How are we making sure that the linking annotation gets updated?"

**Critical Finding:** The system had **NO cascade deletion logic**. When a textspotting or iconography annotation was deleted, linking annotations that referenced it became orphaned with broken targets.

## Solution Implemented

Added automatic cascade deletion that maintains referential integrity when annotations are deleted.

### Files Created

**`lib/viewer/cascade-delete-linking.ts`** - Core cascade logic

- `cascadeDeleteFromLinking()` - Main function
- `fetchAllLinkingAnnotations()` - Query AnnoRepo for linking annotations
- `hasEnhancementData()` - Check for geotag/point data
- `updateLinkingAnnotation()` - Update annotation in AnnoRepo
- `deleteLinkingAnnotation()` - Delete annotation in AnnoRepo

### Files Modified

**`app/api/annotations/[id]/route.ts`**

- Added import for `cascadeDeleteFromLinking`
- After successful deletion, triggers cascade operation
- Logs results but doesn't fail on cascade errors

**`app/api/annotations/bulk-delete/route.ts`**

- Added import for `cascadeDeleteFromLinking`
- After successful bulk deletions, triggers single cascade operation
- Batches all deleted IDs for efficient processing

### Documentation

**`CASCADE-DELETION.md`** - Comprehensive guide including:

- Problem description
- Solution architecture
- Deletion rules table
- Code examples
- Testing scenarios (4 detailed examples)
- Debugging instructions
- API integration details
- Performance considerations

## How It Works

### Deletion Rules

| Remaining Targets | Has Geotag/Point | Action | Reason                                     |
| ----------------- | ---------------- | ------ | ------------------------------------------ |
| 0                 | Any              | Delete | No targets = no linking                    |
| 1                 | No               | Delete | Linking requires ≥2 targets OR enhancement |
| 1                 | Yes              | Update | Valid: 1 target + enhancement allowed      |
| 2+                | Any              | Update | Valid: multiple targets = valid linking    |

### Process Flow

1. **Annotation deleted** (single or bulk)
2. **Fetch all linking annotations** from AnnoRepo
3. **Find affected** - Filter linking annotations with deleted target(s)
4. **Remove deleted targets** from target arrays
5. **Validate remaining targets**:
   - Valid → Update annotation
   - Invalid → Delete annotation
6. **Log results** (doesn't affect deletion success)

### Example: Deleting from 4-annotation linking

**Before:**

```json
{
  "id": "linking-1",
  "target": ["icon-a", "icon-b", "text-c", "text-d"]
}
```

**Delete `icon-b`**

**After:**

```json
{
  "id": "linking-1",
  "target": ["icon-a", "text-c", "text-d"]
}
```

**Result:** Linking annotation updated with 3 targets

### Example: Deleting from 2-annotation linking (no geotag)

**Before:**

```json
{
  "id": "linking-2",
  "target": ["icon-a", "icon-b"]
}
```

**Delete `icon-a`**

**After:** Linking annotation deleted

**Result:** Only 1 target would remain without enhancement data (invalid)

## Key Design Decisions

### 1. Non-blocking Cascade

- Cascade failures don't block the main deletion
- Primary annotation is always deleted first
- Cascade errors are logged but don't throw to client
- **Rationale:** User's intent to delete is fulfilled even if cleanup partially fails

### 2. Validation-based Deletion

- Uses same validation rules as widget
- Maintains consistency with user-facing validation
- Deletes only truly invalid linking annotations
- **Rationale:** Prevents accumulation of invalid data while preserving valid configurations

### 3. Batch Processing for Performance

- Single cascade call for bulk deletes
- Fetches all linking annotations once
- Parallel updates/deletes where possible
- **Rationale:** Efficient handling of large bulk operations

### 4. Timeout Protection

- 10-second timeout for fetching linking annotations
- Graceful degradation on slow responses
- Empty array fallback on timeout
- **Rationale:** Consistent with external service resilience patterns

## Testing Recommendations

### Manual Testing Scenarios

1. **Single deletion from multi-target linking**
   - Create linking with 4 annotations
   - Delete one annotation
   - Verify linking updated with 3 targets

2. **Deletion that invalidates linking**
   - Create linking with 2 annotations, no geotag
   - Delete one annotation
   - Verify linking annotation is deleted

3. **Deletion preserving valid linking**
   - Create linking with 2 annotations + geotag
   - Delete one annotation
   - Verify linking updated with 1 target + geotag

4. **Bulk deletion affecting multiple linkings**
   - Create 3 linking annotations referencing same annotations
   - Bulk delete 2 annotations
   - Verify all 3 linkings updated/deleted correctly

### Debug Endpoint Testing

```bash
# Check for orphaned annotations (pre-existing or cascade failures)
curl '/api/debug/linking?action=orphaned-targets'
```

Expected response:

```json
{
  "orphanedAnalysis": {
    "totalLinkingAnnotations": 10,
    "orphanedLinkingAnnotations": 0,
    "details": []
  }
}
```

## Maintenance Notes

### Pre-existing Orphaned Annotations

Annotations orphaned **before** this feature:

- Will not be automatically cleaned up
- Can be detected via `/api/debug/linking?action=orphaned-targets`
- Can be manually fixed using the linking widget
- Consider one-time cleanup script if many exist

### Monitoring

Server logs will show:

```
Cascade deletion: 2 linking annotations updated, 1 deleted
Cascade updated linking annotation https://... (removed 1 target(s))
Cascade deleted linking annotation https://... (0 targets, hasEnhancements: false)
```

### Performance Impact

- Minimal: Cascade only runs on delete operations
- Single additional API call to fetch linking annotations
- 10-second timeout ensures no indefinite waits
- Batch processing for bulk deletes (not per-annotation)

## Related Issues & Fixes

This cascade deletion complements other recent fixes:

1. **Target preservation during body-only updates** (CRITICAL-FIX-TARGET-PRESERVATION.md)
   - Preserves existing targets when adding geotag/point
   - Now also handles removal of invalid targets on deletion

2. **Selective body purpose deletion** (LINKING-UPDATE-IMPLEMENTATION.md)
   - Allows removing geotag/point without affecting targets
   - Cascade deletion validates if resulting configuration is still valid

3. **Validation for target reduction**
   - Widget validates when reducing annotation count
   - Cascade deletion enforces same rules server-side

## Future Enhancements

Potential improvements:

- Periodic cleanup job for pre-existing orphans
- Admin UI for bulk orphan management
- Webhook notifications for cascade operations
- Transaction-like behavior with rollback capability
- Client-side cache invalidation coordination
- Optimistic UI updates for cascade operations

## Commit Message

```
Add cascade deletion for linking annotations
```

## Files Changed Summary

```
Created:
  lib/viewer/cascade-delete-linking.ts (305 lines)
  CASCADE-DELETION.md (comprehensive documentation)
  CASCADE-DELETION-SUMMARY.md (this file)

Modified:
  app/api/annotations/[id]/route.ts (+19 lines)
  app/api/annotations/bulk-delete/route.ts (+31 lines)
```

## Verification

- ✅ TypeScript compilation successful
- ✅ No lint errors
- ✅ Consistent with existing patterns
- ✅ Error handling follows project guidelines
- ✅ Documentation comprehensive
- ✅ Non-blocking design preserves UX
