import { ProjectLinks } from '@/components/ProjectLinks';
import React from 'react';

export default async function Home() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-12">
      <div className="container mx-auto px-6 max-w-6xl space-y-16">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
          <div className="space-y-6 flex flex-col justify-center">
            <div className="space-y-2">
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold font-heading text-gray-900 leading-tight">
                Necessary Reunions
                <span className="block text-3xl lg:text-4xl xl:text-5xl text-primary mt-3">
                  Project
                </span>
              </h1>
              <h2 className="text-lg lg:text-xl xl:text-2xl font-heading text-gray-700 leading-relaxed max-w-2xl">
                Remarrying Maps to Text and Reconceptualizing Histories of Early
                Modern Kerala
              </h2>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end items-center">
            <div className="relative">
              <img
                src="/image/neru.png"
                alt="Necessary Reunions Project"
                className="w-full max-w-sm lg:max-w-md xl:max-w-lg"
              />
            </div>
          </div>
        </div>

        {/* Project Tools Section */}
        <div className="space-y-8">
          <ProjectLinks />
        </div>

        {/* FAQ Section */}
        <div className="space-y-8">
          <div className="text-center space-y-6">
            <h2 className="text-4xl lg:text-5xl font-bold font-heading text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Common questions about the Necessary Reunions project and its
              digital tools.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white/60 rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <h3 className="text-xl font-bold font-heading text-gray-900 mb-4">
                What is the Necessary Reunions project?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Maps and textual sources in the Dutch East India Company (VOC)
                archives were meant to be together. This project reintegrates
                data from VOC textual archives and thirty maps on Kerala from
                the Leupe collection in the National Archives, The Hague, using
                techniques of georeferencing and machine-generated
                transcriptions to reconceptualize Kerala's early modern
                topography.
              </p>
            </div>

            <div className="bg-white/60 rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <h3 className="text-xl font-bold font-heading text-gray-900 mb-4">
                What's the difference between the Gazetteer and GAVOC?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                The <strong>Gazetteer</strong> shows places located on the 30
                maps in re:Charted, connected to demonstrate the history and
                transition of places based on the VOC maps.{' '}
                <strong>GAVOC</strong> (part of the Grote Atlas) is a historical
                thesaurus connecting locations mentioned in the Grote Atlas to
                modern coordinates and places, providing URIs for linking
                historical references to contemporary geographic data.
              </p>
            </div>

            <div className="bg-white/60 rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <h3 className="text-xl font-bold font-heading text-gray-900 mb-4">
                How does the project use AI and digital techniques?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                The project employs handwritten text recognition (HTR) which
                converts handwritten text to machine readable transcriptions,
                computer vision which automatically detects visual features like
                icons on maps, and georeferencing techniques which help identify
                place coordinates on historical maps by comparing them with
                modern day maps.
              </p>
            </div>

            <div className="bg-white/60 rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <h3 className="text-xl font-bold font-heading text-gray-900 mb-4">
                Can I contribute annotations or access the source code?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Annotations are added and adjusted by team members only to
                ensure scholarly accuracy and consistency. However, the
                project's source code is available on{' '}
                <a
                  href="https://github.com/globalise-huygens/necessary-reunions"
                  className="text-primary hover:underline"
                >
                  GitHub
                </a>
                . Any data created in this project is part of the{' '}
                <a
                  href="https://globalise.huygens.knaw.nl"
                  className="text-primary hover:underline"
                >
                  GLOBALISE project
                </a>{' '}
                and will be available there for academic research.
              </p>
            </div>

            <div className="bg-white/60 rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <h3 className="text-xl font-bold font-heading text-gray-900 mb-4">
                Who is behind this project?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                The project is led by Manjusha Kuruppath (Huygens Institute) and
                Leon van Wissen (University of Amsterdam), with team members
                Jona Schlegel (Huygens Institute / archaeoINK) and Meenu Rabecca
                (University of Leiden). It's funded by the NWO XS
                (March–December 2025) and conducted at the Huygens Institute.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
