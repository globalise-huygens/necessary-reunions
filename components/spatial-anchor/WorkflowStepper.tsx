'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../shared/Button';
import { STEPS } from './data';

interface WorkflowStepperProps {
  stepIndex: number;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function WorkflowStepper({
  stepIndex,
  onSelect,
  onPrev,
  onNext,
}: WorkflowStepperProps) {
  return (
    <section
      aria-labelledby="workflow-heading"
      className="rounded-2xl border border-primary/20 bg-card/90 shadow-sm p-2 xl:flex xl:flex-col xl:items-center xl:justify-between"
    >
      <header className="px-1 py-1 text-center xl:text-left">
        <h2
          id="workflow-heading"
          className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground"
        >
          Poster flow
        </h2>
        <p className="mt-0.5 text-[11px] font-medium text-primary max-w-[10rem] xl:max-w-[11rem]">
          {STEPS[stepIndex]?.label}
        </p>
      </header>

      <ol
        role="list"
        className="flex flex-row justify-center gap-2 overflow-x-auto xl:flex-col xl:overflow-visible"
      >
        {STEPS.map((step, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <li key={`workflow-step-${step.id}`}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${i + 1}. ${step.label}`}
                title={step.label}
                className={[
                  'group inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card',
                  isActive
                    ? 'border-[hsl(12_70%_50%)] bg-[hsl(12_70%_50%)] text-white shadow-sm'
                    : isDone
                      ? 'border-[hsl(173_58%_39%)] bg-[hsl(173_58%_39%)] text-white'
                      : 'border-primary/25 bg-card text-muted-foreground hover:border-primary/50 hover:text-primary',
                ].join(' ')}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex items-center justify-center gap-2 xl:mt-0 xl:flex-col">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={stepIndex === 0}
          aria-label="Previous step"
          title="Previous"
          className="h-9 w-9 p-0"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={stepIndex === STEPS.length - 1}
          aria-label="Next step"
          title="Next"
          className="h-9 w-9 p-0"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
