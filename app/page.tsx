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
            width={840}
            height={640}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <ProjectLinks />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-heading text-primary">Remarkable</h3>
            <p className="mt-2 text-foreground">
              The project uses emerging techniques of georeferencing on maps and
              machine generated transcripts on Dutch East India Company maps and
              texts about early modern Kerala (India).
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-heading text-primary">Valorisation</h3>
            <p className="mt-2 text-foreground">
              This project will create a gazetteer of places in early modern
              Kerala and a website to feature the enrichments made on maps.
            </p>
          </div>
        </div>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <SquareChartGantt className="w-5 h-5 text-primary" />
            <span>Project Overview</span>
          </h2>
          <p>
            Maps and textual sources in the Dutch East India Company (VOC)
            archives were meant to be together. In this project, Leon van
            Wissen, a junior researcher and Manjusha Kuruppath will apply
            emerging techniques of georeferencing and machine-generated
            transcriptions to the VOC's textual archives and maps of early
            modern Kerala, India.
          </p>
          <figure className="mt-4">
            <img
              src="https://www.huygens.knaw.nl/wp-content/uploads/2025/02/Necessary-Reunions-e1738667934296.png"
              alt="Automatically annotated map of the coast of Kerala"
              className="w-full rounded"
            />
            <figcaption className="text-sm text-secondary mt-2">
              Automatically annotated map of the coast of Kerala (
              <Link href="https://www.nationaalarchief.nl/onderzoeken/archief/4.VEL/invnr/229/file/NL-HaNA_4.VEL_229?eadID=4.VEL&unitID=229&query=229">
                Nationaal Archief 4.VEL 229
              </Link>
              ). The image shows visual (in red) and textual (in blue) segments
              that are generated automatically with the help of AI in a pilot
              project.
            </figcaption>
          </figure>
        </section>
      </div>
    </div>
  );
}
