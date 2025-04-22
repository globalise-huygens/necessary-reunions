export interface GCP {
  pixel: [number, number];
  world: [number, number];
}

export async function fetchGeoref(manifestCanvas: any): Promise<GCP[]> {
  const annoPage = manifestCanvas.annotations?.find((a: any) =>
    /georeferencing|allmaps/.test(a.id),
  );
  if (!annoPage) return [];
  const id = annoPage.id.match(/\/([^/]+)\.json$/)?.[1];
  if (!id) return [];
  const res = await fetch(`/api/georeferencing/${id}`);
  if (!res.ok) return [];
  const data = await res.json();
  // Allmaps stores features in data.body.features
  const features = data.body?.features ?? data.gcps ?? [];
  return features.map((f: any) => ({
    pixel: f.properties?.pixelCoords || f.pixelCoords,
    world: f.geometry?.coordinates || f.worldCoords,
  }));
}
