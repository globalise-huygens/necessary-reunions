import { ProjectLinks } from '@/components/ProjectLinks';
import React from 'react';

export default async function Home() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-12">
      <div className="container mx-auto px-6 max-w-6xl space-y-24">
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
        <div className="space-y-16">
          <div className="text-center space-y-6">
            <h2 className="text-4xl lg:text-5xl font-bold font-heading text-gray-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-5xl mx-auto space-y-16">
            <div className="space-y-6">
              <h3 className="text-2xl lg:text-3xl font-bold font-heading text-gray-900">
                What is the Necessary Reunions project?
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
                Historical maps and documents from the Dutch East India Company
                (VOC) tell richer stories when brought back together. We are
                annotating thirty Kerala maps from the Leupe collection at the
                National Archives in The Hague and thereby locating places on
                these maps and linking them to modern geographical data.
              </p>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl lg:text-3xl font-bold font-heading text-gray-900">
                How does the project use digital tools and AI?
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
                The project utilises MapReader and Loghi AI to locate
                handwriting on historical maps and documents. For the icons and
                symbols on the maps, the Meta AI Segment Everything is used. For
                storing the data, the AnnoRepo is used, and we use IIIF to serve
                the images. For the creation of the user interface, Next.js and
                React are used.
              </p>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl lg:text-3xl font-bold font-heading text-gray-900">
                {' '}
                How does the project use the "Grote atlas van de Vereinigde
                Oost-Indische Compagnie (GAVOC)"?
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
                The locations mentioned in the Grote atlas van de Vereinigde
                Oost-Indische Compagnie were connected to the current modern
                name and coordinates. These can then be viewed and explored on a
                modern map environment, the GAVOC (Grote atlas van de Vereinigde
                Oost-Indische Compagnie) tool. Furthermore, the names were
                linked, forming a historical thesaurus of place names, that can
                be used as an external reference for linking historical
                locations via an API to other datasets.
              </p>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl lg:text-3xl font-bold font-heading text-gray-900">
                Can I contribute annotations or access the source code?
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
                Right now, the Necessary Reunions team handles all the
                annotations. But if you're interested in the technical side, all
                code is freely available on{' '}
                <a
                  href="https://github.com/globalise-huygens/necessary-reunions"
                  className="text-primary hover:underline font-semibold"
                >
                  GitHub
                </a>
                . The data that is created in the scope of the project will
                eventually be part of the larger{' '}
                <a
                  href="https://globalise.huygens.knaw.nl"
                  className="text-primary hover:underline font-semibold"
                >
                  GLOBALISE project
                </a>
                .
              </p>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl lg:text-3xl font-bold font-heading text-gray-900">
                Who is behind this project?
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
                The project is led by Manjusha Kuruppath (Huygens Institute) and
                Leon van Wissen (University of Amsterdam), with team members
                Jona Schlegel (Huygens Institute / archaeoINK), Meenu Rabecca
                (University of Leiden) and Pham Thuy Dung (Huygens Institute).
                It's funded by the NWO XS (March–December 2025) and conducted at
                the Huygens Institute.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
