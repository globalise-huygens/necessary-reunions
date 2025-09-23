import {
  ArrowDownToLine,
  Link as LinkIcon,
  Mail,
  Map,
  MapPin,
  Phone,
  PocketKnife,
  SquareChartGantt,
  Target,
  University,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="bg-white rounded-lg shadow p-6 flex items-center space-x-4">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-3xl font-heading">Necessary Reunions</h1>
            <p className="text-sm text-secondary">
              March–December 2025 • Funded by the NWO XS • File number
              406.XS.24.02.046 • Grant ID{' '}
              <Link href="https://doi.org/10.61686/OBKQG09045">
                https://doi.org/10.61686/OBKQG09045
              </Link>
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="flex items-center text-lg font-medium space-x-2">
            <LinkIcon className="w-4 h-4 text-primary" />
            <span>Tags</span>
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="https://www.huygens.knaw.nl/en/projecten/?tag=digital-history-en"
              className="bg-gray-200 text-sm px-2 py-1 rounded-full hover:bg-gray-300 hover:text-black"
            >
              Digital History
            </Link>
            <Link
              href="https://www.huygens.knaw.nl/en/projecten/?tag=maritime-history"
              className="bg-gray-200 text-sm px-2 py-1 rounded-full hover:bg-gray-300 hover:text-black"
            >
              Maritime History
            </Link>
            <Link
              href="https://www.huygens.knaw.nl/en/projecten/?tag=overseas-territories"
              className="bg-gray-200 text-sm px-2 py-1 rounded-full hover:bg-gray-300 hover:text-black"
            >
              Overseas Territories
            </Link>
          </div>
        </div>
        <div className="text-center bg-white rounded-lg shadow p-6 space-y-4">
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

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <SquareChartGantt className="w-5 h-5 text-primary" />
            <span>Project Overview</span>
          </h2>
          <p>
            Maps and textual sources in the Dutch East India Company (VOC)
            archives were meant to be together. Maps were vital for
            understanding textual information about places. Written sources, in
            turn, enriched knowledge from maps. Previously, information from
            maps and written sources could not be reintegrated because no
            suitable techniques existed to reunify them.
          </p>
          <p>
            In this project, Leon van Wissen (data engineer at the University of
            Amsterdam), a junior researcher and Manjusha Kuruppath (Researcher
            at the Huygens Institute) will apply emerging techniques of
            georeferencing and machine-generated transcriptions to the VOC’s
            textual archives and maps of early modern Kerala, India. The
            information obtained through these methods will help reconceptualize
            Kerala’s early modern topography.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <Map className="w-5 h-5 text-primary" />
            <span>
              VOC Archives: Key to Visualizing Kerala’s Early Modern Topography
            </span>
          </h2>
          <p>
            The Dutch East India Company, also known as the VOC, was a colonial
            actor in Kerala (India) from 1663 to 1795 and their archives have a
            wealth of textual descriptions that can enrich our knowledge of the
            geographical and political landscape of the region. The VOC as avid
            cartographers also produced maps of Kerala.
          </p>
          <p>
            These maps are extremely rich in detail. They bear topographic
            information about coastlines and riverways and use visual features
            to indicate the location of fortresses, tollhouses and the
            boundaries of kingdoms. However, historians are yet to discover the
            full value of the VOC’s cartographical and textual archives to write
            histories of early modern Kerala.
          </p>
          <p>
            More importantly, these maps and textual descriptions have not been
            sufficiently combined to reconstruct the topography of the region
            even though these archives are arguably the largest source of place
            information about early modern Kerala.
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
              project. They illustrate the nature of text and iconography
              present on maps related to Kerala.
            </figcaption>
          </figure>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <PocketKnife className="w-5 h-5 text-primary" />
            <span>Tools, Techniques and Objectives</span>
          </h2>
          <p>
            This project will reintegrate data from textual archives and thirty
            maps on Kerala from the Leupe collection in the National Archives,
            The Hague to create a gazetteer of place information which includes
            data about their location and names these places were known by. It
            will also create a website which will allow users to view our data
            enrichments to VOC maps. For this purpose, it will use newly
            emerging techniques of i) handwritten text recognition (HTR) which
            converts handwritten text to machine readable transcriptions, ii)
            computer vision which automatically detects visual features like
            icons on maps, and iii) georeferencing techniques which help
            identify place coordinates on historical maps by comparing them with
            modern day maps.
          </p>
          <p>
            These aforementioned techniques have, for instance, been
            successfully implemented by the{' '}
            <Link href="https://github.com/maps-as-data/MapReader">
              MapReader
            </Link>{' '}
            project (UK). In the Necessary Reunions project, these techniques
            will be applied for the first time to an early modern corpus of maps
            consisting entirely of hand-written text from a global and colonial
            context. The gazetteer and website created by this project will
            allow historians to correctly identify places and better comprehend
            historical interactions such as why certain places were vulnerable
            to invasion or became trading hubs. Necessary Reunions is directly
            relevant to the objectives of the{' '}
            <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>{' '}
            project. The reunions project will draw on{' '}
            <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>{' '}
            transcriptions and know-how in place of dataset creation. The
            gazetteer created by the Necessary Reunions project can be
            integrated into and will enrich the{' '}
            <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>{' '}
            contextual information on Kerala.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            <span>Impact</span>
          </h2>
          <p>
            The project will support research for writing political histories
            (by reflecting on the interaction of polities in relation to their
            location and access to resources), environmental histories (by
            studying changing shorelines and riverways), and socio-economic
            histories (in the presence of towns and ports) of Kerala. By
            harnessing the techniques of machine generated transcriptions and
            georeferencing, the project will innovatively reconcile information
            from both texts and maps. Once demonstrated and documented for this
            project, this method and techniques can be used on cartographic and
            textual material from other historical and geographical contexts to
            undertake similar initiatives.
          </p>
          <p>
            The project closely adheres to the aims of the Huygens Institute. In
            utilizing the VOC archives to write histories of Kerala, the project
            upholds the Huygens Institute’s commitment to creating inclusive
            histories. Furthermore, the project capitalizes on the new vistas
            for research that have been opened by new georeferencing tools and
            HTR techniques (like the
            <Link href="https://github.com/knaw-huc/loghi">Loghi</Link> toolkit
            developed in-house at the Huygens Institute that was used to
            generate the transcriptions of the VOC archives in the
            <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>{' '}
            project).
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="flex items-center text-lg font-medium space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Advisors</span>
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <Link href="https://www.universiteitleiden.nl/en/staffmembers/jos-gommans#tab-1">
                  Jos Gommans
                </Link>
                , University of Leiden
              </li>
              <li>
                <Link href="https://pure.knaw.nl/portal/en/persons/rombert-stapel">
                  Rombert Stapel
                </Link>
                , International Institute of Social History
              </li>
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="flex items-center text-lg font-medium space-x-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Team Members</span>
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manjusha Kuruppath, Huygens Institute</li>
              <li>Leon van Wissen, University of Amsterdam</li>
              <li>Jona Schlegel, Huygens Institute / archaeoINK</li>
              <li>Meenu Rabecca, University of Leiden</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Related Projects</span>
          </h2>
          <div>
            <h3 className="font-medium">GLOBALISE</h3>
            <div className="flex items-start space-x-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlSpace="preserve"
                width="24"
                height="26"
                style={{
                  shapeRendering: 'geometricPrecision',
                  textRendering: 'geometricPrecision',
                  fillRule: 'evenodd',
                  clipRule: 'evenodd',
                }}
                viewBox="0 0 472 519.2"
                className="flex-shrink-0 mt-1"
              >
                <defs>
                  <style>{`.fil0{fill:#ff0054}`}</style>
                </defs>
                <g id="Layer_x0020_1">
                  <path
                    d="M21.57 238.63c0 84.3 6.74 116.15 59.87 185.35 25.29 32.93 90.81 69.54 133.72 69.54h10.52c44.86-.04 70.94-1.2 114.69-26.44 60.72-35.03 91.84-107.46 105.74-174.98 3.18-15.47 11.1-40.57-8.31-40.57-14.55 0-14.56 38.65-24.38 72.43-14.13 48.65-37.09 87.59-76.98 116.61-42.47 30.9-72.84 27.14-121.28 27.14-66.31 0-132.93-63.2-155.32-125.38-76.82-213.3 142-364.55 292.73-250.79l24.86 20.32c20.99 20.99 24.08 41.2 44.23 42.88 8.28-12.36 8.19-12.16.15-25.76C388.33 72.34 309.9 28.9 231.3 28.9c-112.67 0-209.73 104.73-209.73 209.73z"
                    className="fil0"
                  />
                  <path
                    d="M79.65 245.08c0 55.18 1.98 99.72 45.91 144.46 70.34 71.63 210.55 68.05 252.14-69.04 4.38-14.43 18.17-68.97-4.43-68.97H211.94c-14.26 0-19.57 22.59-3.23 22.59h151.65c0 68.17-47.14 135.51-112.93 135.51-46.07 0-84.67-8.02-111.17-43.71-84.86-114.29 3.45-253.13 82.13-253.13 90 0 73.26 19.36 100.02 19.36 25.54 0 4.1-45.17-87.11-45.17-79.9 0-151.65 78.2-151.65 158.1z"
                    className="fil0"
                  />
                  <path
                    d="M199.03 312.84c.22 9.83 1.46 11.76 3.23 19.36 40.73 0 60.01 9.85 116.15-3.23-.64-28.81-15.93-19.36-103.25-19.36-5.08 0-12.22 1.71-16.13 3.23zM334.55 141.83v9.68c11.94 6.32 8.93 6.41 22.58 3.23 0-16.87 2.79-22.59-12.9-22.59-7.44 0-9.68 2.25-9.68 9.68z"
                    className="fil0"
                  />
                </g>
              </svg>
              <p>
                Any data created in the Necessary Reunions project is part of
                the GLOBALISE project and will be available and further used
                there in{' '}
                <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>{' '}
                website.
              </p>
            </div>
            <h3 className="font-medium mt-4">Contact</h3>
            <p>
              For any questions please contact us at the
              <Link href="https://www.huygens.knaw.nl/en/projecten/necessary-reunions/">
                Huygens Institute
              </Link>
              .
            </p>
          </div>
        </section>
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Output and Outreach</span>
          </h2>
          <div>
            <h3 className="font-medium">Summerschool</h3>
            <p>
              Kuruppath, M. & van Wissen, L. (13-8-2025). Georeferencing Dutch
              Malabar - Necessary Reunions: Remarrying maps to text, Cosmos
              Malabaricus Summer School 2025, Kochi.
            </p>
            <Link
              href="https://timesofindia.indiatimes.com/blogs/tracking-indian-communities/sailing-through-time-history-on-screens/"
              className="text-primary hover:underline flex items-center space-x-1"
            >
              <span>Sailing Through Time: History on Screens</span>
              <LinkIcon className="w-4 h-4" />
            </Link>
          </div>
          <div>
            <h3 className="font-medium">Publications</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Kuruppath, M. & van Wissen, L. (4-3-2025). Introduction to
                Digital Tools. The GLOBALISE and Necessary Reunions projects,
                GHCC-Map History Research Group Joint Workshop, Coventry.
              </li>
              <li>
                van Wissen, L., Kuruppath, M., & Petram, L. (2025). Unlocking
                the Research Potential of Early Modern Dutch Maps. European
                Journal of Geography, 16(1), s12-s17.
                <Link href="https://doi.org/10.48088/ejg.si.spat.hum.l.wis.12.17">
                  https://doi.org/10.48088/ejg.si.spat.hum.l.wis.12.17
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
