'use client';

import { urls } from '@/lib/shared/urls';
import { ExternalLink, Map, MapPin, SquareChartGantt } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ProjectLinks() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getUrl = (urlFunction: () => string, fallback: string) => {
    return mounted ? urlFunction() : fallback;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-heading text-primary">
        Project Tools & Resources
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href={getUrl(urls.viewer, 'https://necessaryreunions.org/viewer')}
          className="bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg p-4 text-center group"
        >
          <SquareChartGantt className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-heading font-semibold mb-1">re:Charted</h3>
          <p className="text-sm text-gray-600 mb-2">IIIF Annotation Tool</p>
          <div className="flex items-center justify-center text-xs text-primary group-hover:underline">
            <span>Launch Tool</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </div>
        </a>
        <a
          href={getUrl(urls.gavoc, 'https://necessaryreunions.org/gavoc')}
          className="bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg p-4 text-center group"
        >
          <Map className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-heading font-semibold mb-1">GAVOC Atlas</h3>
          <p className="text-sm text-gray-600 mb-2">Historical Atlas</p>
          <div className="flex items-center justify-center text-xs text-primary group-hover:underline">
            <span>View Atlas</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </div>
        </a>
        <a
          href={getUrl(
            urls.gazetteer,
            'https://necessaryreunions.org/gazetteer',
          )}
          className="bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg p-4 text-center group"
        >
          <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-heading font-semibold mb-1">Gazetteer</h3>
          <p className="text-sm text-gray-600 mb-2">Place Names Database</p>
          <div className="flex items-center justify-center text-xs text-primary group-hover:underline">
            <span>Browse Places</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </div>
        </a>
      </div>
    </div>
  );
}
