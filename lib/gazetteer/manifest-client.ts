const MANIFEST_CACHE_KEY = '__necessaryReunionsManifestCache';

type ManifestCacheGlobal = typeof globalThis & {
  [MANIFEST_CACHE_KEY]?: Map<string, Promise<any | null>>;
};

function getManifestCache(): Map<string, Promise<any | null>> {
  const cacheGlobal = globalThis as ManifestCacheGlobal;
  cacheGlobal[MANIFEST_CACHE_KEY] ??= new Map<string, Promise<any | null>>();
  return cacheGlobal[MANIFEST_CACHE_KEY];
}

export function getManifestUrlFromCanvas(canvasUri: string): string {
  return canvasUri.replace(/\/canvas\/.*$/, '');
}

export async function fetchProxiedManifest(
  manifestUrl: string,
): Promise<any | null> {
  const normalizedUrl = manifestUrl.replace(/\/$/, '');
  const manifestCache = getManifestCache();
  let manifestPromise = manifestCache.get(normalizedUrl);

  if (!manifestPromise) {
    manifestPromise = fetch(
      `/api/proxy-manifest?url=${encodeURIComponent(normalizedUrl)}`,
    )
      .then(async (response) => {
        if (!response.ok) return null;

        const manifest = await response.json();
        if (manifest?.error) return null;

        return manifest;
      })
      .catch(() => {
        manifestCache.delete(normalizedUrl);
        return null;
      });

    manifestCache.set(normalizedUrl, manifestPromise);
  }

  return manifestPromise;
}
