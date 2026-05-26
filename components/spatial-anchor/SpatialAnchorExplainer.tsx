'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnnotationPreview } from './AnnotationPreview';
import { STEPS } from './data';
import { MapCrop } from './MapCrop';
import { WorkflowStepper } from './WorkflowStepper';

export function SpatialAnchorExplainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const initialStep = STEPS[0];

  if (!initialStep) {
    return null;
  }

  const step = STEPS[stepIndex] ?? initialStep;

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
    <div className="bg-[hsl(45_40%_94%)] xl:h-full">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 overflow-visible px-3 py-3 md:px-5 md:py-5 xl:h-full xl:min-h-0 xl:overflow-hidden">
        <span className="sr-only" role="status" aria-live="polite">
          Active step: {step.title}.
        </span>

        <div className="grid grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)_6.5rem]">
          <div className="order-1">
            <MapCrop step={step.id} onPlaceAnchor={goToAnchor} />
          </div>
          <div className="order-3 xl:order-2 xl:min-h-0">
            <AnnotationPreview step={step.id} />
          </div>
          <div className="order-2 xl:order-3">
            <WorkflowStepper
              stepIndex={stepIndex}
              onSelect={setStepIndex}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
