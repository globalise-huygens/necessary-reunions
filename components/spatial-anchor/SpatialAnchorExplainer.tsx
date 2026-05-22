'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnnotationPreview } from './AnnotationPreview';
import { STEPS } from './data';
import { MapCrop } from './MapCrop';
import { WorkflowStepper } from './WorkflowStepper';

export function SpatialAnchorExplainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const goPrev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1)),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  const goToAnchor = useCallback(() => {
    const anchorIdx = STEPS.findIndex((s) => s.id === 'anchor');
    setStepIndex((i) => Math.max(i, anchorIdx));
  }, []);

  return (
    <div className="h-full bg-[hsl(45_40%_94%)]">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-2 overflow-hidden px-2 py-2 sm:px-3 sm:py-3 md:px-5 md:py-5">
        <span className="sr-only" role="status" aria-live="polite">
          Active step: {step.title}.
        </span>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)_4rem]">
          <MapCrop step={step.id} onPlaceAnchor={goToAnchor} />
          <AnnotationPreview step={step.id} />
          <WorkflowStepper
            stepIndex={stepIndex}
            onSelect={setStepIndex}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
      </div>
    </div>
  );
}
