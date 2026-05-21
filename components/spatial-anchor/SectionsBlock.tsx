const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: '1. What are the annotation inputs?',
    body: 'The example starts from two real W3C Web Annotations on W37. The text record has motivation "textspotting" and a SvgSelector polygon around "Pananie". Its body keeps both a Loghi-generated transcription and a human-created correction. The iconography record has motivation "iconography", an empty body, and a separate SvgSelector polygon.',
  },
  {
    heading: '2. What does the linking annotation do?',
    body: 'The real linking annotation lists the textspotting and iconography annotation URLs in its target array. It records the interpretative decision that the written label and the nearby symbol refer to Ponnani. Geometry remains on the target annotations; the linking record references them.',
  },
  {
    heading: '3. What is the spatial anchor?',
    body: 'The linking annotation includes a body with purpose "selecting" and a PointSelector at x 2106, y 6547. The x/y values are in IIIF Canvas pixel space. This single point gives the linked annotations a shared anchor without altering their polygons.',
  },
  {
    heading: '4. Why connect to a place entry?',
    body: 'The completed linking annotation uses two place-related bodies: purpose "identifying" points to the Ponnani Place, and purpose "geotagging" carries a Feature with coordinates. The same Ponnani record appears in the project gazetteer with preferred and alternative names, glob_id GLOB_366, part_of Kodungallur, and defined_by POINT (75.920835 10.776903).',
  },
  {
    heading: '5. How does this relate to georeferencing?',
    body: 'The PointSelector gives the image-space position; the Ponnani coordinate gives the geographic position. Together they form one ground control point. A collection of such anchors can populate a candidate IIIF Georeference Annotation with motivation "georeferencing" and a FeatureCollection of GCP features.',
  },
  {
    heading: '6. What is already implemented, and what is next?',
    body: 'AnnoRepo stores the real textspotting, iconography, and linking annotations in the necessary-reunions container. Allmaps already visualises existing georeferenced map data. The next step is to use placed reference points from linking annotations to generate or refine IIIF Georeference annotations. The page does not claim that placed anchors are already used directly for Allmaps georeferencing.',
  },
];

export function SectionsBlock() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {SECTIONS.map((s) => (
        <section
          key={s.heading}
          className="rounded-xl border border-primary/15 bg-card p-5 shadow-sm"
        >
          <h3 className="font-heading text-base text-primary">{s.heading}</h3>
          <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
            {s.body}
          </p>
        </section>
      ))}
    </div>
  );
}
