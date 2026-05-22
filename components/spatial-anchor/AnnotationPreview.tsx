'use client';

import {
  ANCHOR_XY,
  blocksForStep,
  type BlockTone,
  PLACE_COORDINATES,
  PLACE_PONNANI,
  type PreviewBlock,
  type StepId,
  STEPS,
} from './data';

interface AnnotationPreviewProps {
  step: StepId;
}

const toneBorder: Record<BlockTone, string> = {
  green: 'border-[hsl(var(--chart-2))]',
  terracotta: 'border-[hsl(var(--chart-1))]',
  primary: 'border-[hsl(var(--primary))]',
  blue: 'border-[hsl(var(--chart-3))]',
  place: 'border-[hsl(var(--secondary))]',
};

const toneBg: Record<BlockTone, string> = {
  green: 'bg-[hsl(var(--chart-2)/0.08)]',
  terracotta: 'bg-[hsl(var(--chart-1)/0.08)]',
  primary: 'bg-[hsl(var(--primary)/0.06)]',
  blue: 'bg-[hsl(var(--chart-3)/0.08)]',
  place: 'bg-[hsl(var(--secondary)/0.12)]',
};

const toneDot: Record<BlockTone, string> = {
  green: 'bg-[hsl(var(--chart-2))]',
  terracotta: 'bg-[hsl(var(--chart-1))]',
  primary: 'bg-[hsl(var(--primary))]',
  blue: 'bg-[hsl(var(--chart-3))]',
  place: 'bg-[hsl(var(--secondary))]',
};

const LEGEND: Array<{ label: string; tone: BlockTone }> = [
  { label: 'Textspotting annotation', tone: 'green' },
  { label: 'Iconography annotation', tone: 'terracotta' },
  { label: 'Focused linking JSON snippet', tone: 'primary' },
];

function formatNames() {
  const prefNames: string[] = [];
  const altNames: string[] = [];

  PLACE_PONNANI.identified_by.forEach((entry) => {
    if (entry.type !== 'Name') return;
    const classification = entry.classified_as[0]._label;
    if (classification === 'PREF') prefNames.push(entry.content);
    if (classification === 'ALT') altNames.push(entry.content);
  });

  return { prefNames, altNames };
}

function stepFocus(step: StepId) {
  switch (step) {
    case 'empty':
      return 'Start with no annotation object yet.';
    case 'text':
      return 'Show only the text annotation and its value.';
    case 'icon':
      return 'Keep the text outline, add the iconography outline and its classification.';
    case 'link':
      return 'Build linking motivation with ordered targets only: 1) textspotting, 2) iconography.';
    case 'anchor':
      return 'Add a selecting body with a PointSelector to update the linking JSON-LD.';
    case 'thesaurus':
      return 'Add thesaurus-backed identifying and geotagging bodies with world coordinates.';
    case 'future':
      return 'Project a future Allmaps path: pixel-space and world-space pairs can seed georeferencing.';
    default:
      return 'Follow the annotation build-up step by step.';
  }
}

