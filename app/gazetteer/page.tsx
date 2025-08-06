import { ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function GazetteerPage() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4 mb-6">
            <MapPin className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading">Gazetteer</h1>
              <p className="text-gray-600">
                Place Names Database of Early Modern Kerala
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-lg text-foreground">
              The Gazetteer will provide a comprehensive database of place
              names, locations, and geographical information about early modern
              Kerala based on VOC archives.
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
