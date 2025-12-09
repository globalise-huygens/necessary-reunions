# SVG Annotation Loading Investigation

## Problem Statement

SVG annotations (iconography) are not rendering in production (Netlify) but may work locally. Browser shows OpenSeadragon "Ignoring tile loaded before reset" warnings.

## Diagnostic Implementation

### 1. Added Comprehensive Logging

**In `ImageViewer.tsx`:**

- Initial `addOverlays` call tracking with timestamp
- Counters for different skip reasons: `skippedFiltered`, `skippedNoSvg`, `skippedBadPolygon`, `successfulOverlays`
- Logging when annotations lack SVG selectors (shows annotation ID, motivation, selector type)
- Logging when polygon regex fails (shows SVG value preview)
- Final summary log showing all counts and `viewer.world.getItemCount()`

**OpenSeadragon event logging:**

- `open` event: logs world status, item count, annotations length
- `tile-loaded` event: logs world readiness during tile loading

**useEffect tracking:**

- Three different useEffect hooks that call `addOverlays` now log when triggered
- Shows which dependency changes trigger re-renders
- Tracks race conditions between multiple render triggers

### 2. Added API-Level Logging

**In `app/api/annotations/external/route.ts`:**

- Logs total fetched items and SVG annotation count
- Samples first SVG annotation structure
- Shows selector type (array vs single)

### 3. Created Diagnostic Script

**`scripts/debug-svg-annotations.ts`:**

- Fetches annotations directly from AnnoRepo production
- Analyzes SVG selector structure and polygon validity
- Compares data format expectations with reality
- Run with: `pnpm run debug:svg`

**Results from diagnostic script:**

- ✅ AnnoRepo data is valid: 100/100 annotations have proper SVG selectors with polygons
- ✅ Polygon regex pattern matches production data
- ✅ No data format issues detected

## Testing Instructions

### Local Testing

1. Start dev server: `pnpm dev`
2. Open browser to `http://localhost:3000/viewer`
3. Open browser console
4. Navigate to a canvas with iconography annotations
5. Switch to "Annotation View" tab
6. Look for `[SVG Debug]` logs in console

### Key Logs to Check

**Successful rendering should show:**

```
[SVG Debug] addOverlays called { totalAnnotations: 100, ... }
[SVG Debug] OpenSeadragon open event { hasWorld: true, itemCount: 1, ... }
[SVG Debug] addOverlays completed { successfulOverlays: 100, skippedNoSvg: 0, ... }
```

**Problem indicators:**

```
[SVG Debug] No SVG selector found for annotation { ... }
[SVG Debug] Polygon regex failed for annotation { ... }
[SVG Debug] Cannot add point overlay: viewer world not ready
```

### Production Testing

1. Deploy this branch to Netlify preview
2. Open production site with browser console
3. Compare logs between local and production
4. Check for timing differences in `viewer.world.getItemCount()`

## Potential Issues to Investigate

### 1. Timing/Race Conditions ⏱️

**Hypothesis:** In production (slower network), `viewer.world` isn't ready when `addOverlays` is called.

**Evidence to look for:**

- `viewer.world.getItemCount()` returning 0 in production
- OpenSeadragon "reset" warnings coinciding with `addOverlays` calls
- Multiple useEffect hooks firing in rapid succession

**Mitigation:** Add retry logic with exponential backoff when world not ready

### 2. OpenSeadragon Version/Bundling 📦

**Hypothesis:** Production webpack bundling affects OpenSeadragon initialization timing.

**Evidence to look for:**

- Different timing of `open` vs `tile-loaded` events
- Differences in `viewer.world` availability

**Mitigation:** Check OpenSeadragon CDN version consistency

### 3. Filter State Initialization 🎛️

**Hypothesis:** Filters default to wrong state in production.

**Status:** ✅ RULED OUT - Filters default to `true` in ManifestViewer

### 4. Data Format Differences 📋

**Hypothesis:** AnnoRepo returns different SVG format in production.

**Status:** ✅ RULED OUT - Diagnostic script confirms data consistency

### 5. Multiple Render Triggers 🔄

**Hypothesis:** Four different useEffect hooks calling `addOverlays` create race conditions.

**Evidence to look for:**

- Rapid-fire `addOverlays called` logs
- Overlays being cleared before completion
- Viewport "reset" between render calls

**Mitigation:** Consolidate useEffect hooks or add debouncing

## Next Steps Based on Logs

### If `skippedNoSvg > 0`:

Check the logged annotation details. Verify selector structure matches expectations.

### If `skippedBadPolygon > 0`:

Check the SVG preview in logs. Adjust regex if SVG format differs.

### If `successfulOverlays = 0` but no skip logs:

Check `viewer.world.getItemCount()` - likely timing issue. World not ready.

### If logs show multiple rapid `addOverlays` calls:

Race condition from multiple useEffect hooks. Need consolidation or debouncing.

### If production shows different useEffect trigger patterns:

Network timing affects React render cycles. Need better synchronization.

## Deployment Strategy

1. **Deploy with logging to staging/preview**
2. **Test on production URLs** with real external services
3. **Analyze production console logs** to identify issue
4. **Implement fix** based on log evidence
5. **Add timing safeguards** if world readiness is the issue
6. **Remove/reduce logging** after fix confirmed

## Rollback Plan

If diagnostic logging impacts performance:

- Logs only fire during annotation rendering (not continuous)
- Can be disabled with search/replace: `console.log('[SVG Debug]'` → `// console.log('[SVG Debug]'`
- Or wrap in: `if (process.env.NODE_ENV === 'development')`

## Git Branch

Branch: `fix-annotation-loading`
Commit: "Add SVG annotation diagnostic logging"

Files modified:

- `components/viewer/ImageViewer.tsx` - comprehensive logging
- `app/api/annotations/external/route.ts` - API logging
- `scripts/debug-svg-annotations.ts` - diagnostic tool
- `package.json` - added `debug:svg` script
