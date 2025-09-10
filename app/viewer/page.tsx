import { ManifestViewer } from '@/components/viewer/ManifestViewer';

export default function ReChartedApp() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <script
        dangerouslySetInnerHTML={{
          __html: `
            console.log('📜 INLINE SCRIPT EXECUTED - JavaScript is working');
            if (typeof window !== 'undefined') {
              console.log('🌍 CLIENT-SIDE JavaScript confirmed');
            } else {
              console.log('🖥️ SERVER-SIDE JavaScript (should not see this in browser)');
            }
          `,
        }}
      />
      <ManifestViewer />
    </div>
  );
}
