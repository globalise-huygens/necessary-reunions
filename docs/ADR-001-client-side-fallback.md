# ADR-001: Client-Side Fallback for AnnoRepo Access

**Date:** 2025-12-10  
**Status:** Accepted  
**Context:** PR #95 - Fix annotation loading

## Decision

Implement a client-side direct browser→AnnoRepo fallback mechanism when server-side API routes fail due to firewall blocking of Netlify IP addresses.

## Context

### The Problem

In production, external annotations (SVG iconography and AI text spotting) return 0 items because AnnoRepo's firewall blocks Netlify's serverless function IP addresses. This manifests as socket errors or timeouts when Netlify tries to connect to AnnoRepo.

Server-side API routes at `/api/annotations/external/` and `/api/annotations/linking-bulk/` fail with:
- Socket errors: `SocketError`, connection closed
- Timeout errors after 15s (increased from 5s for cold starts)
- Empty responses with debug info showing connection failures

### The Solution

Implement dual-path loading architecture:

1. **Primary Path:** Netlify API → AnnoRepo (with auth token)
2. **Fallback Path:** Browser → AnnoRepo (public read access)

When the server API returns 0 items or fails, client-side code makes direct fetch requests from the user's browser to AnnoRepo, bypassing Netlify's blocked IPs entirely.

## Technical Details

### Authentication Model

AnnoRepo container `necessary-reunions` is configured with:
```json
{
  "readOnlyForAnonymousUsers": true
}
```

**This means:**
- ✅ READ operations work WITHOUT authentication (public access)
- ❌ WRITE operations (create/update/delete) REQUIRE authentication

**Impact:**
- Direct browser→AnnoRepo fallback has identical READ access to server API
- No protected annotations are missed
- All annotation viewing/browsing works without auth
- Only editing features require authenticated server routes

### Performance Considerations

**Caching Strategy:**
- Client-side caching using `sessionStorage` (not `localStorage`)
- 5-minute cache expiration per canvas/page combination
- SessionStorage preferred because:
  - Annotation data changes frequently during editing sessions
  - Data shouldn't persist across browser sessions
  - Automatic cleanup when browser closes

**Network Impact:**
- Fallback only triggers on server failure (empty response or error)
- Direct requests are cached to prevent duplicate fetches
- No performance regression vs. working server route
- Actually faster than timed-out server requests

### Graceful Degradation

The fallback cascade:
1. Try server API route (preferred, has auth token)
2. If empty/error response → try direct browser access
3. If direct access fails → return empty array (graceful failure)
4. UI never crashes, loading indicators stop properly

## Consequences

### Positive

✅ **Production Fixes Immediately:** Annotations load correctly even with firewall blocking  
✅ **Non-Breaking:** Server path still works when firewall is fixed  
✅ **Backwards Compatible:** No changes needed when AnnoRepo allows Netlify IPs  
✅ **Better Resilience:** System works despite external service restrictions  
✅ **Performance:** Client-side caching reduces repeated requests  
✅ **User Experience:** Seamless fallback, users don't notice the difference

### Negative

⚠️ **Temporary Architecture:** Ideally server-side would work without fallback  
⚠️ **Dual Code Paths:** Slightly more complex than single server route  
⚠️ **Cache Invalidation:** Manual cache clearing needed if data changes externally

### Neutral

🔄 **Firewall Configuration:** When AnnoRepo allows Netlify IPs, fallback becomes unused but harmless  
🔄 **Future Migration:** Can remove fallback code once firewall issue is permanently resolved

## Merge Strategy

### Should We Merge Now?

**YES - Merge is appropriate because:**

1. **Fixes Critical Production Issue:**
   - Annotations currently return 0 items in production
   - Users cannot view AI-generated or external annotations
   - Scholarly research workflow is blocked

2. **Graceful Degradation Pattern:**
   - Fallback only activates on server failure
   - Doesn't interfere with normal operation
   - Automatically stops being used if server path works

3. **No Performance Regression:**
   - Fallback is faster than 15s timeout
   - Client-side caching reduces load
   - Only triggers when server already failing

4. **Non-Blocking for Future Fixes:**
   - When firewall configuration changes, server path works again
   - Fallback code becomes dormant but doesn't cause issues
   - Can be safely removed in future cleanup

5. **Best Practices Applied:**
   - Session storage caching implemented
   - Authentication model documented
   - Error handling comprehensive
   - Circuit breakers prevent infinite loops

### What About Firewall Configuration?

**The firewall fix and this PR are complementary, not mutually exclusive:**

- **This PR:** Enables system to work NOW despite firewall
- **Firewall Fix:** Would make server path work (preferred long-term)
- **Both Together:** Provides resilience even if firewall rules change again

### When to Remove Fallback Code?

Consider removing fallback code when:
1. AnnoRepo firewall consistently allows Netlify IPs (6+ months stable)
2. Server-side route success rate >99.9%
3. No socket errors observed in production logs
4. Product requirements don't need external service resilience

Until then, keeping fallback provides valuable production resilience.

## Implementation Files

**Modified:**
- `lib/viewer/annoRepo.ts` - Direct fallback functions with caching
- `hooks/use-global-linking-annotations.ts` - Direct fallback integration
- `app/api/annotations/external/route.ts` - Timeout increase, debug info
- `app/api/annotations/linking-bulk/route.ts` - Socket error detection

**Added:**
- `public/debug-annorepo.html` - Browser diagnostic tool
- `app/api/debug/route.ts` - Environment check endpoint
- Session storage caching functions

## References

- PR #95: https://github.com/globalise-huygens/necessary-reunions/pull/95
- AnnoRepo API: https://github.com/knaw-huc/annorepo/blob/main/docs/api-usage.md
- Container Config: `readOnlyForAnonymousUsers: true`
- Netlify Preview: https://deploy-preview-95--necessaryreunions.netlify.app

## Alternatives Considered

### Alternative 1: Wait for Firewall Fix
**Rejected:** Blocks production use indefinitely with unknown timeline

### Alternative 2: Proxy Through Different Service
**Rejected:** Adds complexity, additional failure points, maintenance burden

### Alternative 3: Client-Only Architecture
**Rejected:** Loses server-side auth token benefits for write operations

### Alternative 4: VPN/Whitelist Netlify IPs
**Rejected:** External service configuration not under our control

## Decision Makers

- Technical Lead: Jona Beysens (@jbeysens)
- Project: Necessary Reunions / GLOBALISE Huygens
- Context: Production annotation loading failure December 2025
