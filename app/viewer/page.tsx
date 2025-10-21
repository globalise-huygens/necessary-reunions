import { ManifestViewer } from '../../components/viewer/ManifestViewer';

export default function ReChartedApp() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <script
        dangerouslySetInnerHTML={{
          __html: `

          `,
        }}
      />
      <ManifestViewer />
    </div>
  );
}
