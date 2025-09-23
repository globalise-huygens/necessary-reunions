import { ProjectLinks } from '@/components/ProjectLinks';
import React from 'react';

export default async function Home() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-2">
      <div className="container mx-auto px-6 max-w-6xl space-y-12">
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
      </div>
    </div>
  );
}
