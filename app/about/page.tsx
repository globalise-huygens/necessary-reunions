export default function AboutPage() {
  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {' '}
        <h2 className="text-3xl font-heading">About Necessary Reunions</h2>
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-xl font-heading mb-2">Project Overview</h3>
          <p className="text-base text-foreground">
            Maps and textual sources in the Dutch East India Company (VOC)
            archives were meant to be together. Maps were vital for
            understanding textual information about places. Written sources, in
            turn, enriched knowledge from maps. Previously, information from
            these sources could not be reintegrated because no suitable
            techniques existed to reunify them. Today emerging techniques of
            georeferencing on maps and machine generated transcriptions on text
            and maps make this possible. This project applies these methods to
            the VOC archives on early modern Kerala, India. This enables us to
            reconceptualize Kerala's early modern topography and support writing
            new histories of the region.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-xl font-heading mb-2">Team</h3>
          <div className="mb-6">
            <h4 className="text-lg font-medium mb-2 text-[var(--color-primary)]">
              Dr. Manjusha Kuruppath
            </h4>
            <p className="text-[var(--color-secondary)]">
              Dr Manjusha Kuruppath leads historical contextualisation, drawing
              on her Leiden doctorate and Oxford posts.
            </p>
          </div>

          <div className="mb-6">
            <h4 className="text-lg font-medium mb-2 text-[var(--color-primary)]">
              Leon van Wissen
            </h4>
            <p className="text-[var(--color-secondary)]">
              Leon van Wissen directs semantic modelling and data infrastructure
              at the University of Amsterdam, employing Linked Open Data to link
              map features with controlled vocabularies.
            </p>
          </div>

          <div className="mb-6">
            <h4 className="text-lg font-medium mb-2 text-[var(--color-primary)]">
              Jona Schlegel
            </h4>
            <p className="text-[var(--color-secondary)]">
              Jona Schlegel contributes to the project's technical development
              and visual science communication.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-medium mb-2 text-[var(--color-primary)]">
              Future Team Member
            </h4>
            <p className="text-[var(--color-secondary)]">
              An intern is set to join the team shortly, focusing on the
              enrichment and validation of segmented annotations.
            </p>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-xl font-heading mb-2">Technical Approach</h3>
          <ul className="list-disc pl-6 space-y-2 text-foreground">
            <li>IIIF viewing and annotation</li>
            <li>Georeferencing VOC maps</li>
            <li>Semantic linking to place thesauri</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
