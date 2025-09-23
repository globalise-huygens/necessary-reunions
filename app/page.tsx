import { ProjectLinks } from '@/components/ProjectLinks';
import {
  Link as LinkIcon,
  SquareChartGantt,
  Target,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export default async function Home() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="text-center bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-3xl font-heading">Necessary Reunions</h1>

          <h2 className="text-2xl font-heading mb-4">
            Remarrying Maps to Text and Reconceptualizing Histories of Early
            Modern Kerala
          </h2>
          <Image
            src="/image/NL-HaNA_4.VELH_619.111-klein.jpg"
            alt="Annotation example from Kerala maps"
            className="mx-auto rounded-lg shadow"
            width={240}
            height={140}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <ProjectLinks />
        </div>
      </div>
    </div>
  );
}