export function AnnotationPreview({ step }: AnnotationPreviewProps) {
  const blocks = blocksForStep(step);
  const stepLabel = STEPS.find((s) => s.id === step)?.label ?? step;

  return (
    <section
      aria-labelledby="preview-heading"
      className="h-full rounded-2xl border border-primary/20 bg-card p-4 shadow-sm lg:p-5 overflow-auto"
    >
      <header className="mb-3">
        <h2
          id="preview-heading"
          className="text-sm font-heading text-primary tracking-wide uppercase"
        >
          Live annotation preview
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Real JSON-LD W3C Web Annotation payloads from AnnoRepo, revealed step
          by step. Reference place: <em>Coijlang</em> (Ponnani thesaurus entry).
        </p>
      </header>

      <JsonLdGuide step={step} />

      <ul className="grid grid-cols-1 gap-1 mb-4 text-[11px]">
        {LEGEND.map((l) => (
          <li
            key={`legend-${l.tone}-${l.label}`}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden
              className={`inline-block h-2.5 w-2.5 rounded-sm ${toneDot[l.tone]}`}
            />
            <span className="text-foreground/80">{l.label}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <div className="rounded-md border border-dashed border-primary/25 bg-muted/20 px-3 py-4 text-[11px] text-muted-foreground">
            No JSON snippet shown in this step. Snippets begin at the linking
            step.
          </div>
        ) : (
          blocks.map((block) => (
            <BlockPanel
              key={`preview-block-${block.id}`}
              block={block}
              step={step}
              stepLabel={stepLabel}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BlockPanel({
  block,
  step,
  stepLabel,
}: {
  block: PreviewBlock;
  step: StepId;
  stepLabel: string;
}) {
  const snippet =
    block.id === 'linking' || block.id === 'place' || block.id === 'georef'
      ? linkingSnippetForStep(step, block.payload)
      : block.payload;
  const json = JSON.stringify(snippet, null, 2);
  const lines = json.split('\n');
  const seenLines = new Map<string, number>();
  const lineRows = lines.map((line, lineNumber) => {
    const lineKey = line || 'blank';
    const duplicateCount = seenLines.get(lineKey) ?? 0;
    seenLines.set(lineKey, duplicateCount + 1);
    return {
      key: `${lineKey.slice(0, 24)}-${duplicateCount}`,
      line,
      lineNumber,
    };
  });

  const importantLineIndices = new Set<number>();
  lines.forEach((line, i) => {
    const isTextSpottingLine =
      block.id === 'text' &&
      (line.includes('"motivation"') ||
        line.includes('"body"') ||
        line.includes('"target"'));
    const isIconographyLine =
      block.id === 'icon' &&
      (line.includes('"motivation"') ||
        line.includes('"body"') ||
        line.includes('"target"'));
    const isTargetLine = line.includes('"target"');
    const isSelectionInsert =
      line.includes('"selecting"') ||
      line.includes('"selector"') ||
      line.includes('"PointSelector"');
    const isExternalInsert =
      line.includes('"identifying"') ||
      line.includes('"geotagging"') ||
      line.includes('"coordinates"') ||
      line.includes('"glob_id"');

    if (
      isTextSpottingLine ||
      isIconographyLine ||
      isTargetLine ||
      ((step === 'anchor' || step === 'thesaurus' || step === 'future') &&
        isSelectionInsert) ||
      ((step === 'thesaurus' || step === 'future') && isExternalInsert)
    ) {
      importantLineIndices.add(i);
    }
  });

  return (
    <article
      className={`rounded-md border ${toneBorder[block.tone]} ${toneBg[block.tone]}`}
      aria-label={`${block.label} at step ${stepLabel}`}
    >
      <header className="flex items-center gap-2 px-3 py-1.5 border-b border-current/10">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-sm ${toneDot[block.tone]}`}
        />
        <h3 className="text-[11px] font-medium tracking-wide uppercase text-primary">
          {block.label}
        </h3>
      </header>
      <div className="px-3 pt-2 pb-1 border-b border-current/10 text-[10.5px] text-muted-foreground">
        Real data only: textspotting and iconography show their full JSON
        records; later steps show the real target array and body insertions.
      </div>
      <pre className="text-[10.5px] leading-snug font-mono p-3 overflow-x-auto bg-[hsl(var(--background)/0.25)]">
        {lineRows.map((row) => (
          <div
            key={`json-line-${block.id}-${step}-${row.key}`}
            className={
              importantLineIndices.has(row.lineNumber)
                ? 'border-l-2 border-[hsl(var(--chart-1))] -ml-3 pl-[10px] bg-[hsl(var(--chart-1)/0.1)]'
                : ''
            }
          >
            {row.line || ' '}
          </div>
        ))}
      </pre>

      {block.id === 'linking' ? <LinkingSummary step={step} /> : null}
      {block.id === 'place' ? <ThesaurusSummary /> : null}
      {block.id === 'georef' ? <GeorefSummary /> : null}
    </article>
  );
}

function JsonLdGuide({ step }: { step: StepId }) {
  const stepLabel = STEPS.find((s) => s.id === step)?.label ?? step;
  return (
    <section className="mb-3 rounded-md border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)] p-3">
      <h3 className="text-[11px] font-semibold tracking-wide uppercase text-primary">
        JSON-LD Structure At This Step
      </h3>
      <p className="mt-1 text-[11px] text-foreground/80 leading-relaxed">
        Step <strong>{stepLabel}</strong>: {stepFocus(step)}
      </p>
      <p className="mt-1 text-[10.5px] text-muted-foreground leading-relaxed">
        Highlighted lines mark only the relevant real snippet parts discussed in
        this workflow.
      </p>
    </section>
  );
}

function linkingSnippetForStep(
  step: StepId,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const targetList = Array.isArray(payload.target) ? payload.target : [];

  const body = Array.isArray(payload.body)
    ? (payload.body as Array<Record<string, unknown>>)
    : [];

  const selecting = body.find((entry) => entry.purpose === 'selecting');
  const identifying = body.find((entry) => entry.purpose === 'identifying');
  const geotagging = body.find((entry) => entry.purpose === 'geotagging');

  const snippet: Record<string, unknown> = {
    target: targetList,
  };

  if (step === 'anchor' || step === 'thesaurus' || step === 'future') {
    snippet.body = selecting ? [selecting] : [];
  }

  if (step === 'thesaurus' || step === 'future') {
    snippet.body = [selecting, identifying, geotagging].filter(Boolean);
  }

  return snippet;
}

function LinkingSummary({ step }: { step: StepId }) {
  if (step === 'link') {
    return (
      <section className="border-t border-current/10 px-3 py-2 text-[11px]">
        <h4 className="font-medium text-primary uppercase tracking-wide text-[10.5px]">
          Target Order
        </h4>
        <p className="mt-1 text-foreground/85">1. textspotting annotation ID</p>
        <p className="text-foreground/85">2. iconography annotation ID</p>
      </section>
    );
  }

  if (step === 'anchor') {
    return (
      <section className="border-t border-current/10 px-3 py-2 text-[11px]">
        <h4 className="font-medium text-primary uppercase tracking-wide text-[10.5px]">
          Point Update
        </h4>
        <p className="mt-1 text-foreground/85">
          The linking body now includes a selecting resource with PointSelector
          ({ANCHOR_XY.x}, {ANCHOR_XY.y}).
        </p>
      </section>
    );
  }

  if (step === 'thesaurus' || step === 'future') {
    return (
      <section className="border-t border-current/10 px-3 py-2 text-[11px]">
        <h4 className="font-medium text-primary uppercase tracking-wide text-[10.5px]">
          Thesaurus Update
        </h4>
        <p className="mt-1 text-foreground/85">
          Identifying and geotagging resources are added from the linked
          thesaurus place.
        </p>
      </section>
    );
  }

  return null;
}

function ThesaurusSummary() {
  const { prefNames, altNames } = formatNames();

  return (
    <section className="border-t border-current/10 px-3 py-2 text-[11px]">
      <h4 className="font-medium text-primary uppercase tracking-wide text-[10.5px]">
        Thesaurus Linkage
      </h4>
      <p className="mt-1 text-foreground/80">
        This place entry contributes thesaurus identity fields used by linking
        and geotagging bodies.
      </p>
      <p className="mt-1 text-foreground/85">
        Preferred: {prefNames.join(', ') || 'None'}
      </p>
      <p className="text-foreground/85">
        Alternative: {altNames.join(', ') || 'None'}
      </p>
      <p className="text-muted-foreground mt-1">
        GLOB ID: {PLACE_PONNANI.glob_id}
      </p>
    </section>
  );
}

function GeorefSummary() {
  return (
    <section className="border-t border-current/10 px-3 py-2 text-[11px]">
      <h4 className="font-medium text-primary uppercase tracking-wide text-[10.5px]">
        Georeference Candidate
      </h4>
      <p className="mt-1 text-foreground/85">
        This step defines one control pair: canvas point ({ANCHOR_XY.x},{' '}
        {ANCHOR_XY.y}) to longitude/latitude ({PLACE_COORDINATES[0]},{' '}
        {PLACE_COORDINATES[1]}).
      </p>
      <p className="mt-1 text-muted-foreground">
        The map panel shows current OSM context with a transparent historical
        snippet and links to the existing Allmaps georeferenced map. It is not a
        final warp for this single anchor.
      </p>
    </section>
  );
}
