'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface ThesaurusConcept {
  '@id': string;
  '@type': string;
  prefLabel: { '@language': string; '@value': string };
  altLabel?: { '@language': string; '@value': string }[];
  definition?: { '@language': string; '@value': string };
  poolPartyUri?: string;
}

interface ThesaurusData {
  '@graph': ThesaurusConcept[];
}

const categories: Record<string, { label: string; ids: string[] }> = {
  fortifications: {
    label: 'Fortifications & Defence',
    ids: [
      'pagger',
      'fort',
      'hollands_fort',
      'portugees_fort',
      'engels_fort',
      'muur',
      'poort',
    ],
  },
  religious: {
    label: 'Religious Buildings',
    ids: [
      'pagood',
      'moorsche_temple',
      'kerk',
      'roomsche_kerk',
      'kapel',
      'kruis',
    ],
  },
  settlements: {
    label: 'Settlements & Urban',
    ids: ['settlement', 'dorp', 'stad', 'plein', 'bazaar'],
  },
  administrative: {
    label: 'Administrative & Company',
    ids: ['paleis', 'company_possession', 'tolhuis', 'hof'],
  },
  military: {
    label: 'Military & Guard',
    ids: ['wachtpost', 'wachthuis'],
  },
  water: {
    label: 'Water Features',
    ids: ['rivier', 'spruit', 'haven', 'bocht', 'dam', 'baai', 'barra'],
  },
  islands: {
    label: 'Islands & Land',
    ids: ['eiland', 'ilha', 'schwemmland', 'bank', 'zandbrug'],
  },
  natural: {
    label: 'Natural Features',
    ids: ['berg', 'gebergte', 'boom', 'bos', 'tuin', 'klip', 'rif', 'put'],
  },
  infrastructure: {
    label: 'Infrastructure',
    ids: ['brug', 'rusthuis', 'zoutpannen'],
  },
};

const langFlags: Record<string, string> = {
  nl: 'NL',
  en: 'EN',
  pt: 'PT',
  fr: 'FR',
  de: 'DE',
};

export default function IconographyThesaurus() {
  const [concepts, setConcepts] = useState<ThesaurusConcept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/iconography-thesaurus.json')
      .then((res) => res.json())
      .then((data: ThesaurusData) => {
        setConcepts(data['@graph']);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const conceptMap = new Map(concepts.map((c) => [c['@id'], c]));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50">
        <p className="text-muted-foreground">Loading thesaurus...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-muted/50 py-8">
      <div className="container mx-auto max-w-4xl space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Iconography Thesaurus
          </h1>
          <p className="text-sm text-muted-foreground">
            {concepts.length} concepts used to classify iconographic features on
            early modern VOC maps of Kerala. Organised by category with
            multilingual labels and definitions.
          </p>
        </div>

        {Object.entries(categories).map(([key, category]) => {
          const items = category.ids
            .map((id) => conceptMap.get(id))
            .filter(Boolean) as ThesaurusConcept[];
          if (items.length === 0) return null;

          return (
            <details key={`category-${key}`} open className="group">
              <summary className="flex cursor-pointer select-none items-center gap-2 rounded-t-lg bg-card px-5 py-3 shadow transition-colors hover:bg-muted/80">
                <span className="text-xs text-muted-foreground transition-transform group-open:rotate-90">
                  &#9654;
                </span>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  {category.label}
                </h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {items.length}
                </span>
              </summary>

              <div className="divide-y divide-border rounded-b-lg bg-card shadow">
                {items.map((concept) => {
                  const altLabels = Array.isArray(concept.altLabel)
                    ? concept.altLabel
                    : [];

                  return (
                    <div
                      key={`concept-${concept['@id']}`}
                      className="flex flex-col gap-1 px-5 py-3"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-heading font-semibold text-foreground">
                          {concept.prefLabel['@value']}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {langFlags[concept.prefLabel['@language']] ||
                            concept.prefLabel['@language']}
                        </span>
                        {concept.poolPartyUri && (
                          <a
                            href={concept.poolPartyUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-muted-foreground transition-colors hover:text-primary"
                            title="PoolParty thesaurus"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {altLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {altLabels.map((alt) => (
                            <span
                              key={`alt-${concept['@id']}-${alt['@language']}-${alt['@value']}`}
                              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              <span className="text-[9px] font-medium uppercase opacity-60">
                                {langFlags[alt['@language']] ||
                                  alt['@language']}
                              </span>
                              {alt['@value']}
                            </span>
                          ))}
                        </div>
                      )}

                      {concept.definition && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {concept.definition['@value']}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
