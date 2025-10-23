import { GazetteerBrowser } from '../../components/gazetteer/GazetteerBrowser';
import { ManifestErrorBoundary } from '../../components/ManifestErrorBoundary';

export default function GazetteerPage() {
  return (
    <ManifestErrorBoundary>
      <GazetteerBrowser />
    </ManifestErrorBoundary>
  );
}
