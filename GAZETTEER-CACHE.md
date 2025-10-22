# Gazetteer Hybrid Caching Strategy

## How It Works

The gazetteer uses a **hybrid caching strategy** to handle Netlify's 10-second serverless timeout:

### 1. First Request (Cold Start)
- Attempts to fetch all linking annotations from AnnoRepo
- Has 8-second timeout protection
- If successful: Caches data in memory (1-hour TTL)
- If timeout: Returns partial data but keeps trying in background
- If complete failure: Falls back to GAVOC CSV data

### 2. Subsequent Requests (Cache Hit)
- Returns cached data instantly (no API calls)
- Cache is valid for **1 hour**
- All users benefit from the warm cache

### 3. Cache Refresh
- After 1 hour, cache expires
- Next request triggers fresh fetch from AnnoRepo
- New data is automatically picked up

## API Endpoints

### Get Places (with cache info)
```bash
GET /api/gazetteer/places?page=0&limit=100
```

Response includes cache metadata:
```json
{
  "places": [...],
  "totalCount": 51,
  "cached": true,
  "cacheAge": 120,
  "message": "From cache (120s old) - 51 places"
}
```

### Warm Up Cache (After Deploy)
```bash
GET /api/gazetteer/warmup
```

Call this endpoint after deploying to pre-populate the cache:
```json
{
  "status": "warmed",
  "duration": 7500,
  "placesLoaded": 51,
  "message": "Cache successfully warmed up"
}
```

### Force Cache Refresh
```bash
POST /api/gazetteer/invalidate-cache
```

Use this when you add new places to AnnoRepo and want them to appear immediately:
```json
{
  "success": true,
  "message": "Cache invalidated successfully"
}
```

## Workflow for Adding New Places

1. **Add new linking annotations to AnnoRepo** with geotagging data
2. **Invalidate the cache**: 
   ```bash
   curl -X POST https://necessaryreunions.netlify.app/api/gazetteer/invalidate-cache
   ```
3. **Wait ~10 seconds** for next user request to fetch fresh data
4. **New places appear** for all subsequent users

Alternatively, you can wait up to 1 hour for automatic cache expiration.

## Cache Behavior

- **Cache Duration**: 1 hour (3600 seconds)
- **Stale-While-Revalidate**: 2 hours (CDN can serve stale data while fetching fresh)
- **Cold Start**: First request after deployment may take 8-10s
- **Warm Cache**: Instant response (< 100ms)

## Monitoring Cache Status

Check cache health:
```bash
curl https://necessaryreunions.netlify.app/api/gazetteer/places | jq '.cached, .cacheAge'
```

Output:
```
true
245
```
(Cache is active, 245 seconds old)

## Benefits

✓ **No 504 timeouts** after initial warmup
✓ **Fresh data** from AnnoRepo within 1 hour
✓ **Manual refresh** available when needed
✓ **Automatic fallback** to GAVOC CSV if AnnoRepo fails
✓ **All users benefit** from single successful fetch
