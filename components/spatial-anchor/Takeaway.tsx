import { BookOpen, Globe2, Map } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../shared/Button';

export function Takeaway() {
  return (
    <section
      aria-labelledby="takeaway-heading"
      className="rounded-2xl border border-[hsl(12_70%_50%/0.4)] bg-[hsl(45_40%_94%)] p-6 shadow-sm"
    >
      <h2 id="takeaway-heading" className="font-heading text-xl text-primary">
        Takeaway
      </h2>
      <p className="text-sm text-foreground/85 mt-2 leading-relaxed max-w-3xl">
        Spatial anchors make the relation between annotation, interpretation,
        and georeferencing explicit. They allow text, iconography, place links,
        and coordinates to remain distinct while becoming part of one reusable
        IIIF-based workflow.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/viewer">
            <Map className="h-4 w-4" aria-hidden />
            Open re:Charted
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/gazetteer">
            <Globe2 className="h-4 w-4" aria-hidden />
            Explore the Gazetteer
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/documentation">
            <BookOpen className="h-4 w-4" aria-hidden />
            Read the documentation
          </Link>
        </Button>
      </div>
    </section>
  );
}
