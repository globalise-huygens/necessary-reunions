'use client';

import { urls } from '@/lib/shared/urls';
import { ExternalLink, Map, MapPin, SquareChartGantt } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ProjectLinks() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const USE_SUBDOMAINS = false;

  const getUrl = (urlFunction: () => string, fallback: string) => {
    if (!mounted) return fallback;
    return USE_SUBDOMAINS ? urlFunction() : fallback;
  };

  return (
    <div className="space-y-16">
      <div className="text-center space-y-6">
        <h2 className="text-4xl lg:text-5xl font-bold font-heading text-gray-900">
          Project Tools
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          These tools provide access to reintegrated data from VOC textual
          archives and maps of early modern Kerala, using techniques of
          georeferencing and machine-generated transcriptions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
        <a
          href={getUrl(urls.viewer, 'https://necessaryreunions.org/viewer')}
          className="group transition-all duration-300 hover:scale-105"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl hover:bg-white/50 transition-all duration-300">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/30 to-primary/10 rounded-full flex items-center justify-center group-hover:shadow-xl group-hover:from-primary/40 group-hover:to-primary/20 transition-all duration-300">
              <SquareChartGantt className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-primary transition-colors">
                re:Charted
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Annotate and view the 30 Kerala maps from the VOC archives. See
                the georeferencing results and create annotations on these
                historical maps using IIIF standards.
              </p>
            </div>
            <div className="flex items-center justify-center text-primary group-hover:underline font-semibold text-lg">
              <span>Access Tool</span>
              <ExternalLink className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>

        <a
          href={getUrl(urls.gavoc, 'https://necessaryreunions.org/gavoc')}
          className="group transition-all duration-300 hover:scale-105"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl hover:bg-white/50 transition-all duration-300">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/30 to-primary/10 rounded-full flex items-center justify-center group-hover:shadow-xl group-hover:from-primary/40 group-hover:to-primary/20 transition-all duration-300">
              <Map className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-primary transition-colors">
                Grote Atlas
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Historical thesaurus connecting locations mentioned in the Grote
                Atlas to modern coordinates and places. Provides URIs for
                linking historical references to contemporary geographic data.
              </p>
            </div>
            <div className="flex items-center justify-center text-primary group-hover:underline font-semibold text-lg">
              <span>Browse Maps</span>
              <ExternalLink className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>

        <a
          href={getUrl(
            urls.gazetteer,
            'https://necessaryreunions.org/gazetteer',
          )}
          className="group transition-all duration-300 hover:scale-105"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl hover:bg-white/50 transition-all duration-300">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/30 to-primary/10 rounded-full flex items-center justify-center group-hover:shadow-xl group-hover:from-primary/40 group-hover:to-primary/20 transition-all duration-300">
              <MapPin className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-primary transition-colors">
                Gazetteer
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Places located on the 30 maps in re:Charted, connected to show
                the history and transition of places based on the VOC maps.
                Trace how locations evolved over time through historical
                documentation.
              </p>
            </div>
            <div className="flex items-center justify-center text-primary group-hover:underline font-semibold text-lg">
              <span>Search Gazetteer</span>
              <ExternalLink className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
