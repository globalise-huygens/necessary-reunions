import 'leaflet.markercluster';
import type * as L from 'leaflet';

declare module 'leaflet' {
  interface MarkerCluster {
    getChildCount(): number;
  }

  interface MarkerClusterGroup extends L.LayerGroup {
    addLayers(layers: L.Layer[]): this;
    clearLayers(): this;
    refreshClusters(): this;
    getBounds(): L.LatLngBounds;
  }
}

export type LeafletModule = typeof L;
