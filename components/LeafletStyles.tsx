'use client';

import 'leaflet/dist/leaflet.css';

/**
 * Client component that imports Leaflet CSS.
 * Keeps the leaflet dependency out of the server component tree,
 * preventing Next.js output tracing from pulling the entire
 * leaflet package into the serverless function bundle.
 */
export function LeafletStyles() {
  return null;
}
