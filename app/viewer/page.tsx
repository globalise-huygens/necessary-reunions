import { ManifestViewer } from '@/components/viewer/ManifestViewer';

export default async function ReChartedApp() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ManifestViewer />
    </div>
  );
}
