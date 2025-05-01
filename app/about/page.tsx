import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Users,
  Link as LinkIcon,
  Mail,
  Phone,
  PocketKnife,
  Target,
  Map,
  SquareChartGantt,
  University,
  ArrowDownToLine,
} from 'lucide-react';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="h-full overflow-auto bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="bg-white rounded-lg shadow p-6 flex items-center space-x-4">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-3xl font-heading">Necessary Reunions</h1>
            <p className="text-sm text-secondary">
              March–December 2025 • Subsidy: NWO XS (50,000 €)
            </p>
          </div>
        </div>

        <div className="text-center bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-2xl font-heading mb-4">
            Remarrying Maps to Text and Reconceptualizing Histories of Early
            Modern Kerala
          </h2>
          <Image
            src="/NL-HaNA_4.VELH_619.111-klein.jpg"
            alt="Annotation example from Kerala maps"
            className="mx-auto rounded-lg shadow"
            width={840}
            height={640}
          />
        </div>
        {/* Remarkable & Valorisation */}
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
            <span>VOC Archives & Topography</span>
          </h2>
          <p>
            The Dutch East India Company, also known as the VOC, was a colonial
            actor in Kerala (India) from 1663 to 1795 and their archives have a
            wealth of textual descriptions that can enrich our knowledge of the
            geographical and political landscape of the region. The VOC as avid
            cartographers also produced maps of Kerala. These maps are extremely
            rich in detail.
          </p>
          <p>
            They bear topographic information about coastlines and riverways and
            use visual features to indicate the location of fortresses,
            tollhouses and the boundaries of kingdoms. However, historians are
            yet to discover the full value of the VOC’s cartographical and
            textual archives to write histories of early modern Kerala.
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
              Automatically annotated map of the coast of Kerala (Nationaal
              Archief 4.VEL 229). The image shows visual (in red) and textual
              (in blue) segments that are generated automatically with the help
              of AI in a pilot project. They illustrate the nature of text and
              iconography present on maps related to Kerala.
            </figcaption>
          </figure>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <PocketKnife className="w-5 h-5 text-primary" />
            <span>Tools, Techniques & Objectives</span>
          </h2>
          <p>
            This project will reintegrate data from textual archives and thirty
            maps on Kerala from the Leupe collection in the National Archives,
            The Hague to create a gazetteer of place information which includes
            data about their location and names these places were known by. It
            will also create a website which will allow users to view our data
            enrichments to VOC maps.
          </p>
          <p>
            For this purpose, it will use newly emerging techniques of i)
            handwritten text recognition (HTR) which converts handwritten text
            to machine readable transcriptions, ii) computer vision which
            automatically detects visual features like icons on maps, and iii)
            georeferencing techniques which help identify place coordinates on
            historical maps by comparing them with modern day maps.
          </p>
          <p>
            These aforementioned techniques have, for instance, been
            successfully implemented by the MapReader project (UK). In the
            Necessary Reunions project, these techniques will be applied for the
            first time to an early modern corpus of maps consisting entirely of
            hand-written text from a global and colonial context.
          </p>
          <p>
            The gazetteer and website created by this project will allow
            historians to correctly identify places and better comprehend
            historical interactions such as why certain places were vulnerable
            to invasion or became trading hubs. Necessary Reunions is directly
            relevant to the objectives of{' '}
            <Link href="https://globalise.huygens.knaw.nl">GLOBALISE</Link>. The
            reunions project will draw on GLOBALISE transcriptions and know-how
            in place of dataset creation.
          </p>
          <p>
            The gazetteer created by the Necessary Reunions project can be
            integrated into and will enrich the GLOBALISE contextual information
            on Kerala.
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
            from both texts and maps.
          </p>
          <p>
            Once demonstrated and documented for this project, this method and
            techniques can be used on cartographic and textual material from
            other historical and geographical contexts to undertake similar
            initiatives. The project closely adheres to the aims of the Huygens
            Institute. In utilizing the VOC archives to write histories of
            Kerala, the project upholds the Huygens Institute’s commitment to
            creating inclusive histories.
          </p>
          <p>
            Furthermore, the project capitalizes on the new vistas for research
            that have been opened by new georeferencing tools and HTR techniques
            (like the Loghi toolkit developed in-house at the Huygens Institute
            that was used to generate the transcriptions of the VOC archives in
            the GLOBALISE project).
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-2">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Advisors</span>
          </h2>
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
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="flex items-center text-lg font-medium space-x-2">
              <University className="w-4 h-4 text-primary" />
              <span>Departments</span>
            </h3>
            <Link href="https://www.huygens.knaw.nl/en/thema/datamanagement/">
              Data Management
            </Link>
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

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="flex items-center text-lg font-medium space-x-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Team Members</span>
            </h3>
            <ul className="mt-2 space-y-1">
              <li>Dr. Manjusha Kuruppath, Researcher</li>
              <li>Leon van Wissen, University of Amsterdam</li>
              <li>Jona Schlegel, Junior Researcher</li>
              <li>intern</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="flex items-center text-lg font-medium space-x-2">
              <Mail className="w-4 h-4 text-primary" />
              <span>Contact</span>
            </h3>
            <p>communicatie[AT]huygens.knaw.nl</p>
            <p className="mt-2 flex items-center space-x-2">
              <Phone className="w-4 h-4 text-primary" />
              <span>+31 20 224 68 18</span>
            </p>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="flex items-center text-2xl font-heading space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Addresses</span>
          </h2>
          <div>
            <h3 className="font-medium">Visiting Address</h3>
            <p>
              Spinhuis
              <br />
              Oudezijds Achterburgwal 185
              <br />
              1012 DK Amsterdam
            </p>
          </div>
          <div>
            <h3 className="font-medium">Postal Address</h3>
            <p>
              Huygens Institute
              <br />
              Postbus 10855
              <br />
              1001 EW Amsterdam
            </p>
          </div>
          <p>info@huygens.knaw.nl • +31 (0)20 224 68 00</p>
          <p>
            Huygens Institute is part of:{' '}
            <Link href="https://huc.knaw.nl">huc.knaw.nl</Link>,{' '}
            <Link href="https://www.knaw.nl">knaw.nl</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
