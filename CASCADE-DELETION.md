# Cascade Deletion for Linking Annotations

## Problem

When a textspotting or iconography annotation is deleted, any linking annotations that reference it in their `target` array become **orphaned** – they point to annotations that no longer exist.

This violates **referential integrity** and creates:

- Broken links in the UI
- Failed fetches when trying to resolve targets
- Confusing user experience
- Data consistency issues

## Solution: Automatic Cascade Deletion

When an annotation is deleted (single or bulk), the system automatically finds and updates all linking annotations that reference it.

### Implementation

**Location:** `lib/viewer/cascade-delete-linking.ts`

**Triggers:**

- `DELETE /api/annotations/[id]` - Single annotation deletion
- `POST /api/annotations/bulk-delete` - Multiple annotation deletion

**Process:**

1. **Find affected linking annotations**
   - Query AnnoRepo for all linking annotations
   - Filter those with deleted annotation(s) in their target array

2. **Remove deleted targets**
   - Filter out the deleted annotation URL(s) from target arrays
   - Calculate remaining valid targets

3. **Validate and act**
   - **0 targets remaining** → Delete the linking annotation
   - **1 target + no geotag/point** → Delete the linking annotation (invalid)
   - **1 target + geotag/point** → Update the linking annotation (valid)
   - **2+ targets** → Update the linking annotation (valid)

### Deletion Rules

| Remaining Targets | Has Geotag/Point | Action | Reason                                          |
| ----------------- | ---------------- | ------ | ----------------------------------------------- |
| 0                 | Any              | Delete | No targets = no linking                         |
| 1                 | No               | Delete | Linking requires ≥2 targets OR enhancement data |
| 1                 | Yes              | Update | Valid: 1 target + enhancement is allowed        |
| 2+                | Any              | Update | Valid: multiple targets = valid linking         |

### Code Example

```typescript
// When deleting annotation ID "abc123"
const cascadeResult = await cascadeDeleteFromLinking(
  ['https://annorepo.../abc123'],
  authToken,
);

// Returns:
// {
//   affectedLinking: 3,     // 3 linking annotations referenced this
//   updated: 2,             // 2 were updated (still have valid targets)
//   deleted: 1,             // 1 was deleted (became invalid)
//   errors: []              // No errors
// }
```

### Error Handling

Cascade deletion failures **do not block** the primary deletion:

- If cascade fails, the main annotation is still deleted
- Errors are logged but don't throw
- Client sees successful deletion even if cascade partially fails
- Orphaned annotations can be detected via `/api/debug/linking?action=orphaned-targets`

## API Integration

### Single Delete

```typescript
// DELETE /api/annotations/[id]

// 1. Delete the main annotation
await fetch(annotationUrl, { method: 'DELETE', ... });

// 2. Cascade to linking annotations
const cascadeResult = await cascadeDeleteFromLinking([annotationUrl], authToken);

// 3. Log results (doesn't affect response)
if (cascadeResult.affectedLinking > 0) {
  console.log(`Updated ${cascadeResult.updated}, deleted ${cascadeResult.deleted}`);
}
```

### Bulk Delete

```typescript
// POST /api/annotations/bulk-delete

// 1. Delete all requested annotations
const results = await Promise.all(ids.map((id) => deleteAnnotation(id)));

// 2. Get successfully deleted IDs
const successfulDeletes = results.filter((r) => r.success).map((r) => r.url);

// 3. Single cascade call for all deletes
if (successfulDeletes.length > 0) {
  await cascadeDeleteFromLinking(successfulDeletes, authToken);
}
```

## Performance Considerations

**Efficient Batch Processing:**

- Single cascade call for bulk deletes (not one per annotation)
- Fetches all linking annotations once
- Updates/deletes in parallel where possible

**Timeout Protection:**

- 10-second timeout for fetching linking annotations
- Graceful degradation if AnnoRepo is slow
- Non-blocking: doesn't delay user feedback

**Logging:**

- Console logs track cascade operations
- Visible in server logs for debugging
- Errors logged but don't throw to client

## Testing Scenarios

### Scenario 1: Delete icon that's part of 4-annotation linking

**Before:**

```json
{
  "id": "linking-1",
  "target": ["icon-a", "icon-b", "text-c", "text-d"],
  "body": []
}
```

**Action:** Delete `icon-b`

**After:**

```json
{
  "id": "linking-1",
  "target": ["icon-a", "text-c", "text-d"],
  "body": []
}
```

**Result:** Linking updated (3 targets remain)

---

### Scenario 2: Delete icon from 2-annotation linking with no geotag

**Before:**

```json
{
  "id": "linking-2",
  "target": ["icon-a", "icon-b"],
  "body": []
}
```

**Action:** Delete `icon-a`

**After:** Linking annotation deleted

**Result:** Only 1 target would remain without geotag/point (invalid)

---

### Scenario 3: Delete icon from 2-annotation linking with geotag

**Before:**

```json
{
  "id": "linking-3",
  "target": ["icon-a", "text-b"],
  "body": [
    {
      "purpose": "geotagging",
      "source": { "type": "Place", "label": "Kerala" }
    }
  ]
}
```

**Action:** Delete `text-b`

**After:**

```json
{
  "id": "linking-3",
  "target": "icon-a",
  "body": [
    {
      "purpose": "geotagging",
      "source": { "type": "Place", "label": "Kerala" }
    }
  ]
}
```

**Result:** Linking updated (1 target + geotag is valid)

---

### Scenario 4: Bulk delete multiple annotations

**Before:**

- Linking-1: `["a", "b", "c"]`
- Linking-2: `["a", "d"]`
- Linking-3: `["b", "e", "f"]`

**Action:** Bulk delete `["a", "b"]`

**After:**

- Linking-1: `["c"]` → Deleted (1 target, no geotag)
- Linking-2: `["d"]` → Deleted (1 target, no geotag)
- Linking-3: `["e", "f"]` → Updated (2 targets remain)

**Result:** 2 linking annotations deleted, 1 updated

## Debugging

### Check for Orphaned Annotations

```bash
GET /api/debug/linking?action=orphaned-targets
```

Returns linking annotations with targets that don't exist.

### Console Logs

Server logs show cascade operations:

```
Cascade deletion: 2 linking annotations updated, 1 deleted
Cascade updated linking annotation https://... (removed 1 target(s))
Cascade deleted linking annotation https://... (0 targets, hasEnhancements: false)
```

## Related Files

- **`lib/viewer/cascade-delete-linking.ts`** - Core cascade logic
- **`app/api/annotations/[id]/route.ts`** - Single delete endpoint
- **`app/api/annotations/bulk-delete/route.ts`** - Bulk delete endpoint
- **`app/api/debug/linking/route.ts`** - Orphan detection for debugging

## Migration Notes

**Existing orphaned annotations** created before this feature was implemented:

- Will not be automatically cleaned up
- Can be detected via debug endpoint
- Can be manually deleted or fixed using the linking widget

**No breaking changes:**

- Delete endpoints maintain same response format
- Cascade happens silently in background
- Errors don't affect deletion success

## Future Enhancements

Potential improvements:

- Periodic cleanup job for orphaned annotations
- Admin UI to view and fix orphans in bulk
- Webhook notifications when cascade operations occur
- Transaction-like behavior with rollback on cascade failure
- Cache invalidation coordination with client state
