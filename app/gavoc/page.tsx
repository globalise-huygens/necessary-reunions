import { ArrowLeft, Map } from 'lucide-react';
import Link from 'next/link';

export default function GroteAtlasPage() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4 mb-6">
            <Map className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading">Grote Atlas Viewer</h1>
              <p className="text-gray-600">
                Historical Atlas of Early Modern Kerala
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-lg text-foreground">
              The GAVOC Atlas subproject will create a comprehensive historical
              atlas of early modern Kerala based on VOC maps and documentation.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                🚧 This subproject is currently under development. Check back
                soon for updates!
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="https://necessaryreunions.org"
                className="inline-flex items-center space-x-2 text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Necessary Reunions</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
