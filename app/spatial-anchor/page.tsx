import type { Metadata } from 'next';
import { SpatialAnchorExplainer } from '../../components/spatial-anchor/SpatialAnchorExplainer';

export const metadata: Metadata = {
  title: 'Build a Spatial Anchor – Necessary Reunions',
  description:
    'Link a label, a symbol, and a place entry on the IIIF Canvas. Companion to the poster "Introducing Spatial Anchors for Annotating and Georeferencing Historical Maps".',
};

export default function SpatialAnchorPage() {
  return (
    <div className="h-full overflow-hidden">
      <SpatialAnchorExplainer />
    </div>
  );
}
