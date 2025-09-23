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
          className="group transition-all duration-500 hover:scale-105 transform rotate-1 hover:rotate-0"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl bg-white/60 hover:bg-white/90 transition-all duration-500 shadow-lg hover:shadow-2xl border border-primary/10 hover:border-primary/20">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/40 to-primary/20 rounded-2xl flex items-center justify-center group-hover:shadow-2xl group-hover:from-primary/60 group-hover:to-primary/30 transition-all duration-500 group-hover:rotate-6">
              <SquareChartGantt className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-primary transition-colors">
                re:Charted
              </h3>
              <p className="text-gray-600 leading-relaxed">
                View 30 Kerala maps from the VOC, coming from various archives
                like the Leupe collection at the National Archives in The Hague.
                See the annotation and georeferencing results of these historic
                maps using LOD and IIIF standards.
              </p>
            </div>
            <div className="flex items-center justify-center text-primary group-hover:text-white group-hover:bg-primary/90 rounded-full px-6 py-3 transition-all duration-300 font-semibold text-sm border border-primary/20 group-hover:border-primary">
              <span>Access Tool</span>
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>

        <a
          href={getUrl(urls.gavoc, 'https://necessaryreunions.org/gavoc')}
          className="group transition-all duration-500 hover:scale-105 transform -rotate-1 hover:rotate-0"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl bg-white/60 hover:bg-white/90 transition-all duration-500 shadow-lg hover:shadow-2xl border border-secondary/10 hover:border-secondary/20">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-secondary/50 to-secondary/30 rounded-2xl flex items-center justify-center group-hover:shadow-2xl group-hover:from-secondary/70 group-hover:to-secondary/40 transition-all duration-500 group-hover:-rotate-6">
              <Map className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-secondary transition-colors duration-300">
                Grote Atlas
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Historical thesaurus based on the locations mentioned in the
                Grote Atlas to modern coordinates and places. And furthermore,
                provides URIs for linking historical references.
              </p>
            </div>
            <div className="flex items-center justify-center text-secondary group-hover:text-white group-hover:bg-secondary/90 rounded-full px-6 py-3 transition-all duration-300 font-semibold text-sm border border-secondary/20 group-hover:border-secondary">
              <span>Browse Maps</span>
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>

        <a
          href={getUrl(
            urls.gazetteer,
            'https://necessaryreunions.org/gazetteer',
          )}
          className="group transition-all duration-500 hover:scale-105 transform rotate-1 hover:rotate-0"
        >
          <div className="text-center space-y-6 p-8 rounded-2xl bg-white/60 hover:bg-white/90 transition-all duration-500 shadow-lg hover:shadow-2xl border border-accent/10 hover:border-accent/20">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-accent/50 to-accent/30 rounded-2xl flex items-center justify-center group-hover:shadow-2xl group-hover:from-accent/70 group-hover:to-accent/40 transition-all duration-500 group-hover:rotate-6">
              <MapPin className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-heading text-gray-900 group-hover:text-accent transition-colors duration-300">
                Gazetteer
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Places located on 30 maps in re:Charted, connected to show the
                history and transition of places in the area of Kerala, India.
              </p>
            </div>
            <div className="flex items-center justify-center text-accent group-hover:text-white group-hover:bg-accent/90 rounded-full px-6 py-3 transition-all duration-300 font-semibold text-sm border border-accent/20 group-hover:border-accent">
              <span>Search Gazetteer</span>
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
